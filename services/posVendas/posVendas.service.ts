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
}): Promise<Array<PosVenda & { PROFISSIONAL: string | null }>> => {
  // Calcular data limite: dia anterior (ontem)
  const hoje = new Date();
  const ontem = new Date(hoje);
  ontem.setDate(ontem.getDate() - 1);
  const dataLimite = ontem.toISOString().split('T')[0]; // Formato: YYYY-MM-DD

  // Busca o unit_code correspondente ao unit_id (se fornecido)
  let unitCode: string | null = null;
  if (filters?.unit_id) {
    const { data: unitData } = await supabase
      .from('units')
      .select('unit_code, id')
      .eq('id', filters.unit_id)
      .single();
    
    unitCode = unitData?.unit_code || null;
  }

  // Busca diretamente de processed_data onde "pos vendas" é NULL ou 'pendente'
  let query = supabase
    .from('processed_data')
    .select('*, unit_id')
    .order('DATA', { ascending: false });

  // Filtro por status pendente (coluna "pos vendas" NULL ou 'pendente')
  query = query.or('"pos vendas".is.null,"pos vendas".eq.pendente');

  // Filtro por unidade (usando unidade_code)
  if (unitCode) {
    query = query.eq('unidade_code', unitCode);
  }

  // Filtro de data: do início do mês até ontem (dia anterior)
  if (filters?.startDate) {
    query = query.gte('DATA', filters.startDate);
  }
  
  // Sempre limita até ontem, mas respeita endDate se for anterior a ontem
  const dataFinal = filters?.endDate && filters.endDate < dataLimite 
    ? filters.endDate 
    : dataLimite;
  query = query.lte('DATA', dataFinal);

  const { data, error } = await query;

  if (error) {
    console.error('Erro ao buscar pendentes de processed_data:', error);
    throw error;
  }

  // Mapeia para o formato PosVenda
  return (data || []).map((row: any) => ({
    id: row.ATENDIMENTO_ID || `temp-${Date.now()}-${Math.random()}`,
    ATENDIMENTO_ID: row.ATENDIMENTO_ID,
    chat_id: null,
    nome: row.CLIENTE,
    contato: row.whatscliente || null, // CORRIGIDO: usa whatscliente ao invés de CONTATO
    unit_id: row.unit_id || filters?.unit_id || null, // CORRIGIDO: usa unit_id da row
    data: row.DATA,
    status: (row['pos vendas'] as 'pendente' | 'contatado' | 'finalizado' | null) || 'pendente',
    nota: null,
    reagendou: false,
    feedback: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    PROFISSIONAL: row.PROFISSIONAL
  }));
};

/**
 * Busca registros de pós-vendas com filtros opcionais
 * Faz queries separadas para pos_vendas e processed_data, depois combina os dados
 */
export const fetchPosVendas = async (filters?: {
  unit_id?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}): Promise<Array<PosVenda & { PROFISSIONAL?: string | null; CLIENTE?: string | null }>> => {
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

  if (!data || data.length === 0) {
    return [];
  }

  // Buscar dados complementares de processed_data (PROFISSIONAL e CLIENTE)
  const atendimentoIds = data
    .map(record => record.ATENDIMENTO_ID)
    .filter(id => id !== null && id !== undefined);

  if (atendimentoIds.length === 0) {
    return data.map(record => ({
      ...record,
      PROFISSIONAL: null,
      CLIENTE: record.nome || null,
    }));
  }

  // Buscar profissionais e clientes dos atendimentos
  const { data: processedData, error: processedError } = await supabase
    .from('processed_data')
    .select('ATENDIMENTO_ID, PROFISSIONAL, CLIENTE')
    .in('ATENDIMENTO_ID', atendimentoIds);

  if (processedError) {
    console.error('Erro ao buscar dados complementares:', processedError);
    // Retorna os dados sem PROFISSIONAL/CLIENTE em caso de erro
    return data.map(record => ({
      ...record,
      PROFISSIONAL: null,
      CLIENTE: record.nome || null,
    }));
  }

  // Criar mapa de atendimento -> dados complementares
  const complementMap = new Map<string, { PROFISSIONAL: string | null; CLIENTE: string | null }>();
  (processedData || []).forEach((item: any) => {
    if (item.ATENDIMENTO_ID) {
      complementMap.set(item.ATENDIMENTO_ID, {
        PROFISSIONAL: item.PROFISSIONAL,
        CLIENTE: item.CLIENTE,
      });
    }
  });

  // Combinar dados
  return data.map(record => {
    const complement = record.ATENDIMENTO_ID ? complementMap.get(record.ATENDIMENTO_ID) : null;
    return {
      ...record,
      PROFISSIONAL: complement?.PROFISSIONAL || null,
      CLIENTE: complement?.CLIENTE || record.nome || null,
    };
  });
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
    .select('ATENDIMENTO_ID, CLIENTE, DATA, SERVIÇO, ENDEREÇO')
    .or(`ATENDIMENTO_ID.ilike.%${searchTerm}%,CLIENTE.ilike.%${searchTerm}%,DATA.ilike.%${searchTerm}%`)
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
    .select('ATENDIMENTO_ID, CLIENTE, DATA, SERVIÇO, ENDEREÇO')
    .eq('ATENDIMENTO_ID', atendimentoId)
    .single();

  if (error) {
    console.error('Erro ao buscar atendimento:', error);
    return null;
  }

  if (!data) return null;

  return {
    ATENDIMENTO_ID: data.ATENDIMENTO_ID,
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
