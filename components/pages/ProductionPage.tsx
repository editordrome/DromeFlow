import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { useAuth } from '../../contexts/AuthContext';
import { useAppContext } from '../../contexts/AppContext';
import { Icon } from '../ui/Icon';
import { 
  fetchProductionColumns, 
  fetchProductionCards, 
  updateProductionCard,
  createProductionColumn,
  deleteProductionColumn
} from '../../services/production/production.service';
import { ProductionColumn, ProductionCard } from '../../types';
import ProductionCardModal from '../ui/ProductionCardModal';
import ProductionTemplateModal from '../ui/ProductionTemplateModal';

const ProductionPage: React.FC = () => {
  const { profile } = useAuth();
  const [columns, setColumns] = useState<ProductionColumn[]>([]);
  const [cards, setCards] = useState<ProductionCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [initialColumnId, setInitialColumnId] = useState<string | null>(null);
  
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cols, cardList] = await Promise.all([
        fetchProductionColumns(),
        fetchProductionCards()
      ]);
      
      setColumns(cols);
      setCards(cardList);
      
      const initial = cols.find(c => c.is_fixed);
      if (initial) {
        setInitialColumnId(initial.id);
      }
    } catch (e: any) {
      setError(e.message || 'Falha ao carregar o módulo de Produção.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const cardsByStatus = useMemo(() => {
    const map: Record<string, ProductionCard[]> = {};
    const filtered = searchTerm 
      ? cards.filter(c => c.unit?.unit_name.toLowerCase().includes(searchTerm.toLowerCase()))
      : cards;

    for (const card of filtered) {
      if (!map[card.current_column_id]) map[card.current_column_id] = [];
      map[card.current_column_id].push(card);
    }
    return map;
  }, [cards, searchTerm]);

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const { draggableId, source, destination } = result;

    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const movingCard = cards.find(c => c.id === draggableId);
    if (!movingCard) return;

    const newCards = [...cards];
    const cardIdx = newCards.findIndex(c => c.id === draggableId);
    newCards[cardIdx] = { 
      ...movingCard, 
      current_column_id: destination.droppableId,
      position: destination.index
    };

    setCards(newCards);

    try {
      await updateProductionCard(draggableId, { 
        current_column_id: destination.droppableId, 
        position: destination.index 
      });
    } catch (e) {
      console.error('Erro ao mover card:', e);
      loadData();
    }
  };

  const handleAddPlatform = async () => {
    const name = prompt('Nome da Plataforma:');
    if (!name) return;

    try {
      await createProductionColumn(name, columns.length);
      loadData();
    } catch (e) {
      alert('Erro ao criar plataforma');
    }
  };

  const handleDeleteColumn = async (id: string, isFixed: boolean) => {
    if (isFixed) return;
    if (!confirm('Deseja excluir esta plataforma e todos os seus itens?')) return;

    try {
      await deleteProductionColumn(id);
      loadData();
    } catch (e) {
      alert('Erro ao excluir plataforma');
    }
  };

  const handleOpenCard = (cardId: string) => {
    setSelectedCardId(cardId);
    setIsCardModalOpen(true);
  };

  const handleCreateNewCard = () => {
    setSelectedCardId(null);
    setIsCardModalOpen(true);
  };

  const handleOpenTemplateSettings = (columnId: string) => {
    setSelectedColumnId(columnId);
    setIsTemplateModalOpen(true);
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Produção (Super Admin)</h1>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Buscar unidade..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="rounded-md border border-border-secondary bg-bg-tertiary px-3 py-1.5 text-sm"
          />
          <button
            onClick={handleAddPlatform}
            className="flex items-center gap-2 rounded-md bg-accent-primary px-4 py-2 text-sm font-semibold text-white hover:bg-accent-secondary transition-colors"
          >
            <Icon name="Plus" className="w-4 h-4" />
            Adicionar Plataforma
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto pb-4">
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex h-full gap-4 items-start min-w-max">
            {columns.map(column => (
              <div
                key={column.id}
                className="flex flex-col w-80 bg-bg-secondary rounded-lg border border-border-primary shadow-sm h-full max-h-full"
              >
                <div className="p-3 border-b border-border-primary flex items-center justify-between bg-bg-tertiary rounded-t-lg">
                  <h2 className="font-bold text-text-primary uppercase text-sm tracking-wider">
                    {column.name}
                  </h2>
                  <div className="flex items-center gap-2">
                    <span className="bg-bg-secondary px-2 py-0.5 rounded-full text-xs font-bold text-text-secondary border border-border-secondary">
                      {cardsByStatus[column.id]?.length || 0}
                    </span>
                    {!column.is_fixed && (
                      <button 
                        onClick={() => handleDeleteColumn(column.id, column.is_fixed)}
                        className="text-text-tertiary hover:text-danger transition-colors"
                      >
                        <Icon name="Trash2" className="w-4 h-4" />
                      </button>
                    )}
                    {!column.is_fixed && (
                      <button 
                        onClick={() => handleOpenTemplateSettings(column.id)}
                        className="text-text-tertiary hover:text-accent-primary transition-colors"
                        title="Configurar Plataforma"
                      >
                        <Icon name="Settings" className="w-4 h-4" />
                      </button>
                    )}
                    {column.is_fixed && (
                      <button 
                        onClick={handleCreateNewCard}
                        className="text-accent-primary hover:text-accent-secondary transition-colors"
                      >
                        <Icon name="PlusCircle" className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <Droppable droppableId={column.id}>
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="flex-1 p-2 space-y-2 overflow-y-auto"
                    >
                      {cardsByStatus[column.id]?.map((card, index) => (
                        <Draggable key={card.id} draggableId={card.id} index={index}>
                          {(dragProvided) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.dragHandleProps}
                              {...dragProvided.draggableProps}
                              onClick={() => handleOpenCard(card.id)}
                              className="bg-bg-tertiary p-3 rounded-md border border-border-secondary hover:border-accent-primary transition-all cursor-pointer shadow-sm group"
                            >
                              <div className="flex justify-between items-start mb-2">
                                <h3 className="font-semibold text-text-primary leading-tight">
                                  {card.unit?.unit_name || 'Unidade não vinculada'}
                                </h3>
                              </div>
                              
                              {/* Barra de Progresso Simplificada */}
                              <div className="mt-3">
                                <div className="flex justify-between text-[10px] text-text-secondary mb-1">
                                  <span>Progresso</span>
                                  <span>0%</span> {/* TODO: Calcular progresso real */}
                                </div>
                                <div className="w-full bg-border-primary rounded-full h-1.5 overflow-hidden">
                                  <div className="bg-accent-primary h-full transition-all duration-500" style={{ width: '0%' }}></div>
                                </div>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      {(!cardsByStatus[column.id] || cardsByStatus[column.id].length === 0) && (
                        <div className="h-20 border-2 border-dashed border-border-secondary rounded-lg flex items-center justify-center text-text-tertiary text-xs">
                          Arraste cards para cá
                        </div>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
          </div>
        </DragDropContext>
      </div>

      {isCardModalOpen && (
        <ProductionCardModal
          isOpen={isCardModalOpen}
          onClose={() => {
            setIsCardModalOpen(false);
            loadData();
          }}
          cardId={selectedCardId}
          initialColumnId={initialColumnId}
        />
      )}

      {isTemplateModalOpen && selectedColumnId && (
        <ProductionTemplateModal
          isOpen={isTemplateModalOpen}
          onClose={() => {
            setIsTemplateModalOpen(false);
            loadData();
          }}
          columnId={selectedColumnId}
        />
      )}
    </div>
  );
};

export default ProductionPage;
