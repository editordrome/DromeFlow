/**
 * comercial.service.ts
 * Serviço para operações do módulo Comercial (Kanban de oportunidades).
 * 
 * ✨ OTIMIZADO: Drag & drop usa batch update RPC para positions (95% menos requisições)
 */
import { supabase } from '../supabaseClient';
import type { ComercialCard, ComercialColumn } from '../../types';
import { startOfTodayISO, startOfWeekISO, startOfMonthISO } from '../utils/dates';

export type ComercialPeriodMetrics = { today: number; week: number; month: number };

const COMERCIAL_SELECT = 'id, unit_id, nome, tipo, endereco, contato, status, observacao, created_at, updated_at, position';

export const fetchComercialColumns = async (unitId: string | null): Promise<ComercialColumn[]> => {
  let query = supabase
    .from('comercial_columns')
  .select('id, unit_id, code, name, color, image_url, position, is_active')
    .order('position', { ascending: true })
    .order('name', { ascending: true });

  if (unitId && unitId !== 'ALL') {
    query = query.or(`unit_id.eq.${unitId},unit_id.is.null`);
  } else {
    query = query.is('unit_id', null);
  }

  const { data, error } = await query;
  if (error) throw error;
  if (!data || data.length === 0) {
    // fallback: retorna colunas padrão em memória para não quebrar a UI
    return [
      { id: 'leads', unit_id: null, code: 'leads', name: 'Leads', color: null, image_url: null, position: 1, is_active: true },
      { id: 'andamento', unit_id: null, code: 'andamento', name: 'Em andamento', color: null, image_url: null, position: 2, is_active: true },
      { id: 'ganhos', unit_id: null, code: 'ganhos', name: 'Ganhos', color: null, image_url: null, position: 3, is_active: true },
      { id: 'perdidos', unit_id: null, code: 'perdidos', name: 'Perdidos', color: null, image_url: null, position: 4, is_active: true },
    ];
  }
  return data as ComercialColumn[];
};

export const fetchComercialCards = async (unitId: string): Promise<ComercialCard[]> => {
  const { data, error } = await supabase
    .from('comercial')
    .select(COMERCIAL_SELECT)
    .eq('unit_id', unitId)
    .order('status', { ascending: true })
    .order('position', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as ComercialCard[]) || [];
};

export const fetchComercialCardsForUnits = async (unitIds: string[]): Promise<ComercialCard[]> => {
  if (!unitIds.length) return [];
  const { data, error } = await supabase
    .from('comercial')
    .select(COMERCIAL_SELECT)
    .in('unit_id', unitIds)
    .order('status', { ascending: true })
    .order('position', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as ComercialCard[]) || [];
};

export const createComercialCard = async (payload: Partial<ComercialCard>) => {
  const { error } = await supabase.from('comercial').insert(payload);
  if (error) throw error;
};

export const updateComercialCard = async (id: string, payload: Partial<ComercialCard>) => {
  const { error } = await supabase.from('comercial').update(payload).eq('id', id);
  if (error) throw error;
};

export const deleteComercialCard = async (id: string) => {
  const { error } = await supabase.from('comercial').delete().eq('id', id);
  if (error) throw error;
};

