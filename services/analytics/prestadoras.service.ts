import { supabase } from '../supabaseClient';

export const countProfissionais = async (unitIds: string[]): Promise<number> => {
  if (!unitIds || unitIds.length === 0) return 0;
  const { count, error } = await supabase
    .from('profissionais')
    .select('id', { count: 'exact', head: true })
    .in('unit_id', unitIds);
  if (error) throw error;
  return count || 0;
};

export const countRecrutadora = async (unitIds: string[]): Promise<number> => {
  if (!unitIds || unitIds.length === 0) return 0;
  const { count, error } = await supabase
    .from('recrutadora')
    .select('id', { count: 'exact', head: true })
    .in('unit_id', unitIds);
  if (error) throw error;
  return count || 0;
};

export const countProcessedDataForPeriod = async (unitCodes: string[], period: string): Promise<number> => {
  if (!unitCodes || unitCodes.length === 0) return 0;
  if (!/^\d{4}-\d{2}$/.test(period)) return 0;
  const [year, month] = period.split('-').map(Number);
  const startDate = `${year}-${String(month).padStart(2,'0')}-01`;
  const endDate = new Date(Date.UTC(year, month, 0)).toISOString().split('T')[0];
  const { count, error } = await supabase
    .from('processed_data')
    .select('id', { count: 'exact', head: true })
    .in('unidade_code', unitCodes)
    .gte('DATA', startDate)
    .lte('DATA', endDate);
  if (error) throw error;
  return count || 0;
};

export type MonthlyActivitySummary = {
  atendimentos: number;
  profissionaisAtuantes: number;
  totalRepasse: number;
  mediaAtendPorProfissional: number;
  mediaRepassePorAtendimento: number;
};

export const getMonthlyActivitySummary = async (unitCodes: string[], period: string): Promise<MonthlyActivitySummary> => {
  if (!unitCodes || unitCodes.length === 0 || !/^\d{4}-\d{2}$/.test(period)) {
    return { atendimentos: 0, profissionaisAtuantes: 0, totalRepasse: 0, mediaAtendPorProfissional: 0, mediaRepassePorAtendimento: 0 };
  }
  const [year, month] = period.split('-').map(Number);
  const startDate = `${year}-${String(month).padStart(2,'0')}-01`;
  const endDate = new Date(Date.UTC(year, month, 0)).toISOString().split('T')[0];

  // Busca somente colunas necessárias para reduzir payload
  const { data, error, count } = await supabase
    .from('processed_data')
    .select('REPASSE, PROFISSIONAL', { count: 'exact' })
    .in('unidade_code', unitCodes)
    .gte('DATA', startDate)
    .lte('DATA', endDate);
  if (error) throw error;

  const atendimentos = count || (data?.length || 0);
  const profSet = new Set<string>();
  let totalRepasse = 0;
  for (const r of (data as any[]) || []) {
    const prof = (r as any).PROFISSIONAL as string | null;
    if (prof && String(prof).trim() !== '') profSet.add(String(prof).trim());
    const rep = Number((r as any).REPASSE);
    if (!Number.isNaN(rep)) totalRepasse += rep;
  }
  const profissionaisAtuantes = profSet.size;
  const mediaAtendPorProfissional = profissionaisAtuantes > 0 ? atendimentos / profissionaisAtuantes : 0;
  const mediaRepassePorAtendimento = atendimentos > 0 ? totalRepasse / atendimentos : 0;
  return { atendimentos, profissionaisAtuantes, totalRepasse, mediaAtendPorProfissional, mediaRepassePorAtendimento };
};

export type ProfessionalMonthlyStat = {
  profissional: string;
  atendimentos: number;
  totalRepasse: number;
};

export const getProfessionalMonthlyStats = async (unitCodes: string[], period: string): Promise<ProfessionalMonthlyStat[]> => {
  if (!unitCodes || unitCodes.length === 0 || !/^\d{4}-\d{2}$/.test(period)) return [];
  const [year, month] = period.split('-').map(Number);
  const startDate = `${year}-${String(month).padStart(2,'0')}-01`;
  const endDate = new Date(Date.UTC(year, month, 0)).toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('processed_data')
    .select('PROFISSIONAL, REPASSE')
    .in('unidade_code', unitCodes)
    .gte('DATA', startDate)
    .lte('DATA', endDate);
  if (error) throw error;

  const map = new Map<string, { atend: number; repasse: number }>();
  for (const r of (data as any[]) || []) {
    const profRaw = (r as any).PROFISSIONAL as string | null;
    const prof = profRaw ? String(profRaw).trim() : '';
    if (!prof) continue;
    const rep = Number((r as any).REPASSE);
    const curr = map.get(prof) || { atend: 0, repasse: 0 };
    curr.atend += 1;
    if (!Number.isNaN(rep)) curr.repasse += rep;
    map.set(prof, curr);
  }
  const arr: ProfessionalMonthlyStat[] = Array.from(map.entries()).map(([prof, agg]) => ({ profissional: prof, atendimentos: agg.atend, totalRepasse: agg.repasse }));
  // Ordenação padrão: mais atendimentos
  arr.sort((a,b)=> b.atendimentos - a.atendimentos || b.totalRepasse - a.totalRepasse);
  return arr;
};

export type ProfessionalAppointment = {
  DATA: string; // YYYY-MM-DD
  CLIENTE: string | null;
  MOMENTO?: string | null; // período
  HORARIO?: string | null; // fallback
  REPASSE: number | null;
  PROFISSIONAL: string;
};

