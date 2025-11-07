import React, { useState, useEffect } from 'react';
import { Icon } from './Icon';
import { Profissional, createProfissional, updateProfissional, fetchProfessionalHistory, fetchProfessionalPosVendaMetrics } from '../../services/profissionais/profissionais.service';
import { useAppContext } from '../../contexts/AppContext';
import DataDetailModal from './DataDetailModal';
import { fetchDataRecordById } from '../../services/data/dataTable.service';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  profissional: Profissional | null;
  onSave: () => void;
}

type TabType = 'dados' | 'atendimentos' | 'posvendas';

export const ProfissionalFormModal: React.FC<Props> = ({ isOpen, onClose, profissional, onSave }) => {
  const { selectedUnit } = useAppContext();
  const isCreating = !profissional;
  const unitCode = (selectedUnit as any)?.unit_code || null;

  const [activeTab, setActiveTab] = useState<TabType>('dados');
  const [formData, setFormData] = useState({
    nome: '',
    whatsapp: '',
    cpf: '',
    rg: '',
    data_nasc: '',
    endereco: '',
    tipo: '',
    preferencia: '',
    habilidade: '',
    estado_civil: '',
    fumante: '',
    filhos: '',
    qto_filhos: '',
    nome_recado: '',
    tel_recado: '',
    observacao: '',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // Estados para histórico
  const [selectedPeriod, setSelectedPeriod] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [loadingHist, setLoadingHist] = useState(false);
  const [history, setHistory] = useState<Array<any>>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRecord, setDetailRecord] = useState<any | null>(null);

  // Estados para pós-venda
  const [metrics, setMetrics] = useState<{ geral: number | null; comercial: number | null; residencial: number | null }>({ 
    geral: null, 
    comercial: null, 
    residencial: null 
  });

  // Inicializa ou reseta o formulário
  useEffect(() => {
    if (isOpen) {
      if (profissional) {
        setFormData({
          nome: profissional.nome || '',
          whatsapp: profissional.whatsapp || '',
          cpf: profissional.cpf || '',
          rg: profissional.rg || '',
          data_nasc: profissional.data_nasc || '',
          endereco: profissional.endereco || '',
          tipo: profissional.tipo || '',
          preferencia: profissional.preferencia || '',
          habilidade: profissional.habilidade || '',
          estado_civil: profissional.estado_civil || '',
          fumante: profissional.fumante || '',
          filhos: profissional.filhos || '',
          qto_filhos: profissional.qto_filhos || '',
          nome_recado: profissional.nome_recado || '',
          tel_recado: profissional.tel_recado || '',
          observacao: profissional.observacao || '',
        });
        setActiveTab('dados');
      } else {
        setFormData({
          nome: '',
          whatsapp: '',
          cpf: '',
          rg: '',
          data_nasc: '',
          endereco: '',
          tipo: '',
          preferencia: '',
          habilidade: '',
          estado_civil: '',
          fumante: '',
          filhos: '',
          qto_filhos: '',
          nome_recado: '',
          tel_recado: '',
          observacao: '',
        });
        setActiveTab('dados');
      }
      setError('');
      setIsSaving(false);
      setHistory([]);
      setMetrics({ geral: null, comercial: null, residencial: null });
    }
  }, [isOpen, profissional]);

  // Carrega histórico quando mudar de tab ou período
  useEffect(() => {
    if (isOpen && activeTab === 'atendimentos' && profissional && unitCode) {
      loadHistory();
    }
  }, [isOpen, activeTab, selectedPeriod, profissional, unitCode]);

  // Carrega métricas pós-venda
  useEffect(() => {
    if (isOpen && activeTab === 'posvendas' && profissional && unitCode) {
      loadPosVendaMetrics();
    }
  }, [isOpen, activeTab, profissional, unitCode]);

  const loadHistory = async () => {
    if (!profissional || !unitCode) return;
    setLoadingHist(true);
    try {
      const hist = await fetchProfessionalHistory(unitCode, profissional.nome || '', 200, selectedPeriod);
      setHistory(hist || []);
    } catch (err) {
      console.error('Erro ao carregar histórico:', err);
      setHistory([]);
    } finally {
      setLoadingHist(false);
    }
  };

  const loadPosVendaMetrics = async () => {
    if (!profissional || !unitCode) return;
    try {
      const m = await fetchProfessionalPosVendaMetrics(unitCode, profissional.nome || '');
      setMetrics(m || { geral: null, comercial: null, residencial: null });
    } catch (err) {
      console.error('Erro ao carregar métricas pós-venda:', err);
      setMetrics({ geral: null, comercial: null, residencial: null });
    }
  };

  const handleOpenDetail = async (recordId: number) => {
    try {
      const rec = await fetchDataRecordById(recordId);
      setDetailRecord(rec);
      setDetailOpen(true);
    } catch (err) {
      console.error('Erro ao abrir detalhe:', err);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome.trim()) {
      setError('Nome é obrigatório');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      if (isCreating) {
        // Criar nova profissional
        const newProfissional = {
          ...formData,
          status: 'Ativa',
          unit_id: selectedUnit && selectedUnit.unit_code !== 'ALL' ? (selectedUnit as any).id : null,
        };
        
        await createProfissional(newProfissional);
      } else {
        // Atualizar profissional existente
        if (!profissional?.id) {
          throw new Error('ID da profissional não encontrado');
        }
        
        await updateProfissional(profissional.id, formData);
      }

      onSave();
      onClose();
    } catch (err: any) {
      console.error('Erro ao salvar profissional:', err);
      setError(err.message || 'Erro ao salvar alterações');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-bg-primary rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border-secondary">
          <h2 className="text-xl font-semibold text-text-primary">
            {isCreating ? 'Nova Profissional' : profissional?.nome || 'Profissional'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-bg-tertiary rounded-md transition-colors"
            disabled={isSaving}
          >
            <Icon name="X" className="w-5 h-5 text-text-secondary" />
          </button>
        </div>

        {/* Tabs - apenas no modo edição */}
        {!isCreating && (
          <div className="flex border-b border-border-secondary bg-bg-secondary">
            <button
              onClick={() => setActiveTab('dados')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'dados'
                  ? 'border-b-2 border-accent-primary text-accent-primary'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <Icon name="User" className="w-4 h-4 inline mr-1" />
              Dados
            </button>
            <button
              onClick={() => setActiveTab('atendimentos')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'atendimentos'
                  ? 'border-b-2 border-accent-primary text-accent-primary'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <Icon name="Calendar" className="w-4 h-4 inline mr-1" />
              Atendimentos
            </button>
            <button
              onClick={() => setActiveTab('posvendas')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'posvendas'
                  ? 'border-b-2 border-accent-primary text-accent-primary'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <Icon name="Star" className="w-4 h-4 inline mr-1" />
              Pós-Venda
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-md text-red-500 text-sm">
              {error}
            </div>
          )}

          {/* ABA DADOS */}
          {activeTab === 'dados' && (
            <div className="space-y-3">
              {/* Nome - Obrigatório */}
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Nome <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.nome}
                  onChange={(e) => handleChange('nome', e.target.value)}
                  className="w-full px-3 py-1.5 text-sm bg-bg-secondary border border-border-secondary rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary"
                  required
                  disabled={isSaving}
                />
              </div>

              {/* Grid de 3 colunas - mais compacto */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">WhatsApp</label>
                  <input
                    type="text"
                    value={formData.whatsapp}
                    onChange={(e) => handleChange('whatsapp', e.target.value)}
                    className="w-full px-2 py-1.5 text-sm bg-bg-secondary border border-border-secondary rounded-md text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-primary"
                    disabled={isSaving}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">CPF</label>
                  <input
                    type="text"
                    value={formData.cpf}
                    onChange={(e) => handleChange('cpf', e.target.value)}
                    className="w-full px-2 py-1.5 text-sm bg-bg-secondary border border-border-secondary rounded-md text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-primary"
                    disabled={isSaving}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">RG</label>
                  <input
                    type="text"
                    value={formData.rg}
                    onChange={(e) => handleChange('rg', e.target.value)}
                    className="w-full px-2 py-1.5 text-sm bg-bg-secondary border border-border-secondary rounded-md text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-primary"
                    disabled={isSaving}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Data Nasc.</label>
                  <input
                    type="date"
                    value={formData.data_nasc}
                    onChange={(e) => handleChange('data_nasc', e.target.value)}
                    className="w-full px-2 py-1.5 text-sm bg-bg-secondary border border-border-secondary rounded-md text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-primary"
                    disabled={isSaving}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Tipo</label>
                  <input
                    type="text"
                    value={formData.tipo}
                    onChange={(e) => handleChange('tipo', e.target.value)}
                    className="w-full px-2 py-1.5 text-sm bg-bg-secondary border border-border-secondary rounded-md text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-primary"
                    disabled={isSaving}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Preferência</label>
                  <input
                    type="text"
                    value={formData.preferencia}
                    onChange={(e) => handleChange('preferencia', e.target.value)}
                    className="w-full px-2 py-1.5 text-sm bg-bg-secondary border border-border-secondary rounded-md text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-primary"
                    disabled={isSaving}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Habilidade</label>
                  <input
                    type="text"
                    value={formData.habilidade}
                    onChange={(e) => handleChange('habilidade', e.target.value)}
                    className="w-full px-2 py-1.5 text-sm bg-bg-secondary border border-border-secondary rounded-md text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-primary"
                    disabled={isSaving}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Estado Civil</label>
                  <input
                    type="text"
                    value={formData.estado_civil}
                    onChange={(e) => handleChange('estado_civil', e.target.value)}
                    className="w-full px-2 py-1.5 text-sm bg-bg-secondary border border-border-secondary rounded-md text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-primary"
                    disabled={isSaving}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Fumante</label>
                  <select
                    value={formData.fumante}
                    onChange={(e) => handleChange('fumante', e.target.value)}
                    className="w-full px-2 py-1.5 text-sm bg-bg-secondary border border-border-secondary rounded-md text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-primary"
                    disabled={isSaving}
                  >
                    <option value="">-</option>
                    <option value="Sim">Sim</option>
                    <option value="Não">Não</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Filhos</label>
                  <select
                    value={formData.filhos}
                    onChange={(e) => handleChange('filhos', e.target.value)}
                    className="w-full px-2 py-1.5 text-sm bg-bg-secondary border border-border-secondary rounded-md text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-primary"
                    disabled={isSaving}
                  >
                    <option value="">-</option>
                    <option value="Sim">Sim</option>
                    <option value="Não">Não</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Qtd Filhos</label>
                  <input
                    type="text"
                    value={formData.qto_filhos}
                    onChange={(e) => handleChange('qto_filhos', e.target.value)}
                    className="w-full px-2 py-1.5 text-sm bg-bg-secondary border border-border-secondary rounded-md text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-primary"
                    disabled={isSaving}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Nome Recado</label>
                  <input
                    type="text"
                    value={formData.nome_recado}
                    onChange={(e) => handleChange('nome_recado', e.target.value)}
                    className="w-full px-2 py-1.5 text-sm bg-bg-secondary border border-border-secondary rounded-md text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-primary"
                    disabled={isSaving}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Tel Recado</label>
                  <input
                    type="text"
                    value={formData.tel_recado}
                    onChange={(e) => handleChange('tel_recado', e.target.value)}
                    className="w-full px-2 py-1.5 text-sm bg-bg-secondary border border-border-secondary rounded-md text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-primary"
                    disabled={isSaving}
                  />
                </div>
              </div>

              {/* Endereço - Full width */}
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Endereço</label>
                <input
                  type="text"
                  value={formData.endereco}
                  onChange={(e) => handleChange('endereco', e.target.value)}
                  className="w-full px-2 py-1.5 text-sm bg-bg-secondary border border-border-secondary rounded-md text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-primary"
                  disabled={isSaving}
                />
              </div>

              {/* Observação */}
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Observação</label>
                <textarea
                  value={formData.observacao}
                  onChange={(e) => handleChange('observacao', e.target.value)}
                  rows={2}
                  className="w-full px-2 py-1.5 text-sm bg-bg-secondary border border-border-secondary rounded-md text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-primary resize-none"
                  disabled={isSaving}
                />
              </div>
            </div>
          )}

          {/* ABA ATENDIMENTOS */}
          {activeTab === 'atendimentos' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-text-primary">Histórico de Atendimentos</h3>
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="px-2 py-1 text-xs bg-bg-secondary border border-border-secondary rounded-md text-text-primary"
                >
                  {Array.from({ length: 12 }, (_, i) => {
                    const d = new Date();
                    d.setMonth(d.getMonth() - i);
                    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                    return <option key={val} value={val}>{d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}</option>;
                  })}
                </select>
              </div>

              {loadingHist ? (
                <div className="text-center py-8 text-text-secondary text-sm">Carregando...</div>
              ) : history.length === 0 ? (
                <div className="text-center py-8 text-text-secondary text-sm">Nenhum atendimento neste período</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-bg-secondary border-b border-border-secondary">
                      <tr>
                        <th className="text-left py-2 px-2 font-medium text-text-secondary">Data</th>
                        <th className="text-left py-2 px-2 font-medium text-text-secondary">Dia</th>
                        <th className="text-left py-2 px-2 font-medium text-text-secondary">Cliente</th>
                        <th className="text-center py-2 px-2 font-medium text-text-secondary">Pós-Venda</th>
                        <th className="text-center py-2 px-2 font-medium text-text-secondary">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((h, idx) => (
                        <tr key={idx} className="border-b border-border-primary hover:bg-bg-secondary/50">
                          <td className="py-2 px-2 text-text-primary">{h.DATA || '-'}</td>
                          <td className="py-2 px-2 text-text-secondary">{h.DIA || '-'}</td>
                          <td className="py-2 px-2 text-text-primary">{h.CLIENTE || '-'}</td>
                          <td className="py-2 px-2 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-xs ${
                              h['pos vendas'] === 'SIM' ? 'bg-green-500/20 text-green-500' : 'bg-gray-500/20 text-gray-500'
                            }`}>
                              {h['pos vendas'] || 'N/A'}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-center">
                            {h.id && (
                              <button
                                onClick={() => handleOpenDetail(h.id!)}
                                className="text-accent-primary hover:text-accent-primary/80 text-xs"
                              >
                                Ver
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ABA PÓS-VENDA */}
          {activeTab === 'posvendas' && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-text-primary">Avaliações Pós-Venda</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-bg-secondary rounded-lg border border-border-secondary text-center">
                  <div className="text-2xl font-bold text-text-primary">
                    {metrics.geral !== null ? `${(metrics.geral * 100).toFixed(0)}%` : '-'}
                  </div>
                  <div className="text-xs text-text-secondary mt-1">Geral</div>
                </div>
                <div className="p-4 bg-bg-secondary rounded-lg border border-border-secondary text-center">
                  <div className="text-2xl font-bold text-text-primary">
                    {metrics.comercial !== null ? `${(metrics.comercial * 100).toFixed(0)}%` : '-'}
                  </div>
                  <div className="text-xs text-text-secondary mt-1">Comercial</div>
                </div>
                <div className="p-4 bg-bg-secondary rounded-lg border border-border-secondary text-center">
                  <div className="text-2xl font-bold text-text-primary">
                    {metrics.residencial !== null ? `${(metrics.residencial * 100).toFixed(0)}%` : '-'}
                  </div>
                  <div className="text-xs text-text-secondary mt-1">Residencial</div>
                </div>
              </div>
              <p className="text-xs text-text-secondary text-center">
                Percentual de clientes que responderam "SIM" no pós-venda
              </p>
            </div>
          )}

        </div>

        {/* Footer - apenas na aba Dados */}
        {activeTab === 'dados' && (
          <div className="flex items-center justify-end gap-2 p-3 border-t border-border-secondary bg-bg-secondary/50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-sm font-medium text-text-secondary hover:bg-bg-tertiary rounded-md transition-colors"
              disabled={isSaving}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSaving || !formData.nome.trim()}
              className="px-4 py-1.5 text-sm font-medium text-white bg-accent-primary hover:bg-accent-primary/90 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Salvando...
                </>
              ) : (
                <>
                  <Icon name="Check" className="w-4 h-4" />
                  {isCreating ? 'Criar' : 'Salvar'}
                </>
              )}
            </button>
          </div>
        )}

        {/* Footer alternativo para outras abas */}
        {activeTab !== 'dados' && (
          <div className="flex items-center justify-end gap-2 p-3 border-t border-border-secondary bg-bg-secondary/50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-sm font-medium text-text-secondary hover:bg-bg-tertiary rounded-md transition-colors"
            >
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>

    {/* Modal de detalhe do atendimento */}
    {detailOpen && detailRecord && (
      <DataDetailModal
        isOpen={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetailRecord(null);
        }}
        record={detailRecord}
      />
    )}
    </>
  );
};
