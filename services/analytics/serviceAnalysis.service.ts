import { supabase } from '../supabaseClient';
import { ServiceAnalysisRecord, ClientAnalysisData } from '../../types';

export type ServiceMonthlySubmetrics = {
  month: string;
  monthName: string;
  startOfMonth: number; // atendimentos de clientes existentes
  evolution: number;    // atendimentos de novos clientes
  productiveDayAvg: number; // média por dia produtivo (>5 atendimentos), baseada em serviços únicos (orcamentos)
  year?: number;
};

export type ClientMonthlySubmetrics = {
  month: string;
  monthName: string;
  recurringCount: number;       // clientes que estavam no mês anterior e repetiram neste mês
  servicesPerClient: number;    // atendimentos (serviços únicos) / clientes únicos no mês
  churnRate: number;            // % clientes do mês anterior que não retornaram neste mês
  year?: number;
};

export const fetchServiceAnalysisData = async (
  unitCode: string,
  period: string
): Promise<ServiceAnalysisRecord[]> => {
  if (!/^\d{4}-\d{2}$/.test(period)) return [];
  const [year, month] = period.split('-').map(Number);
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = new Date(Date.UTC(year, month, 0)).toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('processed_data')
    .select('cadastro, data, dia, atendimento_id, is_divisao')
    .eq('unidade_code', unitCode)
    .gte('data', startDate)
    .lte('data', endDate);

  if (error) throw error;
  return (data as any[])?.map(r => ({ ...r })) as ServiceAnalysisRecord[] || [];
};

export const fetchServicePeriodAnalysisData = async (
  unitCode: string,
  period: string
): Promise<{ periodo: string; tipo?: string }[]> => {
  if (!/^\d{4}-\d{2}$/.test(period)) return [];
  const [year, month] = period.split('-').map(Number);
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = new Date(Date.UTC(year, month, 0)).toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('processed_data')
    .select('periodo, tipo')
    .eq('unidade_code', unitCode)
    .gte('data', startDate)
    .lte('data', endDate);

  if (error) {
    console.error('Error fetching period data:', error);
    throw error;
  }

  console.log('🔍 Period Data from Supabase:', {
    total: data?.length || 0,
    first5: data?.slice(0, 5),
    uniquePeriods: [...new Set(data?.map(d => d.periodo))].filter(Boolean),
    uniqueTypes: [...new Set(data?.map(d => d.tipo))].filter(Boolean)
  });

  return (data as any[])?.map(r => ({ periodo: r.periodo, tipo: r.tipo })) || [];
};

export const fetchClientAnalysisData = async (
  unitCode: string,
  period: string
): Promise<ClientAnalysisData> => {
  if (!/^\d{4}-\d{2}$/.test(period))
    throw new Error('Invalid period format. Expected YYYY-MM.');
  const [year, month] = period.split('-').map(Number);
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = new Date(Date.UTC(year, month, 0)).toISOString().split('T')[0];

  const [currentPeriodDetailsRes, previousClientsRes] = await Promise.all([
    supabase
      .from('processed_data')
      .select('cliente, periodo, tipo')
      .eq('unidade_code', unitCode)
      .gte('data', startDate)
      .lte('data', endDate),
    supabase
      .from('processed_data')
      .select('cliente')
      .eq('unidade_code', unitCode)
      .lt('data', startDate),
  ]);

  if (currentPeriodDetailsRes.error) throw currentPeriodDetailsRes.error;
  if (previousClientsRes.error) throw previousClientsRes.error;

  const clientDetails =
    ((currentPeriodDetailsRes.data as any[]) || []).map(r => ({ cliente: r.cliente, periodo: r.periodo, tipo: r.tipo }));

  const currentMonthClients = new Set(
    clientDetails.map((r) => r.cliente).filter(Boolean)
  );
  const allPreviousClients = new Set(
    (((previousClientsRes.data as any[]) || [])
      .map((r) => r.cliente)
      .filter((c) => typeof c === 'string' && c.trim() !== '')) as string[]
  );

  return { currentMonthClients, allPreviousClients, clientDetails };
};