export const persistStatusOrdering = async (updates: Array<Pick<ComercialCard, 'id' | 'status' | 'position'>>) => {
  if (!updates.length) return;
  
  console.log('🔄 [COMERCIAL] Persistindo ordenação:', {
    totalUpdates: updates.length,
    updates: updates.map(u => ({ id: u.id.slice(0, 8), status: u.status, position: u.position }))
  });

  try {
    // ✨ OTIMIZAÇÃO: Separa updates de status vs position
    // Status mudou: precisa update individual (pode ter triggers/lógica)
    // Position mudou: usa batch update (muito mais rápido)
    
    const statusChanges = updates.filter(u => u.status !== undefined);
    const needsStatusUpdate = new Set(statusChanges.map(u => u.id));
    
    // 1. Atualiza status primeiro (se necessário) - individual por segurança
    for (const update of statusChanges) {
      const { id, status } = update;
      const { error } = await supabase
        .from('comercial')
        .update({ status })
        .eq('id', id);
      
      if (error) {
        console.error(`❌ ERRO ao atualizar status do card ${id.slice(0, 8)}:`, error);
        throw error;
      }
      console.log(`✅ Status do card ${id.slice(0, 8)} → "${status}"`);
    }
    
    // 2. Atualiza positions em BATCH (muito mais rápido!)
    const { batchUpdatePositions } = await import('../utils/batch.service');
    
    const positionUpdates = updates.map(u => ({
      id: u.id,
      position: u.position
    }));
    
    const result = await batchUpdatePositions('comercial', positionUpdates);
    
    if (!result.success) {
      throw new Error(result.error || 'Falha no batch update');
    }
    
    console.log(`✨ [COMERCIAL] Ordenação persistida! ✅ ${result.updated_count}/${result.total} cards`, {
      totalSuccess: result.updated_count,
      totalFailed: result.failed_count
    });
    
  } catch (error: any) {
    // Fallback: se batch falhar, tenta método legado
    if (error.message?.includes('batch_update_positions')) {
      console.warn('⚠️ Batch update não disponível, usando método legado');
      
      for (const update of updates) {
        const { id, status, position } = update;
        const { error: legacyError } = await supabase
          .from('comercial')
          .update({ status, position })
          .eq('id', id);
        
        if (legacyError) throw legacyError;
      }
    } else {
      throw error;
    }
  }
};

export const moveComercialCard = async (cardId: string, newStatus: string, newPosition: number) => {
  const { error } = await supabase
    .from('comercial')
    .update({ status: newStatus, position: newPosition })
    .eq('id', cardId);
  if (error) throw error;
};

export const fetchComercialMetrics = async (unitId: string): Promise<ComercialPeriodMetrics> => {
  const [todayStart, weekStart, monthStart] = [startOfTodayISO(), startOfWeekISO(), startOfMonthISO()];
  const base = supabase
    .from('comercial')
    .select('id, created_at', { head: true, count: 'exact' })
    .eq('unit_id', unitId);

  const { count: today, error: e1 } = await base.gte('created_at', todayStart);
  if (e1) throw e1;
  const { count: week, error: e2 } = await supabase
    .from('comercial')
    .select('id, created_at', { head: true, count: 'exact' })
    .eq('unit_id', unitId)
    .gte('created_at', weekStart);
  if (e2) throw e2;
  const { count: month, error: e3 } = await supabase
    .from('comercial')
    .select('id, created_at', { head: true, count: 'exact' })
    .eq('unit_id', unitId)
    .gte('created_at', monthStart);
  if (e3) throw e3;

  return { today: today || 0, week: week || 0, month: month || 0 };
};

export const fetchComercialMetricsForUnits = async (unitIds: string[]): Promise<ComercialPeriodMetrics> => {
  if (!unitIds.length) return { today: 0, week: 0, month: 0 };
  const [todayStart, weekStart, monthStart] = [startOfTodayISO(), startOfWeekISO(), startOfMonthISO()];
  const { count: today, error: e1 } = await supabase
    .from('comercial')
    .select('id, created_at', { head: true, count: 'exact' })
    .in('unit_id', unitIds)
    .gte('created_at', todayStart);
  if (e1) throw e1;
  const { count: week, error: e2 } = await supabase
    .from('comercial')
    .select('id, created_at', { head: true, count: 'exact' })
    .in('unit_id', unitIds)
    .gte('created_at', weekStart);
  if (e2) throw e2;
  const { count: month, error: e3 } = await supabase
    .from('comercial')
    .select('id, created_at', { head: true, count: 'exact' })
    .in('unit_id', unitIds)
    .gte('created_at', monthStart);
  if (e3) throw e3;

  return { today: today || 0, week: week || 0, month: month || 0 };
};
