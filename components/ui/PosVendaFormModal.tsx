import React, { useState, useEffect } from 'react';
import { Icon } from './Icon';
import { useAppContext } from '../../contexts/AppContext';
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
  const { selectedUnit } = useAppContext();

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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* ATENDIMENTO_ID - FIXO */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                ATENDIMENTO ID
              </label>
              <input
                type="text"
                value={formData.ATENDIMENTO_ID || '-'}
                readOnly
                className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-border-primary rounded-lg text-text-secondary cursor-not-allowed"
              />
            </div>

            {/* Nome - FIXO */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Nome do Cliente
              </label>
              <input
                type="text"
                value={formData.nome || '-'}
                readOnly
                className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-border-primary rounded-lg text-text-secondary cursor-not-allowed"
              />
            </div>

            {/* Contato - FIXO */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Contato (Telefone)
              </label>
              <input
                type="text"
                value={formData.contato || '-'}
                readOnly
                className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-border-primary rounded-lg text-text-secondary cursor-not-allowed"
              />
            </div>

            {/* Chat ID - FIXO */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Chat ID (WhatsApp)
              </label>
              <input
                type="text"
                value={formData.chat_id || '-'}
                readOnly
                className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-border-primary rounded-lg text-text-secondary cursor-not-allowed"
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
              <div className="flex items-center gap-1 p-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => {
                      // Se clicar na estrela já selecionada, remove a avaliação
                      if (formData.nota === star) {
                        handleChange('nota', null);
                      } else {
                        handleChange('nota', star);
                      }
                    }}
                    onMouseEnter={(e) => {
                      // Efeito hover: iluminar até a estrela atual
                      const stars = e.currentTarget.parentElement?.querySelectorAll('button');
                      stars?.forEach((btn, idx) => {
                        const icon = btn.querySelector('svg');
                        if (idx < star && icon) {
                          icon.classList.add('text-yellow-400', 'fill-yellow-400');
                          icon.classList.remove('text-gray-300');
                        }
                      });
                    }}
                    onMouseLeave={(e) => {
                      // Restaurar estado original baseado na nota
                      const stars = e.currentTarget.parentElement?.querySelectorAll('button');
                      stars?.forEach((btn, idx) => {
                        const icon = btn.querySelector('svg');
                        if (icon) {
                          if (formData.nota && idx < formData.nota) {
                            icon.classList.add('text-yellow-400', 'fill-yellow-400');
                            icon.classList.remove('text-gray-300');
                          } else {
                            icon.classList.add('text-gray-300');
                            icon.classList.remove('text-yellow-400', 'fill-yellow-400');
                          }
                        }
                      });
                    }}
                    className="transition-transform hover:scale-110 focus:outline-none"
                    title={
                      star === 1 ? 'Muito insatisfeito' :
                      star === 2 ? 'Insatisfeito' :
                      star === 3 ? 'Neutro' :
                      star === 4 ? 'Satisfeito' :
                      'Muito satisfeito'
                    }
                  >
                    <Icon
                      name="Star"
                      className={`w-8 h-8 transition-colors ${
                        formData.nota && star <= formData.nota
                          ? 'text-yellow-400 fill-yellow-400'
                          : 'text-gray-300'
                      }`}
                    />
                  </button>
                ))}
                {formData.nota && (
                  <button
                    type="button"
                    onClick={() => handleChange('nota', null)}
                    className="ml-2 px-2 py-1 text-xs text-text-secondary hover:text-text-primary transition-colors"
                    title="Remover avaliação"
                  >
                    <Icon name="X" className="w-4 h-4" />
                  </button>
                )}
              </div>
              {formData.nota && (
                <p className="text-xs text-text-secondary mt-1">
                  {formData.nota === 1 && 'Muito insatisfeito'}
                  {formData.nota === 2 && 'Insatisfeito'}
                  {formData.nota === 3 && 'Neutro'}
                  {formData.nota === 4 && 'Satisfeito'}
                  {formData.nota === 5 && 'Muito satisfeito'}
                </p>
              )}
            </div>

            {/* Reagendou */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Reagendou
              </label>
              <select
                value={formData.reagendou ? 'sim' : 'nao'}
                onChange={(e) => handleChange('reagendou', e.target.value === 'sim')}
                className="w-full px-3 py-2 bg-bg-primary border border-border-primary rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="nao">Não</option>
                <option value="sim">Sim</option>
              </select>
            </div>
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
