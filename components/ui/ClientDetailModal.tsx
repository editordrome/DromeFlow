import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from './Icon';
import { UnitClient } from '../../types';
import { getUnitClientByName, updateUnitClient } from '../../services/data/clientsDirectory.service';
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
      if (editNome !== unitClient.nome) patch.nome = editNome;
      if (editContato !== (unitClient.contato || '')) patch.contato = editContato;
      if (editResponsavel !== (unitClient.responsavel || '')) patch.responsavel = editResponsavel;
      
      const updated = await updateUnitClient(unitClient.id, patch);
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
      <p className="text-xs font-semibold uppercase text-text-secondary tracking-wider">{label}</p>
      <p className="text-sm text-text-primary break-words">{value || <span className="text-text-tertiary">-</span>}</p>
    </div>
  );

  const EditableRow: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({ label, value, onChange }) => (
    <div>
      <p className="text-xs font-semibold uppercase text-text-secondary tracking-wider mb-1">{label}</p>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-bg-tertiary border border-border-secondary rounded-md text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" role="dialog" aria-modal="true" onClick={OverlayClose}>
      <div className="w-full max-w-3xl mx-4 bg-bg-secondary rounded-lg shadow-lg" onClick={stop}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-secondary">
          <h2 className="text-lg font-bold text-text-primary truncate" title={clientName}>Cliente: {clientName}</h2>
          <div className="flex items-center gap-2">
            {activeTab === 'dados' && !isEditMode && (
              <button
                onClick={() => setIsEditMode(true)}
                className="p-1 rounded text-text-secondary hover:bg-bg-tertiary"
                aria-label="Editar"
                title="Editar"
              >
                <Icon name="edit" />
              </button>
            )}
            {activeTab === 'dados' && isEditMode && (
              <>
                <button
                  onClick={handleSave}
                  disabled={!hasChanges || isSaving}
                  className={`p-1 rounded ${!hasChanges || isSaving ? 'text-text-tertiary cursor-not-allowed' : 'text-green-500 hover:bg-bg-tertiary'}`}
                  aria-label="Salvar"
                  title="Salvar"
                >
                  <Icon name="check" />
                </button>
                <button
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="p-1 rounded text-red-500 hover:bg-bg-tertiary"
                  aria-label="Cancelar"
                  title="Cancelar"
                >
                  <Icon name="close" />
                </button>
              </>
            )}
            <button onClick={onClose} className="p-1 rounded text-text-secondary hover:bg-bg-tertiary" aria-label="Fechar"><Icon name="close" /></button>
          </div>
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
                  className="px-2 py-1 rounded-md border border-border-secondary text-text-secondary hover:bg-bg-tertiary"
                  title="Próximo mês"
                  onClick={() => {
                    if (!selectedPeriod || !/^\d{4}-\d{2}$/.test(selectedPeriod)) return;
                    // Não avançar além do período atual recebido por props (currentPeriod)
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

        <div className="p-4">
          {loading ? (
            <div className="text-text-secondary text-sm">Carregando…</div>
          ) : activeTab === 'dados' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {isEditMode ? (
                <>
                  <EditableRow label="Nome" value={editNome} onChange={setEditNome} />
                  <Row label="Tipo" value={unitClient?.tipo || '-'} />
                  <Row label="Endereço" value={unitClient?.endereco || '-'} />
                  <EditableRow label="Contato" value={editContato} onChange={setEditContato} />
                  <EditableRow label="Responsável" value={editResponsavel} onChange={setEditResponsavel} />
                </>
              ) : (
                <>
                  <Row label="Nome" value={unitClient?.nome || clientName} />
                  <Row label="Tipo" value={unitClient?.tipo || '-'} />
                  <Row label="Endereço" value={unitClient?.endereco || '-'} />
                  <Row label="Contato" value={unitClient?.contato || '-'} />
                  <Row label="Responsável" value={unitClient?.responsavel || '-'} />
                </>
              )}
            </div>
          ) : (
            <div className="overflow-auto border border-white/10 rounded-md">
              <table className="min-w-full text-sm">
                <thead className="bg-bg-tertiary text-text-secondary">
                  <tr>
                    <th className="px-3 py-2 text-left">ID</th>
                    <th className="px-3 py-2 text-left">Data</th>
                    <th className="px-3 py-2 text-left">Dia</th>
                    <th className="px-3 py-2 text-left">Profissional</th>
                    <th className="px-3 py-2 text-left">Período</th>
                    <th className="px-3 py-2 text-left">Pós-venda</th>
                  </tr>
                </thead>
                <tbody>
                  {(!history || history.length===0) ? (
                    <tr><td colSpan={6} className="px-3 py-4 text-center text-text-secondary">Sem atendimentos registrados.</td></tr>
                  ) : (
                    history.map((h, idx) => {
                      const periodo = (h as any)['PERÍODO'] || (h as any)['PERIODO'];
                      
                      return (
                        <tr key={h.id || idx} className="border-t border-white/5 hover:bg-white/5 cursor-pointer" onDoubleClick={async ()=>{
                          if (!h.id) return;
                          const rec = await fetchDataRecordById(h.id as number);
                          setDetailRecord(rec);
                          setDetailOpen(true);
                        }}>
                          <td className="px-3 py-2 text-text-primary">{(h as any).ATENDIMENTO_ID || '-'}</td>
                          <td className="px-3 py-2">{h.DATA ? new Date(h.DATA + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}</td>
                          <td className="px-3 py-2">{h.DIA || '-'}</td>
                          <td className="px-3 py-2">{h.PROFISSIONAL || '-'}</td>
                          <td className="px-3 py-2">{periodo ? `${periodo} horas` : '-'}</td>
                          <td className="px-3 py-2">{(h as any)['pos vendas'] || '-'}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end px-4 py-3 border-t border-border-secondary">
          <button type="button" onClick={onClose} className="px-3 py-2 text-sm rounded-md border border-border-secondary text-text-secondary hover:bg-bg-tertiary">Fechar</button>
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
