import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from './Icon';
import type { Profissional } from '../../services/profissionais/profissionais.service';
import { useAppContext } from '../../contexts/AppContext';
import { fetchProfessionalHistory, fetchProfessionalPosVendaMetrics, updateProfissional } from '../../services/profissionais/profissionais.service';
import DataDetailModal from './DataDetailModal';
import { fetchDataRecordById } from '../../services/data/dataTable.service';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  profissional: Profissional | null;
  onEdit?: (updated: Profissional) => void;
}

const ProfissionalDetailModal: React.FC<Props> = ({ isOpen, onClose, profissional, onEdit }) => {
  const { selectedUnit } = useAppContext();
  const unitCode = (selectedUnit as any)?.unit_code || null;

  const [activeTab, setActiveTab] = useState<'inicio' | 'dados' | 'historico'>('inicio');
  const [selectedPeriod, setSelectedPeriod] = useState<string>(() => {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  });
  const [loadingHist, setLoadingHist] = useState(false);
  const [history, setHistory] = useState<Array<{ id?: number; DATA: string | null; DIA: string; CLIENTE: string; 'pos vendas': string | null }>>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRecord, setDetailRecord] = useState<any | null>(null);
  const [metrics, setMetrics] = useState<{ geral: number | null; comercial: number | null; residencial: number | null }>({ geral: null, comercial: null, residencial: null });
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Estados para campos editáveis
  const [editNome, setEditNome] = useState<string>('');
  const [editWhatsapp, setEditWhatsapp] = useState<string>('');
  const [editRg, setEditRg] = useState<string>('');
  const [editCpf, setEditCpf] = useState<string>('');
  const [editDataNasc, setEditDataNasc] = useState<string>('');
  const [editTipo, setEditTipo] = useState<string>('');
  const [editPreferencia, setEditPreferencia] = useState<string>('');
  const [editHabilidade, setEditHabilidade] = useState<string>('');
  const [editEstadoCivil, setEditEstadoCivil] = useState<string>('');
  const [editFumante, setEditFumante] = useState<string>('');
  const [editFilhos, setEditFilhos] = useState<string>('');
  const [editQtoFilhos, setEditQtoFilhos] = useState<string>('');
  const [editEndereco, setEditEndereco] = useState<string>('');
  const [editNomeRecado, setEditNomeRecado] = useState<string>('');
  const [editTelRecado, setEditTelRecado] = useState<string>('');
  const [editObservacao, setEditObservacao] = useState<string>('');

  // Detecta mudanças
  const hasChanges = useMemo(() => {
    if (!profissional) return false;
    return (
      editNome !== (profissional.nome || '') ||
      editWhatsapp !== (profissional.whatsapp || '') ||
      editRg !== (profissional.rg || '') ||
      editCpf !== (profissional.cpf || '') ||
      editDataNasc !== (profissional.data_nasc || '') ||
      editTipo !== (profissional.tipo || '') ||
      editPreferencia !== (profissional.preferencia || '') ||
      editHabilidade !== (profissional.habilidade || '') ||
      editEstadoCivil !== (profissional.estado_civil || '') ||
      editFumante !== (profissional.fumante || '') ||
      editFilhos !== (profissional.filhos || '') ||
      editQtoFilhos !== (profissional.qto_filhos || '') ||
      editEndereco !== (profissional.endereco || '') ||
      editNomeRecado !== (profissional.nome_recado || '') ||
      editTelRecado !== (profissional.tel_recado || '') ||
      editObservacao !== (profissional.observacao || '')
    );
  }, [profissional, editNome, editWhatsapp, editRg, editCpf, editDataNasc, editTipo, editPreferencia, editHabilidade, editEstadoCivil, editFumante, editFilhos, editQtoFilhos, editEndereco, editNomeRecado, editTelRecado, editObservacao]);

  useEffect(() => {
    if (profissional && isOpen) {
      setEditNome(profissional.nome || '');
      setEditWhatsapp(profissional.whatsapp || '');
      setEditRg(profissional.rg || '');
      setEditCpf(profissional.cpf || '');
      setEditDataNasc(profissional.data_nasc || '');
      setEditTipo(profissional.tipo || '');
      setEditPreferencia(profissional.preferencia || '');
      setEditHabilidade(profissional.habilidade || '');
      setEditEstadoCivil(profissional.estado_civil || '');
      setEditFumante(profissional.fumante || '');
      setEditFilhos(profissional.filhos || '');
      setEditQtoFilhos(profissional.qto_filhos || '');
      setEditEndereco(profissional.endereco || '');
      setEditNomeRecado(profissional.nome_recado || '');
      setEditTelRecado(profissional.tel_recado || '');
      setEditObservacao(profissional.observacao || '');
      setIsEditing(false);
      setIsSaving(false);
    }
  }, [profissional, isOpen]);

  const onSave = async () => {
    if (!profissional || !hasChanges) return;
    try {
      setIsSaving(true);
      const patch: any = {};
      if (editNome !== (profissional.nome || '')) patch.nome = editNome;
      if (editWhatsapp !== (profissional.whatsapp || '')) patch.whatsapp = editWhatsapp;
      if (editRg !== (profissional.rg || '')) patch.rg = editRg;
      if (editCpf !== (profissional.cpf || '')) patch.cpf = editCpf;
      if (editDataNasc !== (profissional.data_nasc || '')) patch.data_nasc = editDataNasc;
      if (editTipo !== (profissional.tipo || '')) patch.tipo = editTipo;
      if (editPreferencia !== (profissional.preferencia || '')) patch.preferencia = editPreferencia;
      if (editHabilidade !== (profissional.habilidade || '')) patch.habilidade = editHabilidade;
      if (editEstadoCivil !== (profissional.estado_civil || '')) patch.estado_civil = editEstadoCivil;
      if (editFumante !== (profissional.fumante || '')) patch.fumante = editFumante;
      if (editFilhos !== (profissional.filhos || '')) patch.filhos = editFilhos;
      if (editQtoFilhos !== (profissional.qto_filhos || '')) patch.qto_filhos = editQtoFilhos;
      if (editEndereco !== (profissional.endereco || '')) patch.endereco = editEndereco;
      if (editNomeRecado !== (profissional.nome_recado || '')) patch.nome_recado = editNomeRecado;
      if (editTelRecado !== (profissional.tel_recado || '')) patch.tel_recado = editTelRecado;
      if (editObservacao !== (profissional.observacao || '')) patch.observacao = editObservacao;
      
      if (Object.keys(patch).length > 0) {
        console.log('ProfissionalDetailModal: Salvando patch:', patch);
        const updated = await updateProfissional(profissional.id, patch);
        console.log('ProfissionalDetailModal: Resposta do update:', updated);
        if (updated && onEdit) {
          onEdit(updated);
        }
        setIsEditing(false);
      }
    } catch (error: any) {
      console.error('Erro ao salvar profissional:', error);
      const errorMessage = error?.message || error?.error_description || JSON.stringify(error);
      alert(`Erro ao salvar alterações:\n${errorMessage}`);
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab('inicio');
  }, [isOpen]);

  // Carrega métricas de pós-venda ao abrir
  useEffect(() => {
    let cancelled = false;
    if (!isOpen || !profissional || !unitCode || unitCode === 'ALL') return;
    (async () => {
      const m = await fetchProfessionalPosVendaMetrics(unitCode, profissional.nome || '');
      if (!cancelled) setMetrics(m);
    })();
    return () => { cancelled = true; };
  }, [isOpen, profissional, unitCode]);

  useEffect(() => {
    let cancelled = false;
    if (!isOpen || !profissional || !unitCode || unitCode === 'ALL' || activeTab !== 'historico') return;
    setLoadingHist(true);
    (async () => {
      try {
        const hist = await fetchProfessionalHistory(unitCode, profissional.nome || '', 200, selectedPeriod);
        if (!cancelled) setHistory(hist || []);
      } finally {
        if (!cancelled) setLoadingHist(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, profissional, unitCode, selectedPeriod, activeTab]);

  const Item: React.FC<{ label: string; value: any }> = ({ label, value }) => (
    <div>
      <div className="text-xs text-text-secondary">{label}</div>
      <div className="text-sm text-text-primary break-words">{value ?? '-'}</div>
    </div>
  );

  const StarMetric: React.FC<{ title: string; value: number | null }> = ({ title, value }) => {
    const full = Math.floor(value || 0);
    const half = value !== null && value - full >= 0.5 ? 1 : 0;
    const empty = 5 - full - half;
    const stars: React.ReactNode[] = [];
    for (let i = 0; i < full; i++) stars.push(<span key={`f${i}`} className="text-yellow-400">★</span>);
    if (half) stars.push(<span key="h" className="text-yellow-400">☆</span>);
    for (let i = 0; i < empty; i++) stars.push(<span key={`e${i}`} className="text-text-tertiary">☆</span>);
    return (
      <div className="p-3 border border-white/10 rounded-md">
        <div className="text-xs text-text-secondary mb-1 truncate" title={title}>{title}</div>
        <div className="flex items-center gap-2">
          <div className="text-lg leading-none">{stars}</div>
          <div className="text-sm text-text-secondary">{value !== null ? value.toFixed(1) : '-'}</div>
        </div>
      </div>
    );
  };

  const LabeledInput: React.FC<{ label: string; value: string; onChange: (v: string)=>void; type?: string }> = ({ label, value, onChange, type='text' }) => (
    <label className="block">
      <span className="text-xs text-text-secondary">{label}</span>
      <input type={type} value={value} onChange={(e)=>onChange(e.target.value)} className="mt-1 w-full bg-bg-tertiary border border-border-secondary rounded-md px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-primary" />
    </label>
  );

  const LabeledTextarea: React.FC<{ label: string; value: string; onChange: (v: string)=>void }> = ({ label, value, onChange }) => (
    <label className="block col-span-full">
      <span className="text-xs text-text-secondary">{label}</span>
      <textarea value={value} onChange={(e)=>onChange(e.target.value)} rows={3} className="mt-1 w-full bg-bg-tertiary border border-border-secondary rounded-md px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-primary" />
    </label>
  );

  if (!isOpen || !profissional) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" aria-modal="true" role="dialog" onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[90vh] bg-bg-secondary rounded-lg shadow-lg flex flex-col" onClick={(e)=>e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary">
          <div className="min-w-0 flex items-center gap-3">
            {!isEditing ? (
              <>
                <h2 className="text-lg font-semibold text-text-primary truncate" title={profissional.nome || 'Profissional'}>
                  {profissional.nome || 'Profissional'}
                </h2>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs ${profissional.status ? 'border-accent-primary text-accent-primary' : 'border-border-secondary text-text-secondary'}`}>{profissional.status || 'Sem status'}</span>
              </>
            ) : (
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <input
                  type="text"
                  value={editNome}
                  onChange={(e) => setEditNome(e.target.value)}
                  placeholder="Nome do profissional"
                  className="flex-1 min-w-0 px-3 py-1.5 text-lg font-semibold bg-bg-tertiary border border-border-secondary rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary"
                />
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs ${profissional.status ? 'border-accent-primary text-accent-primary' : 'border-border-secondary text-text-secondary'}`}>{profissional.status || 'Sem status'}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isEditing ? (
              <button 
                onClick={() => setIsEditing(true)} 
                className="p-2 text-sm rounded-md text-text-secondary hover:bg-bg-tertiary"
                title="Editar"
              >
                <Icon name="edit" className="w-5 h-5" />
              </button>
            ) : (
              <>
                <button 
                  onClick={onSave} 
                  disabled={!hasChanges || isSaving}
                  className={`p-2 text-sm rounded-md transition-colors ${(hasChanges && !isSaving) ? 'text-white bg-emerald-600 hover:bg-emerald-500' : 'text-text-secondary bg-bg-tertiary opacity-50 cursor-not-allowed'}`}
                  title="Salvar"
                >
                  <Icon name="check" className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => {
                    setIsEditing(false);
                    // Restaura valores originais
                    if (profissional) {
                      setEditNome(profissional.nome || '');
                      setEditWhatsapp(profissional.whatsapp || '');
                      setEditRg(profissional.rg || '');
                      setEditCpf(profissional.cpf || '');
                      setEditDataNasc(profissional.data_nasc || '');
                      setEditTipo(profissional.tipo || '');
                      setEditPreferencia(profissional.preferencia || '');
                      setEditHabilidade(profissional.habilidade || '');
                      setEditEstadoCivil(profissional.estado_civil || '');
                      setEditFumante(profissional.fumante || '');
                      setEditFilhos(profissional.filhos || '');
                      setEditQtoFilhos(profissional.qto_filhos || '');
                      setEditEndereco(profissional.endereco || '');
                      setEditNomeRecado(profissional.nome_recado || '');
                      setEditTelRecado(profissional.tel_recado || '');
                      setEditObservacao(profissional.observacao || '');
                    }
                  }} 
                  className="p-2 text-sm rounded-md text-text-secondary hover:bg-bg-tertiary"
                  title="Cancelar"
                >
                  <Icon name="x" className="w-5 h-5" />
                </button>
              </>
            )}
            <button onClick={onClose} className="p-1 rounded hover:bg-bg-tertiary text-text-secondary"><Icon name="close"/></button>
          </div>
        </div>

        {/* Abas */}
        <div className="px-4 pt-2">
          <div className="flex items-center gap-2 border-b border-border-secondary">
            <button className={`px-3 py-2 text-sm ${activeTab==='inicio' ? 'text-accent-primary border-b-2 border-accent-primary' : 'text-text-secondary'}`} onClick={()=>setActiveTab('inicio')}>Início</button>
            <button className={`px-3 py-2 text-sm ${activeTab==='dados' ? 'text-accent-primary border-b-2 border-accent-primary' : 'text-text-secondary'}`} onClick={()=>setActiveTab('dados')}>Dados</button>
            <button className={`px-3 py-2 text-sm ${activeTab==='historico' ? 'text-accent-primary border-b-2 border-accent-primary' : 'text-text-secondary'}`} onClick={()=>setActiveTab('historico')}>Histórico</button>
            {activeTab === 'historico' && unitCode !== 'ALL' && (
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
                    const [y, m] = selectedPeriod.split('-').map(Number);
                    const d = new Date(Date.UTC(y, m - 1, 1));
                    d.setUTCMonth(d.getUTCMonth() + 1);
                    const ny = d.getUTCFullYear();
                    const nm = d.getUTCMonth() + 1;
                    const next = `${ny}-${String(nm).padStart(2, '0')}`;
                    const now = new Date();
                    const cap = `${now.getUTCFullYear()}-${String(now.getUTCMonth()+1).padStart(2,'0')}`;
                    if (next > cap) return;
                    setSelectedPeriod(next);
                  }}
                >›</button>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          {activeTab === 'inicio' && (
            <div className="space-y-4">
              {/* Métricas de pós-venda com estrelas */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <StarMetric title="Geral" value={metrics.geral} />
                <StarMetric title="Comercial" value={metrics.comercial} />
                <StarMetric title="Residencial" value={metrics.residencial} />
              </div>
              {!isEditing ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Item label="WhatsApp" value={profissional.whatsapp} />
                  <Item label="RG" value={profissional.rg} />
                  <Item label="CPF" value={profissional.cpf} />
                  <Item label="Data de Nascimento" value={profissional.data_nasc} />
                  <Item label="Tipo" value={profissional.tipo} />
                  <Item label="Preferência" value={profissional.preferencia} />
                  <Item label="Habilidade" value={profissional.habilidade} />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <LabeledInput label="WhatsApp" value={editWhatsapp} onChange={setEditWhatsapp} />
                  <LabeledInput label="RG" value={editRg} onChange={setEditRg} />
                  <LabeledInput label="CPF" value={editCpf} onChange={setEditCpf} />
                  <LabeledInput label="Data de Nascimento" value={editDataNasc} onChange={setEditDataNasc} type="date" />
                  <LabeledInput label="Tipo" value={editTipo} onChange={setEditTipo} />
                  <LabeledInput label="Preferência" value={editPreferencia} onChange={setEditPreferencia} />
                  <LabeledInput label="Habilidade" value={editHabilidade} onChange={setEditHabilidade} />
                </div>
              )}
            </div>
          )}
          {activeTab === 'dados' && (
            !isEditing ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Item label="Estado Civil" value={profissional.estado_civil} />
                <Item label="Fumante" value={profissional.fumante} />
                <Item label="Filhos" value={profissional.filhos} />
                <Item label="Qtd Filhos" value={profissional.qto_filhos} />
                <Item label="Endereço" value={profissional.endereco} />
                <Item label="Nome Recado" value={profissional.nome_recado} />
                <Item label="Tel Recado" value={profissional.tel_recado} />
                <Item label="Observação" value={profissional.observacao} />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <LabeledInput label="Estado Civil" value={editEstadoCivil} onChange={setEditEstadoCivil} />
                <LabeledInput label="Fumante" value={editFumante} onChange={setEditFumante} />
                <LabeledInput label="Filhos" value={editFilhos} onChange={setEditFilhos} />
                <LabeledInput label="Qtd Filhos" value={editQtoFilhos} onChange={setEditQtoFilhos} />
                <LabeledInput label="Endereço" value={editEndereco} onChange={setEditEndereco} />
                <LabeledInput label="Nome Recado" value={editNomeRecado} onChange={setEditNomeRecado} />
                <LabeledInput label="Tel Recado" value={editTelRecado} onChange={setEditTelRecado} />
                <LabeledTextarea label="Observação" value={editObservacao} onChange={setEditObservacao} />
              </div>
            )
          )}
          {activeTab === 'historico' && (
            unitCode === 'ALL' ? (
              <div className="text-sm text-text-secondary">Selecione uma unidade para ver o histórico.</div>
            ) : (
              <div className="overflow-auto border border-white/10 rounded-md">
                {loadingHist ? (
                  <div className="p-3 text-sm text-text-secondary">Carregando…</div>
                ) : (
                  <table className="min-w-full text-sm">
                    <thead className="bg-bg-tertiary text-text-secondary">
                      <tr>
                        <th className="px-3 py-2 text-left">Data</th>
                        <th className="px-3 py-2 text-left">Dia</th>
                        <th className="px-3 py-2 text-left">Cliente</th>
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
                            <td className="px-3 py-2">{h.CLIENTE || '-'}</td>
                            <td className="px-3 py-2">{(h as any)['pos vendas'] || '-'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            )
          )}
        </div>
        <div className="px-4 py-3 border-t border-border-primary flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-md border border-border-secondary text-text-secondary hover:bg-bg-tertiary">Fechar</button>
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

export default ProfissionalDetailModal;
