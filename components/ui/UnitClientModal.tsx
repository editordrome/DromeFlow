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
      <p className="text-xs font-medium text-text-secondary mb-1.5">{label}</p>
      <p className="text-sm text-text-primary break-words">{value || <span className="text-text-tertiary">-</span>}</p>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-xl bg-bg-secondary shadow-2xl overflow-hidden" onClick={(e)=>e.stopPropagation()}>
        {/* Header compacto com gradiente */}
        <div className="relative bg-gradient-to-r from-accent-primary/5 to-brand-cyan/5 border-b border-border-secondary px-5 py-3.5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-text-primary truncate" title={item.nome}>
                {item.nome}
              </h2>
              <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                <Icon name="User" className="w-3.5 h-3.5" />
                <span>Cliente da Unidade</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {activeTab === 'dados' && !isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  disabled={busy !== 'idle'}
                  className="rounded-lg p-1.5 text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors disabled:opacity-50"
                  aria-label="Editar"
                  title="Editar dados"
                >
                  <Icon name="Edit" className="w-4 h-4" />
                </button>
              )}
              {activeTab === 'dados' && isEditing && (
                <>
                  <button
                    onClick={() => setIsEditing(false)}
                    disabled={busy !== 'idle'}
                    className="rounded-lg p-1.5 text-danger hover:bg-danger/10 transition-colors disabled:opacity-50"
                    aria-label="Cancelar"
                    title="Cancelar edição"
                  >
                    <Icon name="X" className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={busy !== 'idle'}
                    className="rounded-lg p-1.5 text-success-color hover:bg-success-color/10 transition-colors disabled:opacity-50"
                    aria-label="Salvar"
                    title="Salvar alterações"
                  >
                    {busy === 'saving' ? (
                      <div className="w-4 h-4 border-2 border-text-tertiary/30 border-t-text-tertiary rounded-full animate-spin"></div>
                    ) : (
                      <Icon name="Check" className="w-4 h-4" />
                    )}
                  </button>
                </>
              )}
              <button 
                onClick={onClose} 
                className="rounded-lg p-1.5 text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors" 
                aria-label="Fechar"
              >
                <Icon name="X" className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-border-secondary bg-bg-tertiary/30">
          <div className="flex items-center px-5">
            <button 
              className={`px-4 py-3 text-sm font-medium transition-colors ${activeTab==='dados' ? 'text-accent-primary border-b-2 border-accent-primary' : 'text-text-secondary hover:text-text-primary'}`} 
              onClick={() => setActiveTab('dados')}
            >
              Dados
            </button>
            <button 
              className={`px-4 py-3 text-sm font-medium transition-colors ${activeTab==='atendimentos' ? 'text-accent-primary border-b-2 border-accent-primary' : 'text-text-secondary hover:text-text-primary'}`} 
              onClick={() => setActiveTab('atendimentos')}
            >
              Atendimentos
            </button>
            {activeTab === 'atendimentos' && (
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-md p-1.5 text-text-secondary hover:bg-bg-tertiary transition-colors"
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
                >
                  <Icon name="ChevronLeft" className="w-4 h-4" />
                </button>
                <span className="text-xs text-text-secondary min-w-[140px] text-center font-medium">
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
                  className="rounded-md p-1.5 text-text-secondary hover:bg-bg-tertiary transition-colors"
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
                >
                  <Icon name="ChevronRight" className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Body com scroll */}
        <div className="max-h-[65vh] overflow-y-auto px-5 py-4">
          {activeTab === 'dados' ? (
            !isEditing ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Row label="Nome" value={item.nome} />
                <Row label="Tipo" value={item.tipo} />
                <Row label="Endereço" value={item.endereco} />
                <Row label="Contato" value={item.contato} />
              </div>
            ) : (
              <div className="space-y-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-text-secondary">Nome</span>
                  <input 
                    name="nome" 
                    value={form.nome || ''} 
                    onChange={handleChange} 
                    className="rounded-lg border border-border-secondary bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all" 
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-text-secondary">Tipo</span>
                  <input 
                    name="tipo" 
                    value={form.tipo || ''} 
                    onChange={handleChange} 
                    className="rounded-lg border border-border-secondary bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all" 
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-text-secondary">Endereço</span>
                  <input 
                    name="endereco" 
                    value={form.endereco || ''} 
                    onChange={handleChange} 
                    className="rounded-lg border border-border-secondary bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all" 
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-text-secondary">Contato</span>
                  <input 
                    name="contato" 
                    value={form.contato || ''} 
                    onChange={handleChange} 
                    className="rounded-lg border border-border-secondary bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all" 
                  />
                </label>
              </div>
            )
          ) : (
            <div className="overflow-auto border border-border-secondary rounded-lg">
              {historyLoading ? (
                <div className="flex items-center justify-center py-8 text-text-secondary text-sm">
                  <Icon name="Loader2" className="w-4 h-4 animate-spin mr-2" />
                  Carregando…
                </div>
              ) : (
                <table className="min-w-full text-sm">
                  <thead className="bg-bg-tertiary text-text-secondary">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium">Data</th>
                      <th className="px-3 py-2 text-left text-xs font-medium">Dia</th>
                      <th className="px-3 py-2 text-left text-xs font-medium">Profissional</th>
                      <th className="px-3 py-2 text-left text-xs font-medium">Pós-venda</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(!history || history.length===0) ? (
                      <tr><td colSpan={4} className="px-3 py-8 text-center text-text-secondary text-sm">Sem atendimentos registrados.</td></tr>
                    ) : (
                      history.map((h, idx) => (
                        <tr 
                          key={h.id || idx} 
                          className="border-t border-border-secondary/50 hover:bg-accent-primary/5 cursor-pointer transition-colors" 
                          onDoubleClick={async ()=>{
                            if (!h.id) return;
                            const rec = await fetchDataRecordById(h.id as number);
                            setDetailRecord(rec);
                            setDetailOpen(true);
                          }}
                          title="Duplo clique para ver detalhes"
                        >
                          <td className="px-3 py-2 text-text-primary">{h.DATA ? new Date(h.DATA + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}</td>
                          <td className="px-3 py-2 text-text-secondary">{h.DIA || '-'}</td>
                          <td className="px-3 py-2 text-text-primary">{h.PROFISSIONAL || '-'}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs ${
                              (h as any)['pos vendas'] === 'contatado' ? 'bg-success-color/20 text-success-color' :
                              (h as any)['pos vendas'] === 'pendente' ? 'bg-yellow-500/20 text-yellow-500' :
                              'text-text-tertiary'
                            }`}>
                              {(h as any)['pos vendas'] || '-'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>

        {/* Footer compacto */}
        <div className="flex items-center justify-between border-t border-border-secondary bg-bg-tertiary px-5 py-3">
          <div className="flex items-center gap-1 text-xs text-text-secondary">
            <Icon name="Info" className="w-3 h-3" />
            <span>Duplo clique para detalhes</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy !== 'idle'}
              className="rounded-lg border-2 border-danger/50 p-2 text-danger hover:bg-danger/10 focus:outline-none focus:ring-2 focus:ring-danger/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              title="Excluir cliente"
            >
              {busy === 'deleting' ? (
                <div className="w-4 h-4 border-2 border-danger/30 border-t-danger rounded-full animate-spin"></div>
              ) : (
                <Icon name="Trash2" className="w-4 h-4" />
              )}
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