export const getProfessionalAppointmentsForPeriod = async (
  unitCodes: string[],
  period: string,
  profissional: string
): Promise<ProfessionalAppointment[]> => {
  if (!unitCodes || unitCodes.length === 0 || !/\d{4}-\d{2}/.test(period) || !profissional) return [];
  const [year, month] = period.split('-').map(Number);
  const startDate = `${year}-${String(month).padStart(2,'0')}-01`;
  const endDate = new Date(Date.UTC(year, month, 0)).toISOString().split('T')[0];

  const baseSelect = 'DATA, CLIENTE, MOMENTO, HORARIO, REPASSE, PROFISSIONAL';

  // 1) tentativa com igualdade exata (case-insensitive)
  let { data, error } = await supabase
    .from('processed_data')
    .select(baseSelect)
    .in('unidade_code', unitCodes)
    .gte('DATA', startDate)
    .lte('DATA', endDate)
    .ilike('PROFISSIONAL', profissional)
    .order('DATA', { ascending: true });
  if (error) throw error;

  // 2) fallback: se vier vazio (possíveis espaços/trimming), busca ampla e filtra no cliente por trim
  if (!data || data.length === 0) {
    const resp = await supabase
      .from('processed_data')
      .select(baseSelect)
      .in('unidade_code', unitCodes)
      .gte('DATA', startDate)
      .lte('DATA', endDate)
      .order('DATA', { ascending: true });
    if (resp.error) throw resp.error;
    data = (resp.data || []).filter((r: any) => String(r.PROFISSIONAL || '').trim() === profissional.trim());
  }

  return (data as ProfessionalAppointment[]) || [];
};

export type RecrutadoraMonthlyMetrics = {
  total: number;
  qualificadas: number;
  naoAprovadas: number;
  desistentes: number;
};

export const getRecrutadoraMonthlyMetrics = async (unitIds: string[], period: string): Promise<RecrutadoraMonthlyMetrics> => {
  if (!unitIds || unitIds.length === 0 || !/\d{4}-\d{2}/.test(period)) {
    return { total: 0, qualificadas: 0, naoAprovadas: 0, desistentes: 0 };
  }
  const [year, month] = period.split('-').map(Number);
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const nextMonth = new Date(Date.UTC(year, month, 1));
  const startISO = startDate.toISOString();
  const nextISO = nextMonth.toISOString();

  const base = (status?: string) => {
    let q = supabase
      .from('recrutadora')
      .select('id', { count: 'exact', head: true })
      .in('unit_id', unitIds)
      .gte('created_at', startISO)
      .lt('created_at', nextISO);
    if (status) q = q.eq('status', status);
    return q;
  };

  const [totalRes, qualRes, naoAprovRes, desisRes] = await Promise.all([
    base(),
    base('qualificadas'),
    base('nao_aprovadas'),
    base('desistentes'),
  ]);
  if (totalRes.error) throw totalRes.error;
  if (qualRes.error) throw qualRes.error;
  if (naoAprovRes.error) throw naoAprovRes.error;
  if (desisRes.error) throw desisRes.error;

  return {
    total: totalRes.count || 0,
    qualificadas: qualRes.count || 0,
    naoAprovadas: naoAprovRes.count || 0,
    desistentes: desisRes.count || 0,
  };
};

export const getProfissionaisActivatedForPeriod = async (unitIds: string[], period: string): Promise<number> => {
  if (!unitIds || unitIds.length === 0 || !/\d{4}-\d{2}/.test(period)) return 0;
  const [year, month] = period.split('-').map(Number);
  const startDate = `${year}-${String(month).padStart(2,'0')}-01`;
  const endDate = new Date(Date.UTC(year, month, 0)).toISOString().split('T')[0];

  // Tenta filtrar por data_ativo se existir, com status contendo 'ativo'
  let q = supabase
    .from('profissionais')
    .select('id', { count: 'exact', head: true })
    .in('unit_id', unitIds)
    .ilike('status', '%ativo%')
    .gte('data_ativo', startDate)
    .lte('data_ativo', endDate);
  let { count, error } = await q;
  if (error && (error as any).code === '42703') {
    // Fallback: usar created_at se data_ativo não existir
    const res = await supabase
      .from('profissionais')
      .select('id', { count: 'exact', head: true })
      .in('unit_id', unitIds)
      .ilike('status', '%ativo%')
      .gte('created_at', `${startDate}T00:00:00Z`)
      .lt('created_at', new Date(Date.UTC(year, month, 1)).toISOString());
    if (res.error) throw res.error;
    return res.count || 0;
  }
  if (error) throw error;
  return count || 0;
};

/**
 * Busca o último atendimento de cada profissional diretamente da tabela processed_data
 */
export const getLastAppointmentByProfessional = async (
  unitCodes: string[]
): Promise<Record<string, string>> => {
  if (!unitCodes || unitCodes.length === 0) return {};

  try {
    // Buscar todos os atendimentos das unidades
    const { data, error } = await supabase
      .from('processed_data')
      .select('PROFISSIONAL, DATA')
      .in('unidade_code', unitCodes)
      .not('PROFISSIONAL', 'is', null)
      .not('PROFISSIONAL', 'eq', '')
      .not('DATA', 'is', null)
      .order('DATA', { ascending: false });

    if (error) {
      console.error('Erro ao buscar último atendimento:', error);
      return {};
    }

    // Agrupar por profissional e pegar a data mais recente
    const result: Record<string, string> = {};
    
    if (data && Array.isArray(data)) {
      data.forEach((row: any) => {
        const profKey = (row.PROFISSIONAL || '').toLowerCase().trim();
        if (!profKey) return;
        
        // Se ainda não temos registro dessa profissional, ou se esta data é mais recente
        if (!result[profKey]) {
          result[profKey] = row.DATA;
        }
      });
    }

    return result;
  } catch (error) {
    console.error('Erro ao buscar últimos atendimentos:', error);
    return {};
  }
};
