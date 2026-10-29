import React, { useEffect, useMemo, useState } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { Icon } from '../ui/Icon';
import {
    fetchDashboardSummary,
    fetchFunnelData,
    fetchMonthlyTrend,
    fetchProfileDistribution,
    fetchAvailability,
    type DashboardSummary,
    type FunnelStep,
    type MonthlyPoint,
    type ProfileCategory,
    type AvailabilityItem,
} from '../../services/recrutadora/recrutadoraDashboard.service';

// ─── Mini-componentes de gráfico (CSS puro) ──────────────────

const MetricCard: React.FC<{ title: string; value: string | number; icon: string; iconBgColor?: string }> = ({ title, value, icon }) => (
    <div className="p-3 rounded-lg border bg-bg-secondary border-border-primary hover:shadow-md transition-all">
        <div className="flex items-center gap-2">
            <Icon name={icon} className="w-5 h-5" />
            <span className="text-sm font-medium">{title}</span>
            <span className="ml-auto text-lg font-bold text-text-primary">{value}</span>
        </div>
    </div>
);

const BarChart: React.FC<{ data: Array<{ label: string; value: number }>; color?: string; max?: number }> = ({ data, color = '#60a5fa', max: maxProp }) => {
    const max = maxProp ?? Math.max(...data.map(d => d.value), 1);
    return (
        <div className="flex items-end gap-2 h-40">
            {data.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                    <span className="text-xs font-semibold text-text-primary">{d.value}</span>
                    <div
                        className="w-full rounded-t-md transition-all duration-500"
                        style={{ height: `${Math.max((d.value / max) * 100, 4)}%`, backgroundColor: color }}
                    />
                    <span className="text-[10px] text-text-secondary truncate w-full text-center">{d.label}</span>
                </div>
            ))}
        </div>
    );
};

const HorizontalBar: React.FC<{ label: string; count: number; max: number; color: string }> = ({ label, count, max, color }) => (
    <div className="flex items-center gap-3">
        <span className="text-xs text-text-secondary w-28 text-right shrink-0 truncate">{label}</span>
        <div className="flex-1 bg-bg-tertiary rounded-full h-6 relative overflow-hidden">
            <div
                className="h-full rounded-full transition-all duration-700 flex items-center justify-end pr-2"
                style={{ width: `${Math.max((count / max) * 100, 2)}%`, backgroundColor: color }}
            >
                {count > 0 && (
                    <span className="text-[10px] font-bold text-white drop-shadow">{count}</span>
                )}
            </div>
        </div>
    </div>
);

