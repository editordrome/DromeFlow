import React, { useEffect, useState } from 'react';
import { UnitClient } from '../../types';
import { Icon } from './Icon';
import { updateUnitClient, deleteUnitClient } from '../../services/data/clientsDirectory.service';
import { fetchClientHistory } from '../../services/analytics/clients.service';
import DataDetailModal from './DataDetailModal';
import { fetchDataRecordById } from '../../services/data/dataTable.service';

interface UnitClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: UnitClient | null;
  onSaved?: (updated: UnitClient) => void;
  onDeleted?: (id: string) => void;
  unitCode: string;
  currentPeriod?: string; // YYYY-MM
}

const UnitClientModal: React.FC<UnitClientModalProps> = ({ isOpen, onClose, item, onSaved, onDeleted, unitCode, currentPeriod }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<Partial<UnitClient>>({});
  const [busy, setBusy] = useState<'idle' | 'saving' | 'deleting'>('idle');
  const [activeTab, setActiveTab] = useState<'dados' | 'atendimentos'>('dados');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [history, setHistory] = useState<Array<{ id?: number; DATA: string | null; DIA: string; PROFISSIONAL: string; 'pos vendas': string | null }>>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string | undefined>(currentPeriod);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRecord, setDetailRecord] = useState<any | null>(null);

  useEffect(() => {
    if (item) {
      setForm({ nome: item.nome, tipo: item.tipo, endereco: item.endereco, contato: item.contato });
      setIsEditing(false);
      setBusy('idle');
      setActiveTab('dados');
      setSelectedPeriod(currentPeriod);
    }
  }, [item, currentPeriod]);

  useEffect(() => {
    if (!isOpen || !item?.nome) return;
    setHistoryLoading(true);
    (async () => {
      try {
        const hist = await fetchClientHistory(unitCode, item.nome, 200, selectedPeriod);
        setHistory(hist || []);
      } finally {
        setHistoryLoading(false);
      }
    })();
  }, [isOpen, item?.nome, unitCode, selectedPeriod]);

  if (!isOpen || !item) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!item) return;
    setBusy('saving');
    try {
      const updated = await updateUnitClient(item.id, {
        nome: (form.nome || '').trim() || item.nome,
        tipo: (form.tipo ?? null) as any,
        endereco: (form.endereco ?? null) as any,
        contato: (form.contato ?? null) as any,
      });
      onSaved && onSaved(updated);
      setIsEditing(false);
    } catch (e: any) {
      alert(e?.message || 'Falha ao salvar');
    } finally {
      setBusy('idle');
    }
  };

  const handleDelete = async () => {
    if (!item) return;
    if (!confirm('Excluir este cliente do cadastro da unidade?')) return;
    setBusy('deleting');
    try {
      await deleteUnitClient(item.id);
      onDeleted && onDeleted(item.id);
      onClose();
    } catch (e: any) {
      alert(e?.message || 'Falha ao excluir');
    } finally {
      setBusy('idle');
    }
  };

  const Row: React.FC<{ label: string; value: React.ReactNode }>= ({ label, value }) => (
    <div>
      <p className="text-xs font-semibold uppercase text-text-secondary tracking-wider">{label}</p>
      <p className="text-sm text-text-primary break-words">{value || <span className="text-text-tertiary">-</span>}</p>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="w-full max-w-3xl mx-4 bg-bg-secondary rounded-lg shadow-lg" onClick={(e)=>e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-secondary">
          <h2 className="text-lg font-bold text-text-primary truncate" title={item.nome}>{item.nome}</h2>
          <button onClick={onClose} className="p-1 rounded text-text-secondary hover:bg-bg-tertiary"><Icon name="close" /></button>
        </div>

        <div className="px-4 pt-3">
          <div className="flex items-center gap-2 border-b border-border-secondary">
            <button className={`px-3 py-2 text-sm ${activeTab==='dados' ? 'text-accent-primary border-b-2 border-accent-primary' : 'text-text-secondary'}`} onClick={() => setActiveTab('dados')}>Dados</button>
            <button className={`px-3 py-2 text-sm ${activeTab==='atendimentos' ? 'text-accent-primary border-b-2 border-accent-primary' : 'text-text-secondary'}`} onClick={() => setActiveTab('atendimentos')}>Atendimentos</button>
            {activeTab === 'atendimentos' && (
              <div className="ml-auto flex items-center gap-2 py-2">
                <button
                  type="button"
                  className="px-2 py-1 rounded-md border border-border-secondary text-text-secondary hover:bg-bg-tertiary"
                  title="Mês anterior"
                  onClick={() => {
                    if (!selectedPeriod || !/^\d{4}-\d{2}$/.test(selectedPeriod)) return;
                    const [y, m] = selectedPeriod.split('-').map(Number);
                    const d = new Date(Date.UTC(y, m - 1, 1));
                    d.setUTCMonth(d.getUTCMonth() - 1);
                    const ny = d.getUTCFullYear();
                    const nm = d.getUTCMonth() + 1;
                    setSelectedPeriod(`${ny}-${String(nm).padStart(2, '0')}`);
                  }}
                >‹</button>
                <span className="text-xs text-text-secondary min-w-[140px] text-center">
                  {(() => {
                    const p = selectedPeriod;
                    if (!p || !/^\d{4}-\d{2}$/.test(p)) return '-';
                    const [yy, mm] = p.split('-').map(Number);
                    const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
                    return `${meses[Math.max(1, Math.min(12, mm)) - 1]} ${yy}`;
                  })()}
                </span>
                <button
                  type="button"
                  className="px-2 py-1 rounded-md border border-border-secondary text-text-secondary hover:bg-bg-tertiary"
                  title="Próximo mês"
                  onClick={() => {
                    if (!selectedPeriod || !/^\d{4}-\d{2}$/.test(selectedPeriod)) return;
                    const [y, m] = selectedPeriod.split('-').map(Number);
                    const d = new Date(Date.UTC(y, m - 1, 1));
                    d.setUTCMonth(d.getUTCMonth() + 1);
                    const ny = d.getUTCFullYear();
                    const nm = d.getUTCMonth() + 1;
                    const next = `${ny}-${String(nm).padStart(2, '0')}`;
                    if (currentPeriod && next > currentPeriod) return;
                    setSelectedPeriod(next);
                  }}
                >›</button>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 space-y-4">
          {activeTab === 'dados' ? (
            !isEditing ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Row label="Nome" value={item.nome} />
                <Row label="Tipo" value={item.tipo} />
                <Row label="Endereço" value={item.endereco} />
                <Row label="Contato" value={item.contato} />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-secondary">Nome</label>
                  <input name="nome" value={form.nome || ''} onChange={handleChange} className="mt-1 w-full px-3 py-2 rounded-md border bg-bg-secondary border-border-secondary focus:outline-none focus:ring-2 focus:ring-accent-primary" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary">Tipo</label>
                  <input name="tipo" value={form.tipo || ''} onChange={handleChange} className="mt-1 w-full px-3 py-2 rounded-md border bg-bg-secondary border-border-secondary focus:outline-none focus:ring-2 focus:ring-accent-primary" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary">Endereço</label>
                  <input name="endereco" value={form.endereco || ''} onChange={handleChange} className="mt-1 w-full px-3 py-2 rounded-md border bg-bg-secondary border-border-secondary focus:outline-none focus:ring-2 focus:ring-accent-primary" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary">Contato</label>
                  <input name="contato" value={form.contato || ''} onChange={handleChange} className="mt-1 w-full px-3 py-2 rounded-md border bg-bg-secondary border-border-secondary focus:outline-none focus:ring-2 focus:ring-accent-primary" />
                </div>
              </div>
            )
          ) : (
            <div className="overflow-auto border border-white/10 rounded-md">
              {historyLoading ? (
                <div className="p-4 text-sm text-text-secondary">Carregando…</div>
              ) : (
                <table className="min-w-full text-sm">
                  <thead className="bg-bg-tertiary text-text-secondary">
                    <tr>
                      <th className="px-3 py-2 text-left">Data</th>
                      <th className="px-3 py-2 text-left">Dia</th>
                      <th className="px-3 py-2 text-left">Profissional</th>
                      <th className="px-3 py-2 text-left">Pós-venda</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(!history || history.length===0) ? (
                      <tr><td colSpan={4} className="px-3 py-4 text-center text-text-secondary">Sem atendimentos registrados.</td></tr>
                    ) : (
                      history.map((h, idx) => (
                        <tr key={h.id || idx} className="border-t border-white/5 hover:bg-white/5 cursor-pointer" onDoubleClick={async ()=>{
                          if (!h.id) return;
                          const rec = await fetchDataRecordById(h.id as number);
                          setDetailRecord(rec);
                          setDetailOpen(true);
                        }}>
                          <td className="px-3 py-2">{h.DATA ? new Date(h.DATA + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}</td>
                          <td className="px-3 py-2">{h.DIA || '-'}</td>
                          <td className="px-3 py-2">{h.PROFISSIONAL || '-'}</td>
                          <td className="px-3 py-2">{(h as any)['pos vendas'] || '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-border-secondary">
          <button
            type="button"
            onClick={() => setIsEditing(e => !e)}
            className="px-3 py-2 text-sm rounded-md border border-border-secondary text-text-secondary hover:bg-bg-tertiary"
            disabled={busy !== 'idle'}
          >
            {isEditing ? 'Cancelar' : 'Editar'}
          </button>
          <div className="flex items-center gap-2">
            {isEditing && (
              <button
                type="button"
                onClick={handleSave}
                disabled={busy !== 'idle'}
                className="px-3 py-2 text-sm font-medium text-white rounded-md bg-accent-primary hover:bg-accent-secondary disabled:opacity-60"
              >
                {busy === 'saving' ? 'Salvando…' : 'Salvar'}
              </button>
            )}
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy !== 'idle'}
              className="px-3 py-2 text-sm rounded-md bg-danger/80 text-white hover:bg-danger disabled:opacity-60"
            >
              {busy === 'deleting' ? 'Excluindo…' : 'Excluir'}
            </button>
          </div>
        </div>
      </div>
      <DataDetailModal
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        record={detailRecord}
        onEdit={()=>{}}
        onDelete={()=>{}}
      />
    </div>
  );
};

export default UnitClientModal;
