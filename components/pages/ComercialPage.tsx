import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { DragDropContext, Droppable, Draggable, type DropResult, type DragUpdate } from '@hello-pangea/dnd';
import { useAuth } from '../../contexts/AuthContext';
import { useAppContext } from '../../contexts/AppContext';
import {
  createComercialCard,
  deleteComercialCard,
  fetchComercialCards,
  fetchComercialCardsForUnits,
  fetchComercialColumns,
  fetchComercialMetrics,
  fetchComercialMetricsForUnits,
  updateComercialCard,
  persistStatusOrdering,
  type ComercialPeriodMetrics,
} from '../../services/comercial/comercial.service';
import type { ComercialCard, ComercialColumn } from '../../types';
import ComercialCardModal from '../ui/ComercialCardModal';
import { Icon } from '../ui/Icon';
import { startOfTodayISO, startOfWeekISO, startOfMonthISO } from '../../services/utils/dates';

const STATUS_BORDER_CLASSES: Record<string, string> = {
  leads: 'border-brand-cyan/40',
  andamento: 'border-brand-green/40',
  ganhos: 'border-accent-primary/50',
  perdidos: 'border-danger/50',
};

const STATUS_BADGE_BG: Record<string, string> = {
  leads: 'bg-brand-cyan/90',
  andamento: 'bg-brand-green/80',
  ganhos: 'bg-accent-primary',
  perdidos: 'bg-danger/80',
};

