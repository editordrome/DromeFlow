import React, { useEffect, useMemo, useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { useAuth } from '../../contexts/AuthContext';
import { useAppContext } from '../../contexts/AppContext';
import { fetchColumns, fetchCards, moveCard, ensureDefaultColumnsForUnit, createCard, updateCard, deleteCard } from '../../services/recrutadora/recrutadora.service';
import type { RecrutadoraCard, RecrutadoraColumn } from '../../types';
import RecrutadoraCardModal from '../ui/RecrutadoraCardModal';

const RecrutadoraPage: React.FC = () => {
  const { profile } = useAuth();
  const { selectedUnit } = useAppContext();
  const [columns, setColumns] = useState<RecrutadoraColumn[]>([]);
  const [cards, setCards] = useState<RecrutadoraCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalStatus, setModalStatus] = useState<string | undefined>(undefined);
  const [editingCard, setEditingCard] = useState<RecrutadoraCard | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!selectedUnit) return;
      setLoading(true);
      setError(null);
      try {
        // Garante que a unidade tenha colunas padrão
        await ensureDefaultColumnsForUnit(selectedUnit.id, selectedUnit.unit_name);
        const [cols, crds] = await Promise.all([
          fetchColumns(selectedUnit.id),
          fetchCards(selectedUnit.id),
        ]);
        setColumns(cols);
        setCards(crds);
      } catch (e: any) {
        setError(e.message || 'Falha ao carregar o Kanban.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [selectedUnit]);

  const cardsByStatus = useMemo(() => {
    const map: Record<string, RecrutadoraCard[]> = {};
    for (const c of cards) {
      if (!map[c.status]) map[c.status] = [];
      map[c.status].push(c);
    }
    // garantir ordenação local por position
    for (const k of Object.keys(map)) {
      map[k].sort((a,b) => a.position - b.position || (a.created_at < b.created_at ? 1 : -1));
    }
    return map;
  }, [cards]);

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination || !profile) return;
    const sourceStatus = result.source.droppableId;
    const destStatus = result.destination.droppableId;
    const sourceIndex = result.source.index;
    const destIndex = result.destination.index;

    const sourceList = [...(cardsByStatus[sourceStatus] || [])];
    const moving = sourceList[sourceIndex];
    if (!moving) return;

    // estado otimista
    const nextCards = [...cards];
    const movingIdxGlobal = nextCards.findIndex(c => c.id === moving.id);
    if (movingIdxGlobal === -1) return;

    // remove do source
    const removed = nextCards.splice(movingIdxGlobal, 1)[0];
    // calcula posição de inserção no destino baseado em destStatus + destIndex
    const destList = [...(cardsByStatus[destStatus] || [])];
    const beforeId = destList[destIndex]?.id;
    let insertIdx = nextCards.length;
    if (beforeId !== undefined) {
      insertIdx = nextCards.findIndex(c => c.id === beforeId);
      if (insertIdx === -1) insertIdx = nextCards.length;
    }
    removed.status = destStatus;
    removed.position = destIndex + 1;
    nextCards.splice(insertIdx, 0, removed);

    // normaliza positions locais por status
    const normalize = (status: string) => {
      let i = 1;
      for (const c of nextCards.filter(x => x.status === status).sort((a,b)=>a.position-b.position)) {
        c.position = i++;
      }
    };
    normalize(sourceStatus);
    normalize(destStatus);
    setCards(nextCards);

    try {
      await moveCard(profile.id, moving.id, destStatus, destIndex + 1);
    } catch (e: any) {
      // reverte
      setError('Falha ao mover card: ' + (e.message || '')); 
      // força reload
      if (selectedUnit) {
        const [cols, crds] = await Promise.all([
          fetchColumns(selectedUnit.id),
          fetchCards(selectedUnit.id),
        ]);
        setColumns(cols);
        setCards(crds);
      }
    }
  };

  if (!selectedUnit) {
    return (
      <div className="p-6 bg-bg-secondary rounded-lg shadow-md h-full flex items-center justify-center">
        <p className="text-text-secondary">Selecione uma unidade para acessar a Recrutadora.</p>
      </div>
    );
  }
  if (loading) {
    return (
      <div className="p-6 bg-bg-secondary rounded-lg shadow-md h-full flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-t-4 border-gray-200 rounded-full animate-spin border-t-accent-primary"></div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-6 bg-bg-secondary rounded-lg shadow-md">
        <div className="p-4 text-danger bg-danger/10 border border-danger/30 rounded-md">{error}</div>
      </div>
    );
  }

  return (
  <div className="p-4 bg-bg-secondary rounded-lg shadow-md h-full min-h-0 w-full max-w-full box-border flex flex-col overflow-hidden">
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <h1 className="text-2xl font-bold text-text-primary">Recrutadora - {selectedUnit.unit_name}</h1>
        <div />
      </div>
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex-1 min-h-0 min-w-0 h-full w-full max-w-full overflow-x-auto overscroll-x-contain pb-2 pr-1">
          <div className="inline-flex gap-4 h-full">
            {columns.map(col => (
              <div key={col.id} className="bg-bg-tertiary rounded-lg border border-border-secondary flex flex-col h-full w-[320px] min-w-[320px] shrink-0">
                <div className="px-4 py-2 rounded-t-lg flex items-center justify-between border-b border-border-secondary" style={{ backgroundColor: col.color || undefined }}>
                  <span className="text-sm font-semibold text-text-primary">{col.name}</span>
                </div>
                <Droppable droppableId={col.code}>
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="flex-1 overflow-y-auto p-3 space-y-3">
                      {(cardsByStatus[col.code] || []).map((card, index) => (
                        <Draggable key={card.id} draggableId={String(card.id)} index={index}>
                          {(dragProvided) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              {...dragProvided.dragHandleProps}
                              className="bg-bg-secondary rounded-md p-3 text-text-primary shadow-sm border border-border-secondary hover:bg-bg-tertiary transition cursor-pointer"
                              style={{ borderLeft: `4px solid ${card.color_card || '#4ade80'}` }}
                              onClick={() => { setEditingCard(card); setModalStatus(card.status); setModalOpen(true); }}
                            >
                              <div className="font-semibold leading-snug truncate">{card.nome || 'Sem nome'}</div>
                              <div className="text-xs text-text-secondary mt-1">Cadastrado em: {new Date(card.created_at).toLocaleDateString('pt-BR')}</div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      {(!cardsByStatus[col.code] || cardsByStatus[col.code].length === 0) && (
                        <div className="text-xs text-text-secondary text-center py-6 border border-dashed border-border-secondary rounded">
                          Nenhum card nesta coluna
                        </div>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
          </div>
        </div>
      </DragDropContext>
      <RecrutadoraCardModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={async () => {
          if (!selectedUnit) return;
          const [cols, crds] = await Promise.all([
            fetchColumns(selectedUnit.id),
            fetchCards(selectedUnit.id),
          ]);
          setColumns(cols);
          setCards(crds);
        }}
  unidade={selectedUnit.unit_name}
        defaultStatus={editingCard ? undefined : modalStatus}
        initialCard={editingCard}
        onCreate={async (payload) => {
          await createCard({ ...payload, unit_id: selectedUnit.id, unidade: selectedUnit.unit_name });
        }}
        onUpdate={async (id, payload) => {
          await updateCard(id, payload);
        }}
        onDelete={async (id) => {
          await deleteCard(id);
        }}
      />
    </div>
  );
};

export default RecrutadoraPage;
