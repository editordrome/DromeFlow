/**
 * activityLogs.service.ts
 * Serviço para gerenciamento de logs de atividades do sistema (N8N, integrações, eventos)
 * 
 * 🎯 Consolidação: Substituí Data Drome (jeoegybltyqbdcjpuhbc) → DromeFlow (uframhbsgtxckdxttofo)
 * 💰 Economia: $180/ano + simplificação arquitetural
 * 
 * Tabelas relacionadas:
 * - activity_logs: Logs de execuções de workflows N8N
 * - error_logs: Logs de erros e exceções
 * - actions: Dicionário de ações do sistema
 */

import { supabase } from '../supabaseClient';

// ============================================================================
// TYPES
// ============================================================================

export interface Action {
  id: string;
  action_code: string;
  action_name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActivityLog {
  id: number;
  created_at: string;
  unit_code: string | null;
  unit_id?: string | null;
  workflow: string | null;
  action_code: string | null;
  atend_id: string | null;
  user_identifier: string | null;
  status: 'success' | 'error' | 'pending' | 'cancelled';
  horario: string | null;
  metadata: Record<string, unknown> | null;
  actions?: { action_name: string; description: string | null } | null;
}

export interface ErrorLog {
  id: number;
  created_at: string;
  workflow: string | null;
  url_workflow: string | null;
  error_message: string | null;
  error_type: string | null;
  severity: 'info' | 'warning' | 'error' | 'critical';
  stack_trace: string | null;
  user_id: string | null;
  unit_code: string | null;
  context: Record<string, unknown> | null;
  resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_notes: string | null;
}

export interface ActivityStats {
  action_code: string;
  action_name: string;
  total_executions: number;
  success_count: number;
  error_count: number;
  success_rate: number;
}

// ============================================================================
// ACTIONS (Dicionário)
// ============================================================================

/**
 * Busca todas as ações disponíveis
 */
export const fetchActions = async (): Promise<Action[]> => {
  const { data, error } = await supabase
    .from('actions')
    .select('*')
    .order('action_name');

  if (error) {
    console.error('[fetchActions] Erro:', error);
    throw error;
  }

  return data || [];
};

/**
 * Busca ação por código
 */
export const fetchActionByCode = async (actionCode: string): Promise<Action | null> => {
  const { data, error } = await supabase
    .from('actions')
    .select('*')
    .eq('action_code', actionCode)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    console.error('[fetchActionByCode] Erro:', error);
    throw error;
  }

  return data;
};

/**
 * Cria ou atualiza uma ação
 */
export const upsertAction = async (action: {
  action_code: string;
  action_name: string;
  description?: string;
}): Promise<Action> => {
  const { data, error } = await supabase
    .from('actions')
    .upsert({
      action_code: action.action_code,
      action_name: action.action_name,
      description: action.description || null
    }, {
      onConflict: 'action_code'
    })
    .select()
    .single();

  if (error) {
    console.error('[upsertAction] Erro:', error);
    throw error;
  }

  return data;
};

// ============================================================================
// ACTIVITY LOGS
// ============================================================================

/**
 * Registra log de atividade (usado por N8N webhooks e eventos internos)
 */
export const logActivity = async (log: {
  unit_code?: string;
  unit_id?: string;
  workflow?: string;
  action_code?: string;
  atend_id?: string;
  user_identifier?: string;
  status?: 'success' | 'error' | 'pending' | 'cancelled';
  horario?: string;
  metadata?: Record<string, unknown>;
}): Promise<ActivityLog> => {
  const { data, error } = await supabase
    .from('activity_logs')
    .insert({
      unit_code: log.unit_code || null,
      unit_id: log.unit_id || null,
      workflow: log.workflow || null,
      action_code: log.action_code || null,
      atend_id: log.atend_id || null,
      user_identifier: log.user_identifier || null,
      status: log.status || 'success',
      horario: log.horario || new Date().toISOString(),
      metadata: log.metadata || null
    })
    .select()
    .single();

  if (error) {
    console.error('[logActivity] Erro:', error);
    throw error;
  }

  return data;
};

/**
 * Busca logs de atividade com filtros
 */
export const fetchActivityLogs = async (filters?: {
  unit_code?: string;
  workflow?: string;
  action_code?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
}): Promise<ActivityLog[]> => {
  let query = supabase
    .from('activity_logs')
    .select('*, actions(action_name, description)')
    .order('created_at', { ascending: false });

  if (filters?.unit_code) query = query.eq('unit_code', filters.unit_code);
  if (filters?.workflow) query = query.eq('workflow', filters.workflow);
  if (filters?.action_code) query = query.eq('action_code', filters.action_code);
  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.start_date) query = query.gte('created_at', filters.start_date);
  if (filters?.end_date) query = query.lte('created_at', filters.end_date);
  if (filters?.limit) query = query.limit(filters.limit);

  const { data, error } = await query;

  if (error) {
    console.error('[fetchActivityLogs] Erro:', error);
    throw error;
  }

  return data || [];
};