const DonutChart: React.FC<{ items: Array<{ value: string; percent: number; count: number }>; colors: string[] }> = ({ items, colors }) => {
    // Build conic-gradient
    let gradient = '';
    let current = 0;
    items.forEach((item, i) => {
        const color = colors[i % colors.length];
        const next = current + item.percent;
        gradient += `${color} ${current}% ${next}%${i < items.length - 1 ? ', ' : ''}`;
        current = next;
    });
    // Fill remaining with gray
    if (current < 100) {
        gradient += `, #374151 ${current}% 100%`;
    }

    return (
        <div className="flex items-center gap-4">
            <div
                className="w-20 h-20 rounded-full shrink-0"
                style={{
                    background: `conic-gradient(${gradient})`,
                    maskImage: 'radial-gradient(transparent 40%, black 41%)',
                    WebkitMaskImage: 'radial-gradient(transparent 40%, black 41%)',
                }}
            />
            <div className="flex flex-col gap-1 min-w-0">
                {items.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colors[i % colors.length] }} />
                        <span className="text-text-secondary truncate">{item.value}</span>
                        <span className="font-semibold text-text-primary ml-auto">{item.percent}%</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ─── Paletas ─────────────────────────────────────────────────
const DONUT_COLORS = ['#60a5fa', '#f59e0b', '#10b981', '#ef4444', '#a78bfa', '#f472b6', '#22d3ee'];

// ─── Componente Principal ────────────────────────────────────

const RecrutadoraDashboard: React.FC = () => {
    const { selectedUnit } = useAppContext();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [summary, setSummary] = useState<DashboardSummary | null>(null);
    const [funnel, setFunnel] = useState<FunnelStep[]>([]);
    const [trend, setTrend] = useState<MonthlyPoint[]>([]);
    const [profile, setProfile] = useState<ProfileCategory[]>([]);
    const [availability, setAvailability] = useState<AvailabilityItem[]>([]);
    const [selectedMonth, setSelectedMonth] = useState<string>(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });

    // Generate month options (last 12 months)
    const monthOptions = useMemo(() => {
        const months: Array<{ value: string; label: string }> = [{ value: 'all', label: 'Todos os meses' }];
        const names = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        for (let i = 0; i < 12; i++) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            months.push({ value: key, label: `${names[d.getMonth()]} ${d.getFullYear()}` });
        }
        return months;
    }, []);

    useEffect(() => {
        if (!selectedUnit || (selectedUnit as any).id === 'ALL') {
            setLoading(false);
            return;
        }

        let cancelled = false;
        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                const unitId = selectedUnit.id as string;
                const monthFilter = selectedMonth !== 'all' ? selectedMonth : undefined;
                const [s, f, t, p, a] = await Promise.all([
                    fetchDashboardSummary(unitId, monthFilter),
                    fetchFunnelData(unitId, monthFilter),
                    fetchMonthlyTrend(unitId, 6),
                    fetchProfileDistribution(unitId, monthFilter),
                    fetchAvailability(unitId, monthFilter),
                ]);
                if (cancelled) return;
                setSummary(s);
                setFunnel(f);
                setTrend(t);
                setProfile(p);
                setAvailability(a);
            } catch (e: any) {
                if (!cancelled) setError(e.message || 'Erro ao carregar dashboard');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [selectedUnit, selectedMonth]);

    if (!selectedUnit || (selectedUnit as any).id === 'ALL') {
        return (
            <div className="flex items-center justify-center h-full min-h-[300px]">
                <p className="text-text-secondary text-sm">Selecione uma unidade para ver o dashboard.</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full min-h-[300px]">
                <div className="w-12 h-12 border-4 border-gray-200 rounded-full animate-spin border-t-accent-primary" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 text-danger bg-danger/10 border border-danger/30 rounded-md">{error}</div>
        );
    }

    if (!summary) return null;

    const funnelMax = Math.max(...funnel.map(f => f.count), 1);

    return (
        <div className="flex flex-col gap-6 overflow-y-auto pb-6">
            {/* KPI Cards + Filtro de período */}
            <div className="flex items-center gap-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
                    <MetricCard title="Candidatas" value={summary.total} icon="Users" />
                    <MetricCard title="Ativas" value={summary.ativas} icon="UserCheck" />
                    <MetricCard title="Não Aprovadas" value={summary.naoAprovadas} icon="UserX" />
                    <MetricCard title="Desistentes" value={summary.desistentes} icon="UserMinus" />
                </div>
                <select
                    id="dashboard-month-filter"
                    value={selectedMonth}
                    onChange={e => setSelectedMonth(e.target.value)}
                    className="px-3 py-2 text-sm border rounded-lg bg-bg-secondary border-border-primary text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary shrink-0"
                >
                    {monthOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
            </div>

            {/* Perfil das Candidatas — acima do funil */}
            <div className="bg-bg-secondary rounded-xl border border-border-secondary p-4">
                <h3 className="text-sm font-semibold text-text-primary mb-4">Perfil das Candidatas</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {profile.map(cat => (
                        <div key={cat.field}>
                            <h4 className="text-xs font-semibold text-text-secondary uppercase mb-2">{cat.label}</h4>
                            <DonutChart items={cat.items} colors={DONUT_COLORS} />
                        </div>
                    ))}
                </div>
            </div>

            {/* Funil + Tendência */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Funil */}
                <div className="bg-bg-secondary rounded-xl border border-border-secondary p-4">
                    <h3 className="text-sm font-semibold text-text-primary mb-4">Funil de Recrutamento</h3>
                    <div className="flex flex-col gap-2">
                        {funnel.map(step => (
                            <HorizontalBar key={step.code} label={step.label} count={step.count} max={funnelMax} color={step.color} />
                        ))}
                    </div>
                </div>

                {/* Evolução Mensal */}
                <div className="bg-bg-secondary rounded-xl border border-border-secondary p-4">
                    <h3 className="text-sm font-semibold text-text-primary mb-4">Evolução Mensal</h3>
                    <BarChart data={trend.map(t => ({ label: t.label, value: t.count }))} color="#a78bfa" />
                </div>
            </div>

            {/* Disponibilidade */}
            <div className="bg-bg-secondary rounded-xl border border-border-secondary p-4">
                <h3 className="text-sm font-semibold text-text-primary mb-4">Disponibilidade</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {availability.slice(0, 5).map(a => (
                        <div key={a.dias} className="text-center p-3 bg-bg-tertiary rounded-lg border border-border-secondary">
                            <span className="text-lg font-bold text-accent-primary">{a.percent}%</span>
                            <p className="text-xs text-text-secondary mt-1">{a.dias}</p>
                            <p className="text-[10px] text-text-secondary">{a.count} candidatas</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default RecrutadoraDashboard;
