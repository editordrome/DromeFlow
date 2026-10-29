import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { Icon } from '../ui/Icon';
import type { LoyaltyPlan, LoyaltyPlanClient, UnitClient, LoyaltyTransaction } from '../../types';
import {
    getOrCreatePlan,
    updateLoyaltyPlan,
    fetchPlanStats,
} from '../../services/loyalty/loyaltyPlans.service';
import {
    fetchPlanClients,
    fetchAvailableClients,
    addClientToPlan,
    removeClientFromPlan,
    toggleClientStatus,
    updateClientVipStatus,
} from '../../services/loyalty/loyaltyClients.service';
import {
    fetchTransactionsWithUser,
    adjustBalance,
    fetchExpiringPoints,
    redeemPoints,
    earnPoints,
    fetchAllExpiringPoints,
    syncLoyaltyPoints
} from '../../services/loyalty/loyaltyTransactions.service';
const ToggleSwitch: React.FC<{
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
}> = ({ checked, onChange, disabled }) => {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={() => onChange(!checked)}
            disabled={disabled}
            className={`${checked ? 'bg-accent-primary' : 'bg-gray-300'
                } relative inline-flex items-center h-5 rounded-full w-9 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent-primary disabled:opacity-50 disabled:cursor-not-allowed`}
        >
            <span
                className={`${checked ? 'translate-x-5' : 'translate-x-1'
                    } inline-block w-3 h-3 transform bg-white rounded-full transition-transform`}
            />
        </button>
    );
};

