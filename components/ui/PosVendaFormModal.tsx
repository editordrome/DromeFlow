import React, { useState, useEffect } from 'react';
import { Icon } from './Icon';
import { useApp } from '../../contexts/AppContext';
import type { PosVenda, PosVendaFormData, AtendimentoSearchResult } from '../../types';
import {
  createPosVenda,
  updatePosVenda,
  searchAtendimentos,
  getAtendimentoById
} from '../../services/posVendas/posVendas.service';

interface PosVendaFormModalProps {
  record: PosVenda | null;
  onClose: () => void;
}

const PosVendaFormModal: React.FC<PosVendaFormModalProps> = ({ record, onClose }) => {
  const { selectedUnit } = useApp();

  const [formData, setFormData] = useState<PosVendaFormData>({
    ATENDIMENTO_ID: record?.ATENDIMENTO_ID || null,
    chat_id: record?.chat_id || null,
    nome: record?.nome || null,
    contato: record?.contato || null,
    unit_id: record?.unit_id || selectedUnit || null,
    data: record?.data || new Date().toISOString().split('T')[0],
    status: record?.status || 'pendente',
    nota: record?.nota || null,
    reagendou: record?.reagendou || false,
    feedback: record?.feedback || null
  });

  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<AtendimentoSearchResult[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedAtendimento, setSelectedAtendimento] = useState<AtendimentoSearchResult | null>(null);

  // Carregar atendimento selecionado ao editar
  useEffect(() => {
    if (record?.ATENDIMENTO_ID) {
      loadAtendimento(record.ATENDIMENTO_ID);
    }
  }, [record]);

  const loadAtendimento = async (atendimentoId: string) => {
    try {
      const atendimento = await getAtendimentoById(atendimentoId);
      if (atendimento) {
        setSelectedAtendimento(atendimento);
        setSearchTerm(`${atendimento.ORCAMENTO} - ${atendimento.CLIENTE}`);
      }
    } catch (error) {
      console.error('Erro ao carregar atendimento:', error);
    }
  };

  const handleSearchAtendimentos = async (value: string) => {
    setSearchTerm(value);
    
    if (value.length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    try {
      const results = await searchAtendimentos(value, selectedUnit || undefined);
      setSearchResults(results);
      setShowSearchResults(true);
    } catch (error) {
      console.error('Erro ao buscar atendimentos:', error);
    }
  };

  const handleSelectAtendimento = (atendimento: AtendimentoSearchResult) => {
    setSelectedAtendimento(atendimento);
    setSearchTerm(`${atendimento.ORCAMENTO} - ${atendimento.CLIENTE}`);
    setShowSearchResults(false);
    setFormData(prev => ({
      ...prev,
      ATENDIMENTO_ID: atendimento.ATENDIMENTO_ID,
      nome: prev.nome || atendimento.CLIENTE,
      contato: prev.contato
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (record) {
        await updatePosVenda(record.id, formData);
      } else {
        await createPosVenda(formData);
      }
      onClose();
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar registro');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof PosVendaFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-bg-secondary rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border-primary">
          <h2 className="text-xl font-semibold text-text-primary">
            {record ? 'Editar' : 'Novo'} Registro de Pós-Venda
          </h2>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary transition-colors"
          >
            <Icon name="X" className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Busca de Atendimento */}
          <div className="relative">
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Buscar Atendimento (opcional)
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => handleSearchAtendimentos(e.target.value)}
              placeholder="Digite orçamento, cliente ou data..."
              className="w-full px-3 py-2 bg-bg-primary border border-border-primary rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
            />
            
            {/* Resultados do autocomplete */}
            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-bg-primary border border-border-primary rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {searchResults.map((atendimento) => (
                  <button
                    key={atendimento.ATENDIMENTO_ID}
                    type="button"
                    onClick={() => handleSelectAtendimento(atendimento)}
                    className="w-full px-3 py-2 text-left hover:bg-bg-tertiary transition-colors border-b border-border-primary last:border-b-0"
                  >
                    <p className="text-sm font-medium text-text-primary">
                      {atendimento.ORCAMENTO} - {atendimento.CLIENTE}
                    </p>
                    <p className="text-xs text-text-secondary">
                      {atendimento.SERVICO} • {atendimento.DATA}
                    </p>
                    {atendimento.ENDERECO && (
                      <p className="text-xs text-text-secondary">{atendimento.ENDERECO}</p>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Atendimento selecionado */}
            {selectedAtendimento && (
              <div className="mt-2 p-3 bg-primary/10 border border-primary/20 rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-text-primary">
                      {selectedAtendimento.ORCAMENTO} - {selectedAtendimento.CLIENTE}
                    </p>
                    <p className="text-xs text-text-secondary mt-1">
                      ID: {selectedAtendimento.ATENDIMENTO_ID}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAtendimento(null);
                      setSearchTerm('');
                      setFormData(prev => ({ ...prev, ATENDIMENTO_ID: null }));
                    }}
                    className="text-text-secondary hover:text-text-primary"
                  >
                    <Icon name="X" className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Nome */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Nome do Cliente *
              </label>
              <input
                type="text"
                value={formData.nome || ''}
                onChange={(e) => handleChange('nome', e.target.value)}
                required
                className="w-full px-3 py-2 bg-bg-primary border border-border-primary rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Contato */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Contato (Telefone)
              </label>
              <input
                type="text"
                value={formData.contato || ''}
                onChange={(e) => handleChange('contato', e.target.value)}
                placeholder="(00) 00000-0000"
                className="w-full px-3 py-2 bg-bg-primary border border-border-primary rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Chat ID */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Chat ID (WhatsApp)
              </label>
              <input
                type="text"
                value={formData.chat_id || ''}
                onChange={(e) => handleChange('chat_id', e.target.value)}
                placeholder="5511999999999@c.us"
                className="w-full px-3 py-2 bg-bg-primary border border-border-primary rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Data */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Data do Contato *
              </label>
              <input
                type="date"
                value={formData.data || ''}
                onChange={(e) => handleChange('data', e.target.value)}
                required
                className="w-full px-3 py-2 bg-bg-primary border border-border-primary rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Status *
              </label>
              <select
                value={formData.status || 'pendente'}
                onChange={(e) => handleChange('status', e.target.value as any)}
                required
                className="w-full px-3 py-2 bg-bg-primary border border-border-primary rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="pendente">Pendente</option>
                <option value="contatado">Contatado</option>
                <option value="finalizado">Finalizado</option>
              </select>
            </div>

            {/* Nota */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Avaliação (1-5)
              </label>
              <select
                value={formData.nota || ''}
                onChange={(e) => handleChange('nota', e.target.value ? parseInt(e.target.value) : null)}
                className="w-full px-3 py-2 bg-bg-primary border border-border-primary rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Sem avaliação</option>
                <option value="1">⭐ 1 - Muito insatisfeito</option>
                <option value="2">⭐⭐ 2 - Insatisfeito</option>
                <option value="3">⭐⭐⭐ 3 - Neutro</option>
                <option value="4">⭐⭐⭐⭐ 4 - Satisfeito</option>
                <option value="5">⭐⭐⭐⭐⭐ 5 - Muito satisfeito</option>
              </select>
            </div>
          </div>

          {/* Reagendou */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="reagendou"
              checked={formData.reagendou || false}
              onChange={(e) => handleChange('reagendou', e.target.checked)}
              className="w-4 h-4 text-primary bg-bg-primary border-border-primary rounded focus:ring-2 focus:ring-primary"
            />
            <label htmlFor="reagendou" className="text-sm font-medium text-text-secondary">
              Cliente reagendou o serviço
            </label>
          </div>

          {/* Feedback */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Feedback / Observações
            </label>
            <textarea
              value={formData.feedback || ''}
              onChange={(e) => handleChange('feedback', e.target.value)}
              rows={4}
              placeholder="Comentários do cliente, sugestões, reclamações..."
              className="w-full px-3 py-2 bg-bg-primary border border-border-primary rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          {/* Botões */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-primary">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading && <Icon name="Loader2" className="w-4 h-4 animate-spin" />}
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PosVendaFormModal;
