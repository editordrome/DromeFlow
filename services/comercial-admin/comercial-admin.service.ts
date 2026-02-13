/**
 * comercial-admin.service.ts
 * Serviço para operações do módulo Comercial Admin (Kanban B2B para Super Admin).
 */
import { supabase } from '../supabaseClient';
import type { ComercialAdminCard, ComercialAdminColumn } from '../../types';
import { startOfTodayISO, startOfWeekISO, startOfMonthISO } from '../utils/dates';

export type ComercialAdminPeriodMetrics = { today: number; week: number; month: number };

const COMERCIAL_ADMIN_SELECT = `
  id, unit_id, nome, endereco, contato, origem, 
  status, observacao, plano_id, data_inicio_teste, data_fim_teste,
  created_at, updated_at, position,
  plano:plans(id, name, value, cycle)
`;

export const fetchComercialAdminColumns = async (unitId: string | null): Promise<ComercialAdminColumn[]> => {
    let query = supabase
        .from('comercial_admin_columns')
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
        // Fallback default columns
        return [
            { id: 'leads', unit_id: null, code: 'leads', name: 'Leads', position: 1, is_active: true },
            { id: 'andamento', unit_id: null, code: 'andamento', name: 'Em Andamento', position: 2, is_active: true },
            { id: 'ganhos', unit_id: null, code: 'ganhos', name: 'Ganhos', position: 3, is_active: true },
            { id: 'perdidos', unit_id: null, code: 'perdidos', name: 'Perdidos', position: 4, is_active: true },
        ] as ComercialAdminColumn[];
    }
    return data as ComercialAdminColumn[];
};

export const fetchComercialAdminCards = async (unitId: string): Promise<ComercialAdminCard[]> => {
    let query = supabase
        .from('comercial_admin')
        .select(COMERCIAL_ADMIN_SELECT)
        .order('status', { ascending: true })
        .order('position', { ascending: true })
        .order('created_at', { ascending: false });

    if (unitId && unitId !== 'ALL') {
        // Inclui leads da unidade específica OU leads globais/externos
        query = query.or(`unit_id.eq.${unitId},unit_id.is.null`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data as any[]) || [];
};

export const createComercialAdminCard = async (payload: Partial<ComercialAdminCard>) => {
    const { error } = await supabase.from('comercial_admin').insert(payload);
    if (error) throw error;
};

export const updateComercialAdminCard = async (id: string, payload: Partial<ComercialAdminCard>) => {
    const { error } = await supabase.from('comercial_admin').update(payload).eq('id', id);
    if (error) throw error;
};

export const deleteComercialAdminCard = async (id: string) => {
    const { error } = await supabase.from('comercial_admin').delete().eq('id', id);
    if (error) throw error;
};

export const persistAdminStatusOrdering = async (updates: Array<Pick<ComercialAdminCard, 'id' | 'status' | 'position'>>) => {
    if (!updates.length) return;

    try {
        const statusChanges = updates.filter(u => u.status !== undefined);

        // 1. Update status individually
        for (const update of statusChanges) {
            const { id, status } = update;
            const { error } = await supabase
                .from('comercial_admin')
                .update({ status })
                .eq('id', id);
            if (error) throw error;
        }

        // 2. Batch update positions
        const { batchUpdatePositions } = await import('../utils/batch.service');
        const positionUpdates = updates.map(u => ({ id: u.id, position: u.position }));

        const result = await batchUpdatePositions('comercial_admin', positionUpdates);

        if (!result.success) {
            throw new Error(result.error || 'Falha no batch update');
        }
    } catch (error: any) {
        console.error('Falha na persistência comercial_admin:', error);
        // Fallback legacy
        for (const update of updates) {
            const { id, status, position } = update;
            await supabase
                .from('comercial_admin')
                .update({ status, position })
                .eq('id', id);
        }
    }
};

export const fetchComercialAdminMetrics = async (unitId: string): Promise<ComercialAdminPeriodMetrics> => {
    const [todayStart, weekStart, monthStart] = [startOfTodayISO(), startOfWeekISO(), startOfMonthISO()];

    const getCount = async (date: string) => {
        let query = supabase
            .from('comercial_admin')
            .select('id', { head: true, count: 'exact' })
            .gte('created_at', date);

        if (unitId && unitId !== 'ALL') {
            query = query.or(`unit_id.eq.${unitId},unit_id.is.null`);
        }

        const { count, error } = await query;
        if (error) throw error;
        return count || 0;
    };

    const [today, week, month] = await Promise.all([
        getCount(todayStart),
        getCount(weekStart),
        getCount(monthStart)
    ]);

    return { today, week, month };
};
