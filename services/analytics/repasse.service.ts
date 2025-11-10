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

export type RepasseMonthlySubmetrics = {
  month: string;
  monthName: string;
  averagePerService: number;
  averagePerWeek: number;
  averagePerProfessional: number;
};

// Função para buscar submétricas mensais de repasse (seguindo padrão de Services/Clients)
export const fetchRepasseMonthlySubmetrics = async (
  unitCode: string,
  year: number
): Promise<RepasseMonthlySubmetrics[]> => {
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
  const results: RepasseMonthlySubmetrics[] = [];
  
  for (const m of months) {
    const startDate = `${year}-${m.value}-01`;
    const nextMonth = m.value === '12' ? '01' : String(parseInt(m.value) + 1).padStart(2, '0');
    const nextYear = m.value === '12' ? year + 1 : year;
    const endDate = `${nextYear}-${nextMonth}-01`;

    const { data, error } = await supabase
      .from('processed_data')
      .select('PROFISSIONAL, REPASSE, ATENDIMENTO_ID, IS_DIVISAO')
      .eq('unidade_code', unitCode)
      .gte('DATA', startDate)
      .lt('DATA', endDate);
      
    if (error) {
      results.push({ 
        month: m.value, 
        monthName: m.name, 
        averagePerService: 0, 
        averagePerWeek: 0, 
        averagePerProfessional: 0 
      });
      continue;
    }
    
    const records = (data as any[]) || [];
    
    // Total de repasse (soma todos os registros incluindo derivados)
    const totalRepasse = records.reduce((sum, r) => sum + (r.REPASSE || 0), 0);
    
    // Total de serviços únicos (apenas registros originais)
    const originalRecords = records.filter(r => r.IS_DIVISAO !== 'SIM');
    const uniqueServices = new Set(originalRecords.map(r => r.ATENDIMENTO_ID).filter(Boolean)).size;
    
    // Média por serviço
    const averagePerService = uniqueServices > 0 ? totalRepasse / uniqueServices : 0;
    
    // Média por semana
    const monthNum = parseInt(m.value);
    const daysInMonth = new Date(year, monthNum, 0).getDate();
    const weeksInMonth = daysInMonth / 7;
    const averagePerWeek = weeksInMonth > 0 ? totalRepasse / weeksInMonth : 0;
    
    // Profissionais únicos (apenas registros com PROFISSIONAL válido)
    const uniqueProfessionals = new Set(
      records
        .map(r => r.PROFISSIONAL)
        .filter(p => p && typeof p === 'string' && p.trim() !== '')
        .map(p => p.trim())
    ).size;
    
    const averagePerProfessional = uniqueProfessionals > 0 ? totalRepasse / uniqueProfessionals : 0;
    
    results.push({ 
      month: m.value, 
      monthName: m.name, 
      averagePerService, 
      averagePerWeek, 
      averagePerProfessional 
    });
  }
  
  return results;
};

// Função para multi-unidades (ALL)
export const fetchRepasseMonthlySubmetricsMulti = async (
  unitCodes: string[],
  year: number
): Promise<RepasseMonthlySubmetrics[]> => {
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
  const results: RepasseMonthlySubmetrics[] = [];
  
  for (const m of months) {
    const startDate = `${year}-${m.value}-01`;
    const nextMonth = m.value === '12' ? '01' : String(parseInt(m.value) + 1).padStart(2, '0');
    const nextYear = m.value === '12' ? year + 1 : year;
    const endDate = `${nextYear}-${nextMonth}-01`;

    const { data, error } = await supabase
      .from('processed_data')
      .select('PROFISSIONAL, REPASSE, ATENDIMENTO_ID, IS_DIVISAO')
      .in('unidade_code', unitCodes)
      .gte('DATA', startDate)
      .lt('DATA', endDate);
      
    if (error) {
      results.push({ 
        month: m.value, 
        monthName: m.name, 
        averagePerService: 0, 
        averagePerWeek: 0, 
        averagePerProfessional: 0 
      });
      continue;
    }
    
    const records = (data as any[]) || [];
    
    // Total de repasse
    const totalRepasse = records.reduce((sum, r) => sum + (r.REPASSE || 0), 0);
    
    // Total de serviços únicos
    const originalRecords = records.filter(r => r.IS_DIVISAO !== 'SIM');
    const uniqueServices = new Set(originalRecords.map(r => r.ATENDIMENTO_ID).filter(Boolean)).size;
    
    const averagePerService = uniqueServices > 0 ? totalRepasse / uniqueServices : 0;
    
    // Média por semana
    const monthNum = parseInt(m.value);
    const daysInMonth = new Date(year, monthNum, 0).getDate();
    const weeksInMonth = daysInMonth / 7;
    const averagePerWeek = weeksInMonth > 0 ? totalRepasse / weeksInMonth : 0;
    
    // Profissionais únicos
    const uniqueProfessionals = new Set(
      records
        .map(r => r.PROFISSIONAL)
        .filter(p => p && typeof p === 'string' && p.trim() !== '')
        .map(p => p.trim())
    ).size;
    
    const averagePerProfessional = uniqueProfessionals > 0 ? totalRepasse / uniqueProfessionals : 0;
    
    results.push({ 
      month: m.value, 
      monthName: m.name, 
      averagePerService, 
      averagePerWeek, 
      averagePerProfessional 
    });
  }
  
  return results;
};
