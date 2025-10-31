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

  // Busca dados de contato da tabela unit_clients para enriquecimento
  const unitsRes = await supabase.from('units').select('id').eq('unit_code', unitCode).maybeSingle();
  let contactMap = new Map<string, string>();
  if (!unitsRes.error && unitsRes.data?.id) {
    const clientsRes = await supabase
      .from('unit_clients')
      .select('nome, contato')
      .eq('unit_id', unitsRes.data.id);
    if (!clientsRes.error && clientsRes.data) {
      const normalize = (value: string | null | undefined) => {
        if (!value) return '';
        return value
          .toString()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/\(.*?\)/g, ' ')
          .replace(/[^a-zA-Z0-9\s]/g, ' ')
          .toLowerCase()
          .replace(/\s+/g, ' ')
          .trim();
      };
      clientsRes.data.forEach((c: any) => {
        const key = normalize(c.nome);
        if (key && c.contato) contactMap.set(key, c.contato);
      });
    }
  }

  const [currentRes, prevRes, prev2Res] = await Promise.all([
    supabase
      .from('processed_data')
      .select('CLIENTE, TIPO, DATA, ACAO')
      .eq('unidade_code', unitCode)
      .gte('DATA', startDate)
      .lte('DATA', endDate),
    supabase
      .from('processed_data')
      .select('CLIENTE, TIPO, DATA, ACAO')
      .eq('unidade_code', unitCode)
      .gte('DATA', prevStart)
      .lte('DATA', prevEnd),
    supabase
      .from('processed_data')
      .select('CLIENTE, TIPO, DATA, ACAO')
      .eq('unidade_code', unitCode)
      .gte('DATA', prev2Start)
      .lte('DATA', prev2End),
  ]);

  if (currentRes.error || prevRes.error || prev2Res.error) return [];

  interface Row {
    CLIENTE: string;
    TIPO?: string | null;
    DATA: string;
    ACAO?: string | null;
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

  // Função de normalização para buscar contato
  const normalize = (value: string | null | undefined) => {
    if (!value) return '';
    return value
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\(.*?\)/g, ' ')
      .replace(/[^a-zA-Z0-9\s]/g, ' ')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  };

  let list = Array.from(latestCurrent.values()).map((r) => {
    const raw = r.CLIENTE;
    const inPrev = prevSet.has(raw);
    const categoria = inPrev ? 'recorrente' : 'outro';
    const normalizedName = normalize(raw);
    const contato = contactMap.get(normalizedName) || null;
    return {
      id: raw,
      nome: raw.trim() || raw,
      tipo: r.TIPO || null,
      contato: contato,
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
      const normalizedName = normalize(c);
      const contato = contactMap.get(normalizedName) || null;
      return {
        id: c,
        nome: c.trim() || c,
        tipo: row?.TIPO || null,
        contato: contato,
        lastAttendance: row?.DATA || null,
        acao: row?.ACAO || null,
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
): Promise<{ total: number; mes: number; recorrente: number; atencao: number; outros: number; churnRatePercent: string }> => {
  if (!unitCode || !/^\d{4}-\d{2}$/.test(period))
    return { total: 0, mes: 0, recorrente: 0, atencao: 0, outros: 0, churnRatePercent: '0.0%' };
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

  const [currentRes, prevRes, allHistoricalRes, unitInfo] = await Promise.all([
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
    // Busca TODOS os clientes distintos que já tiveram atendimento (histórico completo)
    supabase
      .from('processed_data')
      .select('CLIENTE')
      .eq('unidade_code', unitCode),
    supabase
      .from('units')
      .select('id')
      .eq('unit_code', unitCode)
      .maybeSingle(),
  ]);

  if (currentRes.error || prevRes.error || allHistoricalRes.error || unitInfo.error)
    return { total: 0, mes: 0, recorrente: 0, atencao: 0, outros: 0, churnRatePercent: '0.0%' };

  const unitId = unitInfo.data?.id as string | undefined;

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
  const allHistoricalClients = new Set<string>(
    ((allHistoricalRes.data as any[]) || [])
      .map((r) => r.CLIENTE)
      .filter((c) => typeof c === 'string' && c.trim() !== '')
  );

  let total = allHistoricalClients.size; // fallback para histórico
  if (unitId) {
    const { count, error } = await supabase
      .from('unit_clients')
      .select('id', { count: 'exact', head: true })
      .eq('unit_id', unitId);
    if (!error && typeof count === 'number') total = count;
  }
  const mes = currentClients.size; // Clientes com atendimento no mês
  let recorrente = 0;
  let atencao = 0;
  currentClients.forEach((c) => {
    if (prevClients.has(c)) recorrente++;
  });
  prevClients.forEach((c) => {
    if (!currentClients.has(c)) atencao++;
  });
  const outros = Math.max(0, mes - recorrente);
  const churnRatePercent = mes > 0 ? `${((atencao / (atencao + mes)) * 100).toFixed(1)}%` : '0.0%';
  return { total, mes, recorrente, atencao, outros, churnRatePercent };
};

export const fetchAllUnitClientsWithHistory = async ({
  unitId,
  unitCode,
  search,
}: {
  unitId: string;
  unitCode: string;
  search?: string;
}): Promise<Array<{ id: string; nome: string; tipo: string | null; contato: string | null; lastAttendance: string | null }>> => {
  if (!unitId || !unitCode) return [];

  const filtersSearch = search?.trim();

  const [baseRes, historyRes] = await Promise.all([
    (() => {
      let query = supabase
        .from('unit_clients')
        .select('id, nome, tipo, contato')
        .eq('unit_id', unitId)
        .order('nome', { ascending: true });
      if (filtersSearch) query = query.ilike('nome', `%${filtersSearch}%`);
      return query;
    })(),
    supabase
      .from('processed_data')
      .select('CLIENTE, DATA')
      .eq('unidade_code', unitCode)
      .order('DATA', { ascending: false }),
  ]);

  if (baseRes.error || historyRes.error) return [];

  // Normalização robusta para casar nomes entre unit_clients.nome e processed_data.CLIENTE
  // - remove acentos/diacríticos
  // - remove conteúdos entre parênteses (e.g., sufixos descritivos)
  // - remove pontuação/sinais, mantendo letras/números e espaços
  // - colapsa múltiplos espaços e converte para minúsculas
  const normalize = (value: string | null | undefined) => {
    if (!value) return '';
    return value
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // diacríticos
      .replace(/\(.*?\)/g, ' ') // conteúdo entre parênteses
      .replace(/[^a-zA-Z0-9\s]/g, ' ') // pontuação/sinais
      .toLowerCase()
      .replace(/\s+/g, ' ') // colapsa espaços
      .trim();
  };

  const lastAttendanceMap = new Map<string, string>();
  ((historyRes.data as any[]) || []).forEach((row) => {
    const key = normalize(row.CLIENTE);
    if (!key) return;
    if (!lastAttendanceMap.has(key)) {
      lastAttendanceMap.set(key, row.DATA ?? null);
    }
  });

  const list = ((baseRes.data as any[]) || []).map((row) => ({
    id: row.id,
    nome: row.nome,
    tipo: row.tipo ?? null,
    contato: row.contato ?? null,
    lastAttendance: lastAttendanceMap.get(normalize(row.nome)) ?? null,
  }));

  return list;
};

// Histórico de atendimentos por cliente
export const fetchClientHistory = async (
  unitCode: string,
  clientName: string,
  limit: number = 200,
  period?: string // YYYY-MM
): Promise<Array<{ id?: number; DATA: string | null; DIA: string; PROFISSIONAL: string; 'pos vendas': string | null }>> => {
  if (!unitCode || !clientName) return [];
  let query = supabase
    .from('processed_data')
    .select('id, DATA, DIA, PROFISSIONAL, "pos vendas"')
    .eq('unidade_code', unitCode)
    .ilike('CLIENTE', `%${clientName}%`);

  if (period && /^\d{4}-\d{2}$/.test(period)) {
    const [yearStr, monthStr] = period.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(Date.UTC(year, month, 0)).toISOString().split('T')[0];
    query = query.gte('DATA', startDate).lte('DATA', endDate);
  }

  const { data, error } = await query.order('DATA', { ascending: false }).limit(limit);
  if (error) return [];
  return (data as any[]) || [];
};

// Último atendimento (DATA) de um cliente por unidade
export const fetchLastAttendance = async (
  unitCode: string,
  clientName: string
): Promise<string | null> => {
  if (!unitCode || !clientName) return null;
  const { data, error } = await supabase
    .from('processed_data')
    .select('DATA')
    .eq('unidade_code', unitCode)
    .ilike('CLIENTE', `%${clientName}%`)
    .order('DATA', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return (data as any)?.DATA || null;
};

// Buscar todos os clientes que já tiveram atendimento na unidade (histórico completo)
export const fetchAllHistoricalClients = async ({
  unitCode,
  search,
}: {
  unitCode: string;
  search?: string;
}): Promise<Array<{ id: string; nome: string; tipo: string | null; lastAttendance: string | null }>> => {
  if (!unitCode) return [];

  // Busca todos os clientes distintos que já tiveram atendimento nesta unidade
  const { data, error } = await supabase
    .from('processed_data')
    .select('CLIENTE, TIPO, DATA')
    .eq('unidade_code', unitCode)
    .order('DATA', { ascending: false });

  if (error) return [];

  interface Row {
    CLIENTE: string;
    TIPO?: string | null;
    DATA: string;
  }

  const rows = ((data as Row[]) || []).filter((r) => r.CLIENTE && r.CLIENTE.trim());

  // Agrupar por cliente e pegar o último atendimento
  const clientMap = new Map<string, Row>();
  for (const r of rows) {
    const clientName = r.CLIENTE.trim();
    const existing = clientMap.get(clientName);
    if (!existing || existing.DATA < r.DATA) {
      clientMap.set(clientName, r);
    }
  }

  let list = Array.from(clientMap.values()).map((r) => ({
    id: r.CLIENTE,
    nome: r.CLIENTE.trim() || r.CLIENTE,
    tipo: r.TIPO || null,
    lastAttendance: r.DATA,
  }));

  // Filtrar por busca se houver
  if (search && search.trim()) {
    const s = search.trim().toLowerCase();
    list = list.filter((c) => c.nome.toLowerCase().includes(s));
  }

  // Ordenar por nome
  list.sort((a, b) => a.nome.localeCompare(b.nome));

  return list;
};

// Atualizar ação de um cliente (último atendimento)
export const updateClientAction = async (
  unitCode: string,
  clientName: string,
  acao: string
): Promise<boolean> => {
  if (!unitCode || !clientName) return false;

  // Busca o último atendimento do cliente
  const { data: lastRecord, error: fetchError } = await supabase
    .from('processed_data')
    .select('id')
    .eq('unidade_code', unitCode)
    .eq('CLIENTE', clientName)
    .order('DATA', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError || !lastRecord) return false;

  // Atualiza a ação
  const { error: updateError } = await supabase
    .from('processed_data')
    .update({ ACAO: acao })
    .eq('id', lastRecord.id);

  return !updateError;
};

/**
 * clients.service.ts
 * Esqueleto de serviço para análises de clientes.
 */

// TODO: migrar funções: fetchClients, fetchClientMetrics, fetchClientMetricsFromProcessed, fetchClientAnalysisData

export {};
