
import React, { useEffect, useState, useMemo } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { fetchPayments, fetchClientAppointments, updatePaymentAppointment } from '../../services/financial/financial.service';
import { PaymentRecord } from '../../types';
import { Icon } from '../ui/Icon';
import { supabase } from '../../services/supabaseClient';
import { WebhookScheduleModal } from '../ui/WebhookScheduleModal';
import { FinancialSettingsModal } from '../ui/FinancialSettingsModal';

const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    // Handle YYYY-MM-DD specifically to avoid timezone issues
    if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [year, month, day] = dateString.split('-').map(Number);
        return new Date(year, month - 1, day).toLocaleDateString('pt-BR');
    }
    return new Date(dateString).toLocaleDateString('pt-BR');
};

const AppointmentSelector: React.FC<{
    payment: PaymentRecord;
    unitCode: string;
    onUpdate: () => void;
}> = ({ payment, unitCode, onUpdate }) => {
    const [options, setOptions] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [selectedApptId, setSelectedApptId] = useState<string | null>(payment.atendimento_id ? String(payment.atendimento_id) : null);

    // Sync with prop changes
    useEffect(() => {
        if (payment.atendimento_id) {
            setSelectedApptId(String(payment.atendimento_id));
        }
    }, [payment.atendimento_id]);

    // Carrega opções quando o dropdown abre
    const loadOptions = async () => {
        if (options.length > 0) return; // cache simples
        setLoading(true);
        try {
            // Usa a data de vencimento como referência do mês do atendimento
            const refDate = payment.data_vencimento || new Date().toISOString();
            // Calculate start/end of month for the reference date
            const d = new Date(refDate);
            const startDate = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
            const endDate = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];

            // Tenta buscar pelo nome do cliente
            const clientName = payment.nome ||
                (Array.isArray(payment.unit_clients) ? payment.unit_clients[0]?.nome : payment.unit_clients?.nome) ||
                '';

            if (clientName) {
                const appts = await fetchClientAppointments(unitCode, clientName, startDate, endDate);
                setOptions(appts);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSelect = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newVal = e.target.value === '' ? null : e.target.value;
        setSelectedApptId(newVal);
        try {
            await updatePaymentAppointment(payment.id, newVal);
            onUpdate(); // Recarrega dados pai para confirmar
        } catch (error) {
            console.error("Falha ao vincular", error);
            // Reverte em caso de erro (opcional)
            setSelectedApptId(null);
        }
    };

    // Renderiza badge estático se já estiver vinculado
    if (selectedApptId) {
        return (
            <div className="text-text-primary" title={`Atendimento #${selectedApptId}`}>
                {selectedApptId}
            </div>
        );
    }

    return (
        <div className="relative min-w-[120px] h-7">
            {/* Display Visual - Placeholder "Vincular" */}
            <div className={`absolute inset-0 flex items-center justify-between px-2 border rounded text-xs bg-bg-tertiary text-text-secondary border-border-secondary hover:border-accent-primary/50 transition-colors`}>
                <span className="truncate">
                    Vincular
                </span>
                <Icon name="ChevronDown" className="w-3 h-3 opacity-50 flex-shrink-0 ml-1" />
            </div>

            {/* Select Funcional Invisível */}
            <select
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                value={selectedApptId || ''}
                onClick={() => !isOpen && (setIsOpen(true), loadOptions())}
                onChange={handleSelect}
            >
                <option value="">Selecione...</option>
                {loading ? (
                    <option disabled>Carregando...</option>
                ) : (
                    options.map(opt => (
                        <option key={opt.id} value={opt.atendimento_id}>
                            {new Date(opt.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} • {opt.time?.slice(0, 5)} • {opt.status?.toLowerCase()}
                        </option>
                    ))
                )}
            </select>
        </div>
    );
};

import { PaymentDetailModal } from '../ui/PaymentDetailModal';

type MainTab = 'resumo' | 'faturamento' | 'financas' | 'gestor';
type SubTab = string;

const FinancialPage: React.FC = () => {
    const { selectedUnit } = useAppContext();
    const [payments, setPayments] = useState<PaymentRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>('ALL');
    const [dateRange, setDateRange] = useState<'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'LAST_MONTH' | 'ALL'>('TODAY');
    const [modalPayment, setModalPayment] = useState<PaymentRecord | null>(null);
    const [webhookUrl, setWebhookUrl] = useState<string | null>(null);
    const [scheduleParams, setScheduleParams] = useState<{ open: boolean, payment: PaymentRecord | null }>({ open: false, payment: null });
    const [settingsOpen, setSettingsOpen] = useState(false);

    // Navigation State
    const [activeTab, setActiveTab] = useState<MainTab>('resumo');
    const [activeSubTab, setActiveSubTab] = useState<SubTab>('visao_geral');
    const [cardFilter, setCardFilter] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    // Handle Tab Change and set default sub-tab
    const handleTabChange = (tab: MainTab) => {
        setActiveTab(tab);
        switch (tab) {
            case 'resumo': setActiveSubTab('visao_geral'); break;
            case 'faturamento': setActiveSubTab('todas_cobrancas'); break;
            case 'financas': setActiveSubTab('fluxo_caixa'); break;
            case 'gestor': setActiveSubTab('configuracoes'); break;
        }
    };

    // Sub-menus configuration
    const subMenus: Record<MainTab, { id: string; label: string; icon?: any }[]> = {
        resumo: [], // Removido sub-menus conforme solicitado
        faturamento: [
            { id: 'todas_cobrancas', label: 'Todas Cobranças', icon: 'List' },
            { id: 'nova_cobranca', label: 'Nova Cobrança', icon: 'PlusCircle' },
            { id: 'regua', label: 'Régua de Cobrança', icon: 'Send' },
        ],
        financas: [
            { id: 'fluxo_caixa', label: 'Fluxo de Caixa', icon: 'TrendingUp' },
            { id: 'contas_pagar', label: 'Contas a Pagar', icon: 'ArrowDownCircle' },
            { id: 'contas_receber', label: 'Contas a Receber', icon: 'ArrowUpCircle' },
        ],
        gestor: [
            { id: 'configuracoes', label: 'Configurações', icon: 'Settings' },
            { id: 'metas', label: 'Metas', icon: 'Target' },
            { id: 'comissoes', label: 'Comissões', icon: 'Users' },
        ],
    };

    // Fetch Webhook URL
    useEffect(() => {
        const fetchUrl = async () => {
            const { data } = await supabase
                .from('modules')
                .select('webhook_url')
                .eq('code', 'financial_module')
                .single();
            if (data && data.webhook_url) {
                setWebhookUrl(data.webhook_url);
            }
        };
        fetchUrl();
    }, []);

    const handleInstantSend = async (payment: PaymentRecord) => {
        if (!webhookUrl) {
            alert("URL do Webhook não configurada no módulo Financeiro.");
            return;
        }
        if (!confirm("Deseja enviar cobrança agora?")) return;

        try {
            const res = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'cobrar',
                    payment_id: payment.id,
                    origin: 'financial_table',
                    unit_code: selectedUnit?.unit_code,
                    id_pagamento_asaas: payment.id_pagamento_asaas,
                    cliente_asaas_id: payment.cliente_asaas_id
                })
            });
            if (res.ok) alert("Cobrança enviada!");
            else alert("Erro ao enviar cobrança.");
        } catch (e) {
            console.error(e);
            alert("Erro de conexão.");
        }
    };

    const loadData = async () => {
        if (!selectedUnit) return;
        setLoading(true);
        try {
            // Calculate date range
            let startDate: string | undefined;
            let endDate: string | undefined;
            const now = new Date();

            switch (dateRange) {
                case 'TODAY':
                    startDate = now.toISOString().split('T')[0];
                    endDate = now.toISOString().split('T')[0];
                    break;
                case 'YESTERDAY':
                    const yesterday = new Date(now);
                    yesterday.setDate(now.getDate() - 1);
                    startDate = yesterday.toISOString().split('T')[0];
                    endDate = yesterday.toISOString().split('T')[0];
                    break;
                case 'THIS_WEEK':
                    const firstDayOfWeek = new Date(now);
                    const day = now.getDay() || 7; // Get current day number, converting Sun(0) to 7
                    if (day !== 1) firstDayOfWeek.setHours(-24 * (day - 1)); // Adjust to Monday
                    startDate = firstDayOfWeek.toISOString().split('T')[0];
                    endDate = now.toISOString().split('T')[0]; // Up to today
                    break;
                case 'THIS_MONTH':
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
                    break;
                case 'LAST_MONTH':
                    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
                    endDate = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
                    break;
                case 'ALL':
                default:
                    startDate = undefined;
                    endDate = undefined;
                    break;
            }

            const data = await fetchPayments(selectedUnit.id, {
                status: filterStatus === 'ALL' ? undefined : filterStatus,
                startDate,
                endDate
            });

            // Validação para evitar alerta de Unique Key se houver IDs duplicados ou nulos
            const uniqueIds = new Set(data.map(p => p.id));
            if (uniqueIds.size !== data.length) {
                console.warn("Alerta: Existem registros sem ID único na lista!", data);
            }

            setPayments(data);
        } catch (error) {
            console.error('Erro ao carregar financeiro:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [selectedUnit, filterStatus, dateRange]);

    const billingMetrics = useMemo(() => {
        const calculateCategory = (statuses: string[], usePaymentDate = false) => {
            let filteredInfo = payments.filter(p => statuses.includes(p.status_pagamento));

            // For received payments, only count those with payment date
            if (usePaymentDate) {
                filteredInfo = filteredInfo.filter(p => p.data_pagamento);
            }

            const totalValue = filteredInfo.reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0);
            const count = filteredInfo.length;
            // Count unique clients
            const uniqueClients = new Set(filteredInfo.map(p => p.cliente_asaas_id)).size;
            return { totalValue, count, uniqueClients };
        };

        return {
            received: calculateCategory(['RECEIVED', 'RECEIVED_IN_CASH', 'PAGO'], true),
            confirmed: calculateCategory(['CONFIRMED', 'CONFIRMADO'], true),
            pending: calculateCategory(['PENDING', 'PENDENTE']),
            overdue: calculateCategory(['OVERDUE', 'ATRASADO'])
        };
    }, [payments]);

    const renderBillingStatus = () => (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-text-primary">Situação das cobranças</h2>
                <select
                    value={dateRange}
                    onChange={(e) => setDateRange(e.target.value as any)}
                    className="bg-bg-tertiary border border-border-secondary text-text-primary text-sm rounded-md focus:ring-accent-primary focus:border-accent-primary block px-3 py-1.5"
                >
                    <option value="TODAY">Hoje</option>
                    <option value="YESTERDAY">Ontem</option>
                    <option value="THIS_WEEK">Esta Semana</option>
                    <option value="THIS_MONTH">Este Mês</option>
                    <option value="LAST_MONTH">Mês Passado</option>
                    <option value="ALL">Todo o Período</option>
                </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {([
                    { key: 'received', label: 'Recebidas', statuses: ['RECEIVED', 'RECEIVED_IN_CASH', 'PAGO'], data: billingMetrics.received, color: 'emerald', barColor: 'bg-emerald-500' },
                    { key: 'confirmed', label: 'Confirmadas', statuses: ['CONFIRMED', 'CONFIRMADO'], data: billingMetrics.confirmed, color: 'blue', barColor: 'bg-blue-600' },
                    { key: 'pending', label: 'Aguardando pagamento', statuses: ['PENDING', 'PENDENTE'], data: billingMetrics.pending, color: 'amber', barColor: 'bg-amber-500' },
                    { key: 'overdue', label: 'Vencidas', statuses: ['OVERDUE', 'ATRASADO'], data: billingMetrics.overdue, color: 'rose', barColor: 'bg-rose-500' }
                ] as const).map(card => (
                    <div
                        key={card.key}
                        onClick={() => {
                            // Toggle filter: if already filtered by this card, clear filter; otherwise set filter
                            if (JSON.stringify(cardFilter) === JSON.stringify(card.statuses)) {
                                setCardFilter([]);
                            } else {
                                setCardFilter([...card.statuses]);
                            }
                        }}
                        className={`bg-bg-secondary rounded-xl border p-5 shadow-sm hover:shadow-md transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${JSON.stringify(cardFilter) === JSON.stringify(card.statuses)
                            ? 'border-accent-primary ring-2 ring-accent-primary/20'
                            : 'border-border-secondary'
                            }`}
                    >
                        <div className="flex justify-between items-start mb-2">
                            <span className="font-semibold text-text-primary">{card.label}</span>
                            <Icon name="Info" className="w-4 h-4 text-text-tertiary cursor-help" />
                        </div>

                        <div className={`text-2xl font-bold mb-1 text-${card.color}-500`}>
                            {formatCurrency(card.data.totalValue)}
                        </div>
                        <div className="text-xs text-text-secondary mb-4">
                            {formatCurrency(card.data.totalValue)} líquido
                        </div>

                        {/* Progress Bar Visual */}
                        <div className="w-full h-2 bg-bg-tertiary rounded-full mb-4 overflow-hidden">
                            <div className={`h-full ${card.barColor} rounded-full`} style={{ width: '60%' }}></div>
                            {/* Width fixa de ex 60% apenas visual, idealmente seria percentual real se houvesse meta */}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'RECEIVED': return <span className="px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-medium border border-emerald-500/20">Pago</span>;
            case 'CONFIRMED': return <span className="px-2 py-1 rounded-full bg-blue-500/10 text-blue-500 text-xs font-medium border border-blue-500/20">Confirmado</span>;
            case 'PENDING': return <span className="px-2 py-1 rounded-full bg-yellow-500/10 text-yellow-500 text-xs font-medium border border-yellow-500/20">Pendente</span>;
            case 'OVERDUE': return <span className="px-2 py-1 rounded-full bg-rose-500/10 text-rose-500 text-xs font-medium border border-rose-500/20">Atrasado</span>;
            default: return <span className="px-2 py-1 rounded-full bg-gray-500/10 text-gray-500 text-xs font-medium border border-gray-500/20">{status}</span>;
        }
    };

    // Render Helpers (renderKPIs removido)

    const renderTable = () => (
        <div className="bg-bg-secondary rounded-lg shadow-md overflow-hidden mt-6">
            <div className="p-4 border-b border-border-secondary bg-bg-tertiary/30 flex items-center justify-between">
                <h3 className="font-medium text-text-primary">Registros de Cobrança</h3>
                <div className="relative">
                    <Icon name="Search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                    <input
                        type="text"
                        placeholder="Buscar por nome ou fatura..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 pr-3 py-1.5 bg-bg-secondary border border-border-secondary rounded-md text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent-primary/50 w-64"
                    />
                </div>
            </div>

            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-bg-tertiary shadow-sm">
                        <tr className="text-text-secondary">
                            <th className="px-4 py-3 text-left font-semibold">Nome</th>
                            <th className="px-4 py-3 text-center font-semibold">Valor</th>
                            <th className="px-4 py-3 text-center font-semibold">Forma</th>
                            <th className="px-4 py-3 text-center font-semibold">Vencimento</th>
                            <th className="px-4 py-3 text-center font-semibold">Pagamento</th>
                            <th className="px-4 py-3 text-center font-semibold">Status</th>
                            <th className="px-4 py-3 text-right font-semibold">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border-secondary">
                        {loading ? (
                            <tr>
                                <td colSpan={7} className="py-10 text-center">
                                    <div className="w-8 h-8 border-2 border-gray-200 border-t-accent-primary rounded-full animate-spin mx-auto"></div>
                                </td>
                            </tr>
                        ) : payments.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="py-8 text-center text-text-secondary">
                                    Nenhum registro encontrado.
                                </td>
                            </tr>
                        ) : (
                            payments
                                .filter(payment => cardFilter.length === 0 || cardFilter.includes(payment.status_pagamento))
                                .filter(payment => {
                                    if (!searchTerm) return true;
                                    const term = searchTerm.toLowerCase();
                                    const nome = payment.nome?.toLowerCase() || '';
                                    const fatura = payment.numero_fatura?.toLowerCase() || '';
                                    return nome.includes(term) || fatura.includes(term);
                                })
                                .map((payment) => (
                                    <tr
                                        key={payment.id}
                                        className="hover:bg-bg-tertiary transition-colors cursor-pointer select-none"
                                        onDoubleClick={() => setModalPayment(payment)}
                                    >
                                        <td className="px-4 py-3 font-medium text-text-primary block">
                                            <div className="truncate max-w-[200px]" title={payment.nome || ''}>
                                                {payment.nome || (Array.isArray(payment.unit_clients)
                                                    ? payment.unit_clients[0]?.nome
                                                    : payment.unit_clients?.nome) || 'Cliente Desconhecido'}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-text-primary text-center">
                                            {formatCurrency(Number(payment.valor || (payment as any).value || (payment as any).amount || 0))}
                                        </td>
                                        <td className="px-4 py-3 text-center text-text-secondary capitalize">
                                            {payment.tipo_pagamento ? payment.tipo_pagamento.toLowerCase() : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-text-primary text-center">
                                            {formatDate(payment.data_vencimento)}
                                        </td>
                                        <td className="px-4 py-3 text-text-secondary text-center">
                                            {payment.data_pagamento ? formatDate(payment.data_pagamento) : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {getStatusBadge(payment.status_pagamento)}
                                        </td>
                                        <td className="px-4 py-3 text-right flex items-center justify-end gap-1">
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); handleInstantSend(payment); }}
                                                className="p-1.5 text-text-secondary hover:text-accent-primary hover:bg-accent-primary/10 rounded transition-colors"
                                                title="Enviar Agora"
                                            >
                                                <Icon name="Zap" className="w-4 h-4" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); setScheduleParams({ open: true, payment: payment }); }}
                                                className="p-1.5 text-text-secondary hover:text-accent-primary hover:bg-accent-primary/10 rounded transition-colors"
                                                title="Agendar Envio"
                                            >
                                                <Icon name="CalendarClock" className="w-4 h-4" />
                                            </button>
                                            {payment.link && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigator.clipboard.writeText(payment.link || '');
                                                        alert('Link copiado!');
                                                    }}
                                                    className="inline-flex items-center justify-center p-1.5 text-text-secondary hover:text-accent-primary hover:bg-accent-primary/10 rounded transition-colors"
                                                    title="Copiar Link de Pagamento"
                                                >
                                                    <Icon name="Copy" className="w-4 h-4" />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    return (
        <div className="space-y-4 pb-8">
            {/* Header com Título e Tabs Principais */}
            <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <h1 className="text-2xl font-bold text-text-primary">
                        Financeiro
                        <span className="block text-sm font-normal text-text-secondary mt-1">Gestão financeira completa</span>
                    </h1>
                </div>

                {/* Main Tabs Navigation - Estilo similar aos Day Tabs do Appointments */}
                <div className="flex w-full gap-2 p-1 overflow-x-auto">
                    {(['resumo', 'faturamento', 'financas', 'gestor'] as MainTab[]).map(tab => {
                        const isActive = activeTab === tab;
                        return (
                            <button
                                key={tab}
                                onClick={() => handleTabChange(tab)}
                                className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition text-center truncate border
                                    ${isActive
                                        ? 'bg-accent-primary text-text-on-accent border-accent-primary shadow'
                                        : 'bg-bg-tertiary text-text-secondary border-border-secondary hover:text-text-primary hover:shadow'
                                    }`}
                            >
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Sub-Navigation Buttons */}
            {activeTab && subMenus[activeTab] && subMenus[activeTab].length > 0 && (
                <div className="flex flex-wrap gap-2 py-2">
                    {subMenus[activeTab].map(sub => {
                        const isActive = activeSubTab === sub.id;
                        return (
                            <button
                                key={sub.id}
                                onClick={() => setActiveSubTab(sub.id)}
                                className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-offset-1
                                    ${isActive
                                        ? 'border-accent-primary bg-accent-primary text-text-on-accent'
                                        : 'border-border-secondary bg-bg-tertiary text-text-primary hover:bg-bg-tertiary/70'
                                    }`}
                            >
                                {sub.icon && <Icon name={sub.icon} className={`w-4 h-4 ${isActive ? 'text-text-on-accent' : 'text-text-secondary'}`} />}
                                {sub.label}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Content Area */}
            <div className="mt-2">
                {activeTab === 'resumo' && (
                    <div className="space-y-6">
                        {renderBillingStatus()}
                        {renderTable()}
                    </div>
                )}

                {activeTab === 'faturamento' && (
                    <div className="space-y-4">
                        <div className="bg-bg-secondary p-8 rounded-lg border border-border-secondary text-center text-text-tertiary border-dashed">
                            <Icon name="List" className="w-10 h-10 mx-auto mb-2 opacity-50" />
                            <p>A tabela de registros foi movida para o Resumo.</p>
                        </div>
                    </div>
                )}

                {activeTab === 'financas' && (
                    <div className="bg-bg-secondary p-12 rounded-lg border border-border-secondary text-center text-text-tertiary h-[400px] flex flex-col items-center justify-center">
                        <Icon name="DollarSign" className="w-16 h-16 mb-4 opacity-20" />
                        <h3 className="text-lg font-medium text-text-secondary mb-1">Módulo Finanças</h3>
                        <p className="max-w-md">Fluxo de Caixa, Contas a Pagar e Receber estarão disponíveis aqui.</p>
                    </div>
                )}

                {activeTab === 'gestor' && (
                    <div className="space-y-4">
                        <div className="bg-bg-secondary p-6 rounded-lg border border-border-secondary">
                            <h3 className="text-lg font-medium text-text-primary mb-4">Configurações Rápidas</h3>
                            <button
                                onClick={() => setSettingsOpen(true)}
                                className="flex items-center gap-3 p-4 border border-border-secondary rounded-lg hover:bg-bg-tertiary transition-colors w-full sm:w-auto"
                            >
                                <div className="p-2 bg-accent-primary/10 rounded-full text-accent-primary">
                                    <Icon name="Settings" className="w-6 h-6" />
                                </div>
                                <div className="text-left">
                                    <div className="font-medium text-text-primary">Configurar Integrações</div>
                                    <div className="text-xs text-text-secondary">Gerenciar chaves e preferências financeiras</div>
                                </div>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modais Globais */}
            <WebhookScheduleModal
                isOpen={scheduleParams.open}
                onClose={() => setScheduleParams({ ...scheduleParams, open: false })}
                payment={scheduleParams.payment}
                unitCode={selectedUnit?.unit_code || ''}
                webhookUrl={webhookUrl}
            />
            <FinancialSettingsModal
                isOpen={settingsOpen}
                onClose={() => setSettingsOpen(false)}
                unitId={selectedUnit?.id || ''}
            />
            {modalPayment && selectedUnit && (
                <PaymentDetailModal
                    payment={modalPayment}
                    unitCode={selectedUnit.unit_code}
                    onClose={() => setModalPayment(null)}
                    onUpdate={() => {
                        loadData();
                        setModalPayment(null);
                    }}
                />
            )}
        </div>
    );
};

export default FinancialPage;
