import { supabase } from '../supabaseClient';

export const fetchClients = async ({
  unitCode,
  search,
  period,
}: {
  unitCode: string;
  search?: string;
  period: string;
}): Promise<any[]> => {
  if (!unitCode) return [];
  if (!/^\d{4}-\d{2}$/.test(period)) return [];
  const [year, month] = period.split('-').map(Number);
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = new Date(Date.UTC(year, month, 0)).toISOString().split('T')[0];
  const currentFirst = new Date(Date.UTC(year, month - 1, 1));
  const prevFirst = new Date(currentFirst.getTime());
  prevFirst.setUTCMonth(prevFirst.getUTCMonth() - 1);
  const prevYear = prevFirst.getUTCFullYear();
  const prevMonth = prevFirst.getUTCMonth() + 1;
  const prevStart = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;
  const prevEnd = new Date(Date.UTC(prevYear, prevMonth, 0))
    .toISOString()
    .split('T')[0];
  const prev2First = new Date(prevFirst.getTime());
  prev2First.setUTCMonth(prev2First.getUTCMonth() - 1);
  const prev2Year = prev2First.getUTCFullYear();
  const prev2Month = prev2First.getUTCMonth() + 1;
  const prev2Start = `${prev2Year}-${String(prev2Month).padStart(2, '0')}-01`;
  const prev2End = new Date(Date.UTC(prev2Year, prev2Month, 0))
    .toISOString()
    .split('T')[0];

  const [currentRes, prevRes, prev2Res] = await Promise.all([
    supabase
      .from('processed_data')
      .select('CLIENTE, TIPO, DATA')
      .eq('unidade_code', unitCode)
      .gte('DATA', startDate)
      .lte('DATA', endDate),
    supabase
      .from('processed_data')
      .select('CLIENTE, TIPO, DATA')
      .eq('unidade_code', unitCode)
      .gte('DATA', prevStart)
      .lte('DATA', prevEnd),
    supabase
      .from('processed_data')
      .select('CLIENTE, TIPO, DATA')
      .eq('unidade_code', unitCode)
      .gte('DATA', prev2Start)
      .lte('DATA', prev2End),
  ]);

  if (currentRes.error || prevRes.error || prev2Res.error) return [];

  interface Row {
    CLIENTE: string;
    TIPO?: string | null;
    DATA: string;
  }

  const currentRows = ((currentRes.data as Row[]) || []).filter(
    (r) => r.CLIENTE && r.CLIENTE.trim()
  );
  const prevRows = ((prevRes.data as Row[]) || []).filter(
    (r) => r.CLIENTE && r.CLIENTE.trim()
  );
  const prev2Rows = ((prev2Res.data as Row[]) || []).filter(
    (r) => r.CLIENTE && r.CLIENTE.trim()
  );

  const latestCurrent = new Map<string, Row>();
  for (const r of currentRows) {
    const raw = r.CLIENTE;
    const existing = latestCurrent.get(raw);
    if (!existing || existing.DATA < r.DATA) latestCurrent.set(raw, r);
  }
  const currentSet = new Set(currentRows.map((r) => r.CLIENTE));
  const prevSet = new Set(prevRows.map((r) => r.CLIENTE));

  let list = Array.from(latestCurrent.values()).map((r) => {
    const raw = r.CLIENTE;
    const inPrev = prevSet.has(raw);
    const categoria = inPrev ? 'recorrente' : 'outro';
    return {
      id: raw,
      nome: raw.trim() || raw,
      tipo: r.TIPO || null,
      lastAttendance: r.DATA,
      categoria,
    };
  });

  if (search && search.trim()) {
    const s = search.trim().toLowerCase();
    list = list.filter((c) => c.nome.toLowerCase().includes(s));
  }
  list.sort((a, b) => a.nome.localeCompare(b.nome));

  const latestPrev = new Map<string, Row>();
  for (const r of prevRows) {
    const existing = latestPrev.get(r.CLIENTE);
    if (!existing || existing.DATA < r.DATA) latestPrev.set(r.CLIENTE, r);
  }
  const buildCountMap = (rows: Row[]) => {
    const m = new Map<string, number>();
    for (const r of rows) {
      const k = r.CLIENTE;
      m.set(k, (m.get(k) || 0) + 1);
    }
    return m;
  };
  const currentCountMap = buildCountMap(currentRows);
  const prevCountMap = buildCountMap(prevRows);
  const prev2CountMap = buildCountMap(prev2Rows);

  const currentPeriodKey = `${year}-${String(month).padStart(2, '0')}`;
  const prevPeriodKey = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
  const prev2PeriodKey = `${prev2Year}-${String(prev2Month).padStart(2, '0')}`;

  const atencaoObjects = Array.from(prevSet)
    .filter((c) => !currentSet.has(c))
    .map((c) => {
      const row = latestPrev.get(c);
      const monthlyCounts: Record<string, number> = {
        [prev2PeriodKey]: prev2CountMap.get(c) || 0,
        [prevPeriodKey]: prevCountMap.get(c) || 0,
        [currentPeriodKey]: currentCountMap.get(c) || 0,
      };
      return {
        id: c,
        nome: c.trim() || c,
        tipo: row?.TIPO || null,
        lastAttendance: row?.DATA || null,
        categoria: 'atencao',
        monthlyCounts,
      };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome));

  (list as any)._atencaoSource = atencaoObjects;
  return list;
};

