/**
 * Cross-Database Integration Service
 * 
 * Serviço para queries cross-database entre DromeFlow e Data Drome
 * usando Foreign Data Wrapper (FDW) configurado via SQL.
 * 
 * Pré-requisito: Executar scripts SQL de configuração FDW:
 * - docs/sql/2025-11-15_fdw_data_drome_connection.sql (no DromeFlow)
 * - docs/sql/2025-11-15_fdw_dromeflow_connection.sql (no Data Drome)
 */

import { supabaseClient } from '../supabaseClient';

// ============================================================================
// TYPES
// ============================================================================

export interface AtendimentoWithLogs {
  id: number;
  ATENDIMENTO_ID: string;
  CLIENTE: string;
  PROFISSIONAL: string | null;
  DATA: string;
  VALOR: number;
  STATUS: string | null;
  unidade: string | null;
  log_status: string | null;
  log_horario: string | null;
  log_action: string | null;
  log_workflow: string | null;
  log_created_at: string | null;
}

export interface WorkflowError {
  id: number;
  workflow: string | null;
  url_workflow: string | null;
  erro_message: string | null;
  created_at: string;
  error_count: number;
}

export interface AtendimentoLog {
  log_id: number;
  status: string | null;
  horario: string | null;
  action: string | null;
  workflow: string | null;
  created_at: string;
}

export interface UnitLogStats {
  total_logs: number;
  total_errors: number;
  distinct_workflows: number;
  last_log_date: string | null;
}

export interface WorkflowReport {
  workflow: string;
  total_executions: number;
  successful: number;
  errors: number;
  success_rate: number;
}

export interface FullAtendimentoDetails {
  atendimento_id: string;
  cliente: string;
  profissional: string | null;
  data: string;
  valor: number;
  servico: string;
  status: string | null;
  unidade: string | null;
  total_logs: number;
  ultimo_log: string | null;
  tem_erros: boolean;
}

// ============================================================================
// ATENDIMENTOS COM LOGS (View: atendimentos_with_logs)
// ============================================================================

/**
 * Busca atendimentos enriquecidos com logs de monitoramento
 * 
 * @param filters - Filtros opcionais
 * @returns Lista de atendimentos com logs
 */
export async function fetchAtendimentosWithLogs(filters?: {
  atendimentoId?: string;
  unidade?: string;
  hasErrors?: boolean;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}): Promise<AtendimentoWithLogs[]> {
  let query = supabaseClient
    .from('atendimentos_with_logs')
    .select('*');

  if (filters?.atendimentoId) {
    query = query.eq('ATENDIMENTO_ID', filters.atendimentoId);
  }

  if (filters?.unidade) {
    query = query.eq('unidade', filters.unidade);
  }

  if (filters?.hasErrors) {
    query = query.ilike('log_status', '%erro%');
  }

  if (filters?.dateFrom) {
    query = query.gte('DATA', filters.dateFrom);
  }

  if (filters?.dateTo) {
    query = query.lte('DATA', filters.dateTo);
  }

  query = query
    .order('log_created_at', { ascending: false })
    .limit(filters?.limit || 100);

  const { data, error } = await query;

  if (error) {
    console.error('[fetchAtendimentosWithLogs] Error:', error);
    throw error;
  }

  return data || [];
}

// ============================================================================
// LOGS DE ATENDIMENTO ESPECÍFICO (Function: get_atendimento_logs)
// ============================================================================

/**
 * Busca todos os logs de monitoramento de um atendimento específico
 * 
 * @param atendimentoId - ID do atendimento
 * @returns Lista de logs do atendimento
 */
export async function fetchAtendimentoLogs(
  atendimentoId: string
): Promise<AtendimentoLog[]> {
  const { data, error } = await supabaseClient.rpc('get_atendimento_logs', {
    p_atendimento_id: atendimentoId,
  });

  if (error) {
    console.error('[fetchAtendimentoLogs] Error:', error);
    throw error;
  }

  return data || [];
}

// ============================================================================
// DETALHES COMPLETOS DE ATENDIMENTO (Function: get_full_atendimento_details)
// ============================================================================

/**
 * Busca detalhes completos de um atendimento com estatísticas de logs
 * 
 * NOTA: Esta função só está disponível no Data Drome
 * Se estiver no DromeFlow, use fetchAtendimentosWithLogs + fetchAtendimentoLogs
 * 
 * @param atendimentoId - ID do atendimento
 * @returns Detalhes completos do atendimento
 */
export async function fetchFullAtendimentoDetails(
  atendimentoId: string
): Promise<FullAtendimentoDetails | null> {
  const { data, error } = await supabaseClient.rpc(
    'get_full_atendimento_details',
    {
      p_atendimento_id: atendimentoId,
    }
  );

  if (error) {
    console.error('[fetchFullAtendimentoDetails] Error:', error);
    throw error;
  }

  return data?.[0] || null;
}

