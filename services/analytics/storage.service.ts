/**
 * Storage Analytics Service
 * 
 * Serviço para análise de uso de storage Supabase
 * Fornece métricas, estatísticas e projeções de uso.
 */

import { supabase } from '../supabaseClient';

// =====================================================
// TYPES
// =====================================================

export interface StorageMetrics {
  // Métricas gerais
  total_size_mb: number;
  
  // Por provider
  supabase_size_mb: number;
  
  // Limites e projeções
  supabase_limit_mb: number;
  supabase_percentage_used: number;
}

export interface StorageAlert {
  type: 'warning' | 'critical' | 'info';
  title: string;
  message: string;
  provider: 'supabase' | 'general';
  percentage?: number;
}

export interface DatabaseMetrics {
  // Informações gerais
  total_size_mb: number;
  active_connections: number;
  max_connections: number;
  
  // Estatísticas por tabela
  tables: Array<{
    table_name: string;
    row_count: number;
    table_size_mb: number;
    indexes_size_mb: number;
    total_size_mb: number;
    last_update: string | null;
  }>;
  
  // Performance
  cache_hit_ratio: number;
  transactions_committed: number;
  transactions_rolled_back: number;
  
  // Storage breakdown
  tables_size_mb: number;
  indexes_size_mb: number;
  toast_size_mb: number;
}

// =====================================================
// CONSTANTS
// =====================================================

const SUPABASE_FREE_LIMIT_MB = 500; // 500 MB para dados (plano free)
const WARNING_THRESHOLD = 70; // 70%
const CRITICAL_THRESHOLD = 90; // 90%

// =====================================================
// MAIN METRICS
// =====================================================

/**
 * Busca métricas completas de storage
 */
export async function fetchStorageMetrics(): Promise<StorageMetrics> {
  try {
    // Buscar tamanho real do banco de dados (schema public via dbMetrics)
    let supabaseSizeMB = 69.80; // Fallback: schema public total
    try {
      const dbMetrics = await fetchDatabaseMetrics();
      supabaseSizeMB = dbMetrics.total_size_mb;
    } catch (err) {
      console.warn('[Storage Metrics] Usando tamanho fixo do database:', err);
    }
    
    return {
      total_size_mb: supabaseSizeMB,
      supabase_size_mb: supabaseSizeMB,
      supabase_limit_mb: SUPABASE_FREE_LIMIT_MB,
      supabase_percentage_used: (supabaseSizeMB / SUPABASE_FREE_LIMIT_MB) * 100,
    };
  } catch (error) {
    console.error('[Storage Analytics] Erro ao buscar métricas:', error);
    throw error;
  }
}

// =====================================================
// ALERTS
// =====================================================

/**
 * Gera alertas baseados no uso de storage
 */
export async function generateStorageAlerts(): Promise<StorageAlert[]> {
  const alerts: StorageAlert[] = [];
  
  try {
    const metrics = await fetchStorageMetrics();
    
    // Alerta Supabase Database
    if (metrics.supabase_percentage_used >= CRITICAL_THRESHOLD) {
      alerts.push({
        type: 'critical',
        title: 'Banco de Dados Crítico',
        message: `Uso do banco Supabase está em ${metrics.supabase_percentage_used.toFixed(1)}% (${metrics.supabase_size_mb.toFixed(1)} MB de ${SUPABASE_FREE_LIMIT_MB} MB). Considere otimizar ou fazer upgrade do plano.`,
        provider: 'supabase',
        percentage: metrics.supabase_percentage_used
      });
    } else if (metrics.supabase_percentage_used >= WARNING_THRESHOLD) {
      alerts.push({
        type: 'warning',
        title: 'Banco de Dados Alto',
        message: `Uso do banco Supabase está em ${metrics.supabase_percentage_used.toFixed(1)}% (${metrics.supabase_size_mb.toFixed(1)} MB de ${SUPABASE_FREE_LIMIT_MB} MB). Monitore o crescimento.`,
        provider: 'supabase',
        percentage: metrics.supabase_percentage_used
      });
    }
    
  } catch (error) {
    console.error('[Storage Analytics] Erro ao gerar alertas:', error);
  }
  
  return alerts;
}

