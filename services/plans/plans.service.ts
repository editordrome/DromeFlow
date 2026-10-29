/**
 * plans.service.ts
 * Service for Plans CRUD operations.
 */
import { supabase } from '../supabaseClient';
import type { Plan } from '../../types';

export const fetchAllPlans = async (): Promise<Plan[]> => {
    const { data, error } = await supabase
        .from('plans')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
};

export const createPlan = async (planData: Partial<Plan>): Promise<void> => {
    const payload = {
        name: planData.name?.trim(),
        description: planData.description?.trim() || null,
        value: planData.value,
        cycle: planData.cycle,
        status: planData.status ?? true,
        payment_link: planData.payment_link?.trim() || null
    };

    if (!payload.name || !payload.value || !payload.cycle) {
        throw new Error('Nome, valor e ciclo são obrigatórios');
    }

    const { error } = await supabase
        .from('plans')
        .insert(payload);

    if (error) {
        console.error('Erro ao criar plano:', error);
        throw new Error(`Falha ao criar plano: ${error.message}`);
    }
};

export const updatePlan = async (id: string, planData: Partial<Plan>): Promise<void> => {
    const payload = {
        name: planData.name?.trim(),
        description: planData.description?.trim() || null,
        value: planData.value,
        cycle: planData.cycle,
        status: planData.status,
        payment_link: planData.payment_link?.trim() || null
    };

    if (!payload.name || !payload.value || !payload.cycle) {
        throw new Error('Nome, valor e ciclo são obrigatórios');
    }

    const { error } = await supabase
        .from('plans')
        .update(payload)
        .eq('id', id);

    if (error) {
        console.error('Erro ao atualizar plano:', error);
        throw new Error(`Falha ao atualizar plano: ${error.message}`);
    }
};

export const deletePlan = async (id: string): Promise<void> => {
    const { error } = await supabase
        .from('plans')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Erro ao deletar plano:', error);
        throw new Error(`Falha ao deletar plano: ${error.message}`);
    }
};
