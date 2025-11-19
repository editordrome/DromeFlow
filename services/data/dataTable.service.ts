import { supabase } from '../supabaseClient';
import { DataRecord } from '../../types';

export const fetchDataTable = async (
  unitCode: string,
  page: number,
  pageSize: number,
  searchTerm?: string,
  searchColumn?: 'cliente' | 'atendimento',
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
    const columnName = searchColumn === 'cliente' ? 'CLIENTE' : 'ATENDIMENTO_ID';
    query = query.ilike(columnName, `%${searchTerm}%`);
  }

  query = query.order('DATA', { ascending: false }).range(from, to);

  const { data, error, count } = await query;
  if (error) {
    console.error('Error in fetchDataTable:', error);
    throw error;
  }

  const enrichedData = await enrichWithVerification((data as DataRecord[]) || []);
  return { data: enrichedData, count: count || 0 };
};

export const fetchDataTableMulti = async (
  unitCodes: string[],
  page: number,
  pageSize: number,
  searchTerm?: string,
  searchColumn?: 'cliente' | 'atendimento',
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
    const columnName = searchColumn === 'cliente' ? 'CLIENTE' : 'ATENDIMENTO_ID';
    query = query.ilike(columnName, `%${searchTerm}%`);
  }

  query = query.order('DATA', { ascending: false }).range(from, to);

  const { data, error, count } = await query;
  if (error) {
    console.error('Error in fetchDataTableMulti:', error);
    throw error;
  }

  const enrichedData = await enrichWithVerification((data as DataRecord[]) || []);
  return { data: enrichedData, count: count || 0 };
};

// Helper para enriquecer registros com status de verificação
async function enrichWithVerification(records: DataRecord[]): Promise<DataRecord[]> {
  if (!records.length) return [];

  const unitCodes = [...new Set(records.map(r => (r as any).unidade_code).filter(Boolean))];
  if (unitCodes.length === 0) return records;

  // Buscar IDs das unidades
  const { data: units } = await supabase.from('units').select('id, unit_code').in('unit_code', unitCodes);
  if (!units || units.length === 0) return records;

  const unitMap = new Map(units.map(u => [u.unit_code, u.id]));

  const names = [...new Set(records.map(r => r.CLIENTE).filter(Boolean))];
  const unitIds = units.map(u => u.id);

  if (names.length === 0) return records;

  // Buscar clientes verificados
  const { data: clients } = await supabase
    .from('unit_clients')
    .select('unit_id, nome, is_verified')
    .in('unit_id', unitIds)
    .in('nome', names)
    .eq('is_verified', true);

  if (!clients || clients.length === 0) return records;

  const verifiedSet = new Set<string>(); // key: `${unit_id}:${nome}`
  clients.forEach(c => verifiedSet.add(`${c.unit_id}:${c.nome}`));

  return records.map(r => {
    const uId = unitMap.get((r as any).unidade_code || '');
    if (uId && verifiedSet.has(`${uId}:${r.CLIENTE}`)) {
      return { ...r, is_verified: true };
    }
    return r;
  });
}

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
    ATENDIMENTO_ID: updatedData.ATENDIMENTO_ID,
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

export const deleteDataRecords = async (recordIds: string[]): Promise<void> => {
  if (!recordIds || recordIds.length === 0) return;
  const { error } = await supabase
    .from('processed_data')
    .delete()
    .in('id', recordIds);
  if (error) {
    console.error('Erro ao deletar registros em lote:', error);
    throw error;
  }
};

export const fetchDataRecordById = async (recordId: number): Promise<DataRecord | null> => {
  const { data, error } = await supabase
    .from('processed_data')
    .select('*')
    .eq('id', recordId)
    .maybeSingle();
  if (error) {
    console.error('Erro ao buscar registro por ID:', error);
    return null;
  }
  return (data as DataRecord) || null;
};

/**
 * Busca os anos disponíveis com dados para a unidade ou múltiplas unidades
 * Retorna array de anos em ordem decrescente
 */
export const fetchAvailableYearsFromProcessedData = async (unitCode: string | string[]): Promise<number[]> => {
  const unitCodes = Array.isArray(unitCode) ? unitCode : [unitCode];

  if (unitCodes.length === 0 || unitCodes.includes('ALL')) {
    return [new Date().getFullYear()];
  }

  try {
    let query = supabase
      .from('processed_data')
      .select('DATA')
      .not('DATA', 'is', null)
      .order('DATA', { ascending: false })
      .limit(1000);

    if (unitCodes.length === 1) {
      query = query.eq('unidade_code', unitCodes[0]);
    } else {
      query = query.in('unidade_code', unitCodes);
    }

    const { data, error } = await query;

    if (error || !data || data.length === 0) {
      return [new Date().getFullYear()];
    }

    // Extrai anos únicos dos dados
    const yearsSet = new Set<number>();
    data.forEach((record: any) => {
      if (record.DATA) {
        const year = new Date(record.DATA).getFullYear();
        if (year >= 2020 && year <= new Date().getFullYear() + 1) {
          yearsSet.add(year);
        }
      }
    });

    const years = Array.from(yearsSet).sort((a, b) => b - a);
    return years.length > 0 ? years : [new Date().getFullYear()];
  } catch (error) {
    console.error('Erro ao buscar anos disponíveis:', error);
    return [new Date().getFullYear()];
  }
};

/**
 * dataTable.service.ts
 * Esqueleto de serviço para operações de tabela de dados e agendamentos.
 */

// TODO: migrar funções: fetchDataTable, updateDataRecord, deleteDataRecord, fetchAppointments

export { };