const ComercialPage: React.FC = () => {
  const { userUnits } = useAuth();
  const { selectedUnit } = useAppContext();
  const [columns, setColumns] = useState<ComercialColumn[]>([]);
  const [cards, setCards] = useState<ComercialCard[]>([]);
  const [metrics, setMetrics] = useState<ComercialPeriodMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activePeriod, setActivePeriod] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalStatus, setModalStatus] = useState<string>('leads');
  const [editingCard, setEditingCard] = useState<ComercialCard | null>(null);
  const [dragIndicator, setDragIndicator] = useState<{ droppableId: string; index: number } | null>(null);

  const isAllUnits = (selectedUnit as any)?.id === 'ALL';
  const selectedUnitId = !selectedUnit || isAllUnits ? null : (selectedUnit.id as string);

  const refreshAllUnitsData = useCallback(async () => {
    if (!userUnits || userUnits.length === 0) return;
    try {
      const unitIds = userUnits.map(u => u.id);
      const [cardList, metricsData] = await Promise.all([
        fetchComercialCardsForUnits(unitIds),
        fetchComercialMetricsForUnits(unitIds),
      ]);
      setCards(cardList);
      setMetrics(metricsData);
    } catch (err) {
      console.error('Falha ao atualizar dados do Comercial (modo ALL):', err);
    }
  }, [userUnits]);

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const loadData = useCallback(async () => {
    if (!selectedUnit) return;
    setLoading(true);
    setError(null);
    try {
      const [cols] = await Promise.all([fetchComercialColumns(selectedUnitId)]);
      setColumns(cols.filter(c => c.is_active));

      if (isAllUnits) {
        if (!userUnits || userUnits.length === 0) {
          setCards([]);
          setMetrics({ today: 0, week: 0, month: 0 });
        } else {
          const unitIds = userUnits.map(u => u.id);
          const [cardList, m] = await Promise.all([
            fetchComercialCardsForUnits(unitIds),
            fetchComercialMetricsForUnits(unitIds),
          ]);
          setCards(cardList);
          setMetrics(m);
        }
      } else if (selectedUnitId) {
        const [cardList, m] = await Promise.all([
          fetchComercialCards(selectedUnitId),
          fetchComercialMetrics(selectedUnitId),
        ]);
        setCards(cardList);
        setMetrics(m);
      }
    } catch (e: any) {
      setError(e.message || 'Falha ao carregar o módulo Comercial.');
    } finally {
      setLoading(false);
    }
  }, [selectedUnit, selectedUnitId, isAllUnits, userUnits]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const visibleCards = useMemo(() => {
    let list = cards;
    if (activePeriod !== 'all') {
      let startISO: string;
      if (activePeriod === 'today') startISO = startOfTodayISO();
      else if (activePeriod === 'week') startISO = startOfWeekISO();
      else startISO = startOfMonthISO();
      const start = new Date(startISO).getTime();
      list = list.filter(c => {
        const created = new Date(c.created_at).getTime();
        return !isNaN(created) && created >= start;
      });
    }
    if (debouncedSearch) {
      list = list.filter(c => {
        const nome = (c.nome || '').toLowerCase();
        const contato = (c.contato || '').toLowerCase();
        return nome.includes(debouncedSearch) || contato.includes(debouncedSearch);
      });
    }
    return list;
  }, [cards, activePeriod, debouncedSearch]);

  const cardsByStatus = useMemo(() => {
    const map: Record<string, ComercialCard[]> = {};
    for (const card of visibleCards) {
      if (!map[card.status]) map[card.status] = [];
      map[card.status].push(card);
    }
    for (const status of Object.keys(map)) {
      map[status].sort((a, b) => a.position - b.position || (a.created_at < b.created_at ? 1 : -1));
    }
    return map;
  }, [visibleCards]);

  const handleOpenModal = (status: string, card?: ComercialCard) => {
    if (!card && !selectedUnitId) return;
    setModalStatus(card?.status || status);
    setEditingCard(card || null);
    setModalOpen(true);
  };

  const handleCreateCard = async (payload: Partial<ComercialCard>) => {
    const targetStatus = payload.status || modalStatus;
    if (!payload.unit_id) {
      throw new Error('Selecione uma unidade antes de criar a oportunidade.');
    }
    const unitTarget = payload.unit_id as string;
    const countInStatus = cards.filter(card => card.status === targetStatus && card.unit_id === unitTarget).length;
    await createComercialCard({ ...payload, position: countInStatus + 1 });
  };

  const handleUpdateCard = async (id: string, payload: Partial<ComercialCard>) => {
    // Update in database
    await updateComercialCard(id, payload);
    
    // Update local state to avoid full reload
    setCards(prevCards => 
      prevCards.map(card => 
        card.id === id ? { ...card, ...payload } : card
      )
    );
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const sourceStatus = result.source.droppableId;
    const destStatus = result.destination.droppableId;
    const moving = cards.find(c => c.id === result.draggableId);
    if (!moving) return;

    const originalMap = new Map(cards.map(card => [card.id, card]));
    const nextCards = cards.map(card => ({ ...card }));
    const movingCard = nextCards.find(card => card.id === moving.id);
    if (!movingCard) return;

    const buckets = new Map<string, ComercialCard[]>();
    for (const card of nextCards) {
      if (!buckets.has(card.status)) buckets.set(card.status, []);
      buckets.get(card.status)!.push(card);
    }
    for (const bucket of buckets.values()) {
      bucket.sort((a, b) => a.position - b.position || (a.created_at < b.created_at ? 1 : -1));
    }

    const sourceBucket = buckets.get(sourceStatus) || [];
    const sourceIdx = sourceBucket.findIndex(card => card.id === movingCard.id);
    if (sourceIdx === -1) return;
    sourceBucket.splice(sourceIdx, 1);

    if (!buckets.has(destStatus)) buckets.set(destStatus, []);
    const destBucket = buckets.get(destStatus)!;
    if (sourceStatus !== destStatus) movingCard.status = destStatus;
    destBucket.splice(result.destination.index, 0, movingCard);

    buckets.set(sourceStatus, sourceBucket);
    buckets.set(destStatus, destBucket);

    for (const [status, bucket] of buckets.entries()) {
      bucket.forEach((card, idx) => {
        card.position = idx + 1;
      });
    }

    setCards(nextCards);

    try {
      const updates = nextCards
        .map(card => {
          const original = originalMap.get(card.id);
          if (!original) return null;
          if (original.status === card.status && original.position === card.position) return null;
          return { id: card.id, status: card.status, position: card.position } as const;
        })
        .filter((item): item is { id: string; status: string; position: number } => Boolean(item));

      if (updates.length) {
        await persistStatusOrdering(updates);
      }

      if (isAllUnits) {
        await refreshAllUnitsData();
      }
    } catch (e) {
      console.error('Erro ao persistir ordenação Comercial:', e);
      setError('Falha ao mover card. Recarregando dados.');
      loadData();
    } finally {
      setDragIndicator(null);
    }
  };

  const handleDragUpdate = (update: DragUpdate) => {
    if (update.destination) {
      setDragIndicator({ droppableId: update.destination.droppableId, index: update.destination.index });
    } else {
      setDragIndicator(null);
    }
  };

  if (!selectedUnit) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg bg-bg-secondary p-6 shadow-md">
        <p className="text-text-secondary">Selecione uma unidade para acessar o módulo Comercial.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg bg-bg-secondary p-6 shadow-md">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-t-4 border-gray-200 border-t-accent-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-bg-secondary p-6 shadow-md">
        <div className="rounded-md border border-danger/30 bg-danger/10 p-4 text-danger">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho Principal */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-text-primary">Comercial</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <label htmlFor="comercial-search" className="sr-only">
              Buscar registros
            </label>
            <input
              id="comercial-search"
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome ou contato..."
              className="w-full max-w-64 rounded-md border border-border-secondary bg-bg-tertiary px-3 py-2 pr-8 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/40"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
                aria-label="Limpar busca"
              >
                <Icon name="close" className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {([
              { key: 'today', label: 'Hoje', icon: 'CalendarDays', color: 'text-brand-green', value: metrics?.today || 0 },
              { key: 'week', label: 'Semana', icon: 'CalendarRange', color: 'text-brand-cyan', value: metrics?.week || 0 },
              { key: 'month', label: 'Mês', icon: 'Calendar', color: 'text-accent-primary', value: metrics?.month || 0 },
            ] as const).map(metric => {
              const isActive = activePeriod === metric.key;
              return (
                <button
                  key={metric.key}
                  type="button"
                  onClick={() => setActivePeriod(prev => (prev === metric.key ? 'all' : metric.key))}
                  className={`flex items-center gap-1 rounded-md border px-2 py-1 text-sm transition focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                    isActive
                      ? 'border-accent-primary bg-accent-primary text-text-on-accent'
                      : 'border-border-secondary bg-bg-tertiary text-text-primary hover:bg-bg-tertiary/70'
                  }`}
                  aria-pressed={isActive}
                >
                  <Icon name={metric.icon as any} className={`h-4 w-4 ${isActive ? 'text-text-on-accent' : metric.color}`} />
                  <span className={isActive ? 'text-text-on-accent' : 'text-text-secondary'}>{metric.label}</span>
                  <span className={isActive ? 'font-semibold text-text-on-accent' : 'font-semibold text-text-primary'}>{metric.value}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => handleOpenModal('leads')}
            className="flex items-center justify-center rounded-md bg-accent-primary p-2 text-sm font-semibold text-text-on-accent shadow hover:bg-accent-primary/90 focus:outline-none focus:ring-2 focus:ring-accent-primary"
            disabled={isAllUnits}
            title={isAllUnits ? 'Selecione uma unidade específica para adicionar oportunidades.' : 'Nova oportunidade'}
          >
            <Icon name="Plus" className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Área das Colunas Kanban */}
      <div className="flex h-full min-h-0 w-full max-w-full flex-col overflow-hidden rounded-lg bg-bg-secondary p-4 shadow-md">
        <DragDropContext onDragEnd={handleDragEnd} onDragUpdate={handleDragUpdate}>
          <div className="flex-1 min-h-0 min-w-0 overflow-x-auto pb-2 pr-1">
            <div className="inline-flex h-full gap-4">
            {columns.map(column => {
              const columnCards = cardsByStatus[column.code] || [];
              const hasImage = Boolean(column.image_url);
              const borderTone = STATUS_BORDER_CLASSES[column.code] || 'border-border-secondary';
              const badgeBg = STATUS_BADGE_BG[column.code] || 'bg-black/60';
              return (
                <div
                  key={column.code}
                  className={`flex h-full w-[320px] min-w-[320px] shrink-0 flex-col rounded-lg border bg-bg-tertiary ${borderTone}`}
                >
                  <div className="relative h-[108px] overflow-hidden rounded-t-lg border-b border-border-secondary">
                    {hasImage && (
                      <div
                        className="absolute inset-0 bg-cover bg-center"
                        style={{ backgroundImage: `linear-gradient(to top, rgba(0,0,0,0.55), rgba(0,0,0,0.05)), url(${column.image_url})` }}
                        aria-hidden="true"
                      />
                    )}
                    {!hasImage && (
                      <div className="flex h-full items-center justify-center bg-bg-tertiary px-3">
                        <p className="text-sm font-semibold uppercase text-text-primary">{column.name}</p>
                      </div>
                    )}
                    <span
                      className={`absolute right-2 top-2 z-10 inline-flex h-7 min-w-[2rem] items-center justify-center rounded-full px-2 text-sm font-semibold text-white shadow ${badgeBg}`}
                    >
                      {columnCards.length}
                    </span>
                  </div>
                  <Droppable droppableId={column.code}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex-1 space-y-3 overflow-y-auto p-3 transition ${snapshot.isDraggingOver ? 'bg-accent-primary/5 ring-1 ring-accent-primary/40 shadow-lg shadow-accent-primary/20' : ''}`}
                      >
                        {columnCards.map((card, index, arr) => {
                          const elements: React.ReactNode[] = [];
                          const indicator = dragIndicator && dragIndicator.droppableId === column.code;
                          if (indicator && dragIndicator!.index === index) {
                            elements.push(
                              <div
                                key={`indicator-${column.code}-${index}`}
                                className="pointer-events-none -mb-16 h-16 rounded-md bg-accent-primary/15 ring-2 ring-accent-primary/60 shadow-lg"
                              />
                            );
                          }
                          elements.push(
                            <Draggable key={card.id} draggableId={card.id} index={index}>
                              {(dragProvided, dragSnapshot) => {
                                const cardContent = (
                                  <div
                                    ref={dragProvided.innerRef}
                                    {...dragProvided.draggableProps}
                                    {...dragProvided.dragHandleProps}
                                    className={`rounded-lg border border-border-secondary bg-bg-secondary p-3 text-text-primary shadow-sm transition ${dragSnapshot.isDragging ? 'bg-bg-tertiary shadow-2xl ring-2 ring-accent-primary/60' : 'hover:bg-bg-tertiary'}`}
                                    style={{
                                      ...dragProvided.draggableProps.style,
                                      borderLeft: `4px solid ${column.color || 'var(--color-accent-primary)'}`,
                                    }}
                                    onClick={() => handleOpenModal(column.code, card)}
                                  >
                                    <h3 className="text-base font-semibold leading-snug text-text-primary">{card.nome}</h3>
                                    <div className="mt-1 flex items-center justify-between gap-2">
                                      <p className="text-[10px] font-medium uppercase tracking-wide text-text-tertiary">
                                        {new Date(card.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                                      </p>
                                      {card.origem && <p className="text-xs text-text-tertiary">{card.origem}</p>}
                                    </div>
                                    {card.tipo && <p className="mt-1 text-xs text-text-secondary">{card.tipo}</p>}
                                  </div>
                                );
                                return dragSnapshot.isDragging ? createPortal(cardContent, document.body) : cardContent;
                              }}
                            </Draggable>
                          );
                          const isLast = index === arr.length - 1;
                          if (indicator && isLast && dragIndicator!.index === arr.length) {
                            elements.push(
                              <div
                                key={`indicator-${column.code}-end`}
                                className="pointer-events-none -mb-16 h-16 rounded-md bg-accent-primary/15 ring-2 ring-accent-primary/60 shadow-lg"
                              />
                            );
                          }
                          return elements;
                        })}
                        {columnCards.length === 0 && (
                          <>
                            {dragIndicator && dragIndicator.droppableId === column.code && dragIndicator.index === 0 && (
                              <div className="mb-3 h-16 rounded-md bg-accent-primary/15 ring-2 ring-accent-primary/60 shadow-lg" />
                            )}
                            <div className="flex h-32 items-center justify-center rounded border border-dashed border-border-secondary text-xs text-text-secondary">
                              Nenhum card nesta coluna
                            </div>
                          </>
                        )}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </div>
      </DragDropContext>
      </div>

      {modalOpen && (
        <ComercialCardModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onSaved={loadData}
          unidadeNome={selectedUnit.unit_name}
          defaultStatus={modalStatus}
          unitId={editingCard?.unit_id || selectedUnitId || (userUnits && userUnits.length > 0 ? userUnits[0].id : undefined)}
          initialCard={editingCard}
          onCreate={handleCreateCard}
          onUpdate={handleUpdateCard}
          onDelete={deleteComercialCard}
        />
      )}
    </div>
  );
};

export default ComercialPage;
