import { supabase } from '../supabaseClient';
import { DataRecord } from '../../types';

export const fetchDataTable = async (
  unitCode: string,
  page: number,
  pageSize: number,
  searchTerm?: string,
  searchColumn?: 'cliente' | 'orcamento',
  period?: string
): Promise<{ data: DataRecord[]; count: number }> => {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('processed_data')
    .select('*', { count: 'exact' })
    .eq('unidade_code', unitCode);

  if (period && period.match(/^\d{4}-\d{2}$/)) {
    const [year, month] = period.split('-').map(Number);
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(Date.UTC(year, month, 0)).toISOString().split('T')[0];
    query = query.gte('DATA', startDate).lte('DATA', endDate);
  }

  if (searchTerm && searchColumn) {
    const columnName = searchColumn === 'cliente' ? 'CLIENTE' : 'orcamento';
    query = query.ilike(columnName, `%${searchTerm}%`);
  }

  query = query.order('DATA', { ascending: false }).range(from, to);

  const { data, error, count } = await query;
  if (error) {
    console.error('Error in fetchDataTable:', error);
    throw error;
  }
  return { data: (data as DataRecord[]) || [], count: count || 0 };
};

export const fetchDataTableMulti = async (
  unitCodes: string[],
  page: number,
  pageSize: number,
  searchTerm?: string,
  searchColumn?: 'cliente' | 'orcamento',
  period?: string
): Promise<{ data: DataRecord[]; count: number }> => {
  if (!unitCodes || unitCodes.length === 0) return { data: [], count: 0 };
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('processed_data')
    .select('*', { count: 'exact' })
    .in('unidade_code', unitCodes);

  if (period && /^\d{4}-\d{2}$/.test(period)) {
    const [year, month] = period.split('-').map(Number);
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(Date.UTC(year, month, 0)).toISOString().split('T')[0];
    query = query.gte('DATA', startDate).lte('DATA', endDate);
  }

  if (searchTerm && searchColumn) {
    const columnName = searchColumn === 'cliente' ? 'CLIENTE' : 'orcamento';
    query = query.ilike(columnName, `%${searchTerm}%`);
  }

  query = query.order('DATA', { ascending: false }).range(from, to);

  const { data, error, count } = await query;
  if (error) {
    console.error('Error in fetchDataTableMulti:', error);
    throw error;
  }
  return { data: (data as DataRecord[]) || [], count: count || 0 };
};

export const fetchAppointments = async (
  unitCode: string,
  date: string
): Promise<DataRecord[]> => {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)) return [];
  const { data, error } = await supabase
    .from('processed_data')
    .select('*')
    .eq('unidade_code', unitCode)
    .eq('DATA', date)
    .order('HORARIO', { ascending: true });
  if (error) {
    console.error('Erro ao buscar agendamentos:', error);
    throw error;
  }
  return (data as DataRecord[]) || [];
};

export const fetchAppointmentsMulti = async (
  unitCodes: string[],
  date: string
): Promise<DataRecord[]> => {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)) return [];
  if (!unitCodes || unitCodes.length === 0) return [];
  const { data, error } = await supabase
    .from('processed_data')
    .select('*')
    .in('unidade_code', unitCodes)
    .eq('DATA', date)
    .order('HORARIO', { ascending: true });
  if (error) {
    console.error('Erro ao buscar agendamentos (multi):', error);
    throw error;
  }
  return (data as DataRecord[]) || [];
};

export const updateDataRecord = async (
  recordId: string,
  updatedData: Partial<DataRecord>
): Promise<DataRecord> => {
  const updatePayload: { [key: string]: any } = {
    DATA: updatedData.DATA,
    CLIENTE: updatedData.CLIENTE,
    VALOR: updatedData.VALOR,
    STATUS: (updatedData as any).STATUS ?? updatedData.status,
    orcamento: updatedData.orcamento,
    // Campos de texto livres
    observacao: updatedData.observacao,
    comentario: updatedData.comentario,
    // Profissional (texto)
    PROFISSIONAL: (updatedData as any)['PROFISSIONAL'],
  };

  const { data, error } = await supabase
    .from('processed_data')
    .update(updatePayload)
    .eq('id', recordId)
    .select()
    .single();

  if (error) {
    console.error('Erro ao atualizar registro:', error);
    throw error;
  }
  return data as DataRecord;
};

export const deleteDataRecord = async (recordId: string): Promise<void> => {
  const { error } = await supabase
    .from('processed_data')
    .delete()
    .eq('id', recordId);
  if (error) {
    console.error('Erro ao deletar registro:', error);
    throw error;
  }
};
/**
 * dataTable.service.ts
 * Esqueleto de serviço para operações de tabela de dados e agendamentos.
 */

// TODO: migrar funções: fetchDataTable, updateDataRecord, deleteDataRecord, fetchAppointments

export {};
