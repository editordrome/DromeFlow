import { supabase } from '../supabaseClient';

// ─── KPI Summary ─────────────────────────────────────────────
export interface DashboardSummary {
    total: number;
    ativas: number;        // status = finalizado | ativo
    naoAprovadas: number;
    desistentes: number;
    novasMes: number;      // criadas no mês corrente
    taxaAprovacao: number; // ativas / total  (0-100)
    taxaDesistencia: number;
}

export async function fetchDashboardSummary(unitId: string, monthFilter?: string): Promise<DashboardSummary> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    let query = supabase
        .from('recrutadora')
        .select('status, created_at')
        .eq('unit_id', unitId);
    if (monthFilter) {
        const [y, m] = monthFilter.split('-').map(Number);
        const from = new Date(y, m - 1, 1);
        const to = new Date(y, m, 1);
        query = query.gte('created_at', from.toISOString()).lt('created_at', to.toISOString());
    }
    const { data, error } = await query;

    if (error) throw error;
    const rows = data || [];
    const total = rows.length;

    const normalize = (s: string) => s.toLowerCase().trim();

    const ativas = rows.filter(r => {
        const s = normalize(r.status);
        return s === 'finalizado' || s === 'finalizados' || s === 'ativo';
    }).length;

    const naoAprovadas = rows.filter(r => {
        const s = normalize(r.status);
        return s === 'nao_aprovadas' || s === 'não aprovadas';
    }).length;

    const desistentes = rows.filter(r => normalize(r.status) === 'desistentes').length;

    const novasMes = rows.filter(r => new Date(r.created_at) >= startOfMonth).length;

    return {
        total,
        ativas,
        naoAprovadas,
        desistentes,
        novasMes,
        taxaAprovacao: total > 0 ? Math.round((ativas / total) * 100) : 0,
        taxaDesistencia: total > 0 ? Math.round((desistentes / total) * 100) : 0,
    };
}

// ─── Funil ───────────────────────────────────────────────────
export interface FunnelStep {
    label: string;
    code: string;
    count: number;
    color: string;
}

const FUNNEL_STAGES: Array<{ code: string; label: string; color: string; aliases: string[] }> = [
    { code: 'qualificadas', label: 'Qualificadas', color: '#60a5fa', aliases: ['qualificadas', 'qualificado'] },
    { code: 'contato', label: 'Contato', color: '#a78bfa', aliases: ['contato', 'conversa_agendada'] },
    { code: 'envio_doc', label: 'Envio Docs', color: '#fbbf24', aliases: ['envio_doc'] },
    { code: 'truora', label: 'Truora', color: '#f97316', aliases: ['truora'] },
    { code: 'treinamento', label: 'Treinamento', color: '#34d399', aliases: ['treinamento'] },
    { code: 'finalizado', label: 'Finalizado', color: '#10b981', aliases: ['finalizado', 'finalizados', 'ativo'] },
    { code: 'nao_aprovadas', label: 'Não Aprovadas', color: '#ef4444', aliases: ['nao_aprovadas', 'não aprovadas', 'desqualificado'] },
    { code: 'desistentes', label: 'Desistentes', color: '#94a3b8', aliases: ['desistentes'] },
];

export async function fetchFunnelData(unitId: string, monthFilter?: string): Promise<FunnelStep[]> {
    let query = supabase
        .from('recrutadora')
        .select('status')
        .eq('unit_id', unitId);
    if (monthFilter) {
        const [y, m] = monthFilter.split('-').map(Number);
        const from = new Date(y, m - 1, 1);
        const to = new Date(y, m, 1);
        query = query.gte('created_at', from.toISOString()).lt('created_at', to.toISOString());
    }
    const { data, error } = await query;

    if (error) throw error;
    const rows = data || [];

    return FUNNEL_STAGES.map(stage => ({
        label: stage.label,
        code: stage.code,
        color: stage.color,
        count: rows.filter(r => stage.aliases.includes(r.status.toLowerCase().trim())).length,
    }));
}

// ─── Evolução Mensal ─────────────────────────────────────────
export interface MonthlyPoint {
    month: string; // YYYY-MM
    label: string; // "Jan/26"
    count: number;
}

