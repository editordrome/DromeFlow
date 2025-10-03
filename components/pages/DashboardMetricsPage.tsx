import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { fetchDashboardMetrics, fetchDashboardMetricsMulti, fetchMonthlyChartData } from '../../services/analytics/dashboard.service';
import type { MonthlyChartData } from '../../services/analytics/dashboard.service';
import { fetchServiceAnalysisData, fetchClientAnalysisData, fetchServiceMonthlySubmetrics, fetchServiceMonthlySubmetricsMulti, fetchClientMonthlySubmetrics, fetchClientMonthlySubmetricsMulti, type ServiceMonthlySubmetrics, type ClientMonthlySubmetrics } from '../../services/analytics/serviceAnalysis.service';
import { fetchRepasseAnalysisData } from '../../services/analytics/repasse.service';
import { DashboardMetrics, ServiceAnalysisRecord, ClientAnalysisData, RepasseAnalysisRecord } from '../../types';
import { Icon } from '../ui/Icon';
import MonthlyComparisonChart from '../ui/MonthlyComparisonChart';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';


const MetricCard: React.FC<{
  title: string;
  value: string;
  icon: string;
  iconBgColor: string;
  isSelected?: boolean;
  onClick?: () => void;
}> = ({ title, value, icon, iconBgColor, isSelected = false, onClick }) => (
  <div 
    className={`p-6 rounded-lg shadow-md flex items-center transition-all cursor-pointer hover:shadow-lg ${
      isSelected 
        ? 'bg-accent-primary border-2 border-accent-secondary' 
        : 'bg-bg-secondary hover:bg-bg-tertiary'
    }`}
    onClick={onClick}
  >
    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${iconBgColor}`}>
      <Icon name={icon} className="w-6 h-6 text-white" />
    </div>
    <div className="ml-4">
      <p className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-text-secondary'}`}>
        {title}
      </p>
      <p className={`text-2xl font-bold ${isSelected ? 'text-white' : 'text-text-primary'}`}>
        {value}
      </p>
    </div>
  </div>
);

