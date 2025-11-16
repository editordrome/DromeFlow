/**
 * Storage Analytics Service
 * 
 * Serviço para análise de uso de storage (Supabase + Cloudflare R2)
 * Fornece métricas, estatísticas e projeções de uso.
 */

import { supabase } from '../supabaseClient';
import type { FileMetadata } from '../storage/r2.service';

// =====================================================
// TYPES
// =====================================================

export interface StorageStats {
  totalFiles: number;
  totalSizeMB: number;
  supabaseSizeMB: number;
  r2SizeMB: number;
  percentageUsed: number;
  byFileType: { type: string; count: number; sizeMB: number }[];
  byUnit: { unitCode: string; unitName: string; count: number; sizeMB: number }[];
}

export interface StorageMetrics {
  // Métricas gerais
  total_files: number;
  total_size_bytes: number;
  total_size_mb: number;
  
  // Por provider
  supabase_files: number;
  supabase_size_mb: number;
  r2_files: number;
  r2_size_mb: number;
  
  // Limites e projeções
  supabase_limit_mb: number;
  supabase_percentage_used: number;
  r2_limit_mb: number;
  r2_percentage_used: number;
  
  // Distribuição
  by_type: Array<{ file_type: string; count: number; size_mb: number }>;
  by_unit: Array<{ unit_id: string; unit_code: string; unit_name: string; count: number; size_mb: number }>;
}

export interface RecentFile extends FileMetadata {
  unit_code?: string;
  unit_name?: string;
  uploader_name?: string;
}

export interface StorageAlert {
  type: 'warning' | 'critical' | 'info';
  title: string;
  message: string;
  provider: 'supabase' | 'r2' | 'general';
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
const R2_FREE_LIMIT_MB = 10240; // 10 GB
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
    
    // Buscar estatísticas agregadas de arquivos (apenas R2)
    const { data: stats, error: statsError } = await supabase
      .from('file_metadata')
      .select('storage_provider, file_type, file_size, unit_id, units(unit_code, unit_name)')
      .is('deleted_at', null);

    if (statsError) throw statsError;

    // Calcular métricas
    const files = stats || [];
    
    const totalFiles = files.length;
    const totalSizeBytes = files.reduce((sum, f) => sum + (f.file_size || 0), 0);
    const totalSizeMB = (totalSizeBytes / (1024 * 1024)) + supabaseSizeMB; // Soma DB + arquivos
    
    // Por provider (arquivos ficam apenas no R2)
    const r2Files = files.filter(f => f.storage_provider === 'r2');
    const r2SizeMB = r2Files.reduce((sum, f) => sum + (f.file_size || 0), 0) / (1024 * 1024);
    
    // Por tipo
    const byTypeMap = new Map<string, { count: number; sizeBytes: number }>();
    files.forEach(f => {
      const type = f.file_type || 'unknown';
      const current = byTypeMap.get(type) || { count: 0, sizeBytes: 0 };
      byTypeMap.set(type, {
        count: current.count + 1,
        sizeBytes: current.sizeBytes + (f.file_size || 0)
      });
    });
    
    const byType = Array.from(byTypeMap.entries()).map(([type, data]) => ({
      file_type: type,
      count: data.count,
      size_mb: data.sizeBytes / (1024 * 1024)
    })).sort((a, b) => b.size_mb - a.size_mb);
    
    // Por unidade
    const byUnitMap = new Map<string, { unit_code: string; unit_name: string; count: number; sizeBytes: number }>();
    files.forEach(f => {
      if (!f.unit_id) return;
      
      const unitData = (f.units as any);
      const unitCode = unitData?.unit_code || 'unknown';
      const unitName = unitData?.unit_name || 'Desconhecida';
      
      const current = byUnitMap.get(f.unit_id) || { unit_code: unitCode, unit_name: unitName, count: 0, sizeBytes: 0 };
      byUnitMap.set(f.unit_id, {
        ...current,
        count: current.count + 1,
        sizeBytes: current.sizeBytes + (f.file_size || 0)
      });
    });
    
    const byUnit = Array.from(byUnitMap.entries()).map(([unitId, data]) => ({
      unit_id: unitId,
      unit_code: data.unit_code,
      unit_name: data.unit_name,
      count: data.count,
      size_mb: data.sizeBytes / (1024 * 1024)
    })).sort((a, b) => b.size_mb - a.size_mb);
    
    return {
      total_files: totalFiles,
      total_size_bytes: totalSizeBytes + (supabaseSizeMB * 1024 * 1024),
      total_size_mb: totalSizeMB,
      
      supabase_files: 0, // Supabase não armazena arquivos, apenas dados estruturados
      supabase_size_mb: supabaseSizeMB,
      r2_files: r2Files.length,
      r2_size_mb: r2SizeMB,
      
      supabase_limit_mb: SUPABASE_FREE_LIMIT_MB,
      supabase_percentage_used: (supabaseSizeMB / SUPABASE_FREE_LIMIT_MB) * 100,
      r2_limit_mb: R2_FREE_LIMIT_MB,
      r2_percentage_used: (r2SizeMB / R2_FREE_LIMIT_MB) * 100,
      
      by_type: byType,
      by_unit: byUnit
    };
  } catch (error) {
    console.error('[Storage Analytics] Erro ao buscar métricas:', error);
    throw error;
  }
}