// ============================================================================
// ESTATÍSTICAS DE LOGS POR UNIDADE (Function: get_unit_log_stats)
// ============================================================================

/**
 * Busca estatísticas de logs de uma unidade nos últimos N dias
 * 
 * @param unitCode - Código da unidade
 * @param days - Número de dias (padrão: 30)
 * @returns Estatísticas de logs
 */
export async function fetchUnitLogStats(
  unitCode: string,
  days: number = 30
): Promise<UnitLogStats | null> {
  const { data, error } = await supabaseClient.rpc('get_unit_log_stats', {
    p_unit_code: unitCode,
    p_days: days,
  });

  if (error) {
    console.error('[fetchUnitLogStats] Error:', error);
    throw error;
  }

  return data?.[0] || null;
}

// ============================================================================
// RELATÓRIO DE WORKFLOWS (Function: get_workflow_report_by_unit)
// ============================================================================

/**
 * Busca relatório de performance de workflows por unidade
 * 
 * NOTA: Esta função só está disponível no Data Drome
 * 
 * @param unitCode - Código da unidade
 * @param days - Número de dias (padrão: 7)
 * @returns Lista de workflows com estatísticas
 */
export async function fetchWorkflowReport(
  unitCode: string,
  days: number = 7
): Promise<WorkflowReport[]> {
  const { data, error } = await supabaseClient.rpc(
    'get_workflow_report_by_unit',
    {
      p_unit_code: unitCode,
      p_days: days,
    }
  );

  if (error) {
    console.error('[fetchWorkflowReport] Error:', error);
    throw error;
  }

  return data || [];
}

// ============================================================================
// ERROS DE WORKFLOW (View: workflow_errors)
// ============================================================================

/**
 * Busca erros de workflows N8N
 * 
 * @param limit - Número máximo de resultados
 * @returns Lista de erros
 */
export async function fetchWorkflowErrors(limit: number = 50): Promise<WorkflowError[]> {
  const { data, error } = await supabaseClient
    .from('workflow_errors')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[fetchWorkflowErrors] Error:', error);
    throw error;
  }

  return data || [];
}

// ============================================================================
// HELPER: Verificar se FDW está configurado
// ============================================================================

/**
 * Verifica se o Foreign Data Wrapper está configurado corretamente
 * Testa se consegue acessar tabelas estrangeiras
 * 
 * @returns true se FDW está funcionando
 */
export async function checkFDWConnection(): Promise<boolean> {
  try {
    // Tentar buscar 1 registro da view de atendimentos com logs
    const { data, error } = await supabaseClient
      .from('atendimentos_with_logs')
      .select('ATENDIMENTO_ID')
      .limit(1);

    if (error) {
      console.error('[checkFDWConnection] Error:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[checkFDWConnection] Exception:', err);
    return false;
  }
}

// ============================================================================
// ANALYTICS: Dashboard Cross-Database
// ============================================================================

/**
 * Busca dados agregados para dashboard cross-database
 * Combina dados de atendimentos com estatísticas de logs
 * 
 * @param unitCode - Código da unidade
 * @param days - Número de dias para análise
 * @returns Dados agregados para dashboard
 */
export async function fetchCrossDatabaseDashboard(
  unitCode: string,
  days: number = 30
): Promise<{
  atendimentos: AtendimentoWithLogs[];
  logStats: UnitLogStats | null;
  workflows: WorkflowReport[];
  recentErrors: WorkflowError[];
}> {
  try {
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);

    // Buscar dados em paralelo
    const [atendimentos, logStats, workflows, recentErrors] = await Promise.all([
      fetchAtendimentosWithLogs({
        unidade: unitCode,
        dateFrom: dateFrom.toISOString().split('T')[0],
        limit: 50,
      }),
      fetchUnitLogStats(unitCode, days),
      // Workflow report só funciona no Data Drome, então capturamos erro
      fetchWorkflowReport(unitCode, days).catch(() => []),
      fetchWorkflowErrors(10),
    ]);

    return {
      atendimentos,
      logStats,
      workflows,
      recentErrors,
    };
  } catch (error) {
    console.error('[fetchCrossDatabaseDashboard] Error:', error);
    throw error;
  }
}

// ============================================================================
// EXPORT DEFAULT
// ============================================================================

export default {
  fetchAtendimentosWithLogs,
  fetchAtendimentoLogs,
  fetchFullAtendimentoDetails,
  fetchUnitLogStats,
  fetchWorkflowReport,
  fetchWorkflowErrors,
  checkFDWConnection,
  fetchCrossDatabaseDashboard,
};
