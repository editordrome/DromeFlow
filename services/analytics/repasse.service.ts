import { supabase } from '../supabaseClient';
import { RepasseAnalysisRecord } from '../../types';

export const fetchRepasseAnalysisData = async (
  unitCode: string,
  period: string
): Promise<RepasseAnalysisRecord[]> => {
  if (!/^\d{4}-\d{2}$/.test(period)) return [];
  const [year, month] = period.split('-').map(Number);
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = new Date(year, month, 0).toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('processed_data')
    .select('PROFISSIONAL, REPASSE')
    .eq('unidade_code', unitCode)
    .gte('DATA', startDate)
    .lte('DATA', endDate);
  if (error) throw error;
  return ((data as RepasseAnalysisRecord[]) || []).filter(
    (r) => r.PROFISSIONAL && r.PROFISSIONAL.trim() !== ''
  );
};
/**
 * repasse.service.ts
 * Esqueleto de serviço para análises de repasse.
 */

// TODO: migrar função: fetchRepasseAnalysisData

export {};
