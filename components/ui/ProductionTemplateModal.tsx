import React, { useState, useEffect } from 'react';
import { Icon } from './Icon';
import { 
  fetchProductionColumns,
  createColumnTemplate,
  deleteColumnTemplate,
  updateColumnTemplate
} from '../../services/production/production.service';
import { ProductionColumn, ProductionColumnTemplate } from '../../types';

interface ProductionTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  columnId: string;
}

const ProductionTemplateModal: React.FC<ProductionTemplateModalProps> = ({ 
  isOpen, 
  onClose, 
  columnId 
}) => {
  const [column, setColumn] = useState<ProductionColumn | null>(null);
  const [loading, setLoading] = useState(true);
  const [newItemTitle, setNewItemTitle] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const cols = await fetchProductionColumns();
      const current = cols.find(c => c.id === columnId);
      if (current) {
        setColumn(current);
      }
    } catch (e) {
      console.error('Erro ao carregar templates:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && columnId) loadData();
  }, [isOpen, columnId]);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemTitle.trim()) return;

    try {
      const pos = column?.templates?.length || 0;
      await createColumnTemplate(columnId, newItemTitle.trim(), pos);
      setNewItemTitle('');
      loadData();
    } catch (e) {
      alert('Erro ao adicionar item');
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Deseja excluir este item padrão desta plataforma?')) return;
    try {
      await deleteColumnTemplate(id);
      loadData();
    } catch (e) {
      alert('Erro ao excluir item');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-bg-secondary w-full max-w-md rounded-xl shadow-2xl border border-border-primary flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="p-4 border-b border-border-primary flex items-center justify-between bg-bg-tertiary">
          <div className="flex items-center gap-2 text-accent-primary">
            <Icon name="Settings" className="w-5 h-5" />
            <h2 className="text-lg font-bold text-text-primary">
              Configurar {column?.name}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-bg-secondary rounded-full transition-colors text-text-tertiary">
            <Icon name="X" className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 bg-bg-tertiary/50 border-b border-border-primary">
          <p className="text-xs text-text-tertiary">
            Defina os checkpoints padrão para esta plataforma. Eles aparecerão em todos os cards que passarem por esta coluna.
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[60vh]">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-primary border-t-transparent"></div>
            </div>
          ) : (
            <>
              <form onSubmit={handleAddItem} className="flex gap-2">
                <input
                  type="text"
                  value={newItemTitle}
                  onChange={(e) => setNewItemTitle(e.target.value)}
                  placeholder="Nova tarefa padrão..."
                  className="flex-1 bg-bg-secondary border border-border-secondary rounded-md px-3 py-2 text-sm text-text-primary outline-none focus:ring-1 focus:ring-accent-primary transition-all"
                />
                <button
                  type="submit"
                  className="bg-accent-primary hover:bg-accent-secondary text-white p-2 rounded-md transition-colors shadow-sm"
                  title="Adicionar Item"
                >
                  <Icon name="Plus" className="w-5 h-5" />
                </button>
              </form>

              <div className="space-y-2">
                {column?.templates && column.templates.length > 0 ? (
                  column.templates.map((item) => (
                    <div 
                      key={item.id}
                      className="flex items-center justify-between p-3 bg-bg-tertiary rounded-lg border border-border-secondary group hover:border-accent-primary/50 transition-all shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-accent-primary opacity-50"></div>
                        <span className="text-sm text-text-primary font-medium">{item.title}</span>
                      </div>
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="p-1 text-text-tertiary hover:text-danger opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Icon name="Trash2" className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-10 px-4 border-2 border-dashed border-border-secondary rounded-lg">
                    <Icon name="ListChecks" className="w-8 h-8 text-text-tertiary mx-auto mb-2 opacity-20" />
                    <p className="text-xs text-text-tertiary">Nenhum checkpoint definido para esta coluna.</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border-primary flex justify-end bg-bg-tertiary">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-bold text-text-secondary hover:text-text-primary transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductionTemplateModal;
