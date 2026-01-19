import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { fetchDashboardMetrics, fetchDashboardMetricsMulti, fetchMonthlyChartData } from '../../services/analytics/dashboard.service';
import type { MonthlyChartData } from '../../services/analytics/dashboard.service';
import { fetchServiceAnalysisData, fetchServicePeriodAnalysisData, fetchClientAnalysisData, fetchServiceMonthlySubmetrics, fetchServiceMonthlySubmetricsMulti, fetchClientMonthlySubmetrics, fetchClientMonthlySubmetricsMulti, type ServiceMonthlySubmetrics, type ClientMonthlySubmetrics } from '../../services/analytics/serviceAnalysis.service';
import { fetchRepasseAnalysisData, fetchRepasseMonthlySubmetrics, fetchRepasseMonthlySubmetricsMulti, type RepasseMonthlySubmetrics } from '../../services/analytics/repasse.service';
import { DashboardMetrics, ServiceAnalysisRecord, ClientAnalysisData, RepasseAnalysisRecord } from '../../types';
import { Icon } from '../ui/Icon';
import MonthlyComparisonChart from '../ui/MonthlyComparisonChart';
import { supabase } from '../../services/supabaseClient';
import { useRealtimeSubscription } from '../../hooks/useRealtimeSubscription';
import { fetchAvailableYearsFromProcessedData } from '../../services/data/dataTable.service';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell
} from 'recharts';