export async function fetchMonthlyTrend(unitId: string, months = 6): Promise<MonthlyPoint[]> {
    const since = new Date();
    since.setMonth(since.getMonth() - months);
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
        .from('recrutadora')
        .select('created_at')
        .eq('unit_id', unitId)
        .gte('created_at', since.toISOString());

    if (error) throw error;
    const rows = data || [];

    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const buckets: Record<string, number> = {};

    // Create empty buckets for all months
    for (let i = 0; i < months; i++) {
        const d = new Date();
        d.setMonth(d.getMonth() - (months - 1 - i));
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        buckets[key] = 0;
    }

    for (const r of rows) {
        const d = new Date(r.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (key in buckets) buckets[key]++;
    }

    return Object.entries(buckets).map(([month, count]) => {
        const [y, m] = month.split('-');
        return { month, label: `${monthNames[parseInt(m) - 1]}/${y.slice(2)}`, count };
    });
}

// ─── Perfil ──────────────────────────────────────────────────
export interface ProfileCategory {
    field: string;
    label: string;
    items: Array<{ value: string; count: number; percent: number }>;
}

const PROFILE_FIELDS: Array<{ field: string; label: string; normalize?: Record<string, string> }> = [
    {
        field: 'estado_civil', label: 'Estado Civil',
        normalize: { solteira: 'Solteira', solteiro: 'Solteira', casada: 'Casada', casado: 'Casada', divorciada: 'Divorciada', 'viúva': 'Viúva', 'união estavel': 'União Estável' }
    },
    {
        field: 'fumante', label: 'Fumante',
        normalize: { sim: 'Sim', 'não': 'Não', nao: 'Não' }
    },
    {
        field: 'filhos', label: 'Tem Filhos',
        normalize: { sim: 'Sim', 'não': 'Não', nao: 'Não', 'sem filhos': 'Não' }
    },
    {
        field: 'transporte', label: 'Transporte',
        normalize: { 'transporte publico/uber': 'Público/Uber', 'transporte publico': 'Público/Uber', uber: 'Público/Uber', carro: 'Carro', moto: 'Moto', 'próprio': 'Carro', 'público': 'Público/Uber' }
    },
    {
        field: 'sit_atual', label: 'Situação Atual',
        normalize: { 'estou parada': 'Parada', 'faço particular': 'Faz Particular', empregado: 'Empregada', desempregada: 'Parada' }
    },
    {
        field: 'exp_residencial', label: 'Exp. Residencial',
        normalize: { sim: 'Sim', 'não': 'Não', nao: 'Não' }
    },
    {
        field: 'exp_comercial', label: 'Exp. Comercial',
        normalize: { sim: 'Sim', 'não': 'Não', nao: 'Não' }
    },
];

export async function fetchProfileDistribution(unitId: string, monthFilter?: string): Promise<ProfileCategory[]> {
    const fields = PROFILE_FIELDS.map(f => f.field).join(', ') + ', created_at';
    let query = supabase
        .from('recrutadora')
        .select(fields)
        .eq('unit_id', unitId);
    if (monthFilter) {
        const [y, m] = monthFilter.split('-').map(Number);
        const from = new Date(y, m - 1, 1);
        const to = new Date(y, m, 1);
        query = query.gte('created_at', from.toISOString()).lt('created_at', to.toISOString());
    }
    const { data, error } = await query;

    if (error) throw error;
    const rows = data || [];

    return PROFILE_FIELDS.map(pf => {
        const counts: Record<string, number> = {};
        let validTotal = 0;

        for (const row of rows) {
            let val = ((row as any)[pf.field] || '').toString().trim().toLowerCase();
            if (!val || val === 'vazio' || val === 'preencher' || val === '-') continue;

            // Normalize
            if (pf.normalize) {
                val = pf.normalize[val] || val;
            }
            // Capitalize if not handled by normalize
            if (val === val.toLowerCase() && val.length > 1) {
                val = val.charAt(0).toUpperCase() + val.slice(1);
            }

            counts[val] = (counts[val] || 0) + 1;
            validTotal++;
        }

        const items = Object.entries(counts)
            .map(([value, count]) => ({ value, count, percent: validTotal > 0 ? Math.round((count / validTotal) * 100) : 0 }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5); // top 5

        return { field: pf.field, label: pf.label, items };
    });
}

// ─── Disponibilidade ─────────────────────────────────────────
export interface AvailabilityItem {
    dias: string;
    count: number;
    percent: number;
}

export async function fetchAvailability(unitId: string, monthFilter?: string): Promise<AvailabilityItem[]> {
    let query = supabase
        .from('recrutadora')
        .select('dias_livres')
        .eq('unit_id', unitId);
    if (monthFilter) {
        const [y, m] = monthFilter.split('-').map(Number);
        const from = new Date(y, m - 1, 1);
        const to = new Date(y, m, 1);
        query = query.gte('created_at', from.toISOString()).lt('created_at', to.toISOString());
    }
    const { data, error } = await query;

    if (error) throw error;
    const rows = data || [];

    const counts: Record<string, number> = {};
    let validTotal = 0;

    for (const r of rows) {
        const val = (r.dias_livres || '').trim();
        if (!val) continue;
        counts[val] = (counts[val] || 0) + 1;
        validTotal++;
    }

    return Object.entries(counts)
        .map(([dias, count]) => ({ dias, count, percent: validTotal > 0 ? Math.round((count / validTotal) * 100) : 0 }))
        .sort((a, b) => b.count - a.count);
}