export const fetchServiceMonthlySubmetrics = async (
  unitCode: string,
  year: number
): Promise<ServiceMonthlySubmetrics[]> => {
  const months = [
    { value: '01', name: 'Jan' },
    { value: '02', name: 'Fev' },
    { value: '03', name: 'Mar' },
    { value: '04', name: 'Abr' },
    { value: '05', name: 'Mai' },
    { value: '06', name: 'Jun' },
    { value: '07', name: 'Jul' },
    { value: '08', name: 'Ago' },
    { value: '09', name: 'Set' },
    { value: '10', name: 'Out' },
    { value: '11', name: 'Nov' },
    { value: '12', name: 'Dez' },
  ];
  const results: ServiceMonthlySubmetrics[] = [];
  for (const m of months) {
    const startDate = `${year}-${m.value}-01`;
    const nextMonth = m.value === '12' ? '01' : String(parseInt(m.value) + 1).padStart(2, '0');
    const nextYear = m.value === '12' ? year + 1 : year;
    const endDate = `${nextYear}-${nextMonth}-01`;

    const { data, error } = await supabase
      .from('processed_data')
      .select('cadastro, data, atendimento_id, is_divisao')
      .eq('unidade_code', unitCode)
      .gte('data', startDate)
      .lt('data', endDate);
    if (error) {
      results.push({ month: m.value, monthName: m.name, startOfMonth: 0, evolution: 0, productiveDayAvg: 0 });
      continue;
    }
    const records = (data as any[]) || [];
    const periodStartDate = new Date(`${startDate}T12:00:00Z`);
    const seenAppointments = new Set<string>();
    let startOfMonth = 0;
    let evolution = 0;
    const dailyBudgets: Map<string, Set<string>> = new Map();

    // serviços únicos por atendimento original
    const original = records.filter(r => r.is_divisao !== 'SIM');
    const uniqueBudgets = new Set<string>();
    original.forEach(r => { if (r.atendimento_id) uniqueBudgets.add(r.atendimento_id); });
    const totalServices = uniqueBudgets.size;

    original.forEach(r => {
      if (r.data && r.atendimento_id) {
        if (!dailyBudgets.has(r.data)) {
          dailyBudgets.set(r.data, new Set());
        }
        dailyBudgets.get(r.data)!.add(r.atendimento_id);
      }
      if (r.atendimento_id && r.cadastro) {
        if (!seenAppointments.has(r.atendimento_id)) {
          const cadastroDate = new Date(`${r.cadastro}T12:00:00Z`);
          if (!isNaN(cadastroDate.getTime())) {
            if (cadastroDate < periodStartDate) startOfMonth++;
            else evolution++;
          }
          seenAppointments.add(r.atendimento_id);
        }
      }
    });

    const productiveDays = Array.from(dailyBudgets.values()).filter(budgets => budgets.size > 5).length;

    const productiveDayAvg = productiveDays > 0 ? totalServices / productiveDays : 0;

    // DEBUG: Log temporário para verificar valores
    if (unitCode === 'mb-teresina' && m.value === '02' && year === 2026) {
      console.log('🔍 DEBUG MB Teresina Fev 2026:', {
        totalServices,
        startOfMonth,
        evolution,
        productiveDays,
        productiveDayAvg,
        dailyBudgetsSize: dailyBudgets.size
      });
    }

    results.push({ month: m.value, monthName: m.name, startOfMonth, evolution, productiveDayAvg });

  }
  return results;
};