// =====================================================
// DATABASE METRICS
// =====================================================

export interface DatabaseMetrics {
  // Informações gerais
  total_size_mb: number;
  active_connections: number;
  max_connections: number;
  
  // Estatísticas por tabela
  tables: Array<{
    table_name: string;
    row_count: number;
    table_size_mb: number;
    indexes_size_mb: number;
    total_size_mb: number;
    last_update: string | null;
  }>;
  
  // Performance
  cache_hit_ratio: number;
  transactions_committed: number;
  transactions_rolled_back: number;
  
  // Storage breakdown
  tables_size_mb: number;
  indexes_size_mb: number;
  toast_size_mb: number;
}

/**
 * Busca métricas detalhadas do banco de dados PostgreSQL
 */
export async function fetchDatabaseMetrics(): Promise<DatabaseMetrics> {
  try {
    // Tamanho total do banco (busca dinâmica)
    let totalSizeMB = 82.83; // Fallback
    try {
      const { data: sizeData } = await supabase.rpc('execute_sql', {
        query: 'SELECT ROUND(pg_database_size(current_database())::NUMERIC / (1024 * 1024), 2) as size_mb'
      });
      if (sizeData && sizeData[0]?.size_mb) {
        totalSizeMB = parseFloat(sizeData[0].size_mb);
      }
    } catch (err) {
      console.warn('[Database Metrics] Usando tamanho fixo do banco:', err);
    }
    
    // Estatísticas por tabela (top 10)
    const { data: tables, error: tablesError } = await supabase.rpc('get_table_stats');
    
    if (tablesError) {
      console.error('[Database Metrics] Erro ao buscar tabelas:', tablesError);
    }
    
    // Buscar métricas gerais do banco (conexões, cache, transações)
    const { data: metricsData, error: metricsError } = await supabase.rpc('get_database_metrics');
    
    if (metricsError) {
      console.error('[Database Metrics] Erro ao buscar métricas gerais:', metricsError);
    }
    
    const dbMetrics = metricsData && metricsData.length > 0 ? metricsData[0] : null;
    
    // Calcular totais por tipo (baseado no schema public, não no database total)
    let tablesSizeMB = 0;
    let indexesSizeMB = 0;
    
    if (tables && tables.length > 0) {
      tables.forEach((t: any) => {
        tablesSizeMB += parseFloat(t.table_size_mb) || 0;
        indexesSizeMB += parseFloat(t.indexes_size_mb) || 0;
      });
    }
    
    // Total do schema public (aproximado pelas top 10 que representam ~99%)
    const publicSchemaSizeMB = tablesSizeMB + indexesSizeMB;
    
    return {
      total_size_mb: publicSchemaSizeMB, // Usar tamanho do schema public para cálculos de %
      active_connections: dbMetrics?.active_connections || 0,
      max_connections: dbMetrics?.max_connections || 60,
      
      tables: tables || [],
      
      cache_hit_ratio: dbMetrics?.cache_hit_ratio ? parseFloat(dbMetrics.cache_hit_ratio) : 0,
      transactions_committed: dbMetrics?.transactions_committed || 0,
      transactions_rolled_back: dbMetrics?.transactions_rolled_back || 0,
      
      tables_size_mb: tablesSizeMB,
      indexes_size_mb: indexesSizeMB,
      toast_size_mb: 0
    };
  } catch (error) {
    console.error('[Storage Analytics] Erro ao buscar métricas do banco:', error);
    
    // Retornar valores padrão em caso de erro
    return {
      total_size_mb: 69.80,
      active_connections: 0,
      max_connections: 60,
      tables: [],
      cache_hit_ratio: 0,
      transactions_committed: 0,
      transactions_rolled_back: 0,
      tables_size_mb: 37.70,
      indexes_size_mb: 32.10,
      toast_size_mb: 0
    };
  }
}

// =====================================================
// EXPORTS
// =====================================================

export const storageAnalytics = {
  fetchMetrics: fetchStorageMetrics,
  generateAlerts: generateStorageAlerts,
  fetchDatabaseMetrics
};

export default storageAnalytics;
