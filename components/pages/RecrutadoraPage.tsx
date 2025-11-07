import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { DragDropContext, Droppable, Draggable, DropResult, DragUpdate } from '@hello-pangea/dnd';
import { useAuth } from '../../contexts/AuthContext';
import { useAppContext } from '../../contexts/AppContext';
import { fetchColumns, fetchCards, moveCard, ensureDefaultColumnsForUnit, createCard, updateCard, deleteCard, fetchRecrutadoraMetrics, fetchRecrutadoraMetricsForUnits } from '../../services/recrutadora/recrutadora.service';
import type { RecrutadoraCard, RecrutadoraColumn } from '../../types';
import RecrutadoraCardModal from '../ui/RecrutadoraCardModal';
import { Icon } from '../ui/Icon';
import { startOfTodayISO, startOfWeekISO, startOfMonthISO } from '../../services/utils/dates';

const RecrutadoraPage: React.FC = () => {
  const { profile, userUnits } = useAuth();
  const { selectedUnit } = useAppContext();
  const [columns, setColumns] = useState<RecrutadoraColumn[]>([]);
  const [cards, setCards] = useState<RecrutadoraCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalStatus, setModalStatus] = useState<string | undefined>(undefined);
  const [editingCard, setEditingCard] = useState<RecrutadoraCard | null>(null);
  const [dragIndicator, setDragIndicator] = useState<{ droppableId: string; index: number } | null>(null);
  const [metrics, setMetrics] = useState<{ today: number; week: number; month: number } | null>(null);
  // Periodo ativo para filtro a partir das métricas
  const [activePeriod, setActivePeriod] = useState<'all' | 'today' | 'week' | 'month'>('all');
  // Busca (nome ou whatsapp)
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm.trim().toLowerCase()), 350);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // Escolhe cor de texto com bom contraste sobre o fundo fornecido (hex)
  const getTextContrastClass = (bg?: string | null) => {
    if (!bg) return 'text-text-secondary';
    try {
      let hex = bg.trim();
      if (hex.startsWith('rgb')) {
        // rgb(a) -> cálculo simples: extrai números
        const nums = hex.match(/\d+\.\d+|\d+/g)?.map(Number) || [0, 0, 0];
        const [r, g, b] = nums;
        const yiq = (r * 299 + g * 587 + b * 114) / 1000; // YIQ heuristic
        return yiq >= 150 ? 'text-text-primary' : 'text-white';
      }
      if (hex[0] === '#') hex = hex.substring(1);
      if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      const yiq = (r * 299 + g * 587 + b * 114) / 1000; // mais simples e eficiente
      return yiq >= 150 ? 'text-text-primary' : 'text-white';
    } catch {
      return 'text-text-secondary';
    }
  };

  const getBadgeClasses = (bg?: string | null) => {
    const contrast = getTextContrastClass(bg);
    if (contrast === 'text-white') {
      return 'ml-2 text-xs font-semibold px-2 py-0.5 rounded-full border border-white/60 bg-white/10 text-white';
    }
    return 'ml-2 text-xs font-semibold px-2 py-0.5 rounded-full border border-border-secondary bg-bg-secondary text-text-secondary';
  };

  useEffect(() => {
    const load = async () => {
      if (!selectedUnit) return;
      setLoading(true);
      setError(null);
      try {
        // Colunas são globais; cards variam por unidade
        const cols = await fetchColumns(selectedUnit.id as any);
        setColumns(cols);
        // Quando ALL, agrega cards de todas as unidades do usuário
        if ((selectedUnit as any).id === 'ALL') {
          if (!userUnits || userUnits.length === 0) {
            setCards([]);
            setMetrics({ today: 0, week: 0, month: 0 });
          } else {
            const ids = userUnits.map(u => u.id);
            const { fetchCardsForUnits } = await import('../../services/recrutadora/recrutadora.service');
            const crdsAll = await fetchCardsForUnits(ids);
            setCards(crdsAll);
            const m = await fetchRecrutadoraMetricsForUnits(ids);
            setMetrics(m);
          }
        } else {
          const crds = await fetchCards(selectedUnit.id as string);
          setCards(crds);
          const m = await fetchRecrutadoraMetrics(selectedUnit.id as string);
          setMetrics(m);
        }
      } catch (e: any) {
        setError(e.message || 'Falha ao carregar o Kanban.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [selectedUnit, userUnits]);

  const isAllUnits = (selectedUnit as any)?.id === 'ALL';

  // Aplica filtro por período nos cards carregados
  const visibleCards = useMemo(() => {
    let base = cards;
    if (activePeriod !== 'all') {
      let startISO: string;
      if (activePeriod === 'today') startISO = startOfTodayISO();
      else if (activePeriod === 'week') startISO = startOfWeekISO();
      else startISO = startOfMonthISO();
      const start = new Date(startISO).getTime();
      base = base.filter(c => {
        const created = new Date(c.created_at).getTime();
        return !isNaN(created) && created >= start;
      });
    }
    if (debouncedSearch) {
      base = base.filter(c => {
        const nome = (c.nome || '').toLowerCase();
        const whatsapp = (c.whatsapp || '').toLowerCase();
        return nome.includes(debouncedSearch) || whatsapp.includes(debouncedSearch);
      });
    }
    return base;
  }, [cards, activePeriod, debouncedSearch]);

  const cardsByStatus = useMemo(() => {
    const map: Record<string, RecrutadoraCard[]> = {};
    for (const c of visibleCards) {
      if (!map[c.status]) map[c.status] = [];
      map[c.status].push(c);
    }
    // garantir ordenação local por position
    for (const k of Object.keys(map)) {
      map[k].sort((a,b) => a.position - b.position || (a.created_at < b.created_at ? 1 : -1));
    }
    return map;
  }, [visibleCards]);

  // Paleta estável por unidade (até 8 cores; cicla se >8)
  const unitColorMap = useMemo(() => {
    const colors = ['#60a5fa', '#f59e0b', '#10b981', '#ef4444', '#a78bfa', '#f472b6', '#22d3ee', '#94a3b8'];
    const map: Record<string, string> = {};
    userUnits?.forEach((u, idx) => { map[u.id] = colors[idx % colors.length]; });
    return map;
  }, [userUnits]);

  // Colunas para renderização: quando ALL, duplicar "qualificadas" por unidade
  const renderColumns = useMemo(() => {
    if (!isAllUnits) return columns;
    const qual = columns.find(c => c.code === 'qualificadas');
    const others = columns.filter(c => c.code !== 'qualificadas');
    const perUnitQual = (userUnits || []).map(u => ({
      ...qual!,
      id: `qualificadas_${u.id}`,
      code: 'qualificadas',
      // marca local para saber a qual unidade pertence esta coluna
      // @ts-ignore
      _unitForQual: u,
    } as any));
    return [...perUnitQual, ...others];
  }, [columns, isAllUnits, userUnits]);

  const parseDroppable = (id: string): { status: string; unitId?: string } => {
    const [status, unit] = id.split('|');
    return { status, unitId: unit };
  };

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination || !profile) return;
    const srcInfo = parseDroppable(result.source.droppableId);
    const destInfo = parseDroppable(result.destination.droppableId);
    const sourceStatus = srcInfo.status;
    const destStatus = destInfo.status;
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
    // calcula posição de inserção no destino baseado em destStatus + destIndex (ajustada para unidade quando ALL)
    const destListCombined = [...(cardsByStatus[destStatus] || [])];
    const beforeId = destListCombined[destIndex]?.id;
    let insertIdx = nextCards.length;
    if (beforeId !== undefined) {
      insertIdx = nextCards.findIndex(c => c.id === beforeId);
      if (insertIdx === -1) insertIdx = nextCards.length;
    }
    removed.status = destStatus;
    removed.position = destIndex + 1;
    nextCards.splice(insertIdx, 0, removed);

    // normalização simples apenas para visual; quando ALL recarregamos após sucesso
    const normalize = (status: string) => {
      let i = 1;
      for (const c of nextCards.filter(x => x.status === status).sort((a,b)=>a.position-b.position)) {
        c.position = i++;
      }
    };
    if (!isAllUnits) {
      normalize(sourceStatus);
      normalize(destStatus);
    }
    setCards(nextCards);

    try {
      // Bloqueia mover 'qualificadas' entre unidades diferentes
      if (isAllUnits && destStatus === 'qualificadas' && destInfo.unitId && destInfo.unitId !== moving.unit_id) {
        throw new Error('Não é permitido mover "Qualificadas" entre unidades diferentes.');
      }

      let newPosition = destIndex + 1;
      if (isAllUnits && destStatus !== 'qualificadas') {
        // Converter índice combinado para índice dentro da unidade do card
        let countInUnit = 0;
        for (let i = 0; i < destListCombined.length && i < destIndex; i++) {
          if (destListCombined[i].unit_id === moving.unit_id) countInUnit++;
        }
        newPosition = countInUnit + 1;
      }

      await moveCard(profile.id, moving.id, destStatus, newPosition);

      // Quando ALL, recarrega do servidor para garantir ordenação por unidade correta
      if (isAllUnits) {
        if (userUnits && userUnits.length > 0) {
          const ids = userUnits.map(u => u.id);
          const { fetchCardsForUnits } = await import('../../services/recrutadora/recrutadora.service');
          const crdsAll = await fetchCardsForUnits(ids);
          setCards(crdsAll);
        }
      }
    } catch (e: any) {
      // reverte
      setError('Falha ao mover card: ' + (e.message || '')); 
      // força reload
      if (selectedUnit) {
        const cols = await fetchColumns(selectedUnit.id as any);
        setColumns(cols);
        if (isAllUnits) {
          if (userUnits && userUnits.length > 0) {
            const ids = userUnits.map(u => u.id);
            const { fetchCardsForUnits } = await import('../../services/recrutadora/recrutadora.service');
            const crdsAll = await fetchCardsForUnits(ids);
            setCards(crdsAll);
          }
        } else {
          const crds = await fetchCards(selectedUnit.id as string);
          setCards(crds);
        }
      }
    }
    // limpar indicador visual
    setDragIndicator(null);
  };

  const onDragUpdate = (update: DragUpdate) => {
    if (update.destination) {
      setDragIndicator({ droppableId: update.destination.droppableId, index: update.destination.index });
    } else {
      setDragIndicator(null);
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
    <div className="space-y-6">
      {/* Cabeçalho Principal */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-text-primary">Recrutadora</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <label htmlFor="recrutadora-search" className="sr-only">Buscar cards</label>
            <input
              id="recrutadora-search"
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome ou WhatsApp..."
              className="w-full max-w-64 px-3 py-2 text-sm border rounded-md bg-bg-tertiary border-border-secondary text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-accent-primary pr-8"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
                aria-label="Limpar busca"
              >
                <Icon name="close" className="w-4 h-4" />
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
        </div>
      </div>

      {/* Área das Colunas Kanban */}
      <div className="flex h-full min-h-0 w-full max-w-full flex-col overflow-hidden rounded-lg bg-bg-secondary p-4 shadow-md">
        <DragDropContext onDragEnd={onDragEnd} onDragUpdate={onDragUpdate}>
          <div className="flex-1 min-h-0 min-w-0 overflow-x-auto pb-2 pr-1">
            <div className="inline-flex gap-4 h-full">
            {renderColumns.map((col: any) => {
              const droppableId = col._unitForQual ? `qualificadas|${col._unitForQual.id}` : col.code;
              const columnCards = col._unitForQual
                ? visibleCards.filter(c => c.status === 'qualificadas' && c.unit_id === col._unitForQual.id)
                : (cardsByStatus[col.code] || []);
              return (
                <div key={col.id} className="bg-bg-tertiary rounded-lg border border-border-secondary flex flex-col h-full w-[320px] min-w-[320px] shrink-0">
                  <div className="p-0 h-[100px] md:h-[120px] rounded-t-lg border-b border-border-secondary relative overflow-hidden" style={{ backgroundColor: col.color || undefined }}>
                    {col.image_url && (
                      <div
                        aria-label={col.name}
                        className="absolute inset-0 bg-center bg-no-repeat bg-cover"
                        style={{ backgroundImage: `url(${col.image_url})` }}
                      />
                    )}
                    {isAllUnits && col._unitForQual && (
                      <div className="absolute bottom-0 left-0 right-0 bg-black/40 text-white text-xs font-semibold px-2 py-1 text-center">
                        {col._unitForQual.unit_name}
                      </div>
                    )}
                    <span className={`absolute top-1 right-1 z-10 ${getBadgeClasses(col.color)}`}>
                      {col._unitForQual ? columnCards.length : (cardsByStatus[col.code] || []).length}
                    </span>
                  </div>
                  <Droppable droppableId={droppableId}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex-1 overflow-y-auto p-3 space-y-3 transition-colors ${snapshot.isDraggingOver ? 'bg-accent-primary/5 ring-1 ring-accent-primary/30' : ''}`}
                      >
                        {columnCards.map((card: RecrutadoraCard, index: number, arr: RecrutadoraCard[]) => {
                          const elements: React.ReactNode[] = [];
                          const shouldShowIndicator = dragIndicator && dragIndicator.droppableId === droppableId && dragIndicator.index === index;
                          if (shouldShowIndicator) {
                            elements.push(
                              <div
                                key={`drop-indicator-${droppableId}-${index}`}
                                className="h-16 -mb-16 rounded-md ring-2 ring-accent-primary/50 bg-accent-primary/10 shadow-lg pointer-events-none"
                              />
                            );
                          }
                          elements.push(
                            <Draggable key={card.id} draggableId={String(card.id)} index={index}>
                              {(dragProvided, dragSnapshot) => {
                                const content = (
                                  <div
                                    ref={dragProvided.innerRef}
                                    {...dragProvided.draggableProps}
                                    {...dragProvided.dragHandleProps}
                                    className={`bg-bg-secondary rounded-md p-3 text-text-primary border border-border-secondary transition-shadow cursor-pointer ${dragSnapshot.isDragging ? 'shadow-2xl ring-2 ring-accent-primary/50 bg-bg-tertiary' : 'shadow-sm hover:bg-bg-tertiary'}`}
                                    style={{
                                      ...dragProvided.draggableProps.style,
                                      borderLeft: `4px solid ${isAllUnits ? (unitColorMap[card.unit_id] || '#4ade80') : (card.color_card || '#4ade80')}`,
                                    }}
                                    onClick={() => { setEditingCard(card); setModalStatus(card.status); setModalOpen(true); }}
                                  >
                                    <div className="font-semibold leading-snug truncate">{card.nome || 'Sem nome'}</div>
                                    <div className="text-xs text-text-secondary mt-1">Cadastrado em: {new Date(card.created_at).toLocaleDateString('pt-BR')}</div>
                                  </div>
                                );
                                return dragSnapshot.isDragging ? createPortal(content, document.body) : content;
                              }}
                            </Draggable>
                          );
                          // indicador no final da coluna
                          const isLast = index === arr.length - 1;
                          const shouldShowAtEnd = dragIndicator && dragIndicator.droppableId === droppableId && dragIndicator.index === arr.length && isLast;
                          if (shouldShowAtEnd) {
                            elements.push(
                              <div
                                key={`drop-indicator-${droppableId}-end`}
                                className="h-16 -mb-16 rounded-md ring-2 ring-accent-primary/50 bg-accent-primary/10 shadow-lg pointer-events-none"
                              />
                            );
                          }
                          return elements;
                        })}
                        {provided.placeholder}
                        {columnCards.length === 0 && (
                          <>
                            {dragIndicator && dragIndicator.droppableId === droppableId && dragIndicator.index === 0 && (
                              <div className="h-16 rounded-md ring-2 ring-accent-primary/50 bg-accent-primary/10 shadow-lg pointer-events-none mb-3" />
                            )}
                            <div className="text-xs text-text-secondary text-center py-6 border border-dashed border-border-secondary rounded">
                              Nenhum card nesta coluna
                            </div>
                          </>
                        )}
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

      <RecrutadoraCardModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={async () => {
          if (!selectedUnit) return;
          const cols = await fetchColumns(selectedUnit.id);
          setColumns(cols);
          if ((selectedUnit as any).id === 'ALL') {
            if (userUnits && userUnits.length > 0) {
              const ids = userUnits.map(u => u.id);
              const { fetchCardsForUnits } = await import('../../services/recrutadora/recrutadora.service');
              const crdsAll = await fetchCardsForUnits(ids);
              setCards(crdsAll);
              const m = await fetchRecrutadoraMetricsForUnits(ids);
              setMetrics(m);
            } else {
              setCards([]);
              setMetrics({ today: 0, week: 0, month: 0 });
            }
          } else {
            const crds = await fetchCards(selectedUnit.id);
            setCards(crds);
            const m = await fetchRecrutadoraMetrics(selectedUnit.id);
            setMetrics(m);
          }
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