// Componente de dropdown personalizado para filtro de período
const PeriodDropdown: React.FC<{
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}> = ({ value, onChange, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2]; // Últimos 3 anos
  
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
                  className={`w-full px-3 py-2 text-left text-sm transition-colors hover:bg-bg-tertiary ${
                    value === option.value ? 'bg-accent-primary text-white' : 'text-text-primary'
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

const SubMetricCard: React.FC<{ title: string; value: string; subtext?: string; valueColor?: string; onClick?: () => void; isActive?: boolean }> = ({ title, value, subtext, valueColor, onClick, isActive }) => (
    <div
      className={`flex-1 p-4 rounded-lg shadow-sm text-center transition-colors ${onClick ? 'cursor-pointer' : ''} ${isActive ? 'bg-accent-primary text-white' : 'bg-bg-tertiary'}`}
      onClick={onClick}
    >
        <p className={`text-sm ${isActive ? 'text-white' : 'text-text-secondary'}`}>{title}</p>
        <p className={`text-2xl font-bold ${isActive ? 'text-white' : (valueColor || 'text-text-primary')}`}>{value}</p>
        {subtext && <p className={`text-xs ${isActive ? 'text-white/80' : 'text-text-secondary'}`}>{subtext}</p>}
    </div>
);

const DayAnalysisBar: React.FC<{ day: string; percentage: number }> = ({ day, percentage }) => (
    <div className="flex items-center text-sm">
        <span className="w-24 text-text-secondary">{day}</span>
        <div className="flex-1 h-4 mx-2 bg-gray-200 rounded">
            <div
                className="h-4 rounded bg-accent-secondary"
                style={{ width: `${percentage}%` }}
            />
        </div>
        <span className="w-10 font-semibold text-right text-text-primary">{percentage.toFixed(1)}%</span>
    </div>
);

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
          <p style={{ color: '#8884d8' }}>
            {`Atend. (Antigos): ${payload[0].value}`}
          </p>
          <p style={{ color: '#82ca9d' }}>
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
type ServiceAnalysis = {
    startOfMonthCount: number;
    evolutionCount: number;
    averagePerDay: string;
    dayOfWeekAnalysis: { day: string; percentage: number }[];
    dailyEvolutionData: { day: string; 'Atend. (Clientes Antigos)': number; 'Atend. (Clientes Novos)': number }[];
};
type ClientAnalysis = {
    recurringCount: number;
    servicesPerClient: string;
    churnRate: string;
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
    const [serviceAnalysis, setServiceAnalysis] = useState<ServiceAnalysis | null>(null);
    const [clientAnalysis, setClientAnalysis] = useState<ClientAnalysis | null>(null);
    const [repasseAnalysis, setRepasseAnalysis] = useState<RepasseAnalysis | null>(null);
    const [isChartVisible, setIsChartVisible] = useState(true);
    const [isEvolutionChartVisible, setIsEvolutionChartVisible] = useState(true);

    const [isLoading, setIsLoading] = useState(true);
    const [isChartLoading, setIsChartLoading] = useState(false);
    const [isAnalysisLoading, setIsAnalysisLoading] = useState(false);

    const [error, setError] = useState<string | null>(null);
    const [selectedPeriod, setSelectedPeriod] = useState<string>(() => {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
    });
    const [selectedMetric, setSelectedMetric] = useState<MetricType>('totalRevenue');
    const [selectedRevenueSubMetric, setSelectedRevenueSubMetric] = useState<RevenueSubMetric>('none');
    const [selectedServicesSubMetric, setSelectedServicesSubMetric] = useState<ServicesSubMetric>('none');
    const [selectedClientsSubMetric, setSelectedClientsSubMetric] = useState<ClientsSubMetric>('none');

    const getPreviousPeriod = (period: string): string => {
        const [year, month] = period.split('-').map(Number);
        const date = new Date(year, month - 1, 1);
        date.setMonth(date.getMonth() - 1);
        const prevYear = date.getFullYear();
        const prevMonth = String(date.getMonth() + 1).padStart(2, '0');
        return `${prevYear}-${prevMonth}`;
    };

    const loadMetrics = useCallback(async () => {
        if (!selectedUnit) {
            setMetrics(null);
            setPreviousMonthMetrics(null);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);
        const previousPeriod = getPreviousPeriod(selectedPeriod);

        try {
            let currentResult: DashboardMetrics;
            let previousResult: DashboardMetrics;
            if (selectedUnit.unit_code === 'ALL') {
                currentResult = await fetchDashboardMetricsMulti(multiUnits, selectedPeriod);
                previousResult = await fetchDashboardMetricsMulti(multiUnits, previousPeriod);
            } else {
                [currentResult, previousResult] = await Promise.all([
                    fetchDashboardMetrics(selectedUnit.unit_code, selectedPeriod),
                    fetchDashboardMetrics(selectedUnit.unit_code, previousPeriod)
                ]);
            }
            setMetrics(currentResult);
            setPreviousMonthMetrics(previousResult);
        } catch (err: any) {
            setError('Falha ao carregar as métricas do dashboard.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, [selectedUnit, selectedPeriod, multiUnits]);

    const loadMonthlyData = useCallback(async () => {
        if (!selectedUnit) { setMonthlyData([]); return; }
        setIsChartLoading(true);
        try {
            const currentYear = new Date().getFullYear();
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
                })).sort((a,b)=>a.month.localeCompare(b.month));
                setMonthlyData(finalArray);
            } else {
                const result = await fetchMonthlyChartData(selectedUnit.unit_code, currentYear);
                setMonthlyData(result);
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
        } catch (err: any) {
            console.error('[DASHBOARD] Erro ao carregar dados mensais:', err);
                        setMonthlyData([]);
                        setServicesMonthlyData([]);
                        setClientsMonthlyData([]);
        } finally {
            setIsChartLoading(false);
        }
    }, [selectedUnit, multiUnits]);
    
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
            records.forEach(r => {
                if (r.DIA) dayOfWeekCounts[r.DIA] = (dayOfWeekCounts[r.DIA] || 0) + 1;
            });
            const dayOrder = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
            const dayOfWeekAnalysis = dayOrder.map(day => {
                const count = dayOfWeekCounts[day] || 0;
                const percentage = records.length > 0 ? (count / records.length) * 100 : 0;
                return { day, percentage };
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

            setServiceAnalysis({ startOfMonthCount, evolutionCount, averagePerDay, dayOfWeekAnalysis, dailyEvolutionData });

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
            
            const churnCount = [...previousMonthClients].filter(c => !currentClients.has(c)).length;
            const churnRate = previousMonthClients.size > 0 ? ((churnCount / previousMonthClients.size) * 100).toFixed(1) : '0.0';

            const newClientsCount = [...currentClients].filter(c => !allHistoricClientsBeforeThisMonth.has(c)).length;
            const baseClientsCount = currentClients.size - recurringCount - newClientsCount;

            const uniqueClientTypes = new Map<string, string>();
            currentData.clientDetails.forEach(detail => {
                if (detail.CLIENTE && !uniqueClientTypes.has(detail.CLIENTE)) {
                    uniqueClientTypes.set(detail.CLIENTE, detail.TIPO || 'Não especificado');
                }
            });
            
            const typeCounts: { [key: string]: number } = {};
            for (const type of uniqueClientTypes.values()) {
                const cleanType = type.trim() || 'Não especificado';
                typeCounts[cleanType] = (typeCounts[cleanType] || 0) + 1;
            }

            const totalUniqueClients = currentClients.size;
            const typeAnalysis = Object.keys(typeCounts).map(type => ({
                type,
                count: typeCounts[type],
                percentage: totalUniqueClients > 0 ? (typeCounts[type] / totalUniqueClients) * 100 : 0
            })).sort((a, b) => b.count - a.count);

            setClientAnalysis({
                recurringCount,
                servicesPerClient,
                churnRate: `${churnRate}%`,
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
        } else {
            setServiceAnalysis(null);
        }
        if (selectedMetric === 'uniqueClients' && metrics && previousMonthMetrics) {
            loadClientAnalysis();
        } else {
            setClientAnalysis(null);
        }
         if (selectedMetric === 'totalRepasse' && metrics) {
            loadRepasseAnalysis();
        } else {
            setRepasseAnalysis(null);
        }
    }, [selectedMetric, metrics, previousMonthMetrics, loadServiceAnalysisData, loadClientAnalysis, loadRepasseAnalysis]);

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
            // Pode ajustar título conforme submétrica de clientes, se necessário
            case 'totalRepasse': return { title: 'Repasse por Mês' };
            default: return { title: 'Métricas por Mês' };
        }
    };

    const formatCurrency = (value: number) => {
        return (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    if (!selectedUnit) {
        return (
            <div className="p-6 bg-bg-secondary rounded-lg shadow-md h-full flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-xl font-semibold text-text-primary">Painel de Métricas</h2>
                    <p className="mt-2 text-text-secondary">Por favor, selecione uma unidade para ver as métricas.</p>
                </div>
            </div>
        );
    }
    
    return (
        <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
                 <h1 className="text-3xl font-bold text-text-primary">Dashboard - {selectedUnit.unit_name}</h1>
                <div className="flex items-center gap-2 mt-4 sm:mt-0">
                    <PeriodDropdown
                        value={selectedPeriod}
                        onChange={setSelectedPeriod}
                        disabled={isLoading}
                    />
                </div>
            </div>
            
            {isLoading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="w-16 h-16 border-4 border-t-4 border-gray-200 rounded-full animate-spin border-t-accent-primary"></div>
                </div>
            ) : error ? (
                <div className="p-4 text-danger bg-danger/10 border border-danger/30 rounded-md">{error}</div>
            ) : (
                <>
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                        <MetricCard 
                            title="Faturamento"
                            value={formatCurrency(metrics?.totalRevenue || 0)}
                            icon="chart"
                            iconBgColor="bg-blue-500"
                            isSelected={selectedMetric === 'totalRevenue'}
                            onClick={() => { setSelectedMetric('totalRevenue'); setSelectedServicesSubMetric('none'); }}
                        />
                         <MetricCard 
                            title="Atendimentos"
                            value={String(metrics?.totalServices || 0)}
                            icon="briefcase"
                            iconBgColor="bg-green-500"
                            isSelected={selectedMetric === 'totalServices'}
                            onClick={() => { setSelectedMetric('totalServices'); setSelectedRevenueSubMetric('none'); setSelectedClientsSubMetric('none'); }}
                        />
                         <MetricCard 
                            title="Clientes"
                            value={String(metrics?.uniqueClients || 0)}
                            icon="users"
                            iconBgColor="bg-yellow-500"
                            isSelected={selectedMetric === 'uniqueClients'}
                            onClick={() => { setSelectedMetric('uniqueClients'); setSelectedRevenueSubMetric('none'); setSelectedServicesSubMetric('none'); setSelectedClientsSubMetric('none'); }}
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

                    <div className="mt-8">
                        <div className="bg-bg-secondary rounded-lg shadow-md">
                            <div
                                className="flex items-center justify-between p-6 cursor-pointer"
                                onClick={() => setIsChartVisible(!isChartVisible)}
                                aria-expanded={isChartVisible}
                            >
                                <h3 className="text-lg font-semibold text-text-primary">
                                    {getMetricConfig(selectedMetric).title}
                                </h3>
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
                                                                                                                                : monthlyData
                                                                                                                    }
                                                                                                                    selectedMetric={
                                                                                                                        selectedMetric === 'totalRevenue' && selectedRevenueSubMetric !== 'none'
                                                                                                                            ? (selectedRevenueSubMetric as any)
                                                                                                                            : selectedMetric
                                                                                                                    }
                                                                                                                    isLoading={isChartLoading}
                                                                                                            />
                                </div>
                            </div>
                        </div>
                    </div>

                    {!isLoading && selectedMetric === 'totalRevenue' && metrics && (
                        <div className="mt-6">
                            {/* 4 colunas em telas largas para manter tudo na mesma linha */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                {/* Margem Total (Faturamento - Repasse) */}
                                <SubMetricCard
                                    title="Margem"
                                    value={formatCurrency((metrics.totalRevenue || 0) - (metrics.totalRepasse || 0))}
                                    subtext="Faturamento - Repasse"
                                    onClick={() => setSelectedRevenueSubMetric(prev => prev === 'margin' ? 'none' : 'margin')}
                                    isActive={selectedRevenueSubMetric === 'margin'}
                                />
                                {/* Média por Atendimento (já existente) */}
                                <SubMetricCard
                                    title="Média por Atendimento"
                                    value={formatCurrency(metrics.averageTicket || 0)}
                                    subtext="Faturamento / Atendimentos"
                                    onClick={() => setSelectedRevenueSubMetric(prev => prev === 'averageTicket' ? 'none' : 'averageTicket')}
                                    isActive={selectedRevenueSubMetric === 'averageTicket'}
                                />
                                {/* Margem por Atendimento (derivada) */}
                                <SubMetricCard
                                    title="Margem por Atendimento"
                                    value={formatCurrency(metrics.totalServices > 0 ? ((metrics.totalRevenue - metrics.totalRepasse) / metrics.totalServices) : 0)}
                                    subtext="(Faturamento - Repasse) / Atendimentos"
                                    onClick={() => setSelectedRevenueSubMetric(prev => prev === 'marginPerService' ? 'none' : 'marginPerService')}
                                    isActive={selectedRevenueSubMetric === 'marginPerService'}
                                />
                                {/* Comparação com mês anterior */}
                                {(() => {
                                    if (!previousMonthMetrics) return <SubMetricCard title="Mês Anterior" value="--" />;
                                    const { totalRevenue: current } = metrics;
                                    const { totalRevenue: previous } = previousMonthMetrics;
                                    if (previous === 0) return <SubMetricCard title="Mês Anterior" value="N/A" subtext="Mês anterior sem faturamento" />;
                                    const change = ((current - previous) / previous) * 100;
                                    const isPositive = change >= 0;
                                    return (
                                        <SubMetricCard
                                            title="Mês Anterior"
                                            value={`${isPositive ? '+' : ''}${change.toFixed(1)}%`}
                                            valueColor={isPositive ? 'text-success' : 'text-danger'}
                                            subtext={`vs ${formatCurrency(previous)}`}
                                        />
                                    );
                                })()}
                            </div>
                        </div>
                    )}
                    
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
                                                    <Bar dataKey="Atend. (Clientes Antigos)" name="Atend. (Antigos)" stackId="a" fill="#8884d8" radius={[4, 4, 0, 0]} />
                                                    <Bar dataKey="Atend. (Clientes Novos)" name="Atend. (Novos)" stackId="a" fill="#82ca9d" radius={[4, 4, 0, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                                                <SubMetricCard title="Início Mês" value={String(serviceAnalysis.startOfMonthCount)} subtext="Atendimentos de clientes existentes"
                                                                    onClick={() => setSelectedServicesSubMetric(prev => prev === 'startOfMonth' ? 'none' : 'startOfMonth')}
                                                                    isActive={selectedServicesSubMetric === 'startOfMonth'}
                                                                />
                                                                <SubMetricCard title="Evolução" value={String(serviceAnalysis.evolutionCount)} subtext="Atendimentos de novos clientes"
                                                                    onClick={() => setSelectedServicesSubMetric(prev => prev === 'evolution' ? 'none' : 'evolution')}
                                                                    isActive={selectedServicesSubMetric === 'evolution'}
                                                                />
                                                                <SubMetricCard title="Média/Dia Produtivo" value={String(serviceAnalysis.averagePerDay)} subtext="Dias com >5 atendimentos"
                                                                    onClick={() => setSelectedServicesSubMetric(prev => prev === 'productiveDayAvg' ? 'none' : 'productiveDayAvg')}
                                                                    isActive={selectedServicesSubMetric === 'productiveDayAvg'}
                                                                />
                                {(() => {
                                    if (!previousMonthMetrics) return <SubMetricCard title="Mês Anterior" value="--" />;
                                    const { totalServices: current } = metrics;
                                    const { totalServices: previous } = previousMonthMetrics;
                                    if (previous === 0) return <SubMetricCard title="Mês Anterior" value="N/A" subtext="Mês anterior sem atendimentos" />;
                                    const change = ((current - previous) / previous) * 100;
                                    const isPositive = change >= 0;
                                    return (
                                        <SubMetricCard
                                            title="Mês Anterior"
                                            value={`${isPositive ? '+' : ''}${change.toFixed(1)}%`}
                                            valueColor={isPositive ? 'text-success' : 'text-danger'}
                                            subtext={`vs ${previous}`}
                                        />
                                    );
                                })()}
                            </div>
                            <div className="p-6 bg-bg-secondary rounded-lg shadow-md">
                                <h4 className="text-lg font-semibold text-center text-text-primary mb-4">Análise por Dia da Semana</h4>
                                <div className="space-y-2">
                                    {serviceAnalysis.dayOfWeekAnalysis.map(item => (
                                        <DayAnalysisBar key={item.day} day={item.day} percentage={item.percentage} />
                                    ))}
                                </div>
                            </div>
                        </div>
                      )
                    )}

                    {!isLoading && selectedMetric === 'uniqueClients' && (
                        isAnalysisLoading ? (
                            <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-4 border-t-4 border-gray-200 rounded-full animate-spin border-t-accent-primary"></div></div>
                        ) : clientAnalysis && metrics && previousMonthMetrics && (
                            <div className="mt-8 space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                    <SubMetricCard title="Recorrentes" value={String(clientAnalysis.recurringCount)} subtext="Clientes do mês anterior"
                                      onClick={() => setSelectedClientsSubMetric(prev => prev === 'recurringCount' ? 'none' : 'recurringCount')}
                                      isActive={selectedClientsSubMetric === 'recurringCount'}
                                    />
                                    <SubMetricCard title="Atend. por Cliente" value={clientAnalysis.servicesPerClient} subtext="Média de atendimentos"
                                      onClick={() => setSelectedClientsSubMetric(prev => prev === 'servicesPerClient' ? 'none' : 'servicesPerClient')}
                                      isActive={selectedClientsSubMetric === 'servicesPerClient'}
                                    />
                                    <SubMetricCard title="Churn" value={clientAnalysis.churnRate} valueColor="text-danger" subtext="Clientes não retornaram"
                                      onClick={() => setSelectedClientsSubMetric(prev => prev === 'churnRate' ? 'none' : 'churnRate')}
                                      isActive={selectedClientsSubMetric === 'churnRate'}
                                    />
                                    {(() => {
                                        const { uniqueClients: current } = metrics;
                                        const { uniqueClients: previous } = previousMonthMetrics;
                                        if (previous === 0) return <SubMetricCard title="Mês Anterior" value="N/A" subtext="Mês anterior sem clientes" />;
                                        const change = ((current - previous) / previous) * 100;
                                        const isPositive = change >= 0;
                                        return (
                                            <SubMetricCard
                                                title="Mês Anterior"
                                                value={`${isPositive ? '+' : ''}${change.toFixed(1)}%`}
                                                valueColor={isPositive ? 'text-success' : 'text-danger'}
                                                subtext={`vs ${previous} clientes`}
                                            />
                                        );
                                    })()}
                                </div>
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
                        ) : repasseAnalysis && metrics && previousMonthMetrics && (
                            <div className="mt-8 space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                    <SubMetricCard title="Média/Atend." value={formatCurrency(repasseAnalysis.averagePerService)} subtext="Repasse / Atendimentos" />
                                    <SubMetricCard title="Média/Semana" value={formatCurrency(repasseAnalysis.averagePerWeek)} subtext="Repasse total / 4.3" />
                                    <SubMetricCard title="Média/Profissional" value={formatCurrency(repasseAnalysis.averagePerProfessional)} subtext="Repasse / Profissionais" />
                                     {(() => {
                                        const { totalRepasse: current } = metrics;
                                        const { totalRepasse: previous } = previousMonthMetrics;
                                        if (previous === 0) return <SubMetricCard title="Mês Anterior" value="N/A" subtext="Mês anterior sem repasse" />;
                                        const change = ((current - previous) / previous) * 100;
                                        const isPositive = change >= 0;
                                        return (
                                            <SubMetricCard
                                                title="Mês Anterior"
                                                value={`${isPositive ? '+' : ''}${change.toFixed(1)}%`}
                                                valueColor={isPositive ? 'text-success' : 'text-danger'}
                                                subtext={`vs ${formatCurrency(previous)}`}
                                            />
                                        );
                                    })()}
                                </div>
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