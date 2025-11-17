import { supabase } from '../supabaseClient';
import type { N8NMonitoringLog, N8NErrorLog } from '../../types';

// Usando o cliente Supabase principal do DromeFlow (Data Drome foi consolidado)
const dataDromeClient = supabase;

/**
 * Busca ações disponíveis no data_drome
 */
export async function fetchActions(): Promise<Map<string, string>> {
  try {
    const { data, error } = await dataDromeClient
      .from('actions')
      .select('action_code, action_name')
      .order('action_name', { ascending: true });

    if (error) {
      console.error('[Data Drome] Erro ao buscar ações:', error);
      return new Map();
    }

    const map = new Map<string, string>();
    data?.forEach(action => {
      if (action.action_code && action.action_name) {
        map.set(action.action_code, action.action_name);
      }
    });
    
    return map;
  } catch (error) {
    console.error('[Data Drome] Falha ao buscar ações:', error);
    return new Map();
  }
}

/**
 * Busca logs de monitoramento do N8N
 * @param limit - Número máximo de registros (padrão: 100)
 * @param unitFilter - Filtrar por unidade específica
 */
export async function fetchMonitoringLogs(
  limit: number = 100,
  unitFilter?: string
): Promise<N8NMonitoringLog[]> {
  try {
    let query = dataDromeClient
      .from('monitoramento_dromeboard')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (unitFilter) {
      query = query.eq('unit', unitFilter);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Data Drome] Erro ao buscar logs de monitoramento:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('[Data Drome] Falha ao buscar logs de monitoramento:', error);
    return [];
  }
}

/**
 * Busca logs de erro do N8N
 * @param limit - Número máximo de registros (padrão: 50)
 * @param workflowFilter - Filtrar por workflow específico
 */
export async function fetchErrorLogs(
  limit: number = 50,
  workflowFilter?: string
): Promise<N8NErrorLog[]> {
  try {
    let query = dataDromeClient
      .from('error_dromeboard')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (workflowFilter) {
      query = query.ilike('workflow', `%${workflowFilter}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Data Drome] Erro ao buscar logs de erro:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('[Data Drome] Falha ao buscar logs de erro:', error);
    return [];
  }
}

/**
 * Busca estatísticas agregadas de monitoramento
 */
export async function fetchMonitoringStats(unitFilter?: string): Promise<{
  total: number;
  successCount: number;
  errorCount: number;
  byWorkflow: { workflow: string; count: number }[];
}> {
  try {
    let query = dataDromeClient
      .from('monitoramento_dromeboard')
      .select('status, workflow');

    if (unitFilter) {
      query = query.eq('unit', unitFilter);
    }

    const { data, error } = await query;

    if (error) throw error;

    const logs = data || [];
    const total = logs.length;
    const successCount = logs.filter(l => l.status?.toLowerCase() === 'success').length;
    const errorCount = logs.filter(l => l.status?.toLowerCase() === 'error').length;

    // Agrupar por workflow
    const workflowCounts = logs.reduce((acc: { [key: string]: number }, log) => {
      const wf = log.workflow || 'Unknown';
      acc[wf] = (acc[wf] || 0) + 1;
      return acc;
    }, {});

    const byWorkflow = Object.entries(workflowCounts)
      .map(([workflow, count]) => ({ workflow, count: count as number }))
      .sort((a, b) => b.count - a.count);

    return { total, successCount, errorCount, byWorkflow };
  } catch (error) {
    console.error('[Data Drome] Falha ao buscar estatísticas:', error);
    return { total: 0, successCount: 0, errorCount: 0, byWorkflow: [] };
  }
}

/**
 * Busca últimos erros únicos por workflow
 */
export async function fetchLatestErrorsByWorkflow(limit: number = 10): Promise<{
  workflow: string;
  lastError: string;
  lastOccurrence: string;
  count: number;
}[]> {
  try {
    const { data, error } = await dataDromeClient
      .from('error_dromeboard')
      .select('workflow, erro_message, created_at')
      .order('created_at', { ascending: false })
      .limit(100); // Busca mais para agrupar

    if (error) throw error;

    const logs = data || [];
    
    // Agrupar por workflow
    const grouped = logs.reduce((acc: { [key: string]: any }, log) => {
      const wf = log.workflow || 'Unknown';
      if (!acc[wf]) {
        acc[wf] = {
          workflow: wf,
          lastError: log.erro_message || 'N/A',
          lastOccurrence: log.created_at,
          count: 1
        };
      } else {
        acc[wf].count += 1;
      }
      return acc;
    }, {});

    return Object.values(grouped)
      .sort((a: any, b: any) => b.count - a.count)
      .slice(0, limit);
  } catch (error) {
    console.error('[Data Drome] Falha ao buscar últimos erros:', error);
    return [];
  }
}
