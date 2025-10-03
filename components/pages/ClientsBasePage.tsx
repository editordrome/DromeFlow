import React, { useEffect, useMemo, useState } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { Icon } from '../ui/Icon';
import UnitClientModal from '../ui/UnitClientModal';
import { UnitClient } from '../../types';
import { listUnitClients, createUnitClient, updateUnitClient, deleteUnitClient } from '../../services/data/clientsDirectory.service';

const ClientsBasePage: React.FC = () => {
  const { selectedUnit } = useAppContext();
  const unitId = selectedUnit?.id || '';
  const [items, setItems] = useState<UnitClient[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const [draft, setDraft] = useState<Partial<UnitClient>>({ nome: '', tipo: '', endereco: '', contato: '' });
  const [selected, setSelected] = useState<UnitClient | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const canInteract = useMemo(() => Boolean(unitId), [unitId]);

  const load = async () => {
    if (!unitId) return;
    setIsLoading(true);
    setError(null);
    try {
      const { items, total } = await listUnitClients(unitId, q, page, pageSize);
      setItems(items);
      setTotal(total);
    } catch (e: any) {
      setError(e?.message || 'Falha ao carregar clientes.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, [unitId, q, page, pageSize]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unitId) return;
    if (!draft.nome || !draft.nome.trim()) return;
    try {
      await createUnitClient(unitId, {
        nome: draft.nome!.trim(),
        tipo: draft.tipo || null,
        endereco: draft.endereco || null,
        contato: draft.contato || null,
      } as any);
      setDraft({ nome: '', tipo: '', endereco: '', contato: '' });
      setIsCreating(false);
      await load();
    } catch (e: any) {
      alert(e?.message || 'Falha ao criar cliente');
    }
  };

  const openModal = (item: UnitClient) => {
    setSelected(item);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este cliente do cadastro da unidade?')) return;
    try {
      await deleteUnitClient(id);
      await load();
    } catch (e: any) {
      alert(e?.message || 'Falha ao excluir');
    }
  };

  return (
    <div className="p-6 bg-bg-secondary rounded-lg shadow-md">
      <div className="grid grid-cols-[auto,1fr,auto] items-center gap-3 mb-4">
        <h1 className="text-2xl font-bold text-text-primary">Clientes • Base</h1>
        <div className="flex justify-center">
          <input
            placeholder="Buscar por nome"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            className="w-full max-w-md px-3 py-2 border rounded-md bg-bg-secondary border-border-secondary focus:ring-accent-primary focus:border-accent-primary"
          />
        </div>
        {canInteract && (
          <button
            onClick={() => setIsCreating((v) => !v)}
            className="justify-self-end flex items-center px-4 py-2 text-sm font-medium text-white rounded-md bg-accent-primary hover:bg-accent-secondary"
          >
            <Icon name={isCreating ? 'close' : 'add'} className="w-5 h-5 mr-2" />
            {isCreating ? 'Cancelar' : 'Novo Cliente'}
          </button>
        )}
      </div>

      {isCreating && (
        <form onSubmit={handleCreate} className="mb-4 grid grid-cols-1 md:grid-cols-4 gap-3 bg-bg-tertiary/30 p-3 rounded-md border border-border-secondary">
          <input required placeholder="Nome" value={draft.nome || ''} onChange={(e)=>setDraft(d=>({...d, nome: e.target.value}))} className="px-3 py-2 border rounded-md bg-bg-secondary border-border-secondary focus:ring-accent-primary focus:border-accent-primary" />
          <input placeholder="Tipo" value={draft.tipo || ''} onChange={(e)=>setDraft(d=>({...d, tipo: e.target.value}))} className="px-3 py-2 border rounded-md bg-bg-secondary border-border-secondary focus:ring-accent-primary focus:border-accent-primary" />
          <input placeholder="Endereço" value={draft.endereco || ''} onChange={(e)=>setDraft(d=>({...d, endereco: e.target.value}))} className="px-3 py-2 border rounded-md bg-bg-secondary border-border-secondary focus:ring-accent-primary focus:border-accent-primary" />
          <input placeholder="Contato" value={draft.contato || ''} onChange={(e)=>setDraft(d=>({...d, contato: e.target.value}))} className="px-3 py-2 border rounded-md bg-bg-secondary border-border-secondary focus:ring-accent-primary focus:border-accent-primary" />
          <div className="md:col-span-4 flex justify-end gap-2">
            <button type="button" onClick={()=>{setIsCreating(false); setDraft({ nome:'', tipo:'', endereco:'', contato:''});}} className="px-4 py-2 text-sm font-medium border rounded-md text-text-secondary border-border-secondary hover:bg-bg-tertiary">Cancelar</button>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white rounded-md bg-accent-primary hover:bg-accent-secondary">Salvar</button>
          </div>
        </form>
      )}

      {isLoading ? (
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
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left uppercase text-text-secondary">Nome</th>
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left uppercase text-text-secondary">Tipo</th>
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left uppercase text-text-secondary">Contato</th>
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-right uppercase text-text-secondary">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-bg-secondary divide-y divide-border-primary">
              {items.map((it) => (
                <tr key={it.id} className="transition-colors hover:bg-bg-tertiary cursor-pointer" onDoubleClick={() => openModal(it)}>
                  <td className="px-6 py-3 whitespace-nowrap text-sm">{it.nome}</td>
                  <td className="px-6 py-3 whitespace-nowrap text-sm">{it.tipo || '-'}</td>
                  <td className="px-6 py-3 whitespace-nowrap text-sm">{it.contato || '-'}</td>
                  <td className="px-6 py-3 whitespace-nowrap text-sm text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openModal(it)} className="px-2 py-1 rounded-md text-text-secondary hover:bg-bg-tertiary" title="Abrir"><Icon name="ExternalLink" className="w-5 h-5" /></button>
                      <button onClick={()=>handleDelete(it.id)} className="p-2 rounded-md text-danger hover:bg-danger/10" title="Excluir"><Icon name="delete" className="w-5 h-5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td className="px-6 py-6 text-center text-sm text-text-secondary" colSpan={4}>Nenhum cliente cadastrado.</td>
                </tr>
              )}
            </tbody>
          </table>
          {/* Paginação */}
          <div className="flex items-center justify-between mt-3 text-sm text-text-secondary">
            <div>
              {total > 0 && (
                <span>Mostrando {(items.length>0?((page-1)*pageSize+1):0)}–{(page-1)*pageSize + items.length} de {total}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))} className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-bg-tertiary">Anterior</button>
              <span>Página {page}</span>
              <button disabled={(page*pageSize)>=total} onClick={()=>setPage(p=>p+1)} className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-bg-tertiary">Próxima</button>
            </div>
          </div>
        </div>
      )}
      {/* Modal de Detalhe/Edição */}
      <UnitClientModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        item={selected}
        onSaved={async () => { setIsModalOpen(false); await load(); }}
        onDeleted={async () => { setIsModalOpen(false); await load(); }}
      />
    </div>
  );
};

export default ClientsBasePage;
