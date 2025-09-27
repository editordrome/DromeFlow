import { supabase } from '../supabaseClient';
import { ServiceAnalysisRecord, ClientAnalysisData } from '../../types';

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
/**
 * serviceAnalysis.service.ts
 * Esqueleto de serviço para análise de serviços.
 */

// TODO: migrar função: fetchServiceAnalysisData

export {};