const MetricCard: React.FC<{
    title: string;
    value: string;
    icon: string;
    iconBgColor: string;
    isSelected?: boolean;
    onClick?: () => void;
}> = ({ title, value, icon, iconBgColor, isSelected = false, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className={`p-3 rounded-lg border transition-all ${isSelected
            ? 'bg-accent-primary text-white border-transparent shadow-lg'
            : 'bg-bg-secondary border-border-primary hover:shadow-md'
            }`}
        aria-pressed={isSelected}
    >
        <div className="flex items-center gap-2">
            <Icon name={icon} className="w-5 h-5" />
            <span className="text-sm font-medium">{title}</span>
            <span className={`ml-auto text-lg font-bold ${isSelected ? 'text-white' : 'text-text-primary'}`}>
                {value}
            </span>
        </div>
    </button>
);

// Componente de dropdown personalizado para filtro de período
const PeriodDropdown: React.FC<{
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    availableYears?: number[];
}> = ({ value, onChange, disabled, availableYears }) => {
    const [isOpen, setIsOpen] = useState(false);

    const currentYear = new Date().getFullYear();
    const years = availableYears && availableYears.length > 0 ? availableYears : [currentYear, currentYear - 1, currentYear - 2];

    const months = [
        { value: '01', label: 'Janeiro' },
        { value: '02', label: 'Fevereiro' },
        { value: '03', label: 'Março' },
        { value: '04', label: 'Abril' },
        { value: '05', label: 'Maio' },
        { value: '06', label: 'Junho' },
        { value: '07', label: 'Julho' },
        { value: '08', label: 'Agosto' },
        { value: '09', label: 'Setembro' },
        { value: '10', label: 'Outubro' },
        { value: '11', label: 'Novembro' },
        { value: '12', label: 'Dezembro' }
    ];

    // Gera opções do dropdown
    const options: { value: string; label: string }[] = [];

    // Adiciona opções mensais
    years.forEach(year => {
        months.forEach(month => {
            options.push({
                value: `${year}-${month.value}`,
                label: `${month.label} ${year}`
            });
        });
    });

    const getDisplayLabel = () => {
        // Mês específico
        const [year, monthValue] = value.split('-');
        const month = months.find(m => m.value === monthValue);
        return month ? `${month.label} ${year}` : value;
    };

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className="flex items-center justify-between w-64 px-3 py-2 text-left border rounded-md bg-bg-secondary border-border-secondary focus:ring-accent-primary focus:border-accent-primary disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
                <span className="text-sm text-text-primary">{getDisplayLabel()}</span>
                <Icon name={isOpen ? 'close' : 'add'} className="w-4 h-4 text-text-secondary" />
            </button>

            {isOpen && !disabled && (
                <>
                    {/* Overlay para fechar dropdown */}
                    <div
                        className="fixed inset-0 z-10"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Menu dropdown */}
                    <div className="absolute right-0 z-20 w-64 mt-1 bg-bg-secondary border rounded-md shadow-lg border-border-secondary max-h-80 overflow-y-auto">
                        <div className="py-1">
                            {options.map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() => {
                                        onChange(option.value);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full px-3 py-2 text-left text-sm transition-colors hover:bg-bg-tertiary ${value === option.value ? 'bg-accent-primary text-white' : 'text-text-primary'
                                        }`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

const SubMetricCard: React.FC<{ title: string; value: string; subtext?: string; valueColor?: string; onClick?: () => void; isActive?: boolean }> = ({ title, value, subtext, valueColor, onClick, isActive }) => {
    const clickable = Boolean(onClick);
    const baseClasses = 'flex-1 p-4 rounded-lg text-center border transition-all duration-150';
    const stateClasses = isActive
        ? 'bg-accent-primary text-white border-transparent'
        : 'bg-bg-tertiary text-text-primary border-transparent';
    const hoverClasses = clickable
        ? (isActive
            ? 'hover:shadow-lg hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-accent-primary focus:outline-none'
            : 'hover:bg-bg-tertiary/60 hover:shadow-md hover:-translate-y-0.5 hover:border-accent-primary focus-visible:ring-2 focus-visible:ring-accent-primary focus:outline-none')
        : '';
    return (
        <div
            className={[baseClasses, stateClasses, hoverClasses, clickable ? 'cursor-pointer' : ''].join(' ')}
            onClick={onClick}
            role={clickable ? 'button' : undefined}
            tabIndex={clickable ? 0 : -1}
            onKeyDown={(e) => {
                if (!clickable) return;
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onClick && onClick();
                }
            }}
        >
            <p className={`text-sm ${isActive ? 'text-white' : 'text-text-secondary'}`}>{title}</p>
            <p className={`text-2xl font-bold ${isActive ? 'text-white' : (valueColor || 'text-text-primary')}`}>{value}</p>
            {subtext && <p className={`text-xs ${isActive ? 'text-white/80' : 'text-text-secondary'}`}>{subtext}</p>}
        </div>
    );
};

const DayAnalysisCard: React.FC<{ day: string; percentage: number; count: number; average: number }> = ({ day, percentage, count, average }) => {
    // Determina a cor baseada na intensidade (percentual)
    const getColorClass = (pct: number) => {
        if (pct >= 20) return 'from-accent-primary to-accent-secondary';
        if (pct >= 15) return 'from-brand-cyan to-cyan-400';
        if (pct >= 10) return 'from-brand-green to-green-400';
        return 'from-amber-500 to-amber-400';
    };

    const getDayAbbr = (dayName: string) => {
        const abbr: { [key: string]: string } = {
            'Domingo': 'Dom',
            'Segunda-feira': 'Seg',
            'Terça-feira': 'Ter',
            'Quarta-feira': 'Qua',
            'Quinta-feira': 'Qui',
            'Sexta-feira': 'Sex',
            'Sábado': 'Sáb'
        };
        return abbr[dayName] || dayName;
    };

    return (
        <div className="group relative">
            <div className={`p-2 rounded bg-gradient-to-br ${getColorClass(percentage)} hover:shadow-md transition-all duration-300 cursor-pointer`}>
                <div className="flex flex-col gap-1">
                    {/* Header com nome do dia */}
                    <div className="flex items-center justify-center">
                        <span className="text-[10px] font-bold text-white uppercase tracking-wide">{getDayAbbr(day)}</span>
                    </div>

                    {/* Percentual - Destaque principal */}
                    <div className="flex flex-col items-center py-0.5">
                        <span className="text-2xl font-bold text-white leading-none">{percentage.toFixed(1)}%</span>
                    </div>

                    {/* Total e Média lado a lado */}
                    <div className="flex items-center justify-center gap-2 pt-1 border-t border-white border-opacity-20">
                        <div className="flex items-baseline gap-1">
                            <span className="text-[8px] text-white opacity-75">Total:</span>
                            <span className="text-xs font-semibold text-white">{count}</span>
                        </div>
                        <div className="w-px h-3 bg-white opacity-30"></div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-[8px] text-white opacity-75">Méd:</span>
                            <span className="text-xs font-semibold text-white">{average.toFixed(1)}</span>
                        </div>
                    </div>
                </div>
            </div>
            {/* Tooltip on hover */}
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                {day}
            </div>
        </div>
    );
};

const TypeAnalysisBar: React.FC<{ type: string; percentage: number, count: number }> = ({ type, percentage, count }) => (
    <div className="flex items-center text-sm">
        <span className="w-24 text-text-secondary truncate" title={type}>{type}</span>
        <div className="flex-1 h-4 mx-2 bg-gray-200 rounded">
            <div
                className="h-4 rounded bg-brand-cyan"
                style={{ width: `${percentage}%` }}
            />
        </div>
        <span className="w-16 font-semibold text-right text-text-primary">{percentage.toFixed(1)}% ({count})</span>
    </div>
);

const CustomEvolutionTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-bg-secondary border border-border-primary rounded-lg shadow-lg p-3 text-sm">
                <p className="font-bold text-text-primary mb-2">Dia: {label}</p>
                <p className="text-brand-cyan">
                    {`Atend. (Antigos): ${payload[0].value}`}
                </p>
                <p className="text-brand-green">
                    {`Atend. (Novos): ${payload[1].value}`}
                </p>
                <p className="font-semibold text-text-primary mt-1 border-t border-border-secondary pt-1">
                    {`Total: ${Number(payload[0].value) + Number(payload[1].value)}`}
                </p>
            </div>
        );
    }
    return null;
};

type MetricType = 'totalRevenue' | 'totalServices' | 'uniqueClients' | 'totalRepasse';
type RevenueSubMetric = 'none' | 'averageTicket' | 'margin' | 'marginPerService';
type ServicesSubMetric = 'none' | 'startOfMonth' | 'evolution' | 'productiveDayAvg';
type ClientsSubMetric = 'none' | 'recurringCount' | 'servicesPerClient' | 'churnRate';
type RepasseSubMetric = 'none' | 'averagePerService' | 'averagePerWeek' | 'averagePerProfessional';
type ServiceAnalysis = {
    startOfMonthCount: number;
    evolutionCount: number;
    averagePerDay: string;
    dayOfWeekAnalysis: { day: string; percentage: number; count: number; average: number }[];
    dailyEvolutionData: { day: string; 'Atend. (Clientes Antigos)': number; 'Atend. (Clientes Novos)': number }[];
    periodAnalysis: { type: string; percentage: number; count: number }[];
    periodByTypeAnalysis: { type: string; comercial: number; residencial: number }[];
};
type ClientAnalysis = {
    recurringCount: number;
    servicesPerClient: string;
    churnRate: string;
    churnCount: number;
    baseClientsCount: number;
    newClientsCount: number;
    typeAnalysis: { type: string; percentage: number; count: number }[];
};
type RepasseAnalysis = {
    averagePerService: number;
    averagePerWeek: number;
    averagePerProfessional: number;
    professionalRanking: { professional: string; total: number }[];
};

// Tipo RepasseMonthlySubmetrics agora vem do serviço (repasse.service.ts)

const DashboardMetricsPage: React.FC = () => {
    const { selectedUnit } = useAppContext();
    const { userUnits } = useAuth();
    // multiUnits agora é derivado das unidades do usuário quando ALL está selecionado.
    const multiUnits = useMemo(() => {
        if (!selectedUnit || selectedUnit.unit_code !== 'ALL') return [] as string[];
        return userUnits.map(u => u.unit_code);
    }, [selectedUnit, userUnits]);
    const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
    const [previousMonthMetrics, setPreviousMonthMetrics] = useState<DashboardMetrics | null>(null);
    const [monthlyData, setMonthlyData] = useState<MonthlyChartData[]>([]);
    const [servicesMonthlyData, setServicesMonthlyData] = useState<ServiceMonthlySubmetrics[]>([]);
    const [clientsMonthlyData, setClientsMonthlyData] = useState<ClientMonthlySubmetrics[]>([]);
    const [monthlyPeriods, setMonthlyPeriods] = useState<{ [month: string]: { [period: string]: number } }>({});
    const [repasseMonthlyData, setRepasseMonthlyData] = useState<RepasseMonthlySubmetrics[]>([]);
    const [serviceAnalysis, setServiceAnalysis] = useState<ServiceAnalysis | null>(null);
    const [clientAnalysis, setClientAnalysis] = useState<ClientAnalysis | null>(null);
    const [repasseAnalysis, setRepasseAnalysis] = useState<RepasseAnalysis | null>(null);
    const [isChartVisible, setIsChartVisible] = useState(true);
    const [isEvolutionChartVisible, setIsEvolutionChartVisible] = useState(true);
    const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

    const [isLoading, setIsLoading] = useState(true);
    const [isChartLoading, setIsChartLoading] = useState(false);
    const [isAnalysisLoading, setIsAnalysisLoading] = useState(false);
    const [isPeriodsLoading, setIsPeriodsLoading] = useState(false);

    const [error, setError] = useState<string | null>(null);
    const [selectedPeriod, setSelectedPeriod] = useState<string>(() => {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
    });
    const [availableYears, setAvailableYears] = useState<number[]>([new Date().getFullYear()]);
    const [selectedMetric, setSelectedMetric] = useState<MetricType>('totalRevenue');
    const [selectedRevenueSubMetric, setSelectedRevenueSubMetric] = useState<RevenueSubMetric>('none');
    const [selectedServicesSubMetric, setSelectedServicesSubMetric] = useState<ServicesSubMetric>('none');
    const [selectedClientsSubMetric, setSelectedClientsSubMetric] = useState<ClientsSubMetric>('none');
    const [selectedRepasseSubMetric, setSelectedRepasseSubMetric] = useState<RepasseSubMetric>('none');

    const getPreviousPeriod = (period: string): string => {
        const [year, month] = period.split('-').map(Number);
        const date = new Date(year, month - 1, 1);
        date.setMonth(date.getMonth() - 1);
        const prevYear = date.getFullYear();
        const prevMonth = String(date.getMonth() + 1).padStart(2, '0');
        return `${prevYear}-${prevMonth}`;
    };

    useEffect(() => {
        if (!selectedUnit) {
            setAvailableYears([new Date().getFullYear()]);
            return;
        }
        const loadYears = async () => {
            try {
                const unitCode = selectedUnit.unit_code === 'ALL' ? multiUnits : selectedUnit.unit_code;
                const years = await fetchAvailableYearsFromProcessedData(unitCode);
                setAvailableYears(years);
            } catch (error) {
                console.error('Erro ao carregar anos disponíveis:', error);
                setAvailableYears([new Date().getFullYear()]);
            }
        };
        loadYears();
    }, [selectedUnit, multiUnits]);

    const loadMetrics = useCallback(async () => {
        if (!selectedUnit) {
            console.log('[Dashboard Optimization] ⚠️ Nenhuma unidade selecionada');
            setMetrics(null);
            setPreviousMonthMetrics(null);
            setIsLoading(false);
            return;
        }

        console.log('[Dashboard Optimization] 📊 Iniciando carregamento de métricas...', {
            unit: selectedUnit.unit_code,
            period: selectedPeriod,
            isMultiUnit: selectedUnit.unit_code === 'ALL',
            multiUnitsCount: multiUnits.length
        });

        setIsLoading(true);
        setError(null);
        const previousPeriod = getPreviousPeriod(selectedPeriod);
        const startTime = performance.now();

        try {
            let currentResult: DashboardMetrics;
            let previousResult: DashboardMetrics;

            if (selectedUnit.unit_code === 'ALL') {
                console.log('[Dashboard Optimization] Carregando métricas multi-unidade...', multiUnits);
                currentResult = await fetchDashboardMetricsMulti(multiUnits, selectedPeriod);
                previousResult = await fetchDashboardMetricsMulti(multiUnits, previousPeriod);
            } else {
                console.log('[Dashboard Optimization] Carregando métricas unidade única...');
                [currentResult, previousResult] = await Promise.all([
                    fetchDashboardMetrics(selectedUnit.unit_code, selectedPeriod),
                    fetchDashboardMetrics(selectedUnit.unit_code, previousPeriod)
                ]);
            }

            // Validação de dados
            if (!currentResult || typeof currentResult !== 'object') {
                throw new Error('Dados de métricas inválidos ou vazios');
            }

            console.log('[Dashboard Optimization] ✅ Métricas carregadas:', {
                totalRevenue: currentResult.totalRevenue,
                totalServices: currentResult.totalServices,
                uniqueClients: currentResult.uniqueClients,
                hasData: currentResult.totalServices > 0
            });

            setMetrics(currentResult);
            setPreviousMonthMetrics(previousResult);

            const endTime = performance.now();
            const duration = ((endTime - startTime) / 1000).toFixed(2);
            console.log(`[Dashboard Optimization] ✅ Dados mensais carregados em ${duration}s`);

        } catch (err: any) {
            const errorMsg = err?.message || 'Falha ao carregar as métricas do dashboard.';
            setError(errorMsg);
            console.error('[Dashboard Optimization] ❌ Erro ao carregar métricas:', {
                error: err,
                message: errorMsg,
                unit: selectedUnit.unit_code,
                period: selectedPeriod
            });
        } finally {
            setIsLoading(false);
        }
    }, [selectedUnit, selectedPeriod, multiUnits]);

    const loadMonthlyData = useCallback(async () => {
        if (!selectedUnit) { setMonthlyData([]); return; }
        setIsChartLoading(true);
        console.log('[Dashboard Optimization] 📊 Iniciando carregamento de dados mensais...');
        const startTime = performance.now();
        try {
            const currentYear = parseInt(selectedPeriod.split('-')[0], 10);

            if (selectedUnit.unit_code === 'ALL') {
                const aggregated: { [month: string]: MonthlyChartData } = {};
                for (const code of multiUnits) {
                    const result = await fetchMonthlyChartData(code, currentYear);
                    result.forEach(r => {
                        if (!aggregated[r.month]) aggregated[r.month] = { ...r };
                        else {
                            aggregated[r.month].totalRevenue += r.totalRevenue;
                            aggregated[r.month].totalServices += r.totalServices;
                            aggregated[r.month].uniqueClients += r.uniqueClients;
                            aggregated[r.month].totalRepasse += r.totalRepasse;
                        }
                    });
                }
                const finalArray = Object.values(aggregated).map(m => ({
                    ...m,
                    averageTicket: m.totalServices > 0 ? m.totalRevenue / m.totalServices : 0
                })).sort((a, b) => a.month.localeCompare(b.month));
                setMonthlyData(finalArray);

                // Buscar submétricas de repasse usando serviço (mesmo padrão de Services/Clients)
                const repasseMonthly = await fetchRepasseMonthlySubmetricsMulti(multiUnits, currentYear);
                setRepasseMonthlyData(repasseMonthly);
            } else {
                const result = await fetchMonthlyChartData(selectedUnit.unit_code, currentYear);
                setMonthlyData(result);

                // Buscar submétricas de repasse usando serviço
                const repasseMonthly = await fetchRepasseMonthlySubmetrics(selectedUnit.unit_code, currentYear);
                setRepasseMonthlyData(repasseMonthly);
            }
            // também carregar submétricas de atendimentos para o ano
            if (selectedUnit.unit_code === 'ALL') {
                const sub = await fetchServiceMonthlySubmetricsMulti(multiUnits, currentYear);
                setServicesMonthlyData(sub);
                const csub = await fetchClientMonthlySubmetricsMulti(multiUnits, currentYear);
                setClientsMonthlyData(csub);
            } else {
                const sub = await fetchServiceMonthlySubmetrics(selectedUnit.unit_code, currentYear);
                setServicesMonthlyData(sub);
                const csub = await fetchClientMonthlySubmetrics(selectedUnit.unit_code, currentYear);
                setClientsMonthlyData(csub);
            }

            // ✅ OTIMIZAÇÃO FASE 1: Lazy loading de períodos (não carrega automaticamente)
            // Períodos serão carregados apenas quando usuário visualizar análise de serviços
            console.log('[Dashboard Optimization] Lazy loading habilitado - períodos carregados sob demanda');
            setMonthlyPeriods({});
        } catch (err: any) {
            console.error('[DASHBOARD] Erro ao carregar dados mensais:', err);
            setMonthlyData([]);
            setServicesMonthlyData([]);
            setClientsMonthlyData([]);
            setRepasseMonthlyData([]);
            setMonthlyPeriods({});
        } finally {
            setIsChartLoading(false);
            const endTime = performance.now();
            const duration = ((endTime - startTime) / 1000).toFixed(2);
            console.log(`[Dashboard Optimization] ✅ Dados mensais carregados em ${duration}s`);
        }
    }, [selectedUnit, multiUnits, selectedPeriod]);

    // ✅ OTIMIZAÇÃO FASE 1: Lazy loading de períodos mensais (carrega sob demanda)
    const loadMonthlyPeriods = useCallback(async () => {
        if (!selectedUnit || Object.keys(monthlyPeriods).length > 0) {
            // Já carregado, não recarrega
            return;
        }

        console.log('[Dashboard Optimization] Carregando períodos mensais sob demanda...');
        setIsPeriodsLoading(true);

        try {
            const currentYear = new Date().getFullYear();
            const periodsByMonth: { [month: string]: { [period: string]: number } } = {};

            if (selectedUnit.unit_code === 'ALL') {
                // Para múltiplas unidades, agregar os dados
                for (let month = 1; month <= 12; month++) {
                    const periodKey = `${currentYear}-${String(month).padStart(2, '0')}`;
                    const periodCounts: { [period: string]: number } = {};

                    for (const unitCode of multiUnits) {
                        const periodData = await fetchServicePeriodAnalysisData(unitCode, periodKey);
                        periodData.forEach(item => {
                            const periodo = item.PERÍODO?.trim() || 'Não especificado';
                            periodCounts[periodo] = (periodCounts[periodo] || 0) + 1;
                        });
                    }

                    periodsByMonth[periodKey] = periodCounts;
                }
            } else {
                // Para uma única unidade
                for (let month = 1; month <= 12; month++) {
                    const periodKey = `${currentYear}-${String(month).padStart(2, '0')}`;
                    const periodData = await fetchServicePeriodAnalysisData(
                        selectedUnit.unit_code,
                        periodKey
                    );

                    const periodCounts: { [period: string]: number } = {};
                    periodData.forEach(item => {
                        const periodo = item.PERÍODO?.trim() || 'Não especificado';
                        periodCounts[periodo] = (periodCounts[periodo] || 0) + 1;
                    });

                    periodsByMonth[periodKey] = periodCounts;
                }
            }

            console.log('📊 Monthly Periods Data (Lazy Loaded):', periodsByMonth);
            setMonthlyPeriods(periodsByMonth);
        } catch (err: any) {
            console.error('[Dashboard Optimization] Erro ao carregar períodos mensais:', err);
        } finally {
            setIsPeriodsLoading(false);
        }
    }, [selectedUnit, multiUnits, monthlyPeriods]);

    const loadServiceAnalysisData = useCallback(async () => {
        if (!selectedUnit || !metrics) return;

        setIsAnalysisLoading(true);
        try {
            const records = await fetchServiceAnalysisData(selectedUnit.unit_code, selectedPeriod);

            const uniqueAppointments = Array.from(
                new Map(records.map(record => [record.ATENDIMENTO_ID, record])).values()
            );

            const periodStartDate = new Date(`${selectedPeriod}-01T12:00:00Z`);
            let startOfMonthCount = 0;
            let evolutionCount = 0;
            uniqueAppointments.forEach(r => {
                if (r.CADASTRO) {
                    const cadastroDate = new Date(`${r.CADASTRO}T12:00:00Z`);
                    if (!isNaN(cadastroDate.getTime())) {
                        if (cadastroDate < periodStartDate) startOfMonthCount++;
                        else evolutionCount++;
                    }
                }
            });

            const dailyCounts: { [date: string]: number } = {};
            records.forEach(r => {
                if (r.DATA) dailyCounts[r.DATA] = (dailyCounts[r.DATA] || 0) + 1;
            });
            const daysWithMoreThan5Services = Object.values(dailyCounts).filter(count => count > 5).length;
            const averagePerDay = daysWithMoreThan5Services > 0
                ? (metrics.totalServices / daysWithMoreThan5Services).toFixed(1)
                : 'N/A';

            const dayOfWeekCounts: { [day: string]: number } = {};
            const dayOfWeekDates: { [day: string]: Set<string> } = {}; // Track unique dates for each day
            records.forEach(r => {
                if (r.DIA) {
                    dayOfWeekCounts[r.DIA] = (dayOfWeekCounts[r.DIA] || 0) + 1;
                    if (r.DATA) {
                        if (!dayOfWeekDates[r.DIA]) dayOfWeekDates[r.DIA] = new Set();
                        dayOfWeekDates[r.DIA].add(r.DATA);
                    }
                }
            });
            const dayOrder = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
            const dayOfWeekAnalysis = dayOrder.map(day => {
                const count = dayOfWeekCounts[day] || 0;
                const percentage = records.length > 0 ? (count / records.length) * 100 : 0;
                const occurrences = dayOfWeekDates[day]?.size || 0; // Number of times this day occurred in the month
                const average = occurrences > 0 ? count / occurrences : 0;
                return { day, percentage, count, average };
            });

            // Daily Evolution Chart Data Calculation (using unique ATENDIMENTO_ID)
            const dailyData: { [day: string]: { old: Set<string>; new: Set<string> } } = {};

            records.forEach(r => {
                if (r.DATA && r.ATENDIMENTO_ID) {
                    const day = r.DATA.split('-')[2];
                    if (!dailyData[day]) dailyData[day] = { old: new Set(), new: new Set() };

                    if (r.CADASTRO) {
                        const cadastroDate = new Date(`${r.CADASTRO}T12:00:00Z`);
                        if (!isNaN(cadastroDate.getTime())) {
                            if (cadastroDate < periodStartDate) {
                                dailyData[day].old.add(r.ATENDIMENTO_ID);
                            } else {
                                dailyData[day].new.add(r.ATENDIMENTO_ID);
                            }
                        }
                    }
                }
            });

            const daysInMonth = new Date(
                parseInt(selectedPeriod.split('-')[0]),
                parseInt(selectedPeriod.split('-')[1]),
                0
            ).getDate();

            const dailyEvolutionData = Array.from({ length: daysInMonth }, (_, i) => {
                const day = String(i + 1).padStart(2, '0');
                const data = dailyData[day];
                return {
                    day: day,
                    'Atend. (Clientes Antigos)': data ? data.old.size : 0,
                    'Atend. (Clientes Novos)': data ? data.new.size : 0,
                };
            });

            // Busca dados de PERÍODO
            const periodData = await fetchServicePeriodAnalysisData(selectedUnit.unit_code, selectedPeriod);
            const periodCounts: { [key: string]: number } = {};
            const periodByType: { [key: string]: { comercial: number; residencial: number } } = {};

            periodData.forEach(item => {
                const periodo = item.PERÍODO?.trim() || 'Não especificado';
                const tipo = item.TIPO?.trim().toLowerCase() || 'não especificado';

                periodCounts[periodo] = (periodCounts[periodo] || 0) + 1;

                if (!periodByType[periodo]) {
                    periodByType[periodo] = { comercial: 0, residencial: 0 };
                }

                if (tipo === 'comercial') {
                    periodByType[periodo].comercial++;
                } else if (tipo === 'residencial') {
                    periodByType[periodo].residencial++;
                }
            });

            const totalRecords = periodData.length;
            const periodAnalysis = Object.keys(periodCounts).map(type => ({
                type,
                count: periodCounts[type],
                percentage: totalRecords > 0 ? (periodCounts[type] / totalRecords) * 100 : 0
            })).sort((a, b) => b.count - a.count);

            // Análise de período por tipo
            const periodByTypeAnalysis = Object.keys(periodByType)
                .map(type => ({
                    type,
                    comercial: periodByType[type].comercial,
                    residencial: periodByType[type].residencial
                }))
                .sort((a, b) => parseInt(a.type) - parseInt(b.type));

            console.log('📊 Period By Type Analysis:', {
                periodByType,
                periodByTypeAnalysis,
                totalPeriodData: periodData.length,
                sampleData: periodData.slice(0, 3)
            });

            setServiceAnalysis({ startOfMonthCount, evolutionCount, averagePerDay, dayOfWeekAnalysis, dailyEvolutionData, periodAnalysis, periodByTypeAnalysis });

        } catch (e) {
            console.error("Failed to load analysis data", e);
            setServiceAnalysis(null);
        } finally {
            setIsAnalysisLoading(false);
        }
    }, [selectedUnit, selectedPeriod, metrics]);

    const loadClientAnalysis = useCallback(async () => {
        if (!selectedUnit || !metrics || !previousMonthMetrics) return;

        setIsAnalysisLoading(true);
        try {
            const previousPeriod = getPreviousPeriod(selectedPeriod);

            const [currentData, previousPeriodData] = await Promise.all([
                fetchClientAnalysisData(selectedUnit.unit_code, selectedPeriod),
                fetchClientAnalysisData(selectedUnit.unit_code, previousPeriod)
            ]);

            const currentClients = currentData.currentMonthClients;
            const previousMonthClients = previousPeriodData.currentMonthClients;
            const allHistoricClientsBeforeThisMonth = new Set([...previousPeriodData.allPreviousClients, ...previousMonthClients]);

            const recurringCount = [...currentClients].filter(c => previousMonthClients.has(c)).length;
            const servicesPerClient = metrics.uniqueClients > 0 ? (metrics.totalServices / metrics.uniqueClients).toFixed(2) : '0.00';

            // Churn: clientes que estavam no mês anterior e NÃO estão no mês atual
            const churnCount = [...previousMonthClients].filter(c => !currentClients.has(c)).length;
            const churnRate = previousMonthClients.size > 0 ? ((churnCount / previousMonthClients.size) * 100).toFixed(1) : '0.0';

            const newClientsCount = [...currentClients].filter(c => !allHistoricClientsBeforeThisMonth.has(c)).length;
            const baseClientsCount = currentClients.size - recurringCount - newClientsCount;

            // Análise de tipo por CLIENTE ÚNICO (não por atendimento)
            // 1. Agrupar atendimentos por cliente
            const clientTypeMap: { [clientKey: string]: { [tipo: string]: number } } = {};

            currentData.clientDetails.forEach((detail) => {
                const clientKey = `${detail.CLIENTE || 'sem-nome'}_${detail.CADASTRO || 'sem-cadastro'}`;
                const tipo = detail.TIPO?.trim() || 'Não especificado';

                if (!clientTypeMap[clientKey]) {
                    clientTypeMap[clientKey] = {};
                }
                clientTypeMap[clientKey][tipo] = (clientTypeMap[clientKey][tipo] || 0) + 1;
            });

            // 2. Determinar o tipo predominante de cada cliente
            const typeCounts: { [key: string]: number } = {};
            Object.values(clientTypeMap).forEach((types) => {
                // Encontra o tipo com mais atendimentos para este cliente
                const predominantType = Object.entries(types)
                    .sort((a, b) => b[1] - a[1])[0][0];

                typeCounts[predominantType] = (typeCounts[predominantType] || 0) + 1;
            });

            const totalUniqueClients = currentClients.size;

            // 3. Calcular percentual baseado em clientes únicos
            const typeAnalysis = Object.keys(typeCounts).map(type => ({
                type,
                count: typeCounts[type],
                percentage: totalUniqueClients > 0 ? (typeCounts[type] / totalUniqueClients) * 100 : 0
            })).sort((a, b) => b.count - a.count);

            setClientAnalysis({
                recurringCount,
                servicesPerClient,
                churnRate: `${churnRate}%`,
                churnCount,
                baseClientsCount,
                newClientsCount,
                typeAnalysis
            });

        } catch (e) {
            console.error("Failed to load client analysis data", e);
            setClientAnalysis(null);
            setError("Falha ao carregar análise de clientes.");
        } finally {
            setIsAnalysisLoading(false);
        }
    }, [selectedUnit, selectedPeriod, metrics, previousMonthMetrics]);

    const loadRepasseAnalysis = useCallback(async () => {
        if (!selectedUnit || !metrics) return;
        setIsAnalysisLoading(true);
        try {
            const records = await fetchRepasseAnalysisData(selectedUnit.unit_code, selectedPeriod);

            // Calcula o total de repasse a partir dos dados brutos para consistência
            const totalRepasseFromRecords = records.reduce((sum, record) => sum + (record.REPASSE || 0), 0);

            const averagePerService = metrics.totalServices > 0 ? totalRepasseFromRecords / metrics.totalServices : 0;

            const [year, month] = selectedPeriod.split('-').map(Number);
            const daysInMonth = new Date(year, month, 0).getDate();
            const weeksInMonth = daysInMonth / 7;
            const averagePerWeek = weeksInMonth > 0 ? totalRepasseFromRecords / weeksInMonth : 0;

            const professionalTotals = new Map<string, number>();
            records.forEach(record => {
                const currentTotal = professionalTotals.get(record.PROFISSIONAL) || 0;
                professionalTotals.set(record.PROFISSIONAL, currentTotal + (record.REPASSE || 0));
            });

            const uniqueProfessionals = professionalTotals.size;
            const averagePerProfessional = uniqueProfessionals > 0 ? totalRepasseFromRecords / uniqueProfessionals : 0;

            const professionalRanking = Array.from(professionalTotals.entries())
                .map(([professional, total]) => ({ professional, total }))
                .sort((a, b) => b.total - a.total)
                .slice(0, 10);

            setRepasseAnalysis({
                averagePerService,
                averagePerWeek,
                averagePerProfessional,
                professionalRanking,
            });

        } catch (e) {
            console.error("Failed to load repasse analysis data", e);
            setRepasseAnalysis(null);
            setError("Falha ao carregar análise de repasses.");
        } finally {
            setIsAnalysisLoading(false);
        }
    }, [selectedUnit, selectedPeriod, metrics]);

    useEffect(() => {
        loadMetrics();
        loadMonthlyData();
    }, [loadMetrics, loadMonthlyData]);

    useEffect(() => {
        if (selectedMetric === 'totalServices' && metrics) {
            loadServiceAnalysisData();
            // ✅ OTIMIZAÇÃO FASE 1: Carrega períodos apenas quando visualizar serviços
            if (Object.keys(monthlyPeriods).length === 0) {
                console.log('[Dashboard Optimization] Disparando lazy load de períodos mensais...');
                loadMonthlyPeriods();
            }
        }
        if (selectedMetric === 'uniqueClients' && metrics && previousMonthMetrics) {
            loadClientAnalysis();
        }
        if (selectedMetric === 'totalRepasse' && metrics) {
            loadRepasseAnalysis();
        }
    }, [selectedMetric, metrics, previousMonthMetrics, loadServiceAnalysisData, loadClientAnalysis, loadRepasseAnalysis, monthlyPeriods, loadMonthlyPeriods]);

    // ✅ Memoizar callback de Realtime para evitar reconexões
    const handleRealtimeChange = useCallback(() => {
        console.log('[Dashboard] Mudança em processed_data detectada');
        if (!isLoading && !isChartLoading) {
            loadMetrics();
            loadMonthlyData();
        }
    }, [isLoading, isChartLoading, loadMetrics, loadMonthlyData]);

    // ✅ Memoizar filtro de Realtime
    const realtimeFilter = useCallback((record: any) => {
        // Filtrar por unidade(s)
        if (selectedUnit && selectedUnit.unit_code !== 'ALL') {
            if (record.unidade_code !== selectedUnit.unit_code) {
                return false;
            }
        } else if (multiUnits.length > 0) {
            if (!multiUnits.includes(record.unidade_code)) {
                return false;
            }
        }

        // Filtrar por período (recarrega métricas do mês atual) usando comparação robusta de string
        if (record.DATA) {
            const [targetYear, targetMonth] = selectedPeriod.split('-');
            const dateStr = typeof record.DATA === 'string' ? record.DATA.split('T')[0] : '';
            const [rYear, rMonth] = dateStr.split('-');
            if (rYear === targetYear && rMonth === targetMonth) return true;
        }

        return false;
    }, [selectedUnit, multiUnits, selectedPeriod]);

    // Realtime Subscription para processed_data (Dashboard)
    useRealtimeSubscription({
        table: 'processed_data',
        filter: realtimeFilter,
        callbacks: {
            onInsert: handleRealtimeChange,
            onUpdate: handleRealtimeChange,
            onDelete: handleRealtimeChange
        },
        enabled: true
    });

    const getMetricConfig = (metric: MetricType) => {
        switch (metric) {
            case 'totalRevenue': {
                if (selectedRevenueSubMetric === 'averageTicket') return { title: 'Média por Atendimento (Mês)' };
                if (selectedRevenueSubMetric === 'margin') return { title: 'Margem por Mês' };
                if (selectedRevenueSubMetric === 'marginPerService') return { title: 'Margem por Atendimento (Mês)' };
                return { title: 'Faturamento por Mês' };
            }
            case 'totalServices': {
                if (selectedServicesSubMetric === 'startOfMonth') return { title: 'Início Mês (Atend.) por Mês' };
                if (selectedServicesSubMetric === 'evolution') return { title: 'Evolução (Atend.) por Mês' };
                if (selectedServicesSubMetric === 'productiveDayAvg') return { title: 'Média/Dia Produtivo por Mês' };
                return { title: 'Atendimentos por Mês' };
            }
            case 'uniqueClients': {
                if (selectedClientsSubMetric === 'recurringCount') return { title: 'Recorrentes por Mês' };
                if (selectedClientsSubMetric === 'servicesPerClient') return { title: 'Atend. por Cliente (Mês)' };
                if (selectedClientsSubMetric === 'churnRate') return { title: 'Churn por Mês' };
                return { title: 'Clientes por Mês' };
            }
            case 'totalRepasse': {
                if (selectedRepasseSubMetric === 'averagePerService') return { title: 'Média/Atend. (Repasse) por Mês' };
                if (selectedRepasseSubMetric === 'averagePerWeek') return { title: 'Média/Semana (Repasse) por Mês' };
                if (selectedRepasseSubMetric === 'averagePerProfessional') return { title: 'Média/Profissional (Repasse) por Mês' };
                return { title: 'Repasse por Mês' };
            }
            default: return { title: 'Métricas por Mês' };
        }
    };

    const formatCurrency = (value: number) => {
        return (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const getMinMaxStats = (data: MonthlyChartData[], metric: MetricType) => {
        if (!data || data.length === 0) return null;

        // Filtrar apenas meses até o atual
        const currentMonth = new Date().getMonth() + 1;
        const filteredData = data.filter(item => parseInt(item.month) <= currentMonth);

        if (filteredData.length === 0) return null;

        // Calcular campos derivados
        const enrichedData = filteredData.map((d: any) => ({
            ...d,
            margin: (d.totalRevenue || 0) - (d.totalRepasse || 0),
            marginPerService: d.totalServices > 0 ? (((d.totalRevenue || 0) - (d.totalRepasse || 0)) / d.totalServices) : 0,
        }));

        // Determinar qual campo usar baseado na métrica selecionada e submétricas
        let fieldToUse = metric;
        if (metric === 'totalRevenue') {
            if (selectedRevenueSubMetric === 'averageTicket') fieldToUse = 'averageTicket';
            else if (selectedRevenueSubMetric === 'margin') fieldToUse = 'margin';
            else if (selectedRevenueSubMetric === 'marginPerService') fieldToUse = 'marginPerService';
        } else if (metric === 'totalServices') {
            if (selectedServicesSubMetric === 'startOfMonth') {
                const s = servicesMonthlyData;
                const dataWithSub = enrichedData.map(m => ({
                    ...m,
                    totalServices: s.find(x => x.month === m.month)?.startOfMonth || 0
                }));
                return getMinMaxFromData(dataWithSub, 'totalServices');
            } else if (selectedServicesSubMetric === 'evolution') {
                const s = servicesMonthlyData;
                const dataWithSub = enrichedData.map(m => ({
                    ...m,
                    totalServices: s.find(x => x.month === m.month)?.evolution || 0
                }));
                return getMinMaxFromData(dataWithSub, 'totalServices');
            } else if (selectedServicesSubMetric === 'productiveDayAvg') {
                const s = servicesMonthlyData;
                const dataWithSub = enrichedData.map(m => ({
                    ...m,
                    totalServices: s.find(x => x.month === m.month)?.productiveDayAvg || 0
                }));
                return getMinMaxFromData(dataWithSub, 'totalServices');
            }
        } else if (metric === 'uniqueClients') {
            if (selectedClientsSubMetric === 'recurringCount') {
                const c = clientsMonthlyData;
                const dataWithSub = enrichedData.map(m => ({
                    ...m,
                    uniqueClients: c.find(x => x.month === m.month)?.recurringCount || 0
                }));
                return getMinMaxFromData(dataWithSub, 'uniqueClients');
            } else if (selectedClientsSubMetric === 'servicesPerClient') {
                const c = clientsMonthlyData;
                const dataWithSub = enrichedData.map(m => ({
                    ...m,
                    uniqueClients: c.find(x => x.month === m.month)?.servicesPerClient || 0
                }));
                return getMinMaxFromData(dataWithSub, 'uniqueClients');
            } else if (selectedClientsSubMetric === 'churnRate') {
                const c = clientsMonthlyData;
                const dataWithSub = enrichedData.map(m => ({
                    ...m,
                    uniqueClients: c.find(x => x.month === m.month)?.churnRate || 0
                }));
                return getMinMaxFromData(dataWithSub, 'uniqueClients');
            }
        } else if (metric === 'totalRepasse') {
            if (selectedRepasseSubMetric === 'averagePerService') {
                const r = repasseMonthlyData;
                const dataWithSub = enrichedData.map(m => ({
                    ...m,
                    totalRepasse: r.find(x => x.month === m.month)?.averagePerService || 0
                }));
                return getMinMaxFromData(dataWithSub, 'totalRepasse');
            } else if (selectedRepasseSubMetric === 'averagePerWeek') {
                const r = repasseMonthlyData;
                const dataWithSub = enrichedData.map(m => ({
                    ...m,
                    totalRepasse: r.find(x => x.month === m.month)?.averagePerWeek || 0
                }));
                return getMinMaxFromData(dataWithSub, 'totalRepasse');
            } else if (selectedRepasseSubMetric === 'averagePerProfessional') {
                const r = repasseMonthlyData;
                const dataWithSub = enrichedData.map(m => ({
                    ...m,
                    totalRepasse: r.find(x => x.month === m.month)?.averagePerProfessional || 0
                }));
                return getMinMaxFromData(dataWithSub, 'totalRepasse');
            }
        }

        return getMinMaxFromData(enrichedData, fieldToUse);
    };

    const getMinMaxFromData = (data: any[], field: string) => {
        const maxItem = data.reduce((max, current) =>
            current[field] > max[field] ? current : max
        );
        const minItem = data.reduce((min, current) =>
            current[field] < min[field] ? current : min
        );

        return {
            max: { value: maxItem[field], month: maxItem.monthName },
            min: { value: minItem[field], month: minItem.monthName }
        };
    };

    const formatMetricValue = (value: number, metric: MetricType) => {
        const monetaryMetrics = ['totalRevenue', 'totalRepasse', 'averageTicket', 'margin', 'marginPerService'];
        if (monetaryMetrics.includes(metric) ||
            (metric === 'totalRevenue' && ['averageTicket', 'margin', 'marginPerService'].includes(selectedRevenueSubMetric)) ||
            (metric === 'totalRepasse' && selectedRepasseSubMetric !== 'none')) {
            return formatCurrency(value);
        }
        if (metric === 'uniqueClients' && selectedClientsSubMetric === 'churnRate') {
            return `${value.toFixed(1)}%`;
        }
        return Math.round(value).toString();
    };

    if (!selectedUnit) {
        return (
            <div className="p-6 h-full flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-xl font-semibold text-text-primary">Painel de Métricas</h2>
                    <p className="mt-2 text-text-secondary">Por favor, selecione uma unidade para ver as métricas.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Cabeçalho Principal */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
                <PeriodDropdown
                    value={selectedPeriod}
                    onChange={setSelectedPeriod}
                    disabled={isLoading}
                    availableYears={availableYears}
                />
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="w-16 h-16 border-4 border-t-4 border-gray-200 rounded-full animate-spin border-t-accent-primary"></div>
                </div>
            ) : error ? (
                <div className="p-4 text-danger bg-danger/10 border border-danger/30 rounded-md">{error}</div>
            ) : (
                <>
                    {/* Cards de Métricas Principais */}
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
                        <MetricCard
                            title="Faturamento"
                            value={formatCurrency(metrics?.totalRevenue || 0)}
                            icon="chart"
                            iconBgColor="bg-blue-500"
                            isSelected={selectedMetric === 'totalRevenue'}
                            onClick={() => { setSelectedMetric('totalRevenue'); setSelectedServicesSubMetric('none'); setSelectedClientsSubMetric('none'); setSelectedRepasseSubMetric('none'); }}
                        />
                        <MetricCard
                            title="Atendimentos"
                            value={String(metrics?.totalServices || 0)}
                            icon="briefcase"
                            iconBgColor="bg-green-500"
                            isSelected={selectedMetric === 'totalServices'}
                            onClick={() => { setSelectedMetric('totalServices'); setSelectedRevenueSubMetric('none'); setSelectedClientsSubMetric('none'); setSelectedRepasseSubMetric('none'); }}
                        />
                        <MetricCard
                            title="Clientes"
                            value={String(metrics?.uniqueClients || 0)}
                            icon="users"
                            iconBgColor="bg-yellow-500"
                            isSelected={selectedMetric === 'uniqueClients'}
                            onClick={() => { setSelectedMetric('uniqueClients'); setSelectedRevenueSubMetric('none'); setSelectedServicesSubMetric('none'); setSelectedRepasseSubMetric('none'); }}
                        />
                        <MetricCard
                            title="Repasse"
                            value={formatCurrency(metrics?.totalRepasse || 0)}
                            icon="dollar"
                            iconBgColor="bg-purple-500"
                            isSelected={selectedMetric === 'totalRepasse'}
                            onClick={() => { setSelectedMetric('totalRepasse'); setSelectedRevenueSubMetric('none'); setSelectedServicesSubMetric('none'); setSelectedClientsSubMetric('none'); }}
                        />
                    </div>

                    {/* Cards secundários de Faturamento - posicionados antes do gráfico */}
                    {!isLoading && selectedMetric === 'totalRevenue' && metrics && (
                        <div className="mt-6">
                            {/* 3 colunas centralizadas */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
                                {/* Margem Total (Faturamento - Repasse) */}
                                <div
                                    className={`relative py-3 px-4 rounded-lg shadow-sm border transition-all cursor-pointer ${selectedRevenueSubMetric === 'margin'
                                        ? 'bg-blue-100 border-blue-500'
                                        : 'bg-bg-tertiary border-border-secondary hover:border-accent-primary/50 hover:shadow-md'
                                        }`}
                                    onClick={() => setSelectedRevenueSubMetric(prev => prev === 'margin' ? 'none' : 'margin')}
                                >
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveTooltip(activeTooltip === 'margin' ? null : 'margin');
                                        }}
                                        className="absolute top-2 right-2 p-1 rounded-full hover:bg-bg-secondary/50 transition-colors z-10"
                                        title="Informações sobre esta métrica"
                                    >
                                        <Icon name="Info" className="w-4 h-4 text-accent-primary" />
                                    </button>
                                    <div className="flex flex-col items-center justify-center text-center h-full">
                                        <p className="text-2xl font-bold text-text-primary mb-1">
                                            {formatCurrency((metrics.totalRevenue || 0) - (metrics.totalRepasse || 0))}
                                        </p>
                                        <p className="text-xs font-medium text-text-secondary">
                                            Margem
                                        </p>
                                    </div>
                                    {activeTooltip === 'margin' && (
                                        <>
                                            <div
                                                className="fixed inset-0 z-10"
                                                onClick={() => setActiveTooltip(null)}
                                            />
                                            <div className="absolute top-10 right-0 z-20 w-64 p-3 bg-bg-secondary border border-border-secondary rounded-lg shadow-lg">
                                                <p className="text-xs text-text-primary font-semibold mb-1">Margem Total</p>
                                                <p className="text-xs text-text-secondary">
                                                    Diferença entre o Faturamento total e o Repasse. Representa o lucro bruto da operação.
                                                </p>
                                                <p className="text-xs text-text-secondary mt-2 italic">
                                                    Fórmula: Faturamento - Repasse
                                                </p>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Média por Atendimento */}
                                <div
                                    className={`relative py-3 px-4 rounded-lg shadow-sm border transition-all cursor-pointer ${selectedRevenueSubMetric === 'averageTicket'
                                        ? 'bg-blue-100 border-blue-500'
                                        : 'bg-bg-tertiary border-border-secondary hover:border-accent-primary/50 hover:shadow-md'
                                        }`}
                                    onClick={() => setSelectedRevenueSubMetric(prev => prev === 'averageTicket' ? 'none' : 'averageTicket')}
                                >
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveTooltip(activeTooltip === 'averageTicket' ? null : 'averageTicket');
                                        }}
                                        className="absolute top-2 right-2 p-1 rounded-full hover:bg-bg-secondary/50 transition-colors z-10"
                                        title="Informações sobre esta métrica"
                                    >
                                        <Icon name="Info" className="w-4 h-4 text-accent-primary" />
                                    </button>
                                    <div className="flex flex-col items-center justify-center text-center h-full">
                                        <p className="text-2xl font-bold text-text-primary mb-1">
                                            {formatCurrency(metrics.averageTicket || 0)}
                                        </p>
                                        <p className="text-xs font-medium text-text-secondary">
                                            Média por Atendimento
                                        </p>
                                    </div>
                                    {activeTooltip === 'averageTicket' && (
                                        <>
                                            <div
                                                className="fixed inset-0 z-10"
                                                onClick={() => setActiveTooltip(null)}
                                            />
                                            <div className="absolute top-10 right-0 z-20 w-64 p-3 bg-bg-secondary border border-border-secondary rounded-lg shadow-lg">
                                                <p className="text-xs text-text-primary font-semibold mb-1">Média por Atendimento</p>
                                                <p className="text-xs text-text-secondary">
                                                    Valor médio faturado por cada atendimento realizado no período.
                                                </p>
                                                <p className="text-xs text-text-secondary mt-2 italic">
                                                    Fórmula: Faturamento Total / Número de Atendimentos
                                                </p>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Margem por Atendimento */}
                                <div
                                    className={`relative py-3 px-4 rounded-lg shadow-sm border transition-all cursor-pointer ${selectedRevenueSubMetric === 'marginPerService'
                                        ? 'bg-blue-100 border-blue-500'
                                        : 'bg-bg-tertiary border-border-secondary hover:border-accent-primary/50 hover:shadow-md'
                                        }`}
                                    onClick={() => setSelectedRevenueSubMetric(prev => prev === 'marginPerService' ? 'none' : 'marginPerService')}
                                >
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveTooltip(activeTooltip === 'marginPerService' ? null : 'marginPerService');
                                        }}
                                        className="absolute top-2 right-2 p-1 rounded-full hover:bg-bg-secondary/50 transition-colors z-10"
                                        title="Informações sobre esta métrica"
                                    >
                                        <Icon name="Info" className="w-4 h-4 text-accent-primary" />
                                    </button>
                                    <div className="flex flex-col items-center justify-center text-center h-full">
                                        <p className="text-2xl font-bold text-text-primary mb-1">
                                            {formatCurrency(metrics.totalServices > 0 ? ((metrics.totalRevenue - metrics.totalRepasse) / metrics.totalServices) : 0)}
                                        </p>
                                        <p className="text-xs font-medium text-text-secondary">
                                            Margem por Atendimento
                                        </p>
                                    </div>
                                    {activeTooltip === 'marginPerService' && (
                                        <>
                                            <div
                                                className="fixed inset-0 z-10"
                                                onClick={() => setActiveTooltip(null)}
                                            />
                                            <div className="absolute top-10 right-0 z-20 w-64 p-3 bg-bg-secondary border border-border-secondary rounded-lg shadow-lg">
                                                <p className="text-xs text-text-primary font-semibold mb-1">Margem por Atendimento</p>
                                                <p className="text-xs text-text-secondary">
                                                    Lucro médio obtido por cada atendimento após descontar o repasse.
                                                </p>
                                                <p className="text-xs text-text-secondary mt-2 italic">
                                                    Fórmula: (Faturamento - Repasse) / Número de Atendimentos
                                                </p>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Cards secundários de Atendimentos - posicionados antes do gráfico principal */}
                    {!isLoading && selectedMetric === 'totalServices' && metrics && serviceAnalysis && (
                        <div className="mt-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
                                {/* Início Mês */}
                                <div
                                    className={`relative py-3 px-4 rounded-lg shadow-sm border transition-all cursor-pointer ${selectedServicesSubMetric === 'startOfMonth'
                                        ? 'bg-blue-100 border-blue-500'
                                        : 'bg-bg-tertiary border-border-secondary hover:border-accent-primary/50 hover:shadow-md'
                                        }`}
                                    onClick={() => setSelectedServicesSubMetric(prev => prev === 'startOfMonth' ? 'none' : 'startOfMonth')}
                                >
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveTooltip(activeTooltip === 'startOfMonth' ? null : 'startOfMonth');
                                        }}
                                        className="absolute top-2 right-2 p-1 rounded-full hover:bg-bg-secondary/50 transition-colors z-10"
                                        title="Informações sobre esta métrica"
                                    >
                                        <Icon name="Info" className="w-4 h-4 text-accent-primary" />
                                    </button>
                                    <div className="flex flex-col items-center justify-center text-center h-full">
                                        <p className="text-2xl font-bold text-text-primary mb-1">
                                            {serviceAnalysis.startOfMonthCount || 0}
                                        </p>
                                        <p className="text-xs font-medium text-text-secondary">
                                            Início Mês
                                        </p>
                                    </div>
                                    {activeTooltip === 'startOfMonth' && (
                                        <>
                                            <div
                                                className="fixed inset-0 z-10"
                                                onClick={() => setActiveTooltip(null)}
                                            />
                                            <div className="absolute top-10 right-0 z-20 w-64 p-3 bg-bg-secondary border border-border-secondary rounded-lg shadow-lg">
                                                <p className="text-xs text-text-primary font-semibold mb-1">Início Mês</p>
                                                <p className="text-xs text-text-secondary">
                                                    Número de atendimentos realizados para clientes que já existiam no início do mês.
                                                </p>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Evolução */}
                                <div
                                    className={`relative py-3 px-4 rounded-lg shadow-sm border transition-all cursor-pointer ${selectedServicesSubMetric === 'evolution'
                                        ? 'bg-blue-100 border-blue-500'
                                        : 'bg-bg-tertiary border-border-secondary hover:border-accent-primary/50 hover:shadow-md'
                                        }`}
                                    onClick={() => setSelectedServicesSubMetric(prev => prev === 'evolution' ? 'none' : 'evolution')}
                                >
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveTooltip(activeTooltip === 'evolution' ? null : 'evolution');
                                        }}
                                        className="absolute top-2 right-2 p-1 rounded-full hover:bg-bg-secondary/50 transition-colors z-10"
                                        title="Informações sobre esta métrica"
                                    >
                                        <Icon name="Info" className="w-4 h-4 text-accent-primary" />
                                    </button>
                                    <div className="flex flex-col items-center justify-center text-center h-full">
                                        <p className="text-2xl font-bold text-text-primary mb-1">
                                            {serviceAnalysis.evolutionCount || 0}
                                        </p>
                                        <p className="text-xs font-medium text-text-secondary">
                                            Evolução
                                        </p>
                                    </div>
                                    {activeTooltip === 'evolution' && (
                                        <>
                                            <div
                                                className="fixed inset-0 z-10"
                                                onClick={() => setActiveTooltip(null)}
                                            />
                                            <div className="absolute top-10 right-0 z-20 w-64 p-3 bg-bg-secondary border border-border-secondary rounded-lg shadow-lg">
                                                <p className="text-xs text-text-primary font-semibold mb-1">Evolução</p>
                                                <p className="text-xs text-text-secondary">
                                                    Número de atendimentos realizados para novos clientes que surgiram durante o mês.
                                                </p>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Média por Dia Produtivo */}
                                <div
                                    className={`relative py-3 px-4 rounded-lg shadow-sm border transition-all cursor-pointer ${selectedServicesSubMetric === 'productiveDayAvg'
                                        ? 'bg-blue-100 border-blue-500'
                                        : 'bg-bg-tertiary border-border-secondary hover:border-accent-primary/50 hover:shadow-md'
                                        }`}
                                    onClick={() => setSelectedServicesSubMetric(prev => prev === 'productiveDayAvg' ? 'none' : 'productiveDayAvg')}
                                >
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveTooltip(activeTooltip === 'productiveDayAvg' ? null : 'productiveDayAvg');
                                        }}
                                        className="absolute top-2 right-2 p-1 rounded-full hover:bg-bg-secondary/50 transition-colors z-10"
                                        title="Informações sobre esta métrica"
                                    >
                                        <Icon name="Info" className="w-4 h-4 text-accent-primary" />
                                    </button>
                                    <div className="flex flex-col items-center justify-center text-center h-full">
                                        <p className="text-2xl font-bold text-text-primary mb-1">
                                            {serviceAnalysis.averagePerDay || 0}
                                        </p>
                                        <p className="text-xs font-medium text-text-secondary">
                                            Média/Dia Produtivo
                                        </p>
                                    </div>
                                    {activeTooltip === 'productiveDayAvg' && (
                                        <>
                                            <div
                                                className="fixed inset-0 z-10"
                                                onClick={() => setActiveTooltip(null)}
                                            />
                                            <div className="absolute top-10 right-0 z-20 w-64 p-3 bg-bg-secondary border border-border-secondary rounded-lg shadow-lg">
                                                <p className="text-xs text-text-primary font-semibold mb-1">Média por Dia Produtivo</p>
                                                <p className="text-xs text-text-secondary">
                                                    Média de atendimentos realizados apenas em dias produtivos (dias com mais de 5 atendimentos).
                                                </p>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Cards secundários de Clientes - posicionados antes do gráfico principal */}
                    {!isLoading && selectedMetric === 'uniqueClients' && metrics && previousMonthMetrics && clientAnalysis && (
                        <div className="mt-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
                                {/* Recorrentes */}
                                <div
                                    className={`relative py-3 px-4 rounded-lg shadow-sm border transition-all cursor-pointer ${selectedClientsSubMetric === 'recurringCount'
                                        ? 'bg-blue-100 border-blue-500'
                                        : 'bg-bg-tertiary border-border-secondary hover:border-accent-primary/50 hover:shadow-md'
                                        }`}
                                    onClick={() => setSelectedClientsSubMetric(prev => prev === 'recurringCount' ? 'none' : 'recurringCount')}
                                >
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveTooltip(activeTooltip === 'clients-recurring' ? null : 'clients-recurring');
                                        }}
                                        className="absolute top-2 right-2 p-1 rounded-full hover:bg-bg-secondary/50 transition-colors z-10"
                                        title="Informações sobre esta métrica"
                                    >
                                        <Icon name="Info" className="w-4 h-4 text-accent-primary" />
                                    </button>
                                    <div className="flex flex-col items-center justify-center text-center h-full">
                                        <p className="text-2xl font-bold text-text-primary mb-1">
                                            {clientAnalysis.recurringCount}
                                        </p>
                                        <p className="text-xs font-medium text-text-secondary">
                                            Recorrentes
                                        </p>
                                    </div>
                                    {activeTooltip === 'clients-recurring' && (
                                        <>
                                            <div
                                                className="fixed inset-0 z-10"
                                                onClick={() => setActiveTooltip(null)}
                                            />
                                            <div className="absolute top-10 right-0 z-20 w-64 p-3 bg-bg-secondary border border-border-secondary rounded-lg shadow-lg">
                                                <p className="text-xs text-text-primary font-semibold mb-1">Clientes Recorrentes</p>
                                                <p className="text-xs text-text-secondary">
                                                    Clientes que estavam ativos no mês anterior e continuaram no mês atual.
                                                </p>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Atendimentos por Cliente */}
                                <div
                                    className={`relative py-3 px-4 rounded-lg shadow-sm border transition-all cursor-pointer ${selectedClientsSubMetric === 'servicesPerClient'
                                        ? 'bg-blue-100 border-blue-500'
                                        : 'bg-bg-tertiary border-border-secondary hover:border-accent-primary/50 hover:shadow-md'
                                        }`}
                                    onClick={() => setSelectedClientsSubMetric(prev => prev === 'servicesPerClient' ? 'none' : 'servicesPerClient')}
                                >
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveTooltip(activeTooltip === 'clients-services' ? null : 'clients-services');
                                        }}
                                        className="absolute top-2 right-2 p-1 rounded-full hover:bg-bg-secondary/50 transition-colors z-10"
                                        title="Informações sobre esta métrica"
                                    >
                                        <Icon name="Info" className="w-4 h-4 text-accent-primary" />
                                    </button>
                                    <div className="flex flex-col items-center justify-center text-center h-full">
                                        <p className="text-2xl font-bold text-text-primary mb-1">
                                            {clientAnalysis.servicesPerClient}
                                        </p>
                                        <p className="text-xs font-medium text-text-secondary">
                                            Atend. por Cliente
                                        </p>
                                    </div>
                                    {activeTooltip === 'clients-services' && (
                                        <>
                                            <div
                                                className="fixed inset-0 z-10"
                                                onClick={() => setActiveTooltip(null)}
                                            />
                                            <div className="absolute top-10 right-0 z-20 w-64 p-3 bg-bg-secondary border border-border-secondary rounded-lg shadow-lg">
                                                <p className="text-xs text-text-primary font-semibold mb-1">Atendimentos por Cliente</p>
                                                <p className="text-xs text-text-secondary">
                                                    Média de atendimentos realizados por cliente no mês.
                                                </p>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Churn */}
                                <div
                                    className={`relative py-3 px-4 rounded-lg shadow-sm border transition-all cursor-pointer ${selectedClientsSubMetric === 'churnRate'
                                        ? 'bg-blue-100 border-blue-500'
                                        : 'bg-bg-tertiary border-border-secondary hover:border-accent-primary/50 hover:shadow-md'
                                        }`}
                                    onClick={() => setSelectedClientsSubMetric(prev => prev === 'churnRate' ? 'none' : 'churnRate')}
                                >
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveTooltip(activeTooltip === 'clients-churn' ? null : 'clients-churn');
                                        }}
                                        className="absolute top-2 right-2 p-1 rounded-full hover:bg-bg-secondary/50 transition-colors z-10"
                                        title="Informações sobre esta métrica"
                                    >
                                        <Icon name="Info" className="w-4 h-4 text-accent-primary" />
                                    </button>
                                    <div className="flex flex-col items-center justify-center text-center h-full">
                                        <p className="text-2xl font-bold text-danger mb-1">
                                            {clientAnalysis.churnRate}
                                        </p>
                                        <p className="text-xs font-medium text-text-secondary mb-1">
                                            Churn
                                        </p>
                                        <p className="text-xs text-text-tertiary">
                                            ({clientAnalysis.churnCount} {clientAnalysis.churnCount === 1 ? 'cliente' : 'clientes'})
                                        </p>
                                    </div>
                                    {activeTooltip === 'clients-churn' && (
                                        <>
                                            <div
                                                className="fixed inset-0 z-10"
                                                onClick={() => setActiveTooltip(null)}
                                            />
                                            <div className="absolute top-10 right-0 z-20 w-64 p-3 bg-bg-secondary border border-border-secondary rounded-lg shadow-lg">
                                                <p className="text-xs text-text-primary font-semibold mb-1">Taxa de Churn</p>
                                                <p className="text-xs text-text-secondary">
                                                    Percentual de clientes do mês anterior que não retornaram neste mês.
                                                </p>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Cards secundários de Repasse - posicionados antes do gráfico principal */}
                    {!isLoading && selectedMetric === 'totalRepasse' && metrics && previousMonthMetrics && repasseAnalysis && (
                        <div className="mt-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
                                {/* Média por Atendimento */}
                                <div
                                    className={`relative py-3 px-4 rounded-lg shadow-sm border transition-all cursor-pointer ${selectedRepasseSubMetric === 'averagePerService'
                                        ? 'bg-blue-100 border-blue-500'
                                        : 'bg-bg-tertiary border-border-secondary hover:border-accent-primary/50 hover:shadow-md'
                                        }`}
                                    onClick={() => setSelectedRepasseSubMetric(prev => prev === 'averagePerService' ? 'none' : 'averagePerService')}
                                >
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveTooltip(activeTooltip === 'repasse-service' ? null : 'repasse-service');
                                        }}
                                        className="absolute top-2 right-2 p-1 rounded-full hover:bg-bg-secondary/50 transition-colors z-10"
                                        title="Informações sobre esta métrica"
                                    >
                                        <Icon name="Info" className="w-4 h-4 text-accent-primary" />
                                    </button>
                                    <div className="flex flex-col items-center justify-center text-center h-full">
                                        <p className="text-2xl font-bold text-text-primary mb-1">
                                            {formatCurrency(repasseAnalysis.averagePerService)}
                                        </p>
                                        <p className="text-xs font-medium text-text-secondary">
                                            Média/Atend.
                                        </p>
                                    </div>
                                    {activeTooltip === 'repasse-service' && (
                                        <>
                                            <div
                                                className="fixed inset-0 z-10"
                                                onClick={() => setActiveTooltip(null)}
                                            />
                                            <div className="absolute top-10 right-0 z-20 w-64 p-3 bg-bg-secondary border border-border-secondary rounded-lg shadow-lg">
                                                <p className="text-xs text-text-primary font-semibold mb-1">Média por Atendimento</p>
                                                <p className="text-xs text-text-secondary">
                                                    Valor médio de repasse por atendimento realizado (Repasse total ÷ Total de atendimentos).
                                                </p>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Média por Semana */}
                                <div
                                    className={`relative py-3 px-4 rounded-lg shadow-sm border transition-all cursor-pointer ${selectedRepasseSubMetric === 'averagePerWeek'
                                        ? 'bg-blue-100 border-blue-500'
                                        : 'bg-bg-tertiary border-border-secondary hover:border-accent-primary/50 hover:shadow-md'
                                        }`}
                                    onClick={() => setSelectedRepasseSubMetric(prev => prev === 'averagePerWeek' ? 'none' : 'averagePerWeek')}
                                >
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveTooltip(activeTooltip === 'repasse-week' ? null : 'repasse-week');
                                        }}
                                        className="absolute top-2 right-2 p-1 rounded-full hover:bg-bg-secondary/50 transition-colors z-10"
                                        title="Informações sobre esta métrica"
                                    >
                                        <Icon name="Info" className="w-4 h-4 text-accent-primary" />
                                    </button>
                                    <div className="flex flex-col items-center justify-center text-center h-full">
                                        <p className="text-2xl font-bold text-text-primary mb-1">
                                            {formatCurrency(repasseAnalysis.averagePerWeek)}
                                        </p>
                                        <p className="text-xs font-medium text-text-secondary">
                                            Média/Semana
                                        </p>
                                    </div>
                                    {activeTooltip === 'repasse-week' && (
                                        <>
                                            <div
                                                className="fixed inset-0 z-10"
                                                onClick={() => setActiveTooltip(null)}
                                            />
                                            <div className="absolute top-10 right-0 z-20 w-64 p-3 bg-bg-secondary border border-border-secondary rounded-lg shadow-lg">
                                                <p className="text-xs text-text-primary font-semibold mb-1">Média por Semana</p>
                                                <p className="text-xs text-text-secondary">
                                                    Valor médio de repasse semanal (Repasse total ÷ 4,3 semanas).
                                                </p>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Média por Profissional */}
                                <div
                                    className={`relative py-3 px-4 rounded-lg shadow-sm border transition-all cursor-pointer ${selectedRepasseSubMetric === 'averagePerProfessional'
                                        ? 'bg-blue-100 border-blue-500'
                                        : 'bg-bg-tertiary border-border-secondary hover:border-accent-primary/50 hover:shadow-md'
                                        }`}
                                    onClick={() => setSelectedRepasseSubMetric(prev => prev === 'averagePerProfessional' ? 'none' : 'averagePerProfessional')}
                                >
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveTooltip(activeTooltip === 'repasse-professional' ? null : 'repasse-professional');
                                        }}
                                        className="absolute top-2 right-2 p-1 rounded-full hover:bg-bg-secondary/50 transition-colors z-10"
                                        title="Informações sobre esta métrica"
                                    >
                                        <Icon name="Info" className="w-4 h-4 text-accent-primary" />
                                    </button>
                                    <div className="flex flex-col items-center justify-center text-center h-full">
                                        <p className="text-2xl font-bold text-text-primary mb-1">
                                            {formatCurrency(repasseAnalysis.averagePerProfessional)}
                                        </p>
                                        <p className="text-xs font-medium text-text-secondary">
                                            Média/Profissional
                                        </p>
                                    </div>
                                    {activeTooltip === 'repasse-professional' && (
                                        <>
                                            <div
                                                className="fixed inset-0 z-10"
                                                onClick={() => setActiveTooltip(null)}
                                            />
                                            <div className="absolute top-10 right-0 z-20 w-64 p-3 bg-bg-secondary border border-border-secondary rounded-lg shadow-lg">
                                                <p className="text-xs text-text-primary font-semibold mb-1">Média por Profissional</p>
                                                <p className="text-xs text-text-secondary">
                                                    Valor médio de repasse por profissional ativo (Repasse total ÷ Número de profissionais).
                                                </p>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="mt-6">
                        <div className="bg-bg-secondary rounded-lg shadow-md">
                            <div
                                className="flex items-center justify-between p-6 cursor-pointer"
                                onClick={() => setIsChartVisible(!isChartVisible)}
                                aria-expanded={isChartVisible}
                            >
                                <div className="flex items-center gap-6">
                                    <h3 className="text-lg font-semibold text-text-primary">
                                        {getMetricConfig(selectedMetric).title}
                                    </h3>
                                    {/* Comparação Mês Anterior */}
                                    {(() => {
                                        if (!previousMonthMetrics) {
                                            return (
                                                <div className="flex items-center gap-2 text-sm">
                                                    <span className="text-text-secondary">Mês Anterior:</span>
                                                    <span className="font-bold text-text-secondary">--</span>
                                                </div>
                                            );
                                        }

                                        let current = 0;
                                        let previous = 0;

                                        if (selectedMetric === 'totalRevenue') {
                                            current = metrics.totalRevenue;
                                            previous = previousMonthMetrics.totalRevenue;
                                        } else if (selectedMetric === 'totalServices') {
                                            current = metrics.totalServices;
                                            previous = previousMonthMetrics.totalServices;
                                        } else if (selectedMetric === 'uniqueClients') {
                                            current = metrics.uniqueClients;
                                            previous = previousMonthMetrics.uniqueClients;
                                        } else if (selectedMetric === 'totalRepasse') {
                                            current = metrics.totalRepasse;
                                            previous = previousMonthMetrics.totalRepasse;
                                        }

                                        if (previous === 0) {
                                            return (
                                                <div className="flex items-center gap-2 text-sm">
                                                    <span className="text-text-secondary">Mês Anterior:</span>
                                                    <span className="font-bold text-text-secondary">N/A</span>
                                                </div>
                                            );
                                        }

                                        const change = ((current - previous) / previous) * 100;
                                        const isPositive = change >= 0;
                                        return (
                                            <div className="flex items-center gap-2 text-sm">
                                                <span className="text-text-secondary">Mês Anterior:</span>
                                                <span className={`font-bold ${isPositive ? 'text-success' : 'text-danger'}`}>
                                                    {isPositive ? '+' : ''}{change.toFixed(1)}%
                                                </span>
                                            </div>
                                        );
                                    })()}
                                </div>
                                {(() => {
                                    const stats = getMinMaxStats(monthlyData, selectedMetric);
                                    if (stats) {
                                        return (
                                            <div className="flex gap-6 text-sm">
                                                <div className="flex items-center gap-2">
                                                    <span className="flex items-center gap-1 text-green-600 font-medium">
                                                        <Icon name="trending-up" className="w-4 h-4" />
                                                        Maior:
                                                    </span>
                                                    <span className="text-text-secondary">
                                                        {stats.max.month} - <span className="font-semibold text-text-primary">{formatMetricValue(stats.max.value, selectedMetric)}</span>
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="flex items-center gap-1 text-red-600 font-medium">
                                                        <Icon name="trending-down" className="w-4 h-4" />
                                                        Menor:
                                                    </span>
                                                    <span className="text-text-secondary">
                                                        {stats.min.month} - <span className="font-semibold text-text-primary">{formatMetricValue(stats.min.value, selectedMetric)}</span>
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                })()}
                                <button className="p-1 rounded-full hover:bg-bg-tertiary">
                                    <Icon name={isChartVisible ? 'chevron-up' : 'chevron-down'} className="w-5 h-5 text-text-secondary" />
                                </button>
                            </div>
                            <div
                                className={`transition-all duration-500 ease-in-out overflow-hidden ${isChartVisible ? 'max-h-[500px]' : 'max-h-0'}`}
                            >
                                <div className="px-6 pb-6">
                                    <MonthlyComparisonChart
                                        data={
                                            selectedMetric === 'totalServices' && selectedServicesSubMetric !== 'none'
                                                ? monthlyData.map((m) => {
                                                    const s = servicesMonthlyData.find(x => x.month === m.month);
                                                    return {
                                                        ...m,
                                                        totalServices:
                                                            selectedServicesSubMetric === 'startOfMonth' ? (s?.startOfMonth || 0)
                                                                : selectedServicesSubMetric === 'evolution' ? (s?.evolution || 0)
                                                                    : (s?.productiveDayAvg || 0),
                                                    } as MonthlyChartData;
                                                })
                                                : selectedMetric === 'uniqueClients' && selectedClientsSubMetric !== 'none'
                                                    ? monthlyData.map((m) => {
                                                        const c = clientsMonthlyData.find(x => x.month === m.month);
                                                        return {
                                                            ...m,
                                                            uniqueClients:
                                                                selectedClientsSubMetric === 'recurringCount' ? (c?.recurringCount || 0)
                                                                    : selectedClientsSubMetric === 'servicesPerClient' ? (c?.servicesPerClient || 0)
                                                                        : (c?.churnRate || 0),
                                                        } as MonthlyChartData;
                                                    })
                                                    : selectedMetric === 'totalRepasse' && selectedRepasseSubMetric !== 'none'
                                                        ? (() => {
                                                            console.log('[Chart Data] repasseMonthlyData:', repasseMonthlyData);
                                                            console.log('[Chart Data] selectedRepasseSubMetric:', selectedRepasseSubMetric);
                                                            const mappedData = monthlyData.map((m) => {
                                                                const r = repasseMonthlyData.find(x => x.month === m.month);
                                                                console.log(`[Chart Data] Month ${m.month}: found=${!!r}, value=${selectedRepasseSubMetric === 'averagePerService' ? (r?.averagePerService || 0) : selectedRepasseSubMetric === 'averagePerWeek' ? (r?.averagePerWeek || 0) : (r?.averagePerProfessional || 0)}`);
                                                                return {
                                                                    ...m,
                                                                    totalRepasse:
                                                                        selectedRepasseSubMetric === 'averagePerService' ? (r?.averagePerService || 0)
                                                                            : selectedRepasseSubMetric === 'averagePerWeek' ? (r?.averagePerWeek || 0)
                                                                                : (r?.averagePerProfessional || 0),
                                                                } as MonthlyChartData;
                                                            });
                                                            console.log('[Chart Data] Final mapped data:', mappedData);
                                                            return mappedData;
                                                        })()
                                                        : monthlyData
                                        }
                                        selectedMetric={
                                            selectedMetric === 'totalRevenue' && selectedRevenueSubMetric !== 'none'
                                                ? (selectedRevenueSubMetric as any)
                                                : selectedMetric
                                        }
                                        isLoading={isChartLoading}
                                        invertColors={selectedMetric === 'uniqueClients' && selectedClientsSubMetric === 'churnRate'}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tabela de Métricas de Faturamento por Mês */}
                    {!isLoading && selectedMetric === 'totalRevenue' && monthlyData && (() => {
                        // Calcular totais e médias
                        const totalRevenue = monthlyData.reduce((sum, m) => sum + m.totalRevenue, 0);
                        const totalRepasse = monthlyData.reduce((sum, m) => sum + m.totalRepasse, 0);
                        const totalMargem = totalRevenue - totalRepasse;
                        const totalServices = monthlyData.reduce((sum, m) => sum + m.totalServices, 0);

                        const totalMonths = monthlyData.length;
                        const avgRevenue = totalRevenue / totalMonths;
                        const avgMargem = totalMargem / totalMonths;
                        const avgMediaAtend = totalRevenue / totalServices;
                        const avgMargemAtend = totalMargem / totalServices;

                        return (
                            <div className="mt-6">
                                <div className="bg-bg-secondary rounded-lg shadow-md overflow-hidden">
                                    <div className="p-6">
                                        <h3 className="text-lg font-semibold text-text-primary mb-4">
                                            Métricas Mensais de Faturamento
                                            <span className="ml-3 text-accent-primary font-bold">
                                                Total: {formatCurrency(totalRevenue)}
                                            </span>
                                        </h3>
                                        <div className="overflow-x-auto">
                                            <table className="w-full">
                                                <thead className="bg-bg-tertiary">
                                                    <tr>
                                                        <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                                                            Mês
                                                        </th>
                                                        <th className="px-4 py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider">
                                                            Faturamento
                                                        </th>
                                                        <th className="px-4 py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider">
                                                            Margem
                                                        </th>
                                                        <th className="px-4 py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider">
                                                            Média/Atend
                                                        </th>
                                                        <th className="px-4 py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider">
                                                            Margem/Atend
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-border-primary">
                                                    {monthlyData.map((monthData) => {
                                                        const margem = monthData.totalRevenue - monthData.totalRepasse;
                                                        const mediaAtend = monthData.totalServices > 0 ? monthData.totalRevenue / monthData.totalServices : 0;
                                                        const margemAtend = monthData.totalServices > 0 ? margem / monthData.totalServices : 0;

                                                        return (
                                                            <tr key={monthData.month} className="hover:bg-bg-tertiary transition-colors">
                                                                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-text-primary">
                                                                    {monthData.monthName}
                                                                </td>
                                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-text-primary font-semibold">
                                                                    {formatCurrency(monthData.totalRevenue)}
                                                                </td>
                                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-text-primary">
                                                                    {formatCurrency(margem)}
                                                                </td>
                                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-text-primary">
                                                                    {formatCurrency(mediaAtend)}
                                                                </td>
                                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-text-primary">
                                                                    {formatCurrency(margemAtend)}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                    {/* Linha de Média */}
                                                    <tr className="bg-gray-600 border-t-2 border-gray-500 font-semibold">
                                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-white">
                                                            Média
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-white font-bold">
                                                            {formatCurrency(avgRevenue)}
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-white">
                                                            {formatCurrency(avgMargem)}
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-white">
                                                            {formatCurrency(avgMediaAtend)}
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-white">
                                                            {formatCurrency(avgMargemAtend)}
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {!isLoading && selectedMetric === 'totalServices' && (
                        isAnalysisLoading ? (
                            <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-4 border-t-4 border-gray-200 rounded-full animate-spin border-t-accent-primary"></div></div>
                        ) : serviceAnalysis && metrics && (
                            <div className="mt-8 space-y-8">
                                <div className="bg-bg-secondary rounded-lg shadow-md">
                                    <div
                                        className="flex items-center justify-between p-6 cursor-pointer"
                                        onClick={() => setIsEvolutionChartVisible(!isEvolutionChartVisible)}
                                        aria-expanded={isEvolutionChartVisible}
                                    >
                                        <h3 className="text-lg font-semibold text-text-primary">
                                            Evolução Mês
                                            {serviceAnalysis.evolutionCount > 0 && (serviceAnalysis.startOfMonthCount + serviceAnalysis.evolutionCount) > 0 && (
                                                <span className="ml-2 text-sm font-normal text-brand-green">
                                                    +{((serviceAnalysis.evolutionCount / (serviceAnalysis.startOfMonthCount + serviceAnalysis.evolutionCount)) * 100).toFixed(1)}% Novos
                                                </span>
                                            )}
                                        </h3>
                                        <button className="p-1 rounded-full hover:bg-bg-tertiary">
                                            <Icon name={isEvolutionChartVisible ? 'chevron-up' : 'chevron-down'} className="w-5 h-5 text-text-secondary" />
                                        </button>
                                    </div>
                                    <div
                                        className={`transition-all duration-500 ease-in-out overflow-hidden ${isEvolutionChartVisible ? 'max-h-[400px]' : 'max-h-0'}`}
                                    >
                                        <div className="px-6 pb-6">
                                            <div className="h-72">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart
                                                        data={serviceAnalysis.dailyEvolutionData}
                                                        margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                                                    >
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                        <XAxis dataKey="day" fontSize={12} tickLine={false} axisLine={false} />
                                                        <YAxis allowDecimals={false} fontSize={12} tickLine={false} axisLine={false} />
                                                        <Tooltip content={<CustomEvolutionTooltip />} cursor={{ fill: 'rgba(241, 245, 249, 0.6)' }} />
                                                        <Legend
                                                            formatter={(value) => (
                                                                <span className="text-sm text-text-secondary">{value}</span>
                                                            )}
                                                        />
                                                        <Bar dataKey="Atend. (Clientes Antigos)" name="Atend. (Antigos)" stackId="a" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                                                        <Bar dataKey="Atend. (Clientes Novos)" name="Atend. (Novos)" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Análise por Dia da Semana - Linha completa */}
                                <div className="p-5 bg-bg-secondary rounded-lg shadow-md">
                                    <h4 className="text-base font-semibold text-center text-text-primary mb-3">Análise por Dia da Semana</h4>
                                    <div className="grid grid-cols-7 gap-2">
                                        {serviceAnalysis.dayOfWeekAnalysis.map(item => (
                                            <DayAnalysisCard key={item.day} day={item.day} percentage={item.percentage} count={item.count} average={item.average} />
                                        ))}
                                    </div>
                                </div>

                                {/* Período de Atendimento - Grid com 2 gráficos */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {/* Gráfico 1: Período de Atendimento */}
                                    <div className="p-6 bg-bg-secondary rounded-lg shadow-md h-96">
                                        {(() => {
                                            // Usa os dados de periodAnalysis do serviceAnalysis
                                            const periodAnalysis = serviceAnalysis?.periodAnalysis || [];

                                            // Ordena por período (menor para maior)
                                            const sortedPeriodAnalysis = [...periodAnalysis].sort((a, b) => {
                                                const numA = parseInt(a.type);
                                                const numB = parseInt(b.type);
                                                return numA - numB;
                                            });

                                            const chartData = sortedPeriodAnalysis.map(item => ({
                                                name: `${item.type}h`,
                                                value: item.count,
                                                percentage: item.percentage
                                            }));

                                            // Cores oficiais do sistema
                                            const COLORS = ['#a855f7', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

                                            if (chartData.length === 0) {
                                                return (
                                                    <div className="flex items-center justify-center h-full">
                                                        <p className="text-text-secondary text-sm">Sem dados de período de atendimento</p>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div className="grid grid-cols-5 gap-6 h-full">
                                                    {/* Coluna do Título e Legendas (2/5) */}
                                                    <div className="col-span-2 flex flex-col justify-center">
                                                        <h4 className="text-lg font-semibold text-text-primary mb-6">Período de Atendimento</h4>
                                                        <div className="space-y-3">
                                                            {chartData.map((item, index) => (
                                                                <div key={index} className="flex items-center gap-3">
                                                                    <div
                                                                        className="w-4 h-4 rounded-full flex-shrink-0"
                                                                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                                                    />
                                                                    <div className="flex flex-col">
                                                                        <span className="text-sm font-medium text-text-primary">{item.name}</span>
                                                                        <span className="text-xs text-text-secondary">
                                                                            {item.value} atendimentos ({item.percentage.toFixed(1)}%)
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Coluna do Gráfico de Pizza (3/5) */}
                                                    <div className="col-span-3 flex items-center justify-center">
                                                        <ResponsiveContainer width="100%" height="100%">
                                                            <PieChart>
                                                                <Pie
                                                                    data={chartData}
                                                                    cx="50%"
                                                                    cy="50%"
                                                                    labelLine={false}
                                                                    label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                                                                        const RADIAN = Math.PI / 180;
                                                                        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                                                                        const x = cx + radius * Math.cos(-midAngle * RADIAN);
                                                                        const y = cy + radius * Math.sin(-midAngle * RADIAN);

                                                                        return (
                                                                            <text
                                                                                x={x}
                                                                                y={y}
                                                                                fill="white"
                                                                                textAnchor={x > cx ? 'start' : 'end'}
                                                                                dominantBaseline="central"
                                                                                className="font-bold text-sm"
                                                                            >
                                                                                {`${(percent * 100).toFixed(1)}%`}
                                                                            </text>
                                                                        );
                                                                    }}
                                                                    outerRadius={140}
                                                                    fill="#a855f7"
                                                                    dataKey="value"
                                                                >
                                                                    {chartData.map((entry, index) => (
                                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                                    ))}
                                                                </Pie>
                                                                <Tooltip
                                                                    formatter={(value: any, name: any) => [`${value} atendimentos`, name]}
                                                                />
                                                            </PieChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    {/* Gráfico 2: Período por Tipo (Comercial/Residencial) */}
                                    <div className="p-6 bg-bg-secondary rounded-lg shadow-md h-96">
                                        {(() => {
                                            const periodByTypeAnalysis = serviceAnalysis?.periodByTypeAnalysis || [];

                                            if (periodByTypeAnalysis.length === 0) {
                                                return (
                                                    <div className="flex items-center justify-center h-full">
                                                        <p className="text-text-secondary text-sm">Sem dados de período por tipo</p>
                                                    </div>
                                                );
                                            }

                                            const chartData = periodByTypeAnalysis.map(item => {
                                                const total = item.comercial + item.residencial;
                                                return {
                                                    name: `${item.type}h`,
                                                    Comercial: item.comercial,
                                                    Residencial: item.residencial,
                                                    ComercialPct: total > 0 ? ((item.comercial / total) * 100).toFixed(1) : '0',
                                                    ResidencialPct: total > 0 ? ((item.residencial / total) * 100).toFixed(1) : '0'
                                                };
                                            });

                                            const renderCustomBarLabel = (props: any) => {
                                                const { x, y, width, height, value } = props;
                                                if (value === 0) return null;
                                                return (
                                                    <text
                                                        x={x + width / 2}
                                                        y={y + height / 2}
                                                        fill="white"
                                                        textAnchor="middle"
                                                        dominantBaseline="middle"
                                                        className="text-xs font-bold"
                                                    >
                                                        {value}
                                                    </text>
                                                );
                                            };

                                            return (
                                                <div className="flex flex-col h-full">
                                                    <h4 className="text-lg font-semibold text-text-primary mb-4">Período por Tipo</h4>
                                                    <div className="flex-1">
                                                        <ResponsiveContainer width="100%" height="100%">
                                                            <BarChart
                                                                data={chartData}
                                                                margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                                                            >
                                                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                                <XAxis
                                                                    dataKey="name"
                                                                    fontSize={12}
                                                                    tickLine={false}
                                                                    axisLine={false}
                                                                />
                                                                <YAxis
                                                                    allowDecimals={false}
                                                                    fontSize={12}
                                                                    tickLine={false}
                                                                    axisLine={false}
                                                                />
                                                                <Tooltip
                                                                    cursor={{ fill: 'rgba(241, 245, 249, 0.6)' }}
                                                                    contentStyle={{
                                                                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                                                        border: '1px solid #e2e8f0',
                                                                        borderRadius: '8px',
                                                                        padding: '12px'
                                                                    }}
                                                                    formatter={(value: any, name: any, props: any) => {
                                                                        const pct = name === 'Comercial' ? props.payload.ComercialPct : props.payload.ResidencialPct;
                                                                        return [`${value} (${pct}%)`, name];
                                                                    }}
                                                                />
                                                                <Legend
                                                                    formatter={(value) => (
                                                                        <span className="text-sm text-text-secondary">{value}</span>
                                                                    )}
                                                                />
                                                                <Bar
                                                                    dataKey="Comercial"
                                                                    fill="#06b6d4"
                                                                    radius={[4, 4, 0, 0]}
                                                                    label={renderCustomBarLabel}
                                                                />
                                                                <Bar
                                                                    dataKey="Residencial"
                                                                    fill="#10b981"
                                                                    radius={[4, 4, 0, 0]}
                                                                    label={renderCustomBarLabel}
                                                                />
                                                            </BarChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>

                                {/* Tabela de Métricas de Atendimentos por Mês */}
                                {monthlyData && servicesMonthlyData && (() => {
                                    // Identificar todos os períodos únicos
                                    const allPeriods = new Set<string>();
                                    Object.values(monthlyPeriods).forEach(periodCounts => {
                                        Object.keys(periodCounts).forEach(period => allPeriods.add(period));
                                    });
                                    const sortedPeriods = Array.from(allPeriods).sort((a, b) => {
                                        const numA = parseInt(a);
                                        const numB = parseInt(b);
                                        return numA - numB;
                                    });

                                    console.log('🔍 Table Debug:', {
                                        allPeriods: Array.from(allPeriods),
                                        sortedPeriods,
                                        monthlyPeriods,
                                        sampleMonth: monthlyPeriods['2025-01']
                                    });

                                    // Calcular total do ano
                                    const totalYearServices = monthlyData.reduce((sum, m) => sum + m.totalServices, 0);

                                    // Calcular médias
                                    const totalMonths = monthlyData.length;
                                    const avgServices = (totalYearServices / totalMonths).toFixed(1);
                                    const avgStart = (servicesMonthlyData.reduce((sum, s) => sum + (s.startOfMonth || 0), 0) / totalMonths).toFixed(1);
                                    const avgEvolution = (servicesMonthlyData.reduce((sum, s) => sum + (s.evolution || 0), 0) / totalMonths).toFixed(1);
                                    const avgProductiveDay = (servicesMonthlyData.reduce((sum, s) => sum + (Number(s.productiveDayAvg) || 0), 0) / totalMonths).toFixed(1);

                                    // Calcular média por período
                                    const avgPeriods: { [period: string]: string } = {};
                                    sortedPeriods.forEach(period => {
                                        const total = Object.values(monthlyPeriods).reduce((sum, periodCounts) => sum + (periodCounts[period] || 0), 0);
                                        avgPeriods[period] = (total / totalMonths).toFixed(1);
                                    });

                                    return (
                                        <div className="mt-6">
                                            <div className="bg-bg-secondary rounded-lg shadow-md overflow-hidden">
                                                <div className="p-6">
                                                    <h3 className="text-lg font-semibold text-text-primary mb-4">
                                                        Métricas Mensais de Atendimentos
                                                        <span className="ml-3 text-accent-primary font-bold">
                                                            Total: {totalYearServices.toLocaleString('pt-BR')}
                                                        </span>
                                                    </h3>
                                                    <div className="overflow-x-auto">
                                                        <table className="w-full">
                                                            <thead className="bg-bg-tertiary">
                                                                <tr>
                                                                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                                                                        Mês
                                                                    </th>
                                                                    <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                                                                        Atendimentos
                                                                    </th>
                                                                    <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                                                                        Início
                                                                    </th>
                                                                    <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                                                                        Evolução
                                                                    </th>
                                                                    <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                                                                        Média/Dia
                                                                    </th>
                                                                    {sortedPeriods.map(period => (
                                                                        <th key={period} className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                                                                            {period}h
                                                                        </th>
                                                                    ))}
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-border-primary">
                                                                {monthlyData.map((monthData) => {
                                                                    const serviceData = servicesMonthlyData.find(s => s.month === monthData.month);
                                                                    const currentYear = selectedPeriod.split('-')[0];
                                                                    const monthKey = `${currentYear}-${monthData.month}`;
                                                                    const monthPeriods = monthlyPeriods[monthKey] || {};

                                                                    return (
                                                                        <tr key={monthData.month} className="hover:bg-bg-tertiary transition-colors">
                                                                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-text-primary">
                                                                                {monthData.monthName}
                                                                            </td>
                                                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-text-primary font-semibold">
                                                                                {monthData.totalServices}
                                                                            </td>
                                                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-text-primary">
                                                                                {serviceData?.startOfMonth || 0}
                                                                            </td>
                                                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-text-primary">
                                                                                {serviceData?.evolution || 0}
                                                                            </td>
                                                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-text-primary">
                                                                                {serviceData?.productiveDayAvg ? Number(serviceData.productiveDayAvg).toFixed(1) : '0.0'}
                                                                            </td>
                                                                            {sortedPeriods.map(period => (
                                                                                <td key={period} className="px-4 py-3 whitespace-nowrap text-sm text-center text-text-primary">
                                                                                    {monthPeriods[period] || 0}
                                                                                </td>
                                                                            ))}
                                                                        </tr>
                                                                    );
                                                                })}
                                                                {/* Linha de Média */}
                                                                <tr className="bg-gray-600 border-t-2 border-gray-500 font-semibold">
                                                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-white">
                                                                        Média
                                                                    </td>
                                                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-white font-bold">
                                                                        {avgServices}
                                                                    </td>
                                                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-white">
                                                                        {avgStart}
                                                                    </td>
                                                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-white">
                                                                        {avgEvolution}
                                                                    </td>
                                                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-white">
                                                                        {avgProductiveDay}
                                                                    </td>
                                                                    {sortedPeriods.map(period => (
                                                                        <td key={period} className="px-4 py-3 whitespace-nowrap text-sm text-center text-white">
                                                                            {avgPeriods[period]}
                                                                        </td>
                                                                    ))}
                                                                </tr>
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        )
                    )}

                    {!isLoading && selectedMetric === 'uniqueClients' && (
                        isAnalysisLoading ? (
                            <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-4 border-t-4 border-gray-200 rounded-full animate-spin border-t-accent-primary"></div></div>
                        ) : clientAnalysis && (
                            <div className="mt-8 space-y-8">
                                <div className="p-6 bg-bg-secondary rounded-lg shadow-md">
                                    <h4 className="text-lg font-semibold text-text-primary mb-4">Composição de Clientes</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="flex flex-col gap-4">
                                            <SubMetricCard title="Clientes da Base" value={String(clientAnalysis.baseClientsCount)} subtext="Retornaram após inatividade" />
                                            <SubMetricCard title="Novos" value={String(clientAnalysis.newClientsCount)} subtext="Primeiro atendimento no mês" />
                                        </div>
                                        <div>
                                            <h5 className="text-md font-semibold text-center text-text-secondary mb-4">Análise de Tipo</h5>
                                            <div className="space-y-2">
                                                {clientAnalysis.typeAnalysis.map(item => (
                                                    <TypeAnalysisBar key={item.type} type={item.type} percentage={item.percentage} count={item.count} />
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    )}

                    {!isLoading && selectedMetric === 'totalRepasse' && (
                        isAnalysisLoading ? (
                            <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-4 border-t-4 border-gray-200 rounded-full animate-spin border-t-accent-primary"></div></div>
                        ) : repasseAnalysis && (
                            <div className="mt-8 space-y-8">
                                <div className="p-6 bg-bg-secondary rounded-lg shadow-md">
                                    <h4 className="text-lg font-semibold text-text-primary mb-4">Ranking de Profissionais (Top 10)</h4>
                                    <div className="space-y-3">
                                        {repasseAnalysis.professionalRanking.length === 0 ? (
                                            <p className="text-center text-text-secondary">Nenhum dado de profissional encontrado para este período.</p>
                                        ) : (
                                            repasseAnalysis.professionalRanking.map((item, index) => (
                                                <div key={item.professional} className="flex items-center text-sm p-2 rounded-md hover:bg-bg-tertiary">
                                                    <span className="w-8 font-bold text-text-secondary">{index + 1}.</span>
                                                    <span className="flex-1 font-medium text-text-primary truncate" title={item.professional}>{item.professional}</span>
                                                    <span className="w-32 font-semibold text-right text-success">{formatCurrency(item.total)}</span>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    )}

                </>
            )}
        </div>
    );
};

export default DashboardMetricsPage;