/**
 * Busca logs por atendimento
 */
export const fetchActivityLogsByAtendimento = async (atendId: string): Promise<ActivityLog[]> => {
  const { data, error } = await supabase
    .from('activity_logs')
    .select('*, actions(action_name, description)')
    .eq('atend_id', atendId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[fetchActivityLogsByAtendimento] Erro:', error);
    throw error;
  }

  return data || [];
};

/**
 * Busca estatísticas de atividades por ação (usando RPC)
 */
export const fetchActivityStatsByAction = async (
  unitCode?: string,
  days: number = 30
): Promise<ActivityStats[]> => {
  const { data, error } = await supabase.rpc('get_activity_stats_by_action', {
    p_unit_code: unitCode || null,
    p_days: days
  });

  if (error) {
    console.error('[fetchActivityStatsByAction] Erro:', error);
    throw error;
  }

  return data || [];
};

// ============================================================================
// ERROR LOGS
// ============================================================================

/**
 * Registra log de erro
 */
export const logError = async (error: {
  workflow?: string;
  url_workflow?: string;
  error_message: string;
  error_type?: string;
  severity?: 'info' | 'warning' | 'error' | 'critical';
  stack_trace?: string;
  user_id?: string;
  unit_code?: string;
  context?: Record<string, unknown>;
}): Promise<ErrorLog> => {
  const { data, error: dbError } = await supabase
    .from('error_logs')
    .insert({
      workflow: error.workflow || null,
      url_workflow: error.url_workflow || null,
      error_message: error.error_message,
      error_type: error.error_type || 'unknown',
      severity: error.severity || 'error',
      stack_trace: error.stack_trace || null,
      user_id: error.user_id || null,
      unit_code: error.unit_code || null,
      context: error.context || null,
      resolved: false
    })
    .select()
    .single();

  if (dbError) {
    console.error('[logError] Erro ao registrar erro:', dbError);
    throw dbError;
  }

  return data;
};

/**
 * Busca logs de erro com filtros
 */
export const fetchErrorLogs = async (filters?: {
  workflow?: string;
  severity?: string;
  unit_code?: string;
  resolved?: boolean;
  start_date?: string;
  end_date?: string;
  limit?: number;
}): Promise<ErrorLog[]> => {
  let query = supabase
    .from('error_logs')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters?.workflow) query = query.eq('workflow', filters.workflow);
  if (filters?.severity) query = query.eq('severity', filters.severity);
  if (filters?.unit_code) query = query.eq('unit_code', filters.unit_code);
  if (filters?.resolved !== undefined) query = query.eq('resolved', filters.resolved);
  if (filters?.start_date) query = query.gte('created_at', filters.start_date);
  if (filters?.end_date) query = query.lte('created_at', filters.end_date);
  if (filters?.limit) query = query.limit(filters.limit);

  const { data, error } = await query;

  if (error) {
    console.error('[fetchErrorLogs] Erro:', error);
    throw error;
  }

  return data || [];
};

/**
 * Marca erro como resolvido
 */
export const resolveError = async (
  errorId: number,
  userId: string,
  notes?: string
): Promise<ErrorLog> => {
  const { data, error } = await supabase
    .from('error_logs')
    .update({
      resolved: true,
      resolved_at: new Date().toISOString(),
      resolved_by: userId,
      resolution_notes: notes || null
    })
    .eq('id', errorId)
    .select()
    .single();

  if (error) {
    console.error('[resolveError] Erro:', error);
    throw error;
  }

  return data;
};

/**
 * Busca contagem de erros não resolvidos por severidade
 */
export const fetchUnresolvedErrorCounts = async (): Promise<Record<string, number>> => {
  const { data, error } = await supabase
    .from('error_logs')
    .select('severity')
    .eq('resolved', false);

  if (error) {
    console.error('[fetchUnresolvedErrorCounts] Erro:', error);
    throw error;
  }

  const counts: Record<string, number> = {
    info: 0,
    warning: 0,
    error: 0,
    critical: 0
  };

  data?.forEach((log) => {
    const severity = log.severity || 'error';
    counts[severity] = (counts[severity] || 0) + 1;
  });

  return counts;
};

// ============================================================================
// LIMPEZA (Manutenção)
// ============================================================================

/**
 * Remove logs de atividade antigos (executar via cron ou manualmente)
 */
export const cleanupOldActivityLogs = async (retentionDays: number = 90): Promise<number> => {
  const { data, error } = await supabase.rpc('cleanup_old_activity_logs', {
    p_retention_days: retentionDays
  });

  if (error) {
    console.error('[cleanupOldActivityLogs] Erro:', error);
    throw error;
  }

  return data?.[0]?.deleted_count || 0;
};