// =====================================================
// RECENT FILES
// =====================================================

/**
 * Busca arquivos recentes com informações de unidade e uploader
 */
export async function fetchRecentFiles(limit = 50, unitId?: string): Promise<RecentFile[]> {
  try {
    let query = supabase
      .from('file_metadata')
      .select(`
        *,
        units(unit_code, unit_name),
        profiles(name)
      `)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (unitId) {
      query = query.eq('unit_id', unitId);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    return (data || []).map(file => ({
      ...file,
      unit_code: (file.units as any)?.unit_code,
      unit_name: (file.units as any)?.unit_name,
      uploader_name: (file.profiles as any)?.name
    })) as RecentFile[];
  } catch (error) {
    console.error('[Storage Analytics] Erro ao buscar arquivos recentes:', error);
    return [];
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
    
    // Alerta R2
    if (metrics.r2_percentage_used >= CRITICAL_THRESHOLD) {
      alerts.push({
        type: 'critical',
        title: 'R2 Storage Crítico',
        message: `Uso do R2 está em ${metrics.r2_percentage_used.toFixed(1)}% (${metrics.r2_size_mb.toFixed(0)} MB de ${R2_FREE_LIMIT_MB} MB). Considere limpar arquivos antigos.`,
        provider: 'r2',
        percentage: metrics.r2_percentage_used
      });
    } else if (metrics.r2_percentage_used >= WARNING_THRESHOLD) {
      alerts.push({
        type: 'warning',
        title: 'R2 Storage Alto',
        message: `Uso do R2 está em ${metrics.r2_percentage_used.toFixed(1)}% (${metrics.r2_size_mb.toFixed(0)} MB de ${R2_FREE_LIMIT_MB} MB).`,
        provider: 'r2',
        percentage: metrics.r2_percentage_used
      });
    }
    
  } catch (error) {
    console.error('[Storage Analytics] Erro ao gerar alertas:', error);
  }
  
  return alerts;
}

// =====================================================
// FILE MANAGEMENT
// =====================================================

/**
 * Busca arquivos para gerenciamento com filtros
 */
export async function fetchFilesForManagement(filters: {
  unitId?: string;
  fileType?: string;
  provider?: 'supabase' | 'r2';
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ files: RecentFile[]; totalCount: number }> {
  try {
    const { unitId, fileType, provider, search, limit = 50, offset = 0 } = filters;
    
    let query = supabase
      .from('file_metadata')
      .select(`
        *,
        units(unit_code, unit_name),
        profiles(name)
      `, { count: 'exact' })
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (unitId) query = query.eq('unit_id', unitId);
    if (fileType) query = query.eq('file_type', fileType);
    if (provider) query = query.eq('storage_provider', provider);
    if (search) query = query.ilike('filename', `%${search}%`);
    
    const { data, error, count } = await query;
    
    if (error) throw error;
    
    const files = (data || []).map(file => ({
      ...file,
      unit_code: (file.units as any)?.unit_code,
      unit_name: (file.units as any)?.unit_name,
      uploader_name: (file.profiles as any)?.name
    })) as RecentFile[];
    
    return { files, totalCount: count || 0 };
  } catch (error) {
    console.error('[Storage Analytics] Erro ao buscar arquivos:', error);
    return { files: [], totalCount: 0 };
  }
}

/**
 * Deleta múltiplos arquivos
 */
export async function bulkDeleteFiles(fileIds: string[]): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;
  
  for (const fileId of fileIds) {
    try {
      const { error } = await supabase
        .from('file_metadata')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', fileId);
      
      if (error) throw error;
      success++;
    } catch (error) {
      console.error(`[Storage Analytics] Erro ao deletar arquivo ${fileId}:`, error);
      failed++;
    }
  }
  
  return { success, failed };
}

// =====================================================
// CLEANUP UTILITIES
// =====================================================

/**
 * Limpa arquivos expirados automaticamente
 */
export async function cleanupExpiredFiles(): Promise<number> {
  try {
    const { data, error } = await supabase
      .rpc('cleanup_expired_files');
    
    if (error) throw error;
    
    return data || 0;
  } catch (error) {
    console.error('[Storage Analytics] Erro ao limpar arquivos expirados:', error);
    return 0;
  }
}

// =====================================================
// DATABASE METRICS
// =====================================================

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
  fetchRecentFiles,
  generateAlerts: generateStorageAlerts,
  fetchFilesForManagement,
  bulkDeleteFiles,
  cleanupExpiredFiles,
  fetchDatabaseMetrics
};

export default storageAnalytics;
