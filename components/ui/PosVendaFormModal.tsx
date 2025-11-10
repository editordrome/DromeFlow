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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-2xl rounded-xl bg-bg-secondary shadow-2xl overflow-hidden">
        {/* Header compacto com status */}
        <div className="relative bg-gradient-to-r from-accent-primary/5 to-brand-cyan/5 border-b border-border-secondary px-5 py-3.5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-text-primary">
              {record ? 'Editar Pós-Venda' : 'Novo Pós-Venda'}
            </h2>
            
            <div className="flex items-center gap-3">
              {/* Status ao lado do botão fechar */}
              <label className="flex flex-col gap-1.5 min-w-[140px]">
                <span className="text-xs font-medium text-text-secondary">Status</span>
                <select
                  value={formData.status || 'pendente'}
                  onChange={(e) => handleChange('status', e.target.value as any)}
                  className="rounded-lg border border-border-secondary bg-bg-tertiary px-3 py-1.5 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all"
                >
                  <option value="pendente">Pendente</option>
                  <option value="contatado">Contatado</option>
                  <option value="finalizado">Finalizado</option>
                </select>
              </label>
              
              <button 
                onClick={onClose} 
                type="button"
                className="text-text-secondary hover:text-text-primary hover:bg-bg-tertiary rounded-lg p-1.5 transition-colors mt-5"
                aria-label="Fechar"
              >
                <Icon name="X" className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {/* Body com scroll */}
          <div className="max-h-[65vh] overflow-y-auto px-5 py-4 space-y-4">
            {/* Campos Fixos do Atendimento */}
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* ATENDIMENTO_ID - FIXO */}
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-text-secondary">ID Atendimento</span>
                  <input
                    type="text"
                    value={formData.ATENDIMENTO_ID || '-'}
                    readOnly
                    className="rounded-lg border border-border-secondary/50 bg-bg-tertiary/50 px-3 py-2 text-sm text-text-secondary cursor-not-allowed"
                  />
                </label>

                {/* Chat ID - FIXO */}
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-text-secondary">Chat ID (WhatsApp)</span>
                  <input
                    type="text"
                    value={formData.chat_id || '-'}
                    readOnly
                    className="rounded-lg border border-border-secondary/50 bg-bg-tertiary/50 px-3 py-2 text-sm text-text-secondary cursor-not-allowed"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Nome - FIXO */}
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-text-secondary">Nome do Cliente</span>
                  <input
                    type="text"
                    value={formData.nome || '-'}
                    readOnly
                    className="rounded-lg border border-border-secondary/50 bg-bg-tertiary/50 px-3 py-2 text-sm text-text-secondary cursor-not-allowed"
                  />
                </label>

                {/* Contato - FIXO */}
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-text-secondary">Contato (Telefone)</span>
                  <input
                    type="text"
                    value={formData.contato || '-'}
                    readOnly
                    className="rounded-lg border border-border-secondary/50 bg-bg-tertiary/50 px-3 py-2 text-sm text-text-secondary cursor-not-allowed"
                  />
                </label>
              </div>
            </div>

            {/* Divisor */}
            <div className="border-t border-border-secondary"></div>

            {/* Campos Editáveis */}
            <div className="space-y-3">
              {/* Data */}
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-text-secondary flex items-center gap-1">
                  Data do Contato <span className="text-danger">*</span>
                </span>
                <input
                  type="date"
                  value={formData.data || ''}
                  onChange={(e) => handleChange('data', e.target.value)}
                  required
                  className="rounded-lg border border-border-secondary bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all"
                />
              </label>

              {/* Nota */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-text-secondary">
                  Avaliação (1-5)
                </span>
                <div className="flex items-center gap-1 p-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => {
                      if (formData.nota === star) {
                        handleChange('nota', null);
                      } else {
                        handleChange('nota', star);
                      }
                    }}
                    onMouseEnter={(e) => {
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
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-text-secondary">Reagendou</span>
                <select
                  value={formData.reagendou ? 'sim' : 'nao'}
                  onChange={(e) => handleChange('reagendou', e.target.value === 'sim')}
                  className="rounded-lg border border-border-secondary bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all"
                >
                  <option value="nao">Não</option>
                  <option value="sim">Sim</option>
                </select>
              </label>

              {/* Feedback */}
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-text-secondary">Feedback / Observações</span>
                <textarea
                  value={formData.feedback || ''}
                  onChange={(e) => handleChange('feedback', e.target.value)}
                  rows={4}
                  placeholder="Comentários do cliente, sugestões, reclamações..."
                  className="rounded-lg border border-border-secondary bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all resize-none"
                />
              </label>
            </div>
          </div>

          {/* Footer compacto - apenas ícones */}
          <div className="flex items-center justify-between border-t border-border-secondary bg-bg-tertiary px-5 py-3">
            <div className="flex items-center gap-1 text-xs text-text-secondary">
              <Icon name="Info" className="w-3 h-3" />
              <span>* Obrigatório</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-accent-primary p-2.5 text-white hover:bg-accent-primary/90 focus:outline-none focus:ring-2 focus:ring-accent-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-accent-primary/20"
                title={loading ? "Salvando..." : "Salvar"}
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <Icon name="Check" className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PosVendaFormModal;
