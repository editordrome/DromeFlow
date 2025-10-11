import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { UserRole } from '../../types';
import { listUnitKeysColumns, addUnitKeysColumn, renameUnitKeysColumn, dropUnitKeysColumn, ColumnInfo, getUnitKeysColumnsStats, fetchUnitsBasic, fetchUnitKeysValuesFor, UnitKeyValueRow, updateUnitKeyValueById } from '../../services/units/unitKeysAdmin.service';
import { Icon } from '../ui/Icon';

const TYPES_PRESET = [
  'text',
  'varchar(50)',
  'varchar(100)',
  'varchar(255)',
  'boolean',
  'integer',
  'numeric(10,2)',
  'date',
  'timestamp',
  'timestamptz',
];

const RESERVED = new Set(['id','unit_id','created_at','updated_at','is_active']);

const UnitKeysPage: React.FC = () => {
  const { profile } = useAuth();
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [stats, setStats] = useState<Record<string, { usage_count: number; active_count: number }>>({});
  const [isValuesOpen, setIsValuesOpen] = useState<null | { column: string; rows: Array<{ unit_name: string; unit_code: string; value: any }> }>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState<null | { oldName: string }>(null);

  const canManage = profile?.role === UserRole.SUPER_ADMIN;

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const [data, s] = await Promise.all([
        listUnitKeysColumns(false),
        getUnitKeysColumnsStats(false)
      ]);
      setColumns(data);
      const m: Record<string, { usage_count: number; active_count: number }> = {};
      (s || []).forEach(it => { m[it.column_name] = { usage_count: it.usage_count, active_count: it.active_count }; });
      setStats(m);
    } catch (e:any) {
      setError(e.message || 'Falha ao carregar colunas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (payload: { name: string; type: string; nullable: boolean; def: string }) => {
    if (!profile || !canManage) return;
    const name = payload.name.trim();
    if (!name) { alert('Informe um nome de coluna.'); return; }
    if (!/^[_a-zA-Z][_a-zA-Z0-9]*$/.test(name)) { alert('Nome inválido. Use letras, números e _.'); return; }
    if (RESERVED.has(name)) { alert('Nome reservado.'); return; }
    try {
      await addUnitKeysColumn(profile, name, payload.type, payload.nullable, payload.def ? payload.def : null);
      setIsAddOpen(false);
      await load();
    } catch (e:any) {
      alert(e.message || 'Falha ao adicionar coluna');
    }
  };

  const handleRename = async (oldName: string, newName: string) => {
    if (!profile || !canManage) return;
    if (!newName) return;
    if (!/^[_a-zA-Z][_a-zA-Z0-9]*$/.test(newName)) { alert('Nome inválido.'); return; }
    if (RESERVED.has(oldName)) { alert('Coluna reservada não pode ser renomeada.'); return; }
    try {
      await renameUnitKeysColumn(profile, oldName, newName);
      setIsRenameOpen(null);
      await load();
    } catch (e:any) {
      alert(e.message || 'Falha ao renomear');
    }
  };

  const handleDrop = async (name: string) => {
    if (!profile || !canManage) return;
    if (RESERVED.has(name)) { alert('Coluna reservada não pode ser removida.'); return; }
    if (!confirm(`Excluir coluna ${name}? Esta ação é irreversível.`)) return;
    try {
      await dropUnitKeysColumn(profile, name);
      await load();
    } catch (e:any) {
      alert(e.message || 'Falha ao excluir');
    }
  };

  if (!canManage) {
    return <div className="p-4"><p className="text-sm text-gray-500">Acesso restrito. Apenas super_admin pode gerenciar colunas de unit_keys.</p></div>;
  }

  return (
    <div className="p-6 bg-bg-secondary rounded-lg shadow-md">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Keys (unit_keys)</h1>
        {canManage && (
          <button onClick={() => setIsAddOpen(true)} className="flex items-center px-4 py-2 text-sm font-medium text-white rounded-md bg-accent-primary hover:bg-accent-secondary">
            <Icon name="add" className="w-5 h-5 mr-2" />
            Adicionar Coluna
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-16 h-16 border-4 border-t-4 border-gray-200 rounded-full animate-spin border-t-accent-primary"></div>
        </div>
      ) : error ? (
        <div className="p-4 text-danger bg-danger/10 border border-danger/30 rounded-md">{error}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border-primary">
            <thead className="bg-bg-tertiary">
              <tr>
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left uppercase text-text-secondary">Pos</th>
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left uppercase text-text-secondary">Nome</th>
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left uppercase text-text-secondary">Tipo</th>
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left uppercase text-text-secondary">UNID</th>
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-right uppercase text-text-secondary">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-bg-secondary divide-y divide-border-primary">
              {columns.map((c) => {
                const isReserved = RESERVED.has(c.column_name);
                return (
                  <tr key={c.column_name} className={`transition-colors ${isReserved ? 'opacity-70' : ''} hover:bg-bg-tertiary cursor-pointer`}
                      onClick={async () => {
                        try {
                          // Buscar apenas valores existentes para a coluna e mapear para unidades correspondentes
                          const [units, values] = await Promise.all([
                            fetchUnitsBasic(),
                            fetchUnitKeysValuesFor(c.column_name),
                          ]);
                          const unitById = new Map(units.map(u => [u.id, u] as const));
                          const rows = values
                            .filter(v => v.value !== null && v.value !== undefined)
                            .map(v => {
                              const u = unitById.get(v.unit_id);
                              if (!u) return null;
                              return { rowId: v.id, unit_id: v.unit_id, unit_name: u.unit_name, unit_code: u.unit_code, value: v.value };
                            })
                            .filter(Boolean) as Array<{ rowId: string; unit_id: string; unit_name: string; unit_code: string; value: any }>;
                          setIsValuesOpen({ column: c.column_name, rows });
                        } catch (e:any) {
                          alert(e.message || 'Falha ao carregar valores por unidade');
                        }
                      }}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">{c.ordinal_position}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-text-primary">{c.column_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">{c.data_type}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">{stats[c.column_name]?.usage_count ?? 0}</td>
                    <td className="px-6 py-4 text-sm font-medium text-right whitespace-nowrap">
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          onClick={() => setIsRenameOpen({ oldName: c.column_name })}
                          disabled={!canManage || isReserved}
                          className="p-2 rounded-md text-accent-primary hover:bg-accent-primary/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          title={isReserved ? 'Coluna reservada' : 'Renomear'}
                        >
                          <Icon name="edit" className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDrop(c.column_name)}
                          disabled={!canManage || isReserved}
                          className="p-2 rounded-md text-danger hover:bg-danger/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          title={isReserved ? 'Coluna reservada' : 'Excluir'}
                        >
                          <Icon name="delete" className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {isAddOpen && (
        <AddColumnModal
          onClose={() => setIsAddOpen(false)}
          onSave={(data) => handleAdd(data)}
        />
      )}

      {isRenameOpen && (
        <RenameColumnModal
          oldName={isRenameOpen.oldName}
          onClose={() => setIsRenameOpen(null)}
          onSave={(newName) => handleRename(isRenameOpen.oldName, newName)}
        />
      )}

      {isValuesOpen && (
        <ValuesByUnitModal
          column={isValuesOpen.column}
          rows={isValuesOpen.rows}
          onClose={() => setIsValuesOpen(null)}
        />
      )}
    </div>
  );
};

export default UnitKeysPage;

const AddColumnModal: React.FC<{
  onClose: () => void;
  onSave: (data: { name: string; type: string; nullable: boolean; def: string }) => void;
}> = ({ onClose, onSave }) => {
  const [name, setName] = useState('');
  const [type, setType] = useState(TYPES_PRESET[0]);
  const [nullable, setNullable] = useState(true);
  const [def, setDef] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) { setError('Informe um nome.'); return; }
    setError('');
    onSave({ name, type, nullable, def });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" aria-modal="true" role="dialog" onMouseDown={onClose}>
      <div className="w-full max-w-lg p-6 mx-4 bg-bg-secondary rounded-lg shadow-lg" onMouseDown={(e)=>e.stopPropagation()}>
        <div className="flex items-center justify-between pb-3 border-b border-border-primary">
          <h2 className="text-xl font-bold text-text-primary">Adicionar Coluna</h2>
          <button onClick={onClose} className="p-1 rounded-full text-text-secondary hover:bg-bg-tertiary">
            <Icon name="close" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {error && <p className="text-sm text-center text-danger bg-danger/10 p-2 rounded-md">{error}</p>}
          <div>
            <label className="block text-sm font-medium text-text-secondary">Nome</label>
            <input value={name} onChange={(e)=>setName(e.target.value)} placeholder="ex: umbler2" className="w-full px-3 py-2 mt-1 border rounded-md bg-bg-secondary border-border-secondary focus:ring-accent-primary focus:border-accent-primary" />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary">Tipo</label>
            <select value={type} onChange={(e)=>setType(e.target.value)} className="w-full px-3 py-2 mt-1 border rounded-md bg-bg-secondary border-border-secondary focus:ring-accent-primary focus:border-accent-primary">
              {TYPES_PRESET.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center text-sm text-text-primary">
              <input type="checkbox" checked={nullable} onChange={(e)=>setNullable(e.target.checked)} className="mr-2" /> Permitir nulo
            </label>
            <input value={def} onChange={(e)=>setDef(e.target.value)} placeholder="DEFAULT (opcional, ex: 'x')" className="flex-1 px-3 py-2 border rounded-md bg-bg-secondary border-border-secondary focus:ring-accent-primary focus:border-accent-primary" />
          </div>
          <div className="flex justify-end pt-4 space-x-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium border rounded-md text-text-secondary border-border-secondary hover:bg-bg-tertiary">Cancelar</button>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md bg-accent-primary hover:bg-accent-secondary">Salvar</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Modal com os valores por unidade para a coluna selecionada
const ValuesByUnitModal: React.FC<{
  column: string;
  rows: Array<{ rowId: string; unit_id: string; unit_name: string; unit_code: string; value: any }>;
  onClose: () => void;
}> = ({ column, rows, onClose }) => {
  const [query, setQuery] = useState('');
  const [localRows, setLocalRows] = useState(rows);

  useEffect(() => { setLocalRows(rows); }, [rows]);

  const q = query.toLowerCase();
  const filtered = localRows.filter(r =>
    r.unit_name.toLowerCase().includes(q) || r.unit_code.toLowerCase().includes(q)
  );

  const handleChange = (rowId: string, value: string) => {
    setLocalRows(prev => prev.map(r => r.rowId === rowId ? { ...r, value } : r));
  };

  const handleSave = async (rowId: string, value: any) => {
    try {
      await updateUnitKeyValueById(rowId, column, value ?? null);
    } catch (e:any) {
      alert(e.message || 'Falha ao salvar valor');
    }
  };

  const handleDelete = async (rowId: string) => {
    const ok = confirm('Remover esta key desta unidade? Esta ação não pode ser desfeita.');
    if (!ok) return;
    try {
      await updateUnitKeyValueById(rowId, column, null);
      // Remover a linha do estado (agora a unidade deixa de ter a key)
      setLocalRows(prev => prev.filter(r => r.rowId !== rowId));
    } catch (e:any) {
      alert(e.message || 'Falha ao excluir key');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onMouseDown={onClose}>
      <div className="w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden rounded-lg shadow-lg bg-bg-secondary border border-border-primary" onMouseDown={(e)=>e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border-primary">
          <h3 className="text-lg font-semibold text-text-primary">Valores por Unidade — {column}</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-bg-tertiary text-text-secondary"><Icon name="close" /></button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <input
            type="text"
            value={query}
            onChange={(e)=>setQuery(e.target.value)}
            placeholder="Buscar por unidade ou code..."
            className="mb-3 w-full px-3 py-2 border rounded-md bg-bg-secondary border-border-secondary focus:ring-accent-primary focus:border-accent-primary"
          />
          <table className="min-w-full divide-y divide-border-primary">
            <thead className="bg-bg-tertiary">
              <tr>
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left uppercase text-text-secondary">Unidade</th>
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left uppercase text-text-secondary">Code</th>
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left uppercase text-text-secondary">Key (editar)</th>
                <th className="px-3 py-3 text-xs font-medium tracking-wider text-right uppercase text-text-secondary"></th>
              </tr>
            </thead>
            <tbody className="bg-bg-secondary divide-y divide-border-primary">
              {filtered.map((r) => (
                <tr key={r.rowId} className="transition-colors">
                  <td className="px-6 py-3 text-sm text-text-primary">{r.unit_name}</td>
                  <td className="px-6 py-3 text-sm text-text-secondary">{r.unit_code}</td>
                  <td className="px-6 py-3 text-sm text-text-secondary">
                    <input
                      type="text"
                      value={r.value ?? ''}
                      onChange={(e)=>handleChange(r.rowId, e.target.value)}
                      onBlur={()=>handleSave(r.rowId, r.value)}
                      onKeyDown={(e)=>{ if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                      className="w-full px-2 py-1 border rounded-md bg-bg-secondary border-border-secondary focus:ring-accent-primary focus:border-accent-primary"
                      placeholder="Defina a key desta unidade"
                    />
                  </td>
                  <td className="px-3 py-3 text-right align-middle">
                    <button
                      type="button"
                      className="p-2 rounded-md text-danger hover:bg-danger/10"
                      onClick={()=>handleDelete(r.rowId)}
                      title="Excluir key desta unidade"
                      aria-label="Excluir key"
                    >
                      <Icon name="delete" className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end p-4 border-t border-border-primary">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium border rounded-md text-text-secondary border-border-secondary hover:bg-bg-tertiary">Fechar</button>
        </div>
      </div>
    </div>
  );
};

const RenameColumnModal: React.FC<{
  oldName: string;
  onClose: () => void;
  onSave: (newName: string) => void;
}> = ({ oldName, onClose, onSave }) => {
  const [name, setName] = useState(oldName);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) { setError('Informe um nome.'); return; }
    setError('');
    onSave(name);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" aria-modal="true" role="dialog" onMouseDown={onClose}>
      <div className="w-full max-w-md p-6 mx-4 bg-bg-secondary rounded-lg shadow-lg" onMouseDown={(e)=>e.stopPropagation()}>
        <div className="flex items-center justify-between pb-3 border-b border-border-primary">
          <h2 className="text-xl font-bold text-text-primary">Renomear Coluna</h2>
          <button onClick={onClose} className="p-1 rounded-full text-text-secondary hover:bg-bg-tertiary">
            <Icon name="close" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {error && <p className="text-sm text-center text-danger bg-danger/10 p-2 rounded-md">{error}</p>}
          <div>
            <label className="block text-sm font-medium text-text-secondary">Novo nome</label>
            <input value={name} onChange={(e)=>setName(e.target.value)} className="w-full px-3 py-2 mt-1 border rounded-md bg-bg-secondary border-border-secondary focus:ring-accent-primary focus:border-accent-primary" />
          </div>
          <div className="flex justify-end pt-4 space-x-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium border rounded-md text-text-secondary border-border-secondary hover:bg-bg-tertiary">Cancelar</button>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md bg-accent-primary hover:bg-accent-secondary">Salvar</button>
          </div>
        </form>
      </div>
    </div>
  );
};