export const fetchClientMetrics = async (
  unitCode: string,
  period: string
): Promise<{
  total: number;
  comercial: number;
  residencial: number;
  recorrente: number;
  atencao: number;
  inativos: number;
} | null> => {
  if (!unitCode || !period) return null;
  const { data, error } = await supabase.rpc('get_client_metrics', {
    p_unidade_code: unitCode,
    p_period: period,
  });
  if (error) return null;
  const normalized = Array.isArray(data) ? (data || [])[0] : data;
  if (!normalized)
    return {
      total: 0,
      comercial: 0,
      residencial: 0,
      recorrente: 0,
      atencao: 0,
      inativos: 0,
    };
  return {
    total: normalized.total ?? 0,
    comercial: normalized.comercial ?? 0,
    residencial: normalized.residencial ?? 0,
    recorrente: normalized.recorrente ?? 0,
    atencao: normalized.atencao ?? 0,
    inativos: normalized.inativos ?? 0,
  };
};

export const fetchClientMetricsFromProcessed = async (
  unitCode: string,
  period: string
): Promise<{ total: number; recorrente: number; atencao: number; outros: number; churnRatePercent: string }> => {
  if (!unitCode || !/^\d{4}-\d{2}$/.test(period))
    return { total: 0, recorrente: 0, atencao: 0, outros: 0, churnRatePercent: '0.0%' };
  const [year, month] = period.split('-').map(Number);
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = new Date(Date.UTC(year, month, 0)).toISOString().split('T')[0];

  const currentFirst = new Date(Date.UTC(year, month - 1, 1));
  const prevFirst = new Date(currentFirst.getTime());
  prevFirst.setUTCMonth(prevFirst.getUTCMonth() - 1);
  const prevYear = prevFirst.getUTCFullYear();
  const prevMonth = prevFirst.getUTCMonth() + 1;
  const prevStart = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;
  const prevEnd = new Date(Date.UTC(prevYear, prevMonth, 0)).toISOString().split('T')[0];

  const [currentRes, prevRes] = await Promise.all([
    supabase
      .from('processed_data')
      .select('CLIENTE')
      .eq('unidade_code', unitCode)
      .gte('DATA', startDate)
      .lte('DATA', endDate),
    supabase
      .from('processed_data')
      .select('CLIENTE')
      .eq('unidade_code', unitCode)
      .gte('DATA', prevStart)
      .lte('DATA', prevEnd),
  ]);

  if (currentRes.error || prevRes.error)
    return { total: 0, recorrente: 0, atencao: 0, outros: 0, churnRatePercent: '0.0%' };

  const currentClients = new Set<string>(
    ((currentRes.data as any[]) || [])
      .map((r) => r.CLIENTE)
      .filter((c) => typeof c === 'string' && c.trim() !== '')
  );
  const prevClients = new Set<string>(
    ((prevRes.data as any[]) || [])
      .map((r) => r.CLIENTE)
      .filter((c) => typeof c === 'string' && c.trim() !== '')
  );

  const total = currentClients.size;
  let recorrente = 0;
  let atencao = 0;
  currentClients.forEach((c) => {
    if (prevClients.has(c)) recorrente++;
  });
  prevClients.forEach((c) => {
    if (!currentClients.has(c)) atencao++;
  });
  const outros = Math.max(0, total - recorrente);
  const churnRatePercent = total > 0 ? `${((atencao / (atencao + total)) * 100).toFixed(1)}%` : '0.0%';
  return { total, recorrente, atencao, outros, churnRatePercent };
};
/**
 * clients.service.ts
 * Esqueleto de serviço para análises de clientes.
 */

// TODO: migrar funções: fetchClients, fetchClientMetrics, fetchClientMetricsFromProcessed, fetchClientAnalysisData

export {};
