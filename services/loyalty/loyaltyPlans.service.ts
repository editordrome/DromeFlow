import { supabase } from '../supabaseClient';
import { LoyaltyPlan } from '../../types';

/**
 * Busca todos os planos de fidelidade de uma unidade
 */
export async function fetchLoyaltyPlans(unitId: string): Promise<LoyaltyPlan[]> {
    const { data, error } = await supabase
        .from('loyalty_plans')
        .select('*')
        .eq('unit_id', unitId)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as LoyaltyPlan[];
}

/**
 * Busca um plano específico por ID
 */
export async function fetchLoyaltyPlanById(id: string): Promise<LoyaltyPlan | null> {
    const { data, error } = await supabase
        .from('loyalty_plans')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
    }
    return data as LoyaltyPlan;
}

/**
 * Busca o plano único de uma unidade
 */
export async function fetchPlanByUnit(unitId: string): Promise<LoyaltyPlan | null> {
    const { data, error } = await supabase
        .from('loyalty_plans')
        .select('*')
        .eq('unit_id', unitId)
        .maybeSingle();

    if (error) throw error;
    return data as LoyaltyPlan | null;
}

/**
 * Busca ou cria o plano único de uma unidade
 */
export async function getOrCreatePlan(unitId: string): Promise<LoyaltyPlan> {
    // Tentar buscar plano existente
    const existingPlan = await fetchPlanByUnit(unitId);
    if (existingPlan) return existingPlan;

    // Criar plano padrão se não existir
    const defaultPlan: Partial<LoyaltyPlan> & { unit_id: string } = {
        unit_id: unitId,
        name: 'Programa de Fidelidade',
        type: 'cashback',
        reward_percentage: 5.0,
        min_purchase_value: 0,
        vip_multiplier: 2.0,
        is_active: true,
    };

    return createLoyaltyPlan(defaultPlan);
}

/**
 * Cria um novo plano de fidelidade
 */
export async function createLoyaltyPlan(
    plan: Partial<LoyaltyPlan> & { unit_id: string }
): Promise<LoyaltyPlan> {
    const { data, error } = await supabase
        .from('loyalty_plans')
        .insert(plan)
        .select('*')
        .single();

    if (error) throw error;
    return data as LoyaltyPlan;
}

/**
 * Atualiza um plano de fidelidade existente
 */
export async function updateLoyaltyPlan(
    id: string,
    updates: Partial<LoyaltyPlan>
): Promise<LoyaltyPlan> {
    const { data, error } = await supabase
        .from('loyalty_plans')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single();

    if (error) throw error;
    return data as LoyaltyPlan;
}

/**
 * Deleta um plano de fidelidade (CASCADE deleta clientes e transações)
 */
export async function deleteLoyaltyPlan(id: string): Promise<void> {
    const { error } = await supabase
        .from('loyalty_plans')
        .delete()
        .eq('id', id);

    if (error) throw error;
}

/**
 * Ativa ou desativa um plano
 */
export async function toggleLoyaltyPlanStatus(id: string, isActive: boolean): Promise<LoyaltyPlan> {
    return updateLoyaltyPlan(id, { is_active: isActive });
}

/**
 * Busca estatísticas de um plano
 */
export async function fetchPlanStats(planId: string): Promise<{
    totalClients: number;
    activeClients: number;
    inactiveClients: number;
    vipClients: number;
    totalPointsInCirculation: number;
    totalPointsEarned: number;
    totalPointsRedeemed: number;
}> {
    const { data, error } = await supabase
        .from('loyalty_plan_clients')
        .select('current_balance, total_earned, total_redeemed, is_active, is_vip')
        .eq('plan_id', planId);

    if (error) throw error;

    const clients = data || [];
    const activeClients = clients.filter(c => c.is_active);
    const inactiveClients = clients.filter(c => !c.is_active);
    const vipClients = clients.filter(c => c.is_vip);

    return {
        totalClients: clients.length,
        activeClients: activeClients.length,
        inactiveClients: inactiveClients.length,
        vipClients: vipClients.length,
        totalPointsInCirculation: activeClients.reduce((sum, c) => sum + (c.current_balance || 0), 0),
        totalPointsEarned: clients.reduce((sum, c) => sum + (c.total_earned || 0), 0),
        totalPointsRedeemed: clients.reduce((sum, c) => sum + (c.total_redeemed || 0), 0),
    };
}
