import { supabase } from '../supabaseClient';
import type { PosVenda, PosVendaFormData, AtendimentoSearchResult } from '../../types';

/**
 * Busca registros pendentes diretamente de processed_data
 * Usa a coluna "pos vendas" como status (NULL ou 'pendente' = pendente)
 * Filtra automaticamente do início do mês até o dia anterior (ontem)
 */
export const fetchPendenteWithProfissional = async (filters?: {
  unit_id?: string;
  startDate?: string;
  endDate?: string;
}): Promise<Array<PosVenda>> => {
  let query = supabase
    .from('pos_vendas')
    .select('*')
    .eq('status', 'pendente')
    .order('data', { ascending: false });

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
    console.error('Erro ao buscar pendentes de pos_vendas:', error);
    throw error;
  }

  return data || [];
};

// Removida lógica de mesclagem manual com processed_data

/**
 * Busca registros de pós-vendas com filtros opcionais
 * Faz queries separadas para pos_vendas e processed_data, depois combina os dados
 */
export const fetchPosVendas = async (filters?: {
  unit_id?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}): Promise<Array<PosVenda>> => {
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
 * Pesquisa por ATENDIMENTO_ID, CLIENTE ou DATA
 */
export const searchAtendimentos = async (
  searchTerm: string,
  unit_id?: string
): Promise<AtendimentoSearchResult[]> => {
  let query = supabase
    .from('processed_data')
    .select('atendimento_id, cliente, data, servico, endereco, profissional')
    .or(`atendimento_id.ilike.%${searchTerm}%,cliente.ilike.%${searchTerm}%,data.ilike.%${searchTerm}%`)
    .order('data', { ascending: false })
    .limit(20);

  if (unit_id) {
    query = query.eq('unidade_code', unit_id);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Erro ao buscar atendimentos:', error);
    throw error;
  }

  return (data || []).map((item: any) => ({
    atendimento_id: item.atendimento_id,
    cliente: item.cliente,
    data: item.data,
    servico: item.servico,
    endereco: item.endereco,
    profissional: item.profissional || null
  }));
};

/**
 * Busca dados completos de um atendimento específico por ATENDIMENTO_ID
 */
export const getAtendimentoById = async (atendimentoId: string): Promise<AtendimentoSearchResult | null> => {
  const { data, error } = await supabase
    .from('processed_data')
    .select('atendimento_id, cliente, data, servico, endereco, profissional')
    .eq('atendimento_id', atendimentoId)
    .single();

  if (error) {
    console.error('Erro ao buscar atendimento:', error);
    return null;
  }

  if (!data) return null;

  const row = data as any;
  return {
    atendimento_id: row.atendimento_id,
    cliente: row.cliente,
    data: row.data,
    servico: row.servico,
    endereco: row.endereco,
    profissional: row.profissional || null
  };
};

/**
 * Mapeia os dados do formulário (que podem conter ATENDIMENTO_ID) para os nomes de colunas do banco (atendimento_id)
 */
const mapToDbRecord = (formData: Partial<PosVendaFormData>) => {
  const record: Record<string, any> = { ...formData };
  
  if (formData.ATENDIMENTO_ID !== undefined) {
    record.atendimento_id = formData.ATENDIMENTO_ID;
    delete record.ATENDIMENTO_ID;
  }
  
  // Se atendimento_id (lowercase) já estiver presente, garante que ele prevaleça
  if (formData.atendimento_id !== undefined) {
    record.atendimento_id = formData.atendimento_id;
  }

  // Remove campos que não pertencem à tabela pos_vendas se necessário
  delete record.PROFISSIONAL;
  delete record.data_finalizacao;

  return record;
};

/**
 * Cria um novo registro de pós-venda
 */
export const createPosVenda = async (data: PosVendaFormData): Promise<PosVenda> => {
  const dbRecord = mapToDbRecord(data);
  
  const { data: newRecord, error } = await supabase
    .from('pos_vendas')
    .insert({
      ...dbRecord,
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
  const dbRecord = mapToDbRecord(data);

  const { data: updatedRecord, error } = await supabase
    .from('pos_vendas')
    .update(dbRecord)
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
    .eq('atendimento_id', atendimentoId)
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
  totalContatados: number;
  totalFinalizados: number;
  nps: number | null;
  taxaReagendamento: number;
  distribuicaoNotas: { nota: number; count: number }[];
  statusDistribution: { status: string; count: number }[];
}> => {
  let query = supabase
    .from('pos_vendas')
    .select('data, nota, reagendou, status');

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
  
  // Contar por status específico
  const totalContatados = records.filter(r => r.status === 'contatado').length;
  const totalFinalizados = records.filter(r => r.status === 'finalizado').length;
  
  // Soma de contatados + finalizados
  const totalRespostas = totalContatados + totalFinalizados;
  
  // Total de contatos (todos os registros)
  const totalContatos = records.length;

  // Calcular taxa de conversão: percentual que contatados representa no montante (contatados + finalizados)
  // Se não houver respostas, a taxa é 0%
  const taxaConversao = totalRespostas > 0 
    ? Math.round((totalContatados / totalRespostas) * 100) 
    : 0;

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
    totalContatados,
    totalFinalizados,
    nps,
    taxaReagendamento,
    distribuicaoNotas,
    statusDistribution
  };
};