const LoyaltyPage: React.FC = () => {
    const { selectedUnit } = useAppContext();
    const { profile } = useAuth();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Plan data
    const [plan, setPlan] = useState<LoyaltyPlan | null>(null);
    const [planStats, setPlanStats] = useState({
        totalClients: 0,
        activeClients: 0,
        inactiveClients: 0,
        vipClients: 0,
        attentionClients: 0,
        totalPointsInCirculation: 0,
        totalPointsEarned: 0,
        totalPointsRedeemed: 0,
    });

    const [filterType, setFilterType] = useState<'all' | 'active' | 'inactive' | 'vip' | 'ranking' | 'attention'>('all');
    const [sortConfig, setSortConfig] = useState<{
        key: 'current_balance' | 'last_transaction_at';
        direction: 'asc' | 'desc' | null;
    }>({ key: 'last_transaction_at', direction: 'desc' });

    // Clients data
    const [planClients, setPlanClients] = useState<LoyaltyPlanClient[]>([]);
    const [availableClients, setAvailableClients] = useState<UnitClient[]>([]);
    const [showClientModal, setShowClientModal] = useState(false);
    const [showConfigPanel, setShowConfigPanel] = useState(false);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [showRedeemModal, setShowRedeemModal] = useState(false);
    const [redeemAmount, setRedeemAmount] = useState('');
    const [redeemDescription, setRedeemDescription] = useState('');
    const [isRedeeming, setIsRedeeming] = useState(false);
    const [selectedClient, setSelectedClient] = useState<LoyaltyPlanClient | null>(null);
    const [clientTransactions, setClientTransactions] = useState<LoyaltyTransaction[]>([]);
    const [searchTerm, setSearchTerm] = useState(''); // Busca no modal de adicionar
    const [tableSearchTerm, setTableSearchTerm] = useState(''); // Busca na tabela principal
    const [expiringPoints, setExpiringPoints] = useState(0);
    const [editingBalance, setEditingBalance] = useState(false);
    const [newBalance, setNewBalance] = useState('');
    const [allExpiringPoints, setAllExpiringPoints] = useState<Record<string, { amount: number; date: string }>>({});
    const [showEarnModal, setShowEarnModal] = useState(false);
    const [earnAmount, setEarnAmount] = useState('');
    const [earnDescription, setEarnDescription] = useState('');
    const [isAddingPoints, setIsAddingPoints] = useState(false);

    // Auto-save states
    const [saving, setSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);

    const selectedUnitId = selectedUnit?.id;
    const isAllUnits = selectedUnit?.unit_code === 'ALL';

    useEffect(() => {
        if (selectedUnitId && !isAllUnits) {
            loadPlanData();
        }
    }, [selectedUnitId, isAllUnits]);

    const handleToggleVip = async (planClientId: string, currentVip: boolean) => {
        try {
            await updateClientVipStatus(planClientId, !currentVip);

            // Atualizar estado local
            setPlanClients(prev => prev.map(pc =>
                pc.id === planClientId ? { ...pc, is_vip: !currentVip } : pc
            ));

            if (selectedClient?.id === planClientId) {
                setSelectedClient(prev => prev ? { ...prev, is_vip: !currentVip } : null);
            }
        } catch (error: any) {
            alert('Erro ao atualizar status VIP: ' + error.message);
        }
    };

    const loadPlanData = async () => {
        if (!selectedUnitId) return;

        try {
            setLoading(true);
            setError(null);

            const planData = await getOrCreatePlan(selectedUnitId);
            setPlan(planData);

            const stats = await fetchPlanStats(planData.id);
            setPlanStats(stats);

            const clients = await fetchPlanClients(planData.id);
            setPlanClients(clients);

            const available = await fetchAvailableClients(selectedUnitId, planData.id);
            setAvailableClients(available);

            const expiringAll = await fetchAllExpiringPoints(planData.id);
            setAllExpiringPoints(expiringAll);

            // Calcular estatísticas de atenção (expirações no mês atual)
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();

            const attentionCount = Object.values(expiringAll).filter(exp => {
                const expDate = new Date(exp.date);
                return expDate.getMonth() === currentMonth && expDate.getFullYear() === currentYear && exp.amount > 0;
            }).length;

            setPlanStats(prev => ({
                ...prev,
                attentionClients: attentionCount
            }));
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleFieldChange = async (field: keyof LoyaltyPlan, value: any) => {
        if (!plan) return;

        try {
            setSaving(true);
            setPlan({ ...plan, [field]: value });
            await updateLoyaltyPlan(plan.id, { [field]: value });
            setLastSaved(new Date());
        } catch (e: any) {
            alert('Erro ao salvar: ' + e.message);
            loadPlanData();
        } finally {
            setSaving(false);
        }
    };

    const handleAddClient = async (clientId: string, isVip: boolean = false) => {
        if (!plan) return;

        try {
            await addClientToPlan(plan.id, clientId, isVip);
            loadPlanData();
            setShowClientModal(false);
            setSearchTerm('');
        } catch (e: any) {
            alert('Erro ao adicionar cliente: ' + e.message);
        }
    };

    const handleRemoveClient = async (planClientId: string) => {
        if (!confirm('Deseja realmente remover este cliente do plano?')) return;

        try {
            await removeClientFromPlan(planClientId);
            loadPlanData();
        } catch (e: any) {
            alert('Erro ao remover cliente: ' + e.message);
        }
    };

    const handleClientDoubleClick = async (client: LoyaltyPlanClient) => {
        try {
            setSelectedClient(client);
            const [transactions, expiring] = await Promise.all([
                fetchTransactionsWithUser(client.id),
                fetchExpiringPoints(client.id)
            ]);
            setClientTransactions(transactions);
            setExpiringPoints(expiring);
            setShowDetailsModal(true);
        } catch (e: any) {
            alert('Erro ao carregar transações: ' + e.message);
        }
    };

    const handleToggleStatus = async (planClientId: string, currentStatus: boolean) => {
        try {
            await toggleClientStatus(planClientId, !currentStatus);
            loadPlanData();
        } catch (e: any) {
            alert('Erro ao alterar status: ' + e.message);
        }
    };

    const handleRedeemPoints = async () => {
        if (!selectedClient || !redeemAmount) return;

        const amount = parseFloat(redeemAmount);
        if (isNaN(amount) || amount <= 0) {
            alert('Valor de resgate inválido');
            return;
        }

        if (amount > selectedClient.current_balance) {
            alert('Saldo insuficiente');
            return;
        }

        setIsRedeeming(true);
        try {
            await redeemPoints(selectedClient.id, amount, redeemDescription);

            // Recarregar dados
            const [transactions, expiring] = await Promise.all([
                fetchTransactionsWithUser(selectedClient.id),
                fetchExpiringPoints(selectedClient.id)
            ]);
            setClientTransactions(transactions);
            setExpiringPoints(expiring);
            loadPlanData();

            setShowRedeemModal(false);
            setRedeemAmount('');
            setRedeemDescription('');
        } catch (e: any) {
            alert('Erro ao realizar resgate: ' + e.message);
        } finally {
            setIsRedeeming(false);
        }
    };

    const handleEarnPoints = async () => {
        if (!selectedClient || !earnAmount || !plan) return;

        const purchaseValue = parseFloat(earnAmount);
        if (isNaN(purchaseValue) || purchaseValue <= 0) {
            alert('Valor de venda inválido');
            return;
        }

        setIsAddingPoints(true);
        try {
            // Calcular pontos baseado na regra do plano
            let pointsToEarn = 0;
            const multiplier = selectedClient.is_vip ? (plan.vip_multiplier || 1) : 1;

            if (plan.type === 'cashback') {
                pointsToEarn = (purchaseValue * (plan.reward_percentage || 0) / 100) * multiplier;
            } else {
                pointsToEarn = (purchaseValue * (plan.points_per_real || 0)) * multiplier;
            }

            await earnPoints(
                selectedClient.id,
                pointsToEarn,
                earnDescription || `Acúmulo manual: Venda de R$ ${purchaseValue.toFixed(2)}`,
                undefined, // atendimentoId
                purchaseValue
            );

            loadPlanData();
            setShowEarnModal(false);
            setEarnAmount('');
            setEarnDescription('');
        } catch (e: any) {
            alert('Erro ao adicionar pontos: ' + e.message);
        } finally {
            setIsAddingPoints(false);
        }
    };

    const handleAdjustBalance = async () => {
        if (!selectedClient) return;

        const points = parseFloat(newBalance);
        if (isNaN(points)) {
            alert('Valor inválido');
            return;
        }

        const diff = points - selectedClient.current_balance;
        if (diff === 0) {
            setEditingBalance(false);
            return;
        }

        try {
            const userId = profile?.id || selectedClient.client_id;
            const reason = diff > 0 ? 'Adição manual de pontos' : 'Remoção manual de pontos';

            await adjustBalance(selectedClient.id, diff, reason, userId);
            setEditingBalance(false);
            setNewBalance('');

            const [transactions, expiring] = await Promise.all([
                fetchTransactionsWithUser(selectedClient.id),
                fetchExpiringPoints(selectedClient.id)
            ]);
            setClientTransactions(transactions);
            setExpiringPoints(expiring);
            loadPlanData();
        } catch (e: any) {
            alert('Erro ao ajustar saldo: ' + e.message);
        }
    };

    const filteredPlanClients = planClients
        .filter(pc => {
            // Filtro de busca
            const searchLower = tableSearchTerm.toLowerCase();
            const matchesSearch = !tableSearchTerm ||
                pc.client?.nome?.toLowerCase().includes(searchLower) ||
                pc.client?.codigo?.toLowerCase().includes(searchLower);

            if (!matchesSearch) return false;

            // Filtro de categoria
            if (filterType === 'active') return pc.is_active;
            if (filterType === 'inactive') return !pc.is_active;
            if (filterType === 'vip') return pc.is_vip && pc.is_active;
            if (filterType === 'ranking') return pc.is_active;
            if (filterType === 'attention') {
                const expiring = allExpiringPoints[pc.id];
                if (!expiring || expiring.amount <= 0) return false;
                const expDate = new Date(expiring.date);
                const now = new Date();
                return expDate.getMonth() === now.getMonth() && expDate.getFullYear() === now.getFullYear();
            }

            return true;
        })
        .sort((a, b) => {
            if (!sortConfig.direction) return 0;

            const direction = sortConfig.direction === 'asc' ? 1 : -1;

            if (sortConfig.key === 'current_balance') {
                return (a.current_balance - b.current_balance) * direction;
            }

            if (sortConfig.key === 'last_transaction_at') {
                const dateA = a.last_transaction_at ? new Date(a.last_transaction_at).getTime() : 0;
                const dateB = b.last_transaction_at ? new Date(b.last_transaction_at).getTime() : 0;
                return (dateA - dateB) * direction;
            }

            return 0;
        });

    const filteredClients = availableClients.filter(client => {
        if (!searchTerm) return true;
        return client.nome.toLowerCase().includes(searchTerm.toLowerCase());
    });

    if (!selectedUnit || isAllUnits) {
        return (
            <div className="flex h-full items-center justify-center rounded-lg bg-bg-secondary p-6 shadow-md">
                <p className="text-text-secondary">
                    Selecione uma unidade específica para acessar o módulo de Fidelidade.
                </p>
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
            <div className="flex h-full items-center justify-center rounded-lg bg-bg-secondary p-6 shadow-md">
                <p className="text-danger">{error}</p>
            </div>
        );
    }

    if (!plan) return null;

    return (
        <div className="flex h-full flex-col gap-4 p-6">
            {/* Cabeçalho Principal (Título e Ações) */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <h1 className="text-2xl font-bold text-text-primary">Fidelidade</h1>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                        <Icon name="Search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                        <input
                            type="text"
                            value={tableSearchTerm}
                            onChange={(e) => setTableSearchTerm(e.target.value)}
                            placeholder="Buscar cliente..."
                            className="pl-9 pr-3 py-2 rounded-md bg-bg-tertiary border border-border-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-accent-primary w-64 transition-all"
                        />
                    </div>

                    <button
                        onClick={() => setShowClientModal(true)}
                        className="flex items-center gap-2 rounded-md bg-accent-primary px-4 py-2 text-sm font-medium text-white hover:bg-accent-primary/90 transition-colors h-[38px]"
                    >
                        <Icon name="Plus" className="w-4 h-4" />
                        Adicionar Cliente
                    </button>

                    <button
                        onClick={() => setShowConfigPanel(true)}
                        className="flex items-center justify-center w-[38px] h-[38px] rounded-md border border-border-primary bg-bg-secondary text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
                        title="Configurações do Plano"
                    >
                        <Icon name="Settings" className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Linha de Filtros (Métricas) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                <button
                    onClick={() => {
                        setFilterType('all');
                        setSortConfig({ key: 'last_transaction_at', direction: 'desc' });
                    }}
                    className={`p-3 rounded-lg border transition-all ${filterType === 'all'
                        ? 'bg-accent-primary text-white border-transparent shadow-lg'
                        : 'bg-bg-secondary border-border-primary hover:shadow-md'
                        }`}
                >
                    <div className="flex items-center gap-2">
                        <Icon name="Users" className={`w-5 h-5 ${filterType === 'all' ? 'text-white' : 'text-text-secondary'}`} />
                        <span className="text-sm font-medium">Total</span>
                        <span className={`ml-auto text-lg font-bold ${filterType === 'all' ? 'text-white' : 'text-text-primary'}`}>
                            {planStats.totalClients}
                        </span>
                    </div>
                </button>

                <button
                    onClick={() => {
                        setFilterType('active');
                        setSortConfig({ key: 'last_transaction_at', direction: 'desc' });
                    }}
                    className={`p-3 rounded-lg border transition-all ${filterType === 'active'
                        ? 'bg-success text-white border-transparent shadow-lg'
                        : 'bg-bg-secondary border-border-primary hover:shadow-md'
                        }`}
                >
                    <div className="flex items-center gap-2">
                        <Icon name="UserCheck" className={`w-5 h-5 ${filterType === 'active' ? 'text-white' : 'text-text-secondary'}`} />
                        <span className="text-sm font-medium">Ativos</span>
                        <span className={`ml-auto text-lg font-bold ${filterType === 'active' ? 'text-white' : 'text-text-primary'}`}>
                            {planStats.activeClients}
                        </span>
                    </div>
                </button>

                <button
                    onClick={() => {
                        setFilterType('vip');
                        setSortConfig({ key: 'last_transaction_at', direction: 'desc' });
                    }}
                    className={`p-3 rounded-lg border transition-all ${filterType === 'vip'
                        ? 'bg-amber-600 text-white border-transparent shadow-lg'
                        : 'bg-bg-secondary border-border-primary hover:shadow-md'
                        }`}
                >
                    <div className="flex items-center gap-2">
                        <Icon name="Crown" className={`w-5 h-5 ${filterType === 'vip' ? 'text-white' : 'text-text-secondary'}`} />
                        <span className="text-sm font-medium">VIPs</span>
                        <span className={`ml-auto text-lg font-bold ${filterType === 'vip' ? 'text-white' : 'text-text-primary'}`}>
                            {planStats.vipClients}
                        </span>
                    </div>
                </button>

                <button
                    onClick={() => {
                        setFilterType('ranking');
                        setSortConfig({ key: 'current_balance', direction: 'desc' });
                    }}
                    className={`p-3 rounded-lg border transition-all ${filterType === 'ranking'
                        ? 'bg-purple-600 text-white border-transparent shadow-lg'
                        : 'bg-bg-secondary border-border-primary hover:shadow-md'
                        }`}
                >
                    <div className="flex items-center gap-2">
                        <Icon name="Trophy" className={`w-5 h-5 ${filterType === 'ranking' ? 'text-white' : 'text-text-secondary'}`} />
                        <span className="text-sm font-medium">Ranking</span>
                        <span className={`ml-auto text-lg font-bold ${filterType === 'ranking' ? 'text-white' : 'text-text-primary'}`}>
                            <Icon name="TrendingUp" className="w-4 h-4" />
                        </span>
                    </div>
                </button>

                <button
                    onClick={() => {
                        setFilterType('attention');
                        setSortConfig({ key: 'last_transaction_at', direction: 'desc' });
                    }}
                    className={`p-3 rounded-lg border transition-all ${filterType === 'attention'
                        ? 'bg-red-600 text-white border-transparent shadow-lg'
                        : 'bg-bg-secondary border-border-primary hover:shadow-md'
                        }`}
                >
                    <div className="flex items-center gap-2">
                        <Icon name="AlertCircle" className={`w-5 h-5 ${filterType === 'attention' ? 'text-white' : 'text-text-secondary'}`} />
                        <span className="text-sm font-medium">Atenção</span>
                        <span className={`ml-auto text-lg font-bold ${filterType === 'attention' ? 'text-white' : 'text-text-primary'}`}>
                            {planStats.attentionClients}
                        </span>
                    </div>
                </button>

                <button
                    onClick={() => {
                        setFilterType('inactive');
                        setSortConfig({ key: 'last_transaction_at', direction: 'desc' });
                    }}
                    className={`p-3 rounded-lg border transition-all ${filterType === 'inactive'
                        ? 'bg-danger text-white border-transparent shadow-lg'
                        : 'bg-bg-secondary border-border-primary hover:shadow-md'
                        }`}
                >
                    <div className="flex items-center gap-2">
                        <Icon name="UserX" className={`w-5 h-5 ${filterType === 'inactive' ? 'text-white' : 'text-text-secondary'}`} />
                        <span className="text-sm font-medium">Inativos</span>
                        <span className={`ml-auto text-lg font-bold ${filterType === 'inactive' ? 'text-white' : 'text-text-primary'}`}>
                            {planStats.inactiveClients}
                        </span>
                    </div>
                </button>
            </div>

            {/* Tabela de Clientes */}
            <div className="flex-1 overflow-auto rounded-lg border border-border-secondary bg-bg-secondary">
                <table className="w-full">
                    <thead className="bg-bg-tertiary border-b border-border-secondary sticky top-0">
                        <tr>
                            <th className="px-4 py-3 text-center text-sm font-bold text-text-secondary uppercase tracking-wider">Código</th>
                            <th className="px-4 py-3 text-center text-sm font-bold text-text-secondary uppercase tracking-wider">Cliente</th>
                            <th
                                className="px-4 py-3 text-center text-sm font-bold text-text-secondary cursor-pointer hover:text-text-primary transition-colors group uppercase tracking-wider"
                                onClick={() => {
                                    setSortConfig(prev => ({
                                        key: 'current_balance',
                                        direction: prev.direction === 'desc' ? 'asc' : 'desc'
                                    }));
                                }}
                            >
                                <div className="flex items-center justify-center gap-1">
                                    Saldo
                                    <div className="flex flex-col -space-y-1">
                                        <Icon
                                            name="ChevronUp"
                                            className={`w-3 h-3 ${sortConfig.direction === 'asc' ? 'text-accent-primary' : 'text-text-tertiary group-hover:text-text-secondary'}`}
                                        />
                                        <Icon
                                            name="ChevronDown"
                                            className={`w-3 h-3 ${sortConfig.direction === 'desc' ? 'text-accent-primary' : 'text-text-tertiary group-hover:text-text-secondary'}`}
                                        />
                                    </div>
                                </div>
                            </th>
                            <th
                                className="px-4 py-3 text-center text-sm font-bold text-text-secondary cursor-pointer hover:text-text-primary transition-colors group uppercase tracking-wider"
                                onClick={() => {
                                    setSortConfig(prev => ({
                                        key: 'last_transaction_at',
                                        direction: prev.key === 'last_transaction_at' && prev.direction === 'desc' ? 'asc' : 'desc'
                                    }));
                                }}
                            >
                                <div className="flex items-center justify-center gap-1">
                                    Atualizado
                                    <div className="flex flex-col -space-y-1">
                                        <Icon
                                            name="ChevronUp"
                                            className={`w-3 h-3 ${sortConfig.key === 'last_transaction_at' && sortConfig.direction === 'asc' ? 'text-accent-primary' : 'text-text-tertiary group-hover:text-text-secondary'}`}
                                        />
                                        <Icon
                                            name="ChevronDown"
                                            className={`w-3 h-3 ${sortConfig.key === 'last_transaction_at' && sortConfig.direction === 'desc' ? 'text-accent-primary' : 'text-text-tertiary group-hover:text-text-secondary'}`}
                                        />
                                    </div>
                                </div>
                            </th>
                            <th className="px-4 py-3 text-center text-sm font-bold text-text-secondary uppercase tracking-wider">A Vencer</th>
                            <th className="px-4 py-3 text-center text-sm font-bold text-text-secondary uppercase tracking-wider">Validade</th>
                            <th className="px-4 py-3 text-center text-sm font-bold text-text-secondary uppercase tracking-wider">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredPlanClients.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-4 py-12 text-center text-text-secondary">
                                    <div className="flex flex-col items-center gap-2">
                                        <Icon name="Users" className="w-12 h-12 text-text-tertiary" />
                                        <p>Nenhum cliente cadastrado no plano</p>
                                        <button
                                            onClick={() => setShowClientModal(true)}
                                            className="mt-2 text-accent-primary hover:underline text-sm"
                                        >
                                            Adicionar primeiro cliente
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            filteredPlanClients.map((pc) => {
                                const isExpired = pc.validity_end_date && new Date(pc.validity_end_date) < new Date();
                                const daysRemaining = pc.validity_end_date
                                    ? Math.ceil((new Date(pc.validity_end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                                    : null;

                                return (
                                    <tr
                                        key={pc.id}
                                        className={`border-b border-border-secondary hover:bg-bg-tertiary transition-colors cursor-pointer ${!pc.is_active ? 'opacity-50' : ''}`}
                                        onDoubleClick={() => handleClientDoubleClick(pc)}
                                        title="Duplo clique para ver detalhes"
                                    >
                                        <td className="px-4 py-3 text-xs text-text-secondary font-mono text-center">
                                            {pc.client_id.split('-')[0].toUpperCase()}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-text-primary text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                {pc.client?.nome}
                                                {pc.is_vip && <Icon name="Crown" className="w-3.5 h-3.5 text-amber-500" />}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-text-primary text-center font-medium">
                                            R$ {pc.current_balance.toFixed(2)}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-center text-text-tertiary">
                                            {pc.last_transaction_at ? new Date(pc.last_transaction_at).toLocaleDateString() : '---'}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-amber-600 text-center font-medium">
                                            {allExpiringPoints[pc.id]?.amount ? (
                                                `R$ ${allExpiringPoints[pc.id].amount.toFixed(2)}`
                                            ) : (
                                                'R$ 0.00'
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-center">
                                            {allExpiringPoints[pc.id]?.date ? (
                                                <span className="text-text-primary">
                                                    {new Date(allExpiringPoints[pc.id].date).toLocaleDateString()}
                                                </span>
                                            ) : (
                                                <span className="text-text-tertiary text-xs">---</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-sm font-medium text-center whitespace-nowrap">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedClient(pc);
                                                        setShowEarnModal(true);
                                                    }}
                                                    className="flex items-center gap-2 px-3 py-1.5 text-white bg-success hover:bg-success-dark rounded-md shadow-sm transition-all hover:scale-105 text-[11px] uppercase tracking-wider font-bold"
                                                    title="Acumular Pontos (Adicionar)"
                                                >
                                                    <Icon name="PlusCircle" className="w-3.5 h-3.5" />
                                                    Adicionar
                                                </button>

                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedClient(pc);
                                                        setShowRedeemModal(true);
                                                    }}
                                                    className="flex items-center gap-2 px-3 py-1.5 text-white bg-accent-primary hover:bg-accent-secondary rounded-md shadow-sm transition-all hover:scale-105 text-[11px] uppercase tracking-wider font-bold"
                                                    title="Resgatar Pontos"
                                                >
                                                    <Icon name="MinusCircle" className="w-3.5 h-3.5" />
                                                    Resgatar
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal de Detalhes do Cliente */}
            {showDetailsModal && selectedClient && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4" onClick={() => setShowDetailsModal(false)}>
                    <div className="bg-bg-secondary rounded-xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        <div className="bg-gradient-to-r from-accent-primary/5 to-brand-cyan/5 border-b border-border-secondary px-6 py-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                                        {selectedClient.client?.nome}
                                        {selectedClient.is_vip && <Icon name="Crown" className="w-4 h-4 text-amber-500" />}
                                    </h2>
                                    <p className="text-xs text-text-secondary mt-1">
                                        Membro desde {new Date(selectedClient.joined_at).toLocaleDateString()}
                                    </p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2 pr-4 border-r border-border-secondary">
                                        <span className="text-xs font-semibold text-text-secondary uppercase">Status:</span>
                                        <ToggleSwitch
                                            checked={selectedClient.is_active}
                                            onChange={() => handleToggleStatus(selectedClient.id, selectedClient.is_active)}
                                        />
                                        <span className={`text-[10px] uppercase font-bold w-12 ${selectedClient.is_active ? 'text-success' : 'text-danger'}`}>
                                            {selectedClient.is_active ? 'Ativo' : 'Inativo'}
                                        </span>
                                    </div>

                                    <button
                                        onClick={() => handleToggleVip(selectedClient.id, selectedClient.is_vip)}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${selectedClient.is_vip
                                            ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20 shadow-sm'
                                            : 'bg-bg-tertiary text-text-tertiary border border-border-secondary hover:text-text-secondary'
                                            }`}
                                    >
                                        <Icon name="Crown" className={`w-3.5 h-3.5 ${selectedClient.is_vip ? 'fill-amber-500' : ''}`} />
                                        {selectedClient.is_vip ? 'CLIENTE VIP' : 'TORNAR VIP'}
                                    </button>
                                    <button
                                        onClick={() => setShowDetailsModal(false)}
                                        className="text-text-tertiary hover:text-text-primary p-2 transition-colors"
                                    >
                                        <Icon name="X" className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(85vh-80px)]">
                            {/* Resumo */}
                            <div className="grid grid-cols-4 gap-4">
                                <div className="rounded-lg border border-border-secondary bg-bg-tertiary p-4 relative group">
                                    <div className="flex items-center justify-between mb-1">
                                        <p className="text-xs text-text-secondary">Saldo</p>
                                        {!editingBalance && (
                                            <button
                                                onClick={() => {
                                                    setEditingBalance(true);
                                                    setNewBalance(selectedClient.current_balance.toString());
                                                }}
                                                className="text-text-tertiary hover:text-accent-primary transition-colors opacity-0 group-hover:opacity-100"
                                            >
                                                <Icon name="Edit2" className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                    {editingBalance ? (
                                        <div className="flex flex-col gap-2">
                                            <input
                                                type="number"
                                                autoFocus
                                                value={newBalance}
                                                onChange={(e) => setNewBalance(e.target.value)}
                                                className="w-full rounded-md border border-accent-primary bg-bg-secondary px-2 py-1 text-sm text-text-primary focus:outline-none"
                                            />
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={handleAdjustBalance}
                                                    className="text-xs font-semibold text-success hover:underline"
                                                >
                                                    Salvar
                                                </button>
                                                <button
                                                    onClick={() => setEditingBalance(false)}
                                                    className="text-xs font-semibold text-text-tertiary hover:underline"
                                                >
                                                    Cancelar
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-xl font-bold text-text-primary">R$ {selectedClient.current_balance.toFixed(2)}</p>
                                    )}
                                </div>
                                <div className="rounded-lg border border-border-secondary bg-bg-tertiary p-4">
                                    <p className="text-xs text-text-secondary mb-1">Ganho</p>
                                    <p className="text-xl font-bold text-success">R$ {selectedClient.total_earned.toFixed(2)}</p>
                                </div>
                                <div className="rounded-lg border border-border-secondary bg-bg-tertiary p-4">
                                    <p className="text-xs text-text-secondary mb-1">Total Resgatado</p>
                                    <p className="text-xl font-bold text-text-secondary">R$ {selectedClient.total_redeemed.toFixed(2)}</p>
                                </div>
                                <div className="rounded-lg border border-border-secondary bg-amber-500/5 border-amber-500/20 p-4">
                                    <div className="flex items-center gap-2 text-amber-600 mb-1">
                                        <Icon name="AlertTriangle" className="w-3.5 h-3.5" />
                                        <p className="text-xs font-medium text-amber-600">A Vencer</p>
                                    </div>
                                    <p className="text-xl font-bold text-amber-600">
                                        R$ {allExpiringPoints[selectedClient.id]?.amount.toFixed(2) || '0.00'}
                                    </p>
                                    {allExpiringPoints[selectedClient.id]?.date && (
                                        <p className="text-[10px] text-amber-600/70 mt-1">
                                            Expira em: {new Date(allExpiringPoints[selectedClient.id].date).toLocaleDateString()}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Histórico de Transações */}
                            <div>
                                <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
                                    <Icon name="History" className="w-4 h-4" />
                                    Histórico de Transações
                                </h3>
                                <div className="space-y-2 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                                    {clientTransactions.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-12 text-text-tertiary opacity-50">
                                            <Icon name="FileText" className="w-12 h-12 mb-2" />
                                            <p className="text-sm">Nenhuma transação registrada</p>
                                        </div>
                                    ) : (
                                        clientTransactions.map((tx) => {
                                            const isAdjustment = tx.type === 'manual_adjustment';
                                            const isEarn = tx.type === 'earn';
                                            const isRedeem = tx.type === 'redeem';

                                            return (
                                                <div key={tx.id} className="flex items-center justify-between p-3 rounded-xl border border-border-secondary bg-bg-tertiary hover:bg-bg-secondary transition-all group">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`p-2.5 rounded-xl ${isEarn ? 'bg-success/10 text-success' :
                                                            isAdjustment ? 'bg-accent-primary/10 text-accent-primary' :
                                                                'bg-danger/10 text-danger'
                                                            }`}>
                                                            <Icon
                                                                name={isEarn ? 'TrendingUp' : isAdjustment ? 'Settings2' : 'TrendingDown'}
                                                                className="w-4 h-4"
                                                            />
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <p className="text-sm font-semibold text-text-primary">
                                                                    {isEarn ? 'Acúmulo' : isAdjustment ? 'Ajuste Manual' : 'Resgate'}
                                                                </p>
                                                                {isAdjustment && (
                                                                    <span className="px-1.5 py-0.5 rounded-full bg-accent-primary/10 text-accent-primary text-[10px] font-bold uppercase tracking-wider">
                                                                        Sistema
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex flex-col gap-0.5 mt-0.5">
                                                                <p className="text-[11px] text-text-secondary flex items-center gap-1">
                                                                    <Icon name="Calendar" className="w-3 h-3 opacity-50" />
                                                                    {new Date(tx.created_at).toLocaleString('pt-BR')}
                                                                </p>
                                                                {isAdjustment && tx.adjusted_by && (
                                                                    <p className="text-[11px] text-accent-primary font-medium flex items-center gap-1">
                                                                        <Icon name="User" className="w-3 h-3" />
                                                                        Editado por: {tx.adjusted_by.full_name}
                                                                    </p>
                                                                )}
                                                                {tx.description && (
                                                                    <p className="text-xs text-text-tertiary italic mt-1 pb-1 border-b border-border-secondary/30">
                                                                        {tx.description}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className={`text-base font-bold ${(tx.points || 0) > 0 ? 'text-success' : 'text-danger'}`}>
                                                            {(tx.points || 0) > 0 ? '+' : ''} R$ {Math.abs(tx.points || 0).toFixed(2)}
                                                        </p>
                                                        {tx.expires_at && (
                                                            <p className="text-[10px] text-text-tertiary">
                                                                Expira em: {new Date(tx.expires_at).toLocaleDateString()}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Painel Lateral de Configuração */}
            {showConfigPanel && plan && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-end z-50" onClick={() => setShowConfigPanel(false)}>
                    <div
                        className="bg-bg-secondary h-full w-full max-w-2xl shadow-2xl overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="sticky top-0 bg-gradient-to-r from-accent-primary/5 to-brand-cyan/5 border-b border-border-secondary px-6 py-4 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-text-primary">Configuração do Plano</h2>
                                <div className="flex items-center gap-2 text-xs text-text-secondary mt-1">
                                    {saving ? (
                                        <>
                                            <div className="w-3 h-3 border-2 border-accent-primary/30 border-t-accent-primary rounded-full animate-spin"></div>
                                            <span>Salvando...</span>
                                        </>
                                    ) : lastSaved ? (
                                        <>
                                            <Icon name="Check" className="w-3 h-3 text-success" />
                                            <span>Salvo {lastSaved.toLocaleTimeString()}</span>
                                        </>
                                    ) : null}
                                </div>
                            </div>
                            <button
                                onClick={() => setShowConfigPanel(false)}
                                className="text-text-secondary hover:text-text-primary transition-colors"
                            >
                                <Icon name="X" className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-6">
                            {/* Nome, Datas e Tipo */}
                            <div className="grid grid-cols-2 gap-4">
                                <label className="flex flex-col gap-1.5 col-span-2">
                                    <span className="text-xs font-medium text-text-secondary">Nome do Plano</span>
                                    <input
                                        type="text"
                                        value={plan.name || ''}
                                        onChange={(e) => handleFieldChange('name', e.target.value)}
                                        className="rounded-lg border border-border-secondary bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all"
                                    />
                                </label>

                                <label className="flex flex-col gap-1.5">
                                    <span className="text-xs font-medium text-text-secondary">Data de Início</span>
                                    <input
                                        type="date"
                                        value={plan.start_date || ''}
                                        onChange={(e) => handleFieldChange('start_date', e.target.value || null)}
                                        className="rounded-lg border border-border-secondary bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all"
                                    />
                                </label>

                                <label className="flex flex-col gap-1.5">
                                    <span className="text-xs font-medium text-text-secondary">Data de Término</span>
                                    <input
                                        type="date"
                                        value={plan.end_date || ''}
                                        onChange={(e) => handleFieldChange('end_date', e.target.value || null)}
                                        className="rounded-lg border border-border-secondary bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all"
                                    />
                                </label>

                                <label className="flex flex-col gap-1.5 col-span-2">
                                    <span className="text-xs font-medium text-text-secondary">Tipo</span>
                                    <select
                                        value={plan.type || 'cashback'}
                                        onChange={(e) => handleFieldChange('type', e.target.value as 'cashback' | 'points')}
                                        className="rounded-lg border border-border-secondary bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all"
                                    >
                                        <option value="cashback">Cashback (%)</option>
                                        <option value="points">Pontos</option>
                                    </select>
                                </label>
                            </div>

                            {/* Regras de Acúmulo */}
                            <div className="rounded-lg border border-border-secondary bg-bg-tertiary/50 p-4 space-y-3">
                                <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                                    <Icon name="TrendingUp" className="w-4 h-4" />
                                    Regras de Acúmulo
                                </h3>

                                <div className="grid grid-cols-2 gap-3">
                                    {plan.type === 'cashback' ? (
                                        <label className="flex flex-col gap-1.5">
                                            <span className="text-xs font-medium text-text-secondary">Cashback (%)</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                max="100"
                                                value={plan.reward_percentage || ''}
                                                onChange={(e) => handleFieldChange('reward_percentage', parseFloat(e.target.value) || null)}
                                                className="rounded-lg border border-border-secondary bg-bg-secondary px-3 py-2 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all"
                                            />
                                        </label>
                                    ) : (
                                        <label className="flex flex-col gap-1.5">
                                            <span className="text-xs font-medium text-text-secondary">Pontos por R$ 1</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={plan.points_per_real || ''}
                                                onChange={(e) => handleFieldChange('points_per_real', parseFloat(e.target.value) || null)}
                                                className="rounded-lg border border-border-secondary bg-bg-secondary px-3 py-2 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all"
                                            />
                                        </label>
                                    )}

                                    <label className="flex flex-col gap-1.5">
                                        <span className="text-xs font-medium text-text-secondary">Valor Mínimo (R$)</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={plan.min_purchase_value || ''}
                                            onChange={(e) => handleFieldChange('min_purchase_value', parseFloat(e.target.value) || null)}
                                            className="rounded-lg border border-border-secondary bg-bg-secondary px-3 py-2 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all"
                                        />
                                    </label>

                                    <label className="flex flex-col gap-1.5">
                                        <span className="text-xs font-medium text-text-secondary flex items-center gap-1">
                                            <Icon name="Crown" className="w-3 h-3 text-amber-500" />
                                            Multiplicador VIP
                                        </span>
                                        <input
                                            type="number"
                                            step="0.1"
                                            min="1"
                                            value={plan.vip_multiplier || ''}
                                            onChange={(e) => handleFieldChange('vip_multiplier', parseFloat(e.target.value) || null)}
                                            className="rounded-lg border border-border-secondary bg-bg-secondary px-3 py-2 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all"
                                        />
                                    </label>

                                    <label className="flex flex-col gap-1.5">
                                        <span className="text-xs font-medium text-text-secondary flex items-center gap-1">
                                            <Icon name="Calendar" className="w-3 h-3 text-accent-primary" />
                                            Validade (dias)
                                        </span>
                                        <input
                                            type="number"
                                            min="0"
                                            value={plan.validity_days || ''}
                                            onChange={(e) => handleFieldChange('validity_days', e.target.value ? parseInt(e.target.value) : null)}
                                            placeholder="Sem expiração"
                                            className="rounded-lg border border-border-secondary bg-bg-secondary px-3 py-2 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all"
                                        />
                                        <span className="text-xs text-text-tertiary">A partir do 1º acúmulo</span>
                                    </label>
                                </div>
                            </div>

                            {/* Descrição */}
                            <label className="flex flex-col gap-1.5">
                                <span className="text-xs font-medium text-text-secondary">Descrição</span>
                                <textarea
                                    value={plan.description || ''}
                                    onChange={(e) => handleFieldChange('description', e.target.value || null)}
                                    rows={3}
                                    className="rounded-lg border border-border-secondary bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all resize-none"
                                    placeholder="Descreva o plano..."
                                />
                            </label>

                            {/* Status */}
                            <div className="flex items-center gap-2">
                                <input
                                    id="is-active"
                                    type="checkbox"
                                    checked={plan.is_active || false}
                                    onChange={(e) => handleFieldChange('is_active', e.target.checked)}
                                    className="h-4 w-4 rounded border-border-secondary text-accent-primary focus:ring-2 focus:ring-accent-primary/20"
                                />
                                <label htmlFor="is-active" className="text-sm font-medium text-text-primary cursor-pointer">
                                    Plano ativo
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Adicionar Cliente */}
            {showClientModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4" onClick={() => {
                    setShowClientModal(false);
                    setSearchTerm('');
                }}>
                    <div className="bg-bg-secondary rounded-xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        <div className="bg-gradient-to-r from-accent-primary/5 to-brand-cyan/5 border-b border-border-secondary px-5 py-3.5">
                            <h2 className="text-lg font-bold text-text-primary">Adicionar Cliente ao Plano</h2>
                        </div>

                        {/* Campo de Busca */}
                        <div className="px-5 pt-4 pb-2">
                            <div className="relative">
                                <Icon name="Search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Buscar cliente por nome..."
                                    className="w-full pl-10 pr-3 py-2 rounded-lg border border-border-secondary bg-bg-tertiary text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all"
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="px-5 pb-3 overflow-y-auto max-h-[50vh] space-y-2">
                            {!searchTerm ? (
                                <div className="flex flex-col items-center justify-center py-12 text-text-tertiary opacity-50">
                                    <Icon name="Search" className="w-12 h-12 mb-2" />
                                    <p className="text-sm font-medium">Digite o nome do cliente para buscar</p>
                                </div>
                            ) : filteredClients.length === 0 ? (
                                <p className="text-sm text-text-secondary text-center py-8">
                                    Nenhum cliente encontrado
                                </p>
                            ) : (
                                filteredClients.map(client => (
                                    <div
                                        key={client.id}
                                        className="flex items-center gap-3 p-3 rounded-lg border border-border-secondary hover:bg-bg-tertiary transition-colors"
                                    >
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-text-primary">{client.nome}</p>
                                        </div>

                                        <button
                                            onClick={() => handleAddClient(client.id, false)}
                                            className="px-3 py-1.5 bg-accent-primary text-white text-xs font-medium rounded-lg hover:bg-accent-primary/90 transition-colors"
                                        >
                                            Adicionar
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="border-t border-border-secondary bg-bg-tertiary px-5 py-3 flex justify-end">
                            <button
                                onClick={() => {
                                    setShowClientModal(false);
                                    setSearchTerm('');
                                }}
                                className="px-4 py-2 bg-bg-secondary border border-border-secondary text-text-primary text-sm font-medium rounded-lg hover:bg-bg-tertiary transition-colors"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Acúmulo */}
            {showEarnModal && selectedClient && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] px-4" onClick={() => setShowEarnModal(false)}>
                    <div className="bg-bg-secondary rounded-xl shadow-2xl max-w-sm w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        <div className="bg-gradient-to-r from-accent-primary/5 to-brand-cyan/5 border-b border-border-secondary px-5 py-3.5">
                            <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                                <Icon name="TrendingUp" className="w-5 h-5 text-success" />
                                Acumular Pontos
                            </h2>
                        </div>

                        <div className="p-5 space-y-4">
                            <div className="p-3 bg-bg-tertiary rounded-lg border border-border-secondary">
                                <p className="text-xs text-text-secondary">Cliente</p>
                                <p className="text-sm font-bold text-text-primary">{selectedClient.client?.nome}</p>
                            </div>

                            <label className="flex flex-col gap-1.5">
                                <span className="text-xs font-medium text-text-secondary">Valor da Venda (R$)</span>
                                <input
                                    type="number"
                                    value={earnAmount}
                                    onChange={(e) => setEarnAmount(e.target.value)}
                                    placeholder="Ex: 150.00"
                                    className="w-full px-3 py-2 rounded-lg border border-border-secondary bg-bg-tertiary text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all font-bold"
                                    autoFocus
                                />
                                {earnAmount && plan && (
                                    <p className="text-[10px] text-text-tertiary mt-0.5">
                                        Serão gerados <strong>R$ {(() => {
                                            const val = parseFloat(earnAmount);
                                            const mult = selectedClient.is_vip ? (plan.vip_multiplier || 1) : 1;
                                            if (plan.type === 'cashback') return (val * (plan.reward_percentage || 0) / 100 * mult).toFixed(2);
                                            return (val * (plan.points_per_real || 0) * mult).toFixed(2);
                                        })()}</strong> em cashback/pontos.
                                    </p>
                                )}
                            </label>

                            <label className="flex flex-col gap-1.5">
                                <span className="text-xs font-medium text-text-secondary">Observação (Opcional)</span>
                                <textarea
                                    value={earnDescription}
                                    onChange={(e) => setEarnDescription(e.target.value)}
                                    placeholder="Ex: Venda de produtos"
                                    rows={2}
                                    className="w-full px-3 py-2 rounded-lg border border-border-secondary bg-bg-tertiary text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all resize-none"
                                />
                            </label>

                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setShowEarnModal(false)}
                                    className="flex-1 px-4 py-2 bg-bg-secondary border border-border-secondary text-text-primary text-sm font-bold rounded-lg hover:bg-bg-tertiary transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleEarnPoints}
                                    disabled={isAddingPoints || !earnAmount}
                                    className="flex-1 px-4 py-2 bg-accent-primary text-white text-sm font-bold rounded-lg hover:bg-accent-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isAddingPoints ? (
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    ) : (
                                        <>
                                            <Icon name="Check" className="w-4 h-4" />
                                            Confirmar
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Resgate */}
            {showRedeemModal && selectedClient && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] px-4" onClick={() => setShowRedeemModal(false)}>
                    <div className="bg-bg-secondary rounded-xl shadow-2xl max-w-sm w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        <div className="bg-gradient-to-r from-success/5 to-brand-cyan/5 border-b border-border-secondary px-5 py-3.5">
                            <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                                <Icon name="TrendingDown" className="w-5 h-5 text-success" />
                                Resgatar Pontos
                            </h2>
                        </div>

                        <div className="p-5 space-y-4">
                            <div className="p-3 bg-bg-tertiary rounded-lg border border-border-secondary">
                                <p className="text-xs text-text-secondary">Saldo Disponível</p>
                                <p className="text-lg font-bold text-text-primary">R$ {selectedClient.current_balance.toFixed(2)}</p>
                            </div>

                            <label className="flex flex-col gap-1.5">
                                <span className="text-xs font-medium text-text-secondary">Quantidade de Pontos</span>
                                <input
                                    type="number"
                                    value={redeemAmount}
                                    onChange={(e) => setRedeemAmount(e.target.value)}
                                    placeholder="Ex: 10.00"
                                    className="w-full px-3 py-2 rounded-lg border border-border-secondary bg-bg-tertiary text-sm text-text-primary focus:border-success focus:outline-none focus:ring-2 focus:ring-success/20 transition-all font-bold"
                                    autoFocus
                                />
                            </label>

                            <label className="flex flex-col gap-1.5">
                                <span className="text-xs font-medium text-text-secondary">Observação (Opcional)</span>
                                <textarea
                                    value={redeemDescription}
                                    onChange={(e) => setRedeemDescription(e.target.value)}
                                    placeholder="Ex: Voucher de desconto R$ 20,00"
                                    rows={2}
                                    className="w-full px-3 py-2 rounded-lg border border-border-secondary bg-bg-tertiary text-sm text-text-primary focus:border-success focus:outline-none focus:ring-2 focus:ring-success/20 transition-all resize-none"
                                />
                            </label>

                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setShowRedeemModal(false)}
                                    className="flex-1 px-4 py-2 bg-bg-secondary border border-border-secondary text-text-primary text-sm font-bold rounded-lg hover:bg-bg-tertiary transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleRedeemPoints}
                                    disabled={isRedeeming || !redeemAmount}
                                    className="flex-1 px-4 py-2 bg-success text-white text-sm font-bold rounded-lg hover:bg-success/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isRedeeming ? (
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    ) : (
                                        <>
                                            <Icon name="Check" className="w-4 h-4" />
                                            Confirmar
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LoyaltyPage;
