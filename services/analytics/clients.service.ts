import { supabase } from '../supabaseClient';

const normalizeName = (value: string | null | undefined) => {
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
  let contactMap = new Map<string, any>();
  if (!unitsRes.error && unitsRes.data?.id) {
    const clientsRes = await supabase
      .from('unit_clients')
      .select('nome, contato, is_verified')
      .eq('unit_id', unitsRes.data.id);
    if (!clientsRes.error && clientsRes.data) {
      clientsRes.data.forEach((c: any) => {
        const key = normalizeName(c.nome);
        if (key) contactMap.set(key, { contato: c.contato, is_verified: c.is_verified });
      });
    }
  }

  const [currentRes, prevRes, prev2Res] = await Promise.all([
    supabase
      .from('processed_data')
      .select('cliente, tipo, data, acao, whatscliente')
      .eq('unidade_code', unitCode)
      .gte('data', startDate)
      .lte('data', endDate),
    supabase
      .from('processed_data')
      .select('cliente, tipo, data, acao, whatscliente')
      .eq('unidade_code', unitCode)
      .gte('data', prevStart)
      .lte('data', prevEnd),
    supabase
      .from('processed_data')
      .select('cliente, tipo, data, acao, whatscliente')
      .eq('unidade_code', unitCode)
      .gte('data', prev2Start)
      .lte('data', prev2End),
  ]);

  if (currentRes.error || prevRes.error || prev2Res.error) return [];

  interface Row {
    cliente: string;
    tipo?: string | null;
    data: string;
    acao?: string | null;
    whatscliente?: string | null;
  }

  const currentRows = ((currentRes.data as Row[]) || []).filter(
    (r) => r.cliente && r.cliente.trim()
  );
  const prevRows = ((prevRes.data as Row[]) || []).filter(
    (r) => r.cliente && r.cliente.trim()
  );
  const prev2Rows = ((prev2Res.data as Row[]) || []).filter(
    (r) => r.cliente && r.cliente.trim()
  );

  const latestCurrent = new Map<string, Row>();
  for (const r of currentRows) {
    const raw = r.cliente;
    const existing = latestCurrent.get(raw);
    if (!existing || existing.data < r.data) latestCurrent.set(raw, r);
  }
  const currentSet = new Set(currentRows.map((r) => r.cliente));
  const prevSet = new Set(prevRows.map((r) => r.cliente));

  let list = Array.from(latestCurrent.values()).map((r) => {
    const raw = r.cliente;
    const inPrev = prevSet.has(raw);
    const categoria = inPrev ? 'recorrente' : 'outro';
    const normalizedName = normalizeName(raw);
    const contactInfo = contactMap.get(normalizedName);
    return {
      id: raw,
      nome: raw.trim() || raw,
      tipo: r.tipo || null,
      contato: contactInfo?.contato || r.whatscliente || null,
      is_verified: contactInfo?.is_verified || false,
      lastAttendance: r.data,
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
    const existing = latestPrev.get(r.cliente);
    if (!existing || existing.data < r.data) latestPrev.set(r.cliente, r);
  }
  const buildCountMap = (rows: Row[]) => {
    const m = new Map<string, number>();
    for (const r of rows) {
      const k = r.cliente;
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
      const normalizedName = normalizeName(c);
      const contactInfo = contactMap.get(normalizedName);
      return {
        id: c,
        nome: c.trim() || c,
        tipo: row?.tipo || null,
        contato: contactInfo?.contato || row?.whatscliente || null,
        is_verified: contactInfo?.is_verified || false,
        lastAttendance: row?.data || null,
        acao: row?.acao || null,
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
      .select('cliente')
      .eq('unidade_code', unitCode)
      .gte('data', startDate)
      .lte('data', endDate),
    supabase
      .from('processed_data')
      .select('cliente')
      .eq('unidade_code', unitCode)
      .gte('data', prevStart)
      .lte('data', prevEnd),
    // Busca TODOS os clientes distintos que já tiveram atendimento (histórico completo)
    supabase
      .from('processed_data')
      .select('cliente')
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
      .map((r) => r.cliente)
      .filter((c) => typeof c === 'string' && c.trim() !== '')
  );
  const prevClients = new Set<string>(
    ((prevRes.data as any[]) || [])
      .map((r) => r.cliente)
      .filter((c) => typeof c === 'string' && c.trim() !== '')
  );
  const allHistoricalClients = new Set<string>(
    ((allHistoricalRes.data as any[]) || [])
      .map((r) => r.cliente)
      .filter((c) => typeof c === 'string' && c.trim() !== '')
  );

  // Cálculo do Total (União de Diretório e Histórico)
  const totalClientsSet = new Set<string>();
  
  // 1. Adiciona clientes do histórico (normalizados)
  allHistoricalClients.forEach(c => totalClientsSet.add(normalizeName(c)));
  
  // 2. Adiciona clientes do diretório (normalizados)
  if (unitId) {
    const { data: dirClients } = await supabase
      .from('unit_clients')
      .select('nome')
      .eq('unit_id', unitId);
    if (dirClients) {
      dirClients.forEach(c => totalClientsSet.add(normalizeName(c.nome)));
    }
  }

  const total = totalClientsSet.size;
  const mes = currentClients.size;
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
        .select('id, nome, tipo, contato, is_verified')
        .eq('unit_id', unitId)
        .order('nome', { ascending: true });
      if (filtersSearch) query = query.ilike('nome', `%${filtersSearch}%`);
      return query;
    })(),
    supabase
      .from('processed_data')
      .select('cliente, data, whatscliente')
      .eq('unidade_code', unitCode)
      .order('data', { ascending: false }),
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
  const fallbackContactMap = new Map<string, string>();
  ((historyRes.data as any[]) || []).forEach((row) => {
    const key = normalizeName(row.cliente);
    if (!key) return;
    if (!lastAttendanceMap.has(key)) {
      lastAttendanceMap.set(key, row.data ?? null);
    }
    if (!fallbackContactMap.has(key) && row.whatscliente) {
      fallbackContactMap.set(key, row.whatscliente);
    }
  });

  const list = ((baseRes.data as any[]) || []).map((row) => {
    const normalized = normalizeName(row.nome);
    return {
      id: row.id,
      nome: row.nome,
      tipo: row.tipo ?? null,
      contato: row.contato || fallbackContactMap.get(normalized) || null,
      is_verified: row.is_verified ?? false,
      lastAttendance: lastAttendanceMap.get(normalized) ?? null,
    };
  });

  // Identifica clientes do histórico que não estão no diretório (unit_clients)
  const dirNamesSet = new Set(list.map(c => normalizeName(c.nome)));
  const historyOnly: any[] = [];

  // Mapeia nomes originais do histórico para manter a grafia mais recente
  const originalHistoryNames = new Map<string, string>();
  ((historyRes.data as any[]) || []).forEach(row => {
    const key = normalizeName(row.cliente);
    if (key && !originalHistoryNames.has(key)) {
      originalHistoryNames.set(key, row.cliente);
    }
  });

  lastAttendanceMap.forEach((date, key) => {
    if (!dirNamesSet.has(key)) {
      const originalName = originalHistoryNames.get(key) || key;
      
      // Se houver busca ativa, filtra também os novos itens do histórico
      if (filtersSearch && !originalName.toLowerCase().includes(filtersSearch.toLowerCase())) {
        return;
      }

      historyOnly.push({
        id: `hist-${key}`, // ID virtual para diferenciar de registros do banco
        nome: originalName,
        tipo: null,
        contato: fallbackContactMap.get(key) || null,
        is_verified: false,
        lastAttendance: date,
      });
    }
  });

  // Retorna a união de ambos, ordenados por nome
  return [...list, ...historyOnly].sort((a, b) => a.nome.localeCompare(b.nome));
};

// Histórico de atendimentos por cliente
export async function fetchClientHistory(
  unitCode: string,
  clientName: string,
  limit = 200,
  period?: string
): Promise<Array<{ id?: number; data: string | null; dia: string; profissional: string; pos_vendas: string | null; atendimento_id?: string; periodo?: string }>> {
  let query = supabase
    .from('processed_data')
    .select('id, data, dia, profissional, pos_vendas, atendimento_id, periodo')
    .eq('unidade_code', unitCode)
    .eq('cliente', clientName);

  if (period && /^\d{4}-\d{2}$/.test(period)) {
    const startDate = `${period}-01`;
    const [y, m] = period.split('-').map(Number);
    const endDate = `${y}-${String(m).padStart(2, '0')}-${new Date(y, m, 0).getDate()}`;
    query = query.gte('data', startDate).lte('data', endDate);
  }

  const { data, error } = await query.order('data', { ascending: false }).limit(limit);

  if (error) {
    console.error('fetchClientHistory error:', error);
    return [];
  }
  return data as any;
}

// Último atendimento (DATA) de um cliente por unidade
export const fetchLastAttendance = async (
  unitCode: string,
  clientName: string
): Promise<string | null> => {
  if (!unitCode || !clientName) return null;
  const { data, error } = await supabase
    .from('processed_data')
    .select('data')
    .eq('unidade_code', unitCode)
    .ilike('cliente', `%${clientName}%`)
    .order('data', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return (data as any)?.data || null;
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
    .select('cliente, tipo, data')
    .eq('unidade_code', unitCode)
    .order('data', { ascending: false });

  if (error) return [];

  interface Row {
    cliente: string;
    tipo?: string | null;
    data: string;
  }

  const rows = ((data as Row[]) || []).filter((r) => r.cliente && r.cliente.trim());

  // Agrupar por cliente e pegar o último atendimento
  const clientMap = new Map<string, Row>();
  for (const r of rows) {
    const clientName = r.cliente.trim();
    const existing = clientMap.get(clientName);
    if (!existing || existing.data < r.data) {
      clientMap.set(clientName, r);
    }
  }

  let list = Array.from(clientMap.values()).map((r) => ({
    id: r.cliente,
    nome: r.cliente.trim() || r.cliente,
    tipo: r.tipo || null,
    lastAttendance: r.data,
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
    .eq('cliente', clientName)
    .order('data', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError || !lastRecord) return false;

  // Atualiza a ação
  const { error: updateError } = await supabase
    .from('processed_data')
    .update({ acao: acao })
    .eq('id', lastRecord.id);

  return !updateError;
};

/**
 * Busca os anos disponíveis com dados para a unidade
 * Retorna array de anos em ordem decrescente
 */
export const fetchAvailableYears = async (unitCode: string): Promise<number[]> => {
  if (!unitCode) return [];

  try {
    const { data, error } = await supabase
      .from('processed_data')
      .select('data')
      .eq('unidade_code', unitCode)
      .not('data', 'is', null)
      .order('data', { ascending: false })
      .limit(1000); // Limita para performance

    if (error || !data || data.length === 0) {
      // Fallback: retorna ano atual se não houver dados
      return [new Date().getFullYear()];
    }

    // Extrai anos únicos dos dados
    const yearsSet = new Set<number>();
    data.forEach((record: any) => {
      if (record.data) {
        const year = new Date(record.data).getFullYear();
        if (year >= 2020 && year <= new Date().getFullYear() + 1) {
          yearsSet.add(year);
        }
      }
    });

    // Converte para array e ordena decrescente
    const years = Array.from(yearsSet).sort((a, b) => b - a);

    // Se não encontrou nenhum ano válido, retorna ano atual
    return years.length > 0 ? years : [new Date().getFullYear()];
  } catch (error) {
    console.error('Erro ao buscar anos disponíveis:', error);
    return [new Date().getFullYear()];
  }
};

/**
 * clients.service.ts
 * Esqueleto de serviço para análises de clientes.
 */

// TODO: migrar funções: fetchClients, fetchClientMetrics, fetchClientMetricsFromProcessed, fetchClientAnalysisData

export { };
