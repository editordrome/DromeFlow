import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from './Icon';
import { UnitClient } from '../../types';
import { getUnitClientByName, updateUnitClient, updateClientNameInAppointments } from '../../services/data/clientsDirectory.service';
import DataDetailModal from './DataDetailModal';
import { fetchDataRecordById } from '../../services/data/dataTable.service';
import { fetchClientHistory } from '../../services/analytics/clients.service';

export const ClientDetailModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  clientName: string | null;
  unitId: string;
  unitCode: string;
  currentPeriod?: string;
}> = ({ isOpen, onClose, clientName, unitId, unitCode, currentPeriod }) => {
  const [activeTab, setActiveTab] = useState<'dados' | 'atendimentos'>('dados');
  const [loading, setLoading] = useState(false);
  const [unitClient, setUnitClient] = useState<UnitClient | null>(null);
  const [history, setHistory] = useState<Array<{ id?: number; DATA: string | null; DIA: string; PROFISSIONAL: string; 'pos vendas': string | null }>>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRecord, setDetailRecord] = useState<any | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<string | undefined>(currentPeriod);
  
  // Estados para edição
  const [isEditMode, setIsEditMode] = useState(false);
  const [editNome, setEditNome] = useState('');
  const [editContato, setEditContato] = useState('');
  const [editResponsavel, setEditResponsavel] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => { setSelectedPeriod(currentPeriod); }, [currentPeriod]);

  useEffect(() => {
    if (!isOpen || !clientName) return;
    setLoading(true);
    (async () => {
      try {
        const [uc, hist] = await Promise.all([
          getUnitClientByName(unitId, clientName),
          fetchClientHistory(unitCode, clientName, 200, selectedPeriod),
        ]);
        setUnitClient(uc);
        setHistory(hist || []);
        // Inicializa estados de edição
        setEditNome(uc?.nome || '');
        setEditContato(uc?.contato || '');
        setEditResponsavel(uc?.responsavel || '');
      } finally {
        setLoading(false);
      }
    })();
  }, [isOpen, clientName, unitId, unitCode, selectedPeriod]);

  useEffect(() => {
    if (isOpen) {
      setActiveTab('dados');
      setIsEditMode(false);
    }
  }, [isOpen]);

  // Detecta se houve mudanças
  const hasChanges = useMemo(() => {
    if (!unitClient) return false;
    return (
      editNome !== (unitClient.nome || '') ||
      editContato !== (unitClient.contato || '') ||
      editResponsavel !== (unitClient.responsavel || '')
    );
  }, [unitClient, editNome, editContato, editResponsavel]);

  const handleSave = async () => {
    if (!unitClient?.id || !hasChanges) return;
    setIsSaving(true);
    try {
      const patch: Partial<UnitClient> = {};
      const oldNome = unitClient.nome || '';
      let nomeChanged = false;
      
      if (editNome !== unitClient.nome) {
        patch.nome = editNome;
        nomeChanged = true;
      }
      if (editContato !== (unitClient.contato || '')) patch.contato = editContato;
      if (editResponsavel !== (unitClient.responsavel || '')) patch.responsavel = editResponsavel;
      
      // Atualiza o cliente
      const updated = await updateUnitClient(unitClient.id, patch);
      
      // Se o nome foi alterado, atualiza todos os atendimentos vinculados
      if (nomeChanged && oldNome && editNome) {
        try {
          const updatedCount = await updateClientNameInAppointments(unitCode, oldNome, editNome);
          if (updatedCount > 0) {
            alert(`Cliente atualizado com sucesso!\n${updatedCount} atendimento(s) foram atualizados com o novo nome.`);
          }
        } catch (error) {
          console.error('Erro ao atualizar atendimentos:', error);
          alert('Cliente atualizado, mas houve um erro ao atualizar os atendimentos vinculados.');
        }
      }
      
      setUnitClient(updated);
      setIsEditMode(false);
    } catch (error) {
      console.error('Erro ao salvar cliente:', error);
      alert('Erro ao salvar alterações');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (!unitClient) return;
    setEditNome(unitClient.nome || '');
    setEditContato(unitClient.contato || '');
    setEditResponsavel(unitClient.responsavel || '');
    setIsEditMode(false);
  };

  if (!isOpen || !clientName) return null;

  const OverlayClose: React.MouseEventHandler<HTMLDivElement> = (e) => {
    e.stopPropagation();
    onClose();
  };

  const stop: React.MouseEventHandler<HTMLDivElement> = (e) => e.stopPropagation();

  const Row: React.FC<{ label: string; value: React.ReactNode }>= ({ label, value }) => (
    <div>
      <p className="text-xs font-medium text-text-secondary mb-1.5">{label}</p>
      <p className="text-sm text-text-primary break-words">{value || <span className="text-text-tertiary">-</span>}</p>
    </div>
  );

  const EditableRow: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({ label, value, onChange }) => (
    <div>
      <p className="text-xs font-medium text-text-secondary mb-1.5">{label}</p>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border-secondary bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" role="dialog" aria-modal="true" onClick={OverlayClose}>
      <div className="w-full max-w-3xl rounded-xl bg-bg-secondary shadow-2xl overflow-hidden" onClick={stop}>
        {/* Header compacto com gradiente */}
        <div className="relative bg-gradient-to-r from-accent-primary/5 to-brand-cyan/5 border-b border-border-secondary px-5 py-3.5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-text-primary truncate" title={clientName}>
                {clientName}
              </h2>
              <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                <Icon name="User" className="w-3.5 h-3.5" />
                <span>Cliente</span>
              </div>
            </div>
            
            <button 
              onClick={onClose} 
              className="text-text-secondary hover:text-text-primary hover:bg-bg-tertiary rounded-lg p-1.5 transition-colors" 
              aria-label="Fechar"
            >
              <Icon name="X" className="w-5 h-5" />
            </button>
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
                    const label = (p?: string) => {
                      if (!p || !/^\d{4}-\d{2}$/.test(p)) return '-';
                      const [yy, mm] = p.split('-').map(Number);
                      const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
                      return `${meses[Math.max(1, Math.min(12, mm)) - 1]} ${yy}`;
                    };
                    return label(selectedPeriod);
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
          {loading ? (
            <div className="flex items-center justify-center py-8 text-text-secondary text-sm">
              <Icon name="Loader2" className="w-4 h-4 animate-spin mr-2" />
              Carregando…
            </div>
          ) : activeTab === 'dados' ? (
            <div className="space-y-3">
              {/* Nome, Tipo na mesma linha */}
              <div className="flex gap-3">
                {isEditMode ? (
                  <label className="flex-1 flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-text-secondary">Nome</span>
                    <input
                      type="text"
                      value={editNome}
                      onChange={(e) => setEditNome(e.target.value)}
                      className="rounded-lg border border-border-secondary bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all"
                    />
                  </label>
                ) : (
                  <div className="flex-1">
                    <p className="text-xs font-medium text-text-secondary mb-1.5">Nome</p>
                    <p className="text-sm text-text-primary">{unitClient?.nome || clientName}</p>
                  </div>
                )}
                
                <div className="w-40">
                  <p className="text-xs font-medium text-text-secondary mb-1.5">Tipo</p>
                  <p className="text-sm text-text-primary">{unitClient?.tipo || '-'}</p>
                </div>
              </div>

              {/* Endereço */}
              <div>
                <p className="text-xs font-medium text-text-secondary mb-1.5">Endereço</p>
                <p className="text-sm text-text-primary">{unitClient?.endereco || '-'}</p>
              </div>

              {/* Contato e Responsável */}
              <div className="grid grid-cols-2 gap-3">
                {isEditMode ? (
                  <>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium text-text-secondary">Contato</span>
                      <input
                        type="text"
                        value={editContato}
                        onChange={(e) => setEditContato(e.target.value)}
                        className="rounded-lg border border-border-secondary bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all"
                      />
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium text-text-secondary">Responsável</span>
                      <input
                        type="text"
                        value={editResponsavel}
                        onChange={(e) => setEditResponsavel(e.target.value)}
                        className="rounded-lg border border-border-secondary bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all"
                      />
                    </label>
                  </>
                ) : (
                  <>
                    <div>
                      <p className="text-xs font-medium text-text-secondary mb-1.5">Contato</p>
                      <p className="text-sm text-text-primary">{unitClient?.contato || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-text-secondary mb-1.5">Responsável</p>
                      <p className="text-sm text-text-primary">{unitClient?.responsavel || '-'}</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="overflow-auto border border-border-secondary rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="bg-bg-tertiary text-text-secondary">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium">ID</th>
                    <th className="px-3 py-2 text-left text-xs font-medium">Data</th>
                    <th className="px-3 py-2 text-left text-xs font-medium">Dia</th>
                    <th className="px-3 py-2 text-left text-xs font-medium">Profissional</th>
                    <th className="px-3 py-2 text-left text-xs font-medium">Período</th>
                    <th className="px-3 py-2 text-left text-xs font-medium">Pós-venda</th>
                  </tr>
                </thead>
                <tbody>
                  {(!history || history.length===0) ? (
                    <tr><td colSpan={6} className="px-3 py-8 text-center text-text-secondary text-sm">Sem atendimentos registrados.</td></tr>
                  ) : (
                    history.map((h, idx) => {
                      const periodo = (h as any)['PERÍODO'] || (h as any)['PERIODO'];
                      
                      return (
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
                          <td className="px-3 py-2 text-text-primary font-mono text-xs">{(h as any).ATENDIMENTO_ID || '-'}</td>
                          <td className="px-3 py-2 text-text-primary">{h.DATA ? new Date(h.DATA + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}</td>
                          <td className="px-3 py-2 text-text-secondary">{h.DIA || '-'}</td>
                          <td className="px-3 py-2 text-text-primary">{h.PROFISSIONAL || '-'}</td>
                          <td className="px-3 py-2 text-text-secondary">{periodo ? `${periodo} horas` : '-'}</td>
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
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer compacto */}
        <div className="flex items-center justify-between border-t border-border-secondary bg-bg-tertiary px-5 py-3">
          {activeTab === 'dados' && isEditMode && (
            <div className="flex items-center gap-1 text-xs text-text-secondary">
              <Icon name="info" className="w-3 h-3" />
              <span>Editando dados</span>
            </div>
          )}
          {activeTab === 'dados' && !isEditMode && (
            <div className="flex items-center gap-1 text-xs text-text-secondary">
              <Icon name="info" className="w-3 h-3" />
              <span>Apenas visualização</span>
            </div>
          )}
          {activeTab === 'atendimentos' && (
            <div className="flex items-center gap-1 text-xs text-text-secondary">
              <Icon name="info" className="w-3 h-3" />
              <span>Duplo clique para detalhes</span>
            </div>
          )}
          
          <div className="flex items-center gap-2">
            {activeTab === 'dados' && isEditMode && (
              <>
                <button
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="rounded-lg p-2 text-text-secondary hover:bg-bg-secondary border border-border-secondary focus:outline-none focus:ring-2 focus:ring-border-secondary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Cancelar"
                >
                  <Icon name="X" className="w-5 h-5" />
                </button>
                <button
                  onClick={handleSave}
                  disabled={!hasChanges || isSaving}
                  className="rounded-lg bg-accent-primary p-2.5 text-white hover:bg-accent-primary/90 focus:outline-none focus:ring-2 focus:ring-accent-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-accent-primary/20"
                  title={isSaving ? "Salvando..." : "Salvar alterações"}
                >
                  {isSaving ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <Icon name="Check" className="w-4 h-4" />
                  )}
                </button>
              </>
            )}
            {activeTab === 'dados' && !isEditMode && (
              <button
                onClick={() => setIsEditMode(true)}
                className="rounded-lg bg-accent-primary p-2.5 text-white hover:bg-accent-primary/90 focus:outline-none focus:ring-2 focus:ring-accent-primary transition-all shadow-lg shadow-accent-primary/20"
                title="Editar dados"
              >
                <Icon name="Edit" className="w-4 h-4" />
              </button>
            )}
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

export default ClientDetailModal;
