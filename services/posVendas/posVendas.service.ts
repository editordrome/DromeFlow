import { supabase } from '../supabaseClient';
import type { PosVenda, PosVendaFormData, AtendimentoSearchResult } from '../../types';

/**
 * Busca registros de pós-vendas com filtros opcionais
 */
export const fetchPosVendas = async (filters?: {
  unit_id?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}): Promise<PosVenda[]> => {
  let query = supabase
    .from('pos_vendas')
    .select('*')
    .order('data', { ascending: false });

  if (filters?.unit_id) {
    query = query.eq('unit_id', filters.unit_id);
  }

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  if (filters?.startDate) {
    query = query.gte('data', filters.startDate);
  }

  if (filters?.endDate) {
    query = query.lte('data', filters.endDate);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Erro ao buscar pós-vendas:', error);
    throw error;
  }

  return data || [];
};

/**
 * Busca um registro específico de pós-venda por ID
 */
export const getPosVenda = async (id: string): Promise<PosVenda | null> => {
  const { data, error } = await supabase
    .from('pos_vendas')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Erro ao buscar pós-venda:', error);
    throw error;
  }

  return data;
};

/**
 * Busca atendimentos na tabela processed_data para autocomplete
 * Pesquisa por ORCAMENTO, CLIENTE ou DATA
 */
export const searchAtendimentos = async (
  searchTerm: string,
  unit_id?: string
): Promise<AtendimentoSearchResult[]> => {
  let query = supabase
    .from('processed_data')
    .select('ATENDIMENTO_ID, ORCAMENTO, CLIENTE, DATA, SERVIÇO, ENDEREÇO')
    .or(`ORCAMENTO.ilike.%${searchTerm}%,CLIENTE.ilike.%${searchTerm}%,DATA.ilike.%${searchTerm}%`)
    .order('DATA', { ascending: false })
    .limit(20);

  if (unit_id) {
    query = query.eq('unidade', unit_id);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Erro ao buscar atendimentos:', error);
    throw error;
  }

  return (data || []).map(item => ({
    ATENDIMENTO_ID: item.ATENDIMENTO_ID,
    ORCAMENTO: item.ORCAMENTO,
    CLIENTE: item.CLIENTE,
    DATA: item.DATA,
    SERVICO: item['SERVIÇO'],
    ENDERECO: item['ENDEREÇO']
  }));
};

/**
 * Busca dados completos de um atendimento específico por ATENDIMENTO_ID
 */
export const getAtendimentoById = async (atendimentoId: string): Promise<AtendimentoSearchResult | null> => {
  const { data, error } = await supabase
    .from('processed_data')
    .select('ATENDIMENTO_ID, ORCAMENTO, CLIENTE, DATA, SERVIÇO, ENDEREÇO')
    .eq('ATENDIMENTO_ID', atendimentoId)
    .single();

  if (error) {
    console.error('Erro ao buscar atendimento:', error);
    return null;
  }

  if (!data) return null;

  return {
    ATENDIMENTO_ID: data.ATENDIMENTO_ID,
    ORCAMENTO: data.ORCAMENTO,
    CLIENTE: data.CLIENTE,
    DATA: data.DATA,
    SERVICO: data['SERVIÇO'],
    ENDERECO: data['ENDEREÇO']
  };
};

/**
 * Cria um novo registro de pós-venda
 */
export const createPosVenda = async (data: PosVendaFormData): Promise<PosVenda> => {
  const { data: newRecord, error } = await supabase
    .from('pos_vendas')
    .insert({
      ...data,
      reagendou: data.reagendou ?? false
    })
    .select()
    .single();

  if (error) {
    console.error('Erro ao criar pós-venda:', error);
    throw error;
  }

  return newRecord;
};

/**
 * Atualiza um registro existente de pós-venda
 */
export const updatePosVenda = async (id: string, data: Partial<PosVendaFormData>): Promise<PosVenda> => {
  const { data: updatedRecord, error } = await supabase
    .from('pos_vendas')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Erro ao atualizar pós-venda:', error);
    throw error;
  }

  return updatedRecord;
};

/**
 * Deleta um registro de pós-venda
 */
export const deletePosVenda = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('pos_vendas')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Erro ao deletar pós-venda:', error);
    throw error;
  }
};

/**
 * Busca registros de pós-venda vinculados a um ATENDIMENTO_ID específico
 */
export const getPosVendasByAtendimento = async (atendimentoId: string): Promise<PosVenda[]> => {
  const { data, error } = await supabase
    .from('pos_vendas')
    .select('*')
    .eq('ATENDIMENTO_ID', atendimentoId)
    .order('data', { ascending: false });

  if (error) {
    console.error('Erro ao buscar pós-vendas por atendimento:', error);
    throw error;
  }

  return data || [];
};

/**
 * Calcula métricas de pós-vendas (NPS, taxa de reagendamento, etc)
 */
export const getMetrics = async (filters?: {
  unit_id?: string;
  startDate?: string;
  endDate?: string;
}): Promise<{
  totalContatos: number;
  nps: number | null;
  taxaReagendamento: number;
  distribuicaoNotas: { nota: number; count: number }[];
  statusDistribution: { status: string; count: number }[];
}> => {
  let query = supabase
    .from('pos_vendas')
    .select('nota, reagendou, status');

  if (filters?.unit_id) {
    query = query.eq('unit_id', filters.unit_id);
  }

  if (filters?.startDate) {
    query = query.gte('data', filters.startDate);
  }

  if (filters?.endDate) {
    query = query.lte('data', filters.endDate);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Erro ao calcular métricas:', error);
    throw error;
  }

  const records = data || [];
  const totalContatos = records.length;

  // Calcular NPS (Net Promoter Score)
  const notasValidas = records.filter(r => r.nota !== null);
  let nps: number | null = null;
  
  if (notasValidas.length > 0) {
    const promotores = notasValidas.filter(r => r.nota! >= 4).length;
    const detratores = notasValidas.filter(r => r.nota! <= 2).length;
    nps = Math.round(((promotores - detratores) / notasValidas.length) * 100);
  }

  // Taxa de reagendamento
  const reagendamentos = records.filter(r => r.reagendou === true).length;
  const taxaReagendamento = totalContatos > 0 
    ? Math.round((reagendamentos / totalContatos) * 100) 
    : 0;

  // Distribuição de notas
  const distribuicaoNotas = [1, 2, 3, 4, 5].map(nota => ({
    nota,
    count: records.filter(r => r.nota === nota).length
  }));

  // Distribuição de status
  const statusCounts: Record<string, number> = {};
  records.forEach(r => {
    if (r.status) {
      statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
    }
  });

  const statusDistribution = Object.entries(statusCounts).map(([status, count]) => ({
    status,
    count
  }));

  return {
    totalContatos,
    nps,
    taxaReagendamento,
    distribuicaoNotas,
    statusDistribution
  };
};