export const fetchServiceMonthlySubmetricsMulti = async (
  unitCodes: string[],
  year: number
): Promise<ServiceMonthlySubmetrics[]> => {
  if (!unitCodes || unitCodes.length === 0) return [];
  const months = [
    { value: '01', name: 'Jan' },
    { value: '02', name: 'Fev' },
    { value: '03', name: 'Mar' },
    { value: '04', name: 'Abr' },
    { value: '05', name: 'Mai' },
    { value: '06', name: 'Jun' },
    { value: '07', name: 'Jul' },
    { value: '08', name: 'Ago' },
    { value: '09', name: 'Set' },
    { value: '10', name: 'Out' },
    { value: '11', name: 'Nov' },
    { value: '12', name: 'Dez' },
  ];
  const results: ServiceMonthlySubmetrics[] = [];
  for (const m of months) {
    const startDate = `${year}-${m.value}-01`;
    const nextMonth = m.value === '12' ? '01' : String(parseInt(m.value) + 1).padStart(2, '0');
    const nextYear = m.value === '12' ? year + 1 : year;
    const endDate = `${nextYear}-${nextMonth}-01`;

    let query = supabase
      .from('processed_data')
      .select('cadastro, data, atendimento_id, is_divisao, unidade_code')
      .in('unidade_code', unitCodes)
      .gte('data', startDate)
      .lt('data', endDate);
    const { data, error } = await query;
    if (error) {
      results.push({ month: m.value, monthName: m.name, startOfMonth: 0, evolution: 0, productiveDayAvg: 0 });
      continue;
    }
    const records = (data as any[]) || [];
    const periodStartDate = new Date(`${startDate}T12:00:00Z`);
    const seenAppointments = new Set<string>();
    let startOfMonth = 0;
    let evolution = 0;
    const dailyBudgets: Map<string, Set<string>> = new Map();

    const original = records.filter(r => r.is_divisao !== 'SIM');
    const uniqueBudgets = new Set<string>();
    original.forEach(r => { if (r.atendimento_id) uniqueBudgets.add(r.atendimento_id); });
    const totalServices = uniqueBudgets.size;

    original.forEach(r => {
      if (r.data && r.atendimento_id) {
        if (!dailyBudgets.has(r.data)) {
          dailyBudgets.set(r.data, new Set());
        }
        dailyBudgets.get(r.data)!.add(r.atendimento_id);
      }
      if (r.atendimento_id && r.cadastro) {
        if (!seenAppointments.has(r.atendimento_id)) {
          const cadastroDate = new Date(`${r.cadastro}T12:00:00Z`);
          if (!isNaN(cadastroDate.getTime())) {
            if (cadastroDate < periodStartDate) startOfMonth++;
            else evolution++;
          }
          seenAppointments.add(r.atendimento_id);
        }
      }
    });

    const productiveDays = Array.from(dailyBudgets.values()).filter(budgets => budgets.size > 5).length;

    const productiveDayAvg = productiveDays > 0 ? totalServices / productiveDays : 0;
    results.push({ month: m.value, monthName: m.name, startOfMonth, evolution, productiveDayAvg });
  }
  return results;
};

export const fetchClientMonthlySubmetrics = async (
  unitCode: string,
  year: number
): Promise<ClientMonthlySubmetrics[]> => {
  const months = [
    { value: '01', name: 'Jan' }, { value: '02', name: 'Fev' }, { value: '03', name: 'Mar' },
    { value: '04', name: 'Abr' }, { value: '05', name: 'Mai' }, { value: '06', name: 'Jun' },
    { value: '07', name: 'Jul' }, { value: '08', name: 'Ago' }, { value: '09', name: 'Set' },
    { value: '10', name: 'Out' }, { value: '11', name: 'Nov' }, { value: '12', name: 'Dez' },
  ];
  const results: ClientMonthlySubmetrics[] = [];
  for (let i = 0; i < months.length; i++) {
    const m = months[i];
    const startDate = `${year}-${m.value}-01`;
    const nextMonth = m.value === '12' ? '01' : String(parseInt(m.value) + 1).padStart(2, '0');
    const nextYear = m.value === '12' ? year + 1 : year;
    const endDate = `${nextYear}-${nextMonth}-01`;
    // mês anterior
    const prevMonth = m.value === '01' ? '12' : String(parseInt(m.value) - 1).padStart(2, '0');
    const prevYear = m.value === '01' ? year - 1 : year;
    const prevStart = `${prevYear}-${prevMonth}-01`;
    const prevEnd = startDate;

    const [currRes, prevRes] = await Promise.all([
      supabase
        .from('processed_data')
        .select('cliente, is_divisao, atendimento_id')
        .eq('unidade_code', unitCode)
        .gte('data', startDate)
        .lt('data', endDate),
      supabase
        .from('processed_data')
        .select('cliente, is_divisao, atendimento_id')
        .eq('unidade_code', unitCode)
        .gte('data', prevStart)
        .lt('data', prevEnd),
    ]);
    if (currRes.error || prevRes.error) {
      results.push({ month: m.value, monthName: m.name, recurringCount: 0, servicesPerClient: 0, churnRate: 0 });
      continue;
    }
    const currAll = (currRes.data as any[]) || [];
    const prevAll = (prevRes.data as any[]) || [];
    const currOriginal = currAll.filter(r => r.is_divisao !== 'SIM');
    const prevOriginal = prevAll.filter(r => r.is_divisao !== 'SIM');
    const currClients = new Set<string>(currOriginal.map(r => r.cliente).filter(Boolean));
    const prevClients = new Set<string>(prevOriginal.map(r => r.cliente).filter(Boolean));
    // serviços únicos do mês
    const currBudgets = new Set<string>();
    currOriginal.forEach(r => { if (r.atendimento_id) currBudgets.add(r.atendimento_id); });
    const totalServices = currBudgets.size;
    const uniqueClients = currClients.size;
    const servicesPerClient = uniqueClients > 0 ? totalServices / uniqueClients : 0;
    // recorrentes
    let recurringCount = 0;
    currClients.forEach(c => { if (prevClients.has(c)) recurringCount++; });
    // churn: % dos clientes do mês anterior que não retornaram
    const churnCount = Array.from(prevClients).filter(c => !currClients.has(c)).length;
    const churnRate = prevClients.size > 0 ? (churnCount / prevClients.size) * 100 : 0;
    results.push({ month: m.value, monthName: m.name, recurringCount, servicesPerClient, churnRate });
  }
  return results;
};

