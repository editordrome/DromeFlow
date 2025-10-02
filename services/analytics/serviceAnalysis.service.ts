import { supabase } from '../supabaseClient';
import { ServiceAnalysisRecord, ClientAnalysisData } from '../../types';

export type ServiceMonthlySubmetrics = {
  month: string;
  monthName: string;
  startOfMonth: number; // atendimentos de clientes existentes
  evolution: number;    // atendimentos de novos clientes
  productiveDayAvg: number; // média por dia produtivo (>5 atendimentos), baseada em serviços únicos (orcamentos)
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
    .select('CADASTRO, DATA, DIA, ATENDIMENTO_ID')
    .eq('unidade_code', unitCode)
    .gte('DATA', startDate)
    .lte('DATA', endDate);
  if (error) throw error;
  return (data as ServiceAnalysisRecord[]) || [];
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
      .select('CLIENTE, TIPO')
      .eq('unidade_code', unitCode)
      .gte('DATA', startDate)
      .lte('DATA', endDate),
    supabase
      .from('processed_data')
      .select('CLIENTE')
      .eq('unidade_code', unitCode)
      .lt('DATA', startDate),
  ]);

  if (currentPeriodDetailsRes.error) throw currentPeriodDetailsRes.error;
  if (previousClientsRes.error) throw previousClientsRes.error;

  const clientDetails =
    ((currentPeriodDetailsRes.data as { CLIENTE: string; TIPO: string }[]) || []);

  const currentMonthClients = new Set(
    clientDetails.map((r) => r.CLIENTE).filter(Boolean)
  );
  const allPreviousClients = new Set(
    (((previousClientsRes.data as any[]) || [])
      .map((r) => r.CLIENTE)
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
      .select('CADASTRO, DATA, ATENDIMENTO_ID, IS_DIVISAO, orcamento')
      .eq('unidade_code', unitCode)
      .gte('DATA', startDate)
      .lt('DATA', endDate);
    if (error) {
      results.push({ month: m.value, monthName: m.name, startOfMonth: 0, evolution: 0, productiveDayAvg: 0 });
      continue;
    }
    const records = (data as any[]) || [];
    const periodStartDate = new Date(`${startDate}T12:00:00Z`);
    const seenAppointments = new Set<string>();
    let startOfMonth = 0;
    let evolution = 0;
    const dailyCounts: Record<string, number> = {};

    // serviços únicos por orçamento original
    const original = records.filter(r => r.IS_DIVISAO !== 'SIM');
    const uniqueBudgets = new Set<string>();
    original.forEach(r => { if (r.orcamento) uniqueBudgets.add(r.orcamento); });
    const totalServices = uniqueBudgets.size;

    records.forEach(r => {
      if (r.DATA) dailyCounts[r.DATA] = (dailyCounts[r.DATA] || 0) + 1;
      if (r.ATENDIMENTO_ID && r.CADASTRO) {
        if (!seenAppointments.has(r.ATENDIMENTO_ID)) {
          const cadastroDate = new Date(`${r.CADASTRO}T12:00:00Z`);
          if (!isNaN(cadastroDate.getTime())) {
            if (cadastroDate < periodStartDate) startOfMonth++;
            else evolution++;
          }
          seenAppointments.add(r.ATENDIMENTO_ID);
        }
      }
    });
    const productiveDays = Object.values(dailyCounts).filter(c => c > 5).length;
    const productiveDayAvg = productiveDays > 0 ? totalServices / productiveDays : 0;
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
      .select('CADASTRO, DATA, ATENDIMENTO_ID, IS_DIVISAO, orcamento, unidade_code')
      .in('unidade_code', unitCodes)
      .gte('DATA', startDate)
      .lt('DATA', endDate);
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
    const dailyCounts: Record<string, number> = {};

    const original = records.filter(r => r.IS_DIVISAO !== 'SIM');
    const uniqueBudgets = new Set<string>();
    original.forEach(r => { if (r.orcamento) uniqueBudgets.add(r.orcamento); });
    const totalServices = uniqueBudgets.size;

    records.forEach(r => {
      if (r.DATA) dailyCounts[r.DATA] = (dailyCounts[r.DATA] || 0) + 1;
      if (r.ATENDIMENTO_ID && r.CADASTRO) {
        if (!seenAppointments.has(r.ATENDIMENTO_ID)) {
          const cadastroDate = new Date(`${r.CADASTRO}T12:00:00Z`);
          if (!isNaN(cadastroDate.getTime())) {
            if (cadastroDate < periodStartDate) startOfMonth++;
            else evolution++;
          }
          seenAppointments.add(r.ATENDIMENTO_ID);
        }
      }
    });
    const productiveDays = Object.values(dailyCounts).filter(c => c > 5).length;
    const productiveDayAvg = productiveDays > 0 ? totalServices / productiveDays : 0;
    results.push({ month: m.value, monthName: m.name, startOfMonth, evolution, productiveDayAvg });
  }
  return results;
};
/**
 * serviceAnalysis.service.ts
 * Esqueleto de serviço para análise de serviços.
 */

// TODO: migrar função: fetchServiceAnalysisData

export {};
