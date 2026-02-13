import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { DragDropContext, Droppable, Draggable, type DropResult, type DragUpdate } from '@hello-pangea/dnd';
import { useAuth } from '../../contexts/AuthContext';
import {
    createComercialAdminCard,
    deleteComercialAdminCard,
    fetchComercialAdminCards,
    fetchComercialAdminColumns,
    fetchComercialAdminMetrics,
    persistAdminStatusOrdering,
    updateComercialAdminCard,
    type ComercialAdminPeriodMetrics,
} from '../../services/comercial-admin/comercial-admin.service';
import type { ComercialAdminCard, ComercialAdminColumn } from '../../types';
import ComercialAdminCardModal from '../ui/ComercialAdminCardModal';
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

const ComercialAdminPage: React.FC = () => {
    const { profile } = useAuth();

    // State
    const [columns, setColumns] = useState<ComercialAdminColumn[]>([]);
    const [cards, setCards] = useState<ComercialAdminCard[]>([]);
    const [metrics, setMetrics] = useState<ComercialAdminPeriodMetrics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [activePeriod, setActivePeriod] = useState<'all' | 'today' | 'week' | 'month'>('all');

    // Modal State
    const [modalOpen, setModalOpen] = useState(false);
    const [modalStatus, setModalStatus] = useState<string>('leads');
    const [editingCard, setEditingCard] = useState<ComercialAdminCard | null>(null);

    // Drag State
    const [dragIndicator, setDragIndicator] = useState<{ droppableId: string; index: number } | null>(null);

    // Constants
    const MB_DROME_UNIT_ID = 'af4dd770-31c2-4780-90b4-83cca8416ab6';

    // Load Data
    const loadData = useCallback(async () => {
        if (profile?.role !== 'super_admin') {
            setError('Acesso restrito a Super Administradores.');
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const [cols, cardList, m] = await Promise.all([
                fetchComercialAdminColumns(null), // Global columns
                fetchComercialAdminCards('ALL'), // Buscar TODOS os cards (incluindo todas unidades em teste)
                fetchComercialAdminMetrics('ALL'), // Métricas globais
            ]);
            setColumns(cols.filter(c => c.is_active));
            setCards(cardList);
            setMetrics(m);
        } catch (e: any) {
            setError(e.message || 'Falha ao carregar módulo Comercial Admin.');
        } finally {
            setLoading(false);
        }
    }, [profile]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Filtering
    const visibleCards = useMemo(() => {
        let list = cards;

        // Period Filter
        if (activePeriod !== 'all') {
            let startISO: string;
            if (activePeriod === 'today') startISO = startOfTodayISO();
            else if (activePeriod === 'week') startISO = startOfWeekISO();
            else startISO = startOfMonthISO();
            const start = new Date(startISO).getTime();
            list = list.filter(c => new Date(c.created_at).getTime() >= start);
        }

        // Search Filter
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            list = list.filter(c =>
                (c.nome || '').toLowerCase().includes(term) ||
                (c.contato || '').toLowerCase().includes(term)
            );
        }

        return list;
    }, [cards, activePeriod, searchTerm]);

    // Grouping
    const cardsByStatus = useMemo(() => {
        const map: Record<string, ComercialAdminCard[]> = {};
        for (const card of visibleCards) {
            if (!map[card.status]) map[card.status] = [];
            map[card.status].push(card);
        }
        // Sort
        Object.keys(map).forEach(status => {
            map[status].sort((a, b) => a.position - b.position || (a.created_at < b.created_at ? 1 : -1));
        });
        return map;
    }, [visibleCards]);

    // Expiration Status Calculator
    const getExpirationStatus = (card: ComercialAdminCard): { borderClass: string; isExpired: boolean; isWarning: boolean } => {
        if (!card.data_fim_teste) return { borderClass: '', isExpired: false, isWarning: false };

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const endDate = new Date(card.data_fim_teste);
        endDate.setHours(0, 0, 0, 0);

        const diffTime = endDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
            return { borderClass: 'border-danger border-2', isExpired: true, isWarning: false };
        } else if (diffDays <= 3) {
            return { borderClass: 'border-yellow-500 border-2', isExpired: false, isWarning: true };
        }

        return { borderClass: '', isExpired: false, isWarning: false };
    };

    // Handlers
    const handleOpenModal = (status: string, card?: ComercialAdminCard) => {
        setModalStatus(card?.status || status);
        setEditingCard(card || null);
        setModalOpen(true);
    };

    const handleCreateCard = async (payload: Partial<ComercialAdminCard>) => {
        const targetStatus = payload.status || modalStatus;
        const countInStatus = cards.filter(c => c.status === targetStatus).length;
        await createComercialAdminCard({ ...payload, position: countInStatus + 1 });
    };

    const handleUpdateCard = async (id: string, payload: Partial<ComercialAdminCard>) => {
        await updateComercialAdminCard(id, payload);
        setCards(prev => prev.map(c => c.id === id ? { ...c, ...payload } : c));
    };

    const handleDragEnd = async (result: DropResult) => {
        if (!result.destination) return;
        const { source, destination, draggableId } = result;

        if (source.droppableId === destination.droppableId && source.index === destination.index) return;

        // Optimistic Update
        const newCards = Array.from(cards);
        const movingCardIndex = newCards.findIndex((c: ComercialAdminCard) => c.id === draggableId);
        if (movingCardIndex === -1) return;

        const movingCard: ComercialAdminCard = { ...(newCards[movingCardIndex] as ComercialAdminCard) };
        const oldStatus = movingCard.status;
        const newStatus = destination.droppableId;

        movingCard.status = newStatus;

        // Remove from old pos
        // Calculate new position logic...
        // For simplicity, we'll reload or use complex local logic. 
        // Given the complexity, let's update local state to reflect change and trigger persistence.

        // Re-sort local array is tricky without dedicated lists.
        // Simplest approach: Update status locally, reload data or implement full local reorder logic.
        // Implementing basic local reorder for UI responsiveness:

        newCards.splice(movingCardIndex, 1); // remove

        // Find insertion index in global list is hard because it's segmented by status.
        // We can rely on the server validation for exact position or just update status.
        // Let's reload for safety or use the service batch update.

        setCards(prev => prev.map(c => {
            if (c.id === draggableId) {
                return { ...c, status: newStatus }; // updating status only for now
            }
            return c;
        }));

        // Call persistence (this handles reordering on server)
        try {
            await persistAdminStatusOrdering([{
                id: draggableId,
                status: newStatus,
                position: destination.index + 1 // approximating 1-based index
            }]);
            loadData(); // Sync exact positions
        } catch (e) {
            console.error('Drag failed', e);
            loadData(); // Revert
        }
        setDragIndicator(null);
    };

    const handleDragUpdate = (update: DragUpdate) => {
        if (update.destination) {
            setDragIndicator({ droppableId: update.destination.droppableId, index: update.destination.index });
        } else {
            setDragIndicator(null);
        }
    };

    // Helper utils
    const getTrialStatus = (card: ComercialAdminCard) => {
        if (!card.data_fim_teste) return null;
        const today = new Date();
        const end = new Date(card.data_fim_teste);
        const daysLeft = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (daysLeft < 0) return { label: 'Expirado', color: 'text-danger bg-danger/10' };
        if (daysLeft <= 3) return { label: `${daysLeft} dias`, color: 'text-warning bg-warning/10' };
        return { label: 'Em teste', color: 'text-brand-green bg-brand-green/10' };
    };

    if (loading) {
        return <div className="flex h-full items-center justify-center"><div className="w-12 h-12 border-4 border-accent-primary border-t-transparent rounded-full animate-spin" /></div>;
    }

    if (error) {
        return <div className="p-6 text-danger bg-danger/10 rounded-lg">{error}</div>;
    }

    return (
        <div className="flex flex-col h-full space-y-6">
            {/* Header */}
            <div className="flex-shrink-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
                        <Icon name="Building2" className="w-8 h-8 text-accent-primary" />
                        Comercial Admin
                    </h1>
                    <p className="text-sm text-text-secondary mt-1">Gestão de clientes B2B e Planos</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* Search */}
                    <div className="relative">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Buscar cliente..."
                            className="w-full max-w-64 rounded-md border border-border-secondary bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:border-accent-primary focus:outline-none"
                        />
                        <Icon name="Search" className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                    </div>

                    {/* Metrics Filters */}
                    <div className="flex items-center gap-2">
                        {([
                            { key: 'today', label: 'Hoje', val: metrics?.today },
                            { key: 'week', label: 'Semana', val: metrics?.week },
                            { key: 'month', label: 'Mês', val: metrics?.month },
                        ] as const).map(m => (
                            <button
                                key={m.key}
                                onClick={() => setActivePeriod(prev => prev === m.key ? 'all' : m.key)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${activePeriod === m.key
                                    ? 'bg-accent-primary text-text-on-accent border-accent-primary'
                                    : 'bg-bg-tertiary text-text-secondary border-border-secondary hover:bg-bg-secondary'
                                    }`}
                            >
                                <span>{m.label}</span>
                                <span className="font-bold">{m.val || 0}</span>
                            </button>
                        ))}
                    </div>

                    {/* New Button */}
                    <button
                        onClick={() => handleOpenModal('leads')}
                        className="flex items-center gap-2 bg-accent-primary hover:bg-accent-primary/90 text-text-on-accent px-4 py-2 rounded-md font-medium shadow-md transition-colors"
                    >
                        <Icon name="Plus" className="w-4 h-4" />
                        <span>Novo Cliente</span>
                    </button>
                </div>
            </div>

            {/* Kanban Board */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden rounded-lg bg-bg-secondary p-4 shadow-md">
                <DragDropContext onDragEnd={handleDragEnd} onDragUpdate={handleDragUpdate}>
                    <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden pb-2">
                        <div className="flex h-full gap-4">
                            {columns.map(column => {
                                const columnCards = cardsByStatus[column.code] || [];
                                const borderTone = STATUS_BORDER_CLASSES[column.code] || 'border-border-secondary';
                                const badgeBg = STATUS_BADGE_BG[column.code] || 'bg-black/60';

                                return (
                                    <div key={column.id} className={`flex h-full w-[320px] min-w-[320px] shrink-0 flex-col rounded-lg border bg-bg-tertiary ${borderTone}`}>
                                        {/* Column Header */}
                                        <div className="p-3 border-b border-border-secondary flex items-center justify-between bg-bg-secondary/50 rounded-t-lg">
                                            <h3 className="font-semibold text-text-primary uppercase text-sm tracking-wide">{column.name}</h3>
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold text-white ${badgeBg}`}>
                                                {columnCards.length}
                                            </span>
                                        </div>

                                        {/* Droppable Area */}
                                        <Droppable droppableId={column.code}>
                                            {(provided, snapshot) => (
                                                <div
                                                    ref={provided.innerRef}
                                                    {...provided.droppableProps}
                                                    className={`flex-1 p-2 space-y-2 overflow-y-auto transition-colors ${snapshot.isDraggingOver ? 'bg-accent-primary/5' : ''
                                                        }`}
                                                >
                                                    {columnCards.map((card, index) => {
                                                        const trialStatus = getTrialStatus(card);
                                                        const expirationStatus = getExpirationStatus(card);
                                                        return (
                                                            <Draggable draggableId={card.id} index={index}>
                                                                {(dragProvided, dragSnapshot) => (
                                                                    <div
                                                                        ref={dragProvided.innerRef}
                                                                        {...dragProvided.draggableProps}
                                                                        {...dragProvided.dragHandleProps}
                                                                        onClick={() => handleOpenModal(column.code, card)}
                                                                        className={`
                                      group relative p-3 rounded-lg bg-bg-secondary shadow-sm cursor-pointer
                                      transition-all hover:shadow-md hover:border-accent-primary/30
                                      ${expirationStatus.borderClass || 'border border-border-secondary'}
                                      ${dragSnapshot.isDragging ? 'shadow-xl ring-2 ring-accent-primary rotate-1 scale-105 z-50' : ''}
                                    `}
                                                                    >
                                                                        <h4 className="font-semibold text-text-primary mb-1">{card.nome}</h4>

                                                                        {/* Info Grid */}
                                                                        <div className="space-y-1.5 text-xs text-text-secondary">
                                                                            {card.contato && (
                                                                                <div className="flex items-center gap-1.5">
                                                                                    <Icon name="Phone" className="w-3 h-3 text-text-tertiary" />
                                                                                    <span>{card.contato}</span>
                                                                                </div>
                                                                            )}

                                                                            {/* Plan Badge */}
                                                                            {card.plano && (
                                                                                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-brand-cyan/10 text-brand-cyan font-medium border border-brand-cyan/20">
                                                                                    <Icon name="CreditCard" className="w-3 h-3" />
                                                                                    <span>{card.plano.name}</span>
                                                                                    <span className="opacity-70 text-[10px] ml-1">R${card.plano.value}</span>
                                                                                </div>
                                                                            )}

                                                                            {/* Trial Badge */}
                                                                            {trialStatus && (
                                                                                <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-medium border border-transparent ${trialStatus.color}`}>
                                                                                    <Icon name="Clock" className="w-3 h-3" />
                                                                                    <span>{trialStatus.label}</span>
                                                                                </div>
                                                                            )}
                                                                        </div>

                                                                        {/* Footer */}
                                                                        <div className="mt-3 flex items-center justify-between text-[10px] text-text-tertiary pt-2 border-t border-border-secondary/50">
                                                                            <span>{new Date(card.created_at).toLocaleDateString()}</span>
                                                                            {card.origem && <span className="uppercase tracking-wider">{card.origem}</span>}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </Draggable>
                                                        );
                                                    })}
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
                <ComercialAdminCardModal
                    isOpen={modalOpen}
                    onClose={() => setModalOpen(false)}
                    onSaved={loadData}
                    defaultStatus={modalStatus}
                    initialCard={editingCard}
                    onCreate={handleCreateCard}
                    onUpdate={handleUpdateCard}
                    onDelete={deleteComercialAdminCard}
                />
            )}
        </div>
    );
};

export default ComercialAdminPage;