export const fetchClientMonthlySubmetricsMulti = async (
  unitCodes: string[],
  year: number
): Promise<ClientMonthlySubmetrics[]> => {
  if (!unitCodes || unitCodes.length === 0) return [];
  const months = [
    { value: '01', name: 'Jan' }, { value: '02', name: 'Fev' }, { value: '03', name: 'Mar' },
    { value: '04', name: 'Abr' }, { value: '05', name: 'Mai' }, { value: '06', name: 'Jun' },
    { value: '07', name: 'Jul' }, { value: '08', name: 'Ago' }, { value: '09', name: 'Set' },
    { value: '10', name: 'Out' }, { value: '11', name: 'Nov' }, { value: '12', name: 'Dez' },
  ];
  const results: ClientMonthlySubmetrics[] = [];
  for (let i = 0; i < months.length; i++) {
    const m = months[i];
    const startDate = `${year}-${m.value}-01`;
    const nextMonth = m.value === '12' ? '01' : String(parseInt(m.value) + 1).padStart(2, '0');
    const nextYear = m.value === '12' ? year + 1 : year;
    const endDate = `${nextYear}-${nextMonth}-01`;

    const prevMonth = m.value === '01' ? '12' : String(parseInt(m.value) - 1).padStart(2, '0');
    const prevYear = m.value === '01' ? year - 1 : year;
    const prevStart = `${prevYear}-${prevMonth}-01`;
    const prevEnd = startDate;

    const [currRes, prevRes] = await Promise.all([
      supabase
        .from('processed_data')
        .select('cliente, is_divisao, atendimento_id, unidade_code')
        .in('unidade_code', unitCodes)
        .gte('data', startDate)
        .lt('data', endDate),
      supabase
        .from('processed_data')
        .select('cliente, is_divisao, atendimento_id, unidade_code')
        .in('unidade_code', unitCodes)
        .gte('data', prevStart)
        .lt('data', prevEnd),
    ]);
    if (currRes.error || prevRes.error) {
      results.push({ month: m.value, monthName: m.name, recurringCount: 0, servicesPerClient: 0, churnRate: 0 });
      continue;
    }
    const currAll = (currRes.data as any[]) || [];
    const prevAll = (prevRes.data as any[]) || [];
    const currOriginal = currAll.filter(r => r.is_divisao !== 'SIM');
    const prevOriginal = prevAll.filter(r => r.is_divisao !== 'SIM');
    const currClients = new Set<string>(currOriginal.map(r => r.cliente).filter(Boolean));
    const prevClients = new Set<string>(prevOriginal.map(r => r.cliente).filter(Boolean));
    const currBudgets = new Set<string>();
    currOriginal.forEach(r => { if (r.atendimento_id) currBudgets.add(r.atendimento_id); });
    const totalServices = currBudgets.size;
    const uniqueClients = currClients.size;
    const servicesPerClient = uniqueClients > 0 ? totalServices / uniqueClients : 0;
    let recurringCount = 0;
    currClients.forEach(c => { if (prevClients.has(c)) recurringCount++; });
    const churnCount = Array.from(prevClients).filter(c => !currClients.has(c)).length;
    const churnRate = prevClients.size > 0 ? (churnCount / prevClients.size) * 100 : 0;
    results.push({ month: m.value, monthName: m.name, recurringCount, servicesPerClient, churnRate });
  }
  return results;
};
/**
 * serviceAnalysis.service.ts
 * Esqueleto de serviço para análise de serviços.
 */

// TODO: migrar função: fetchServiceAnalysisData

export { };
