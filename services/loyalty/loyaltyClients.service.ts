import { supabase } from '../supabaseClient';
import { LoyaltyPlanClient, UnitClient } from '../../types';

/**
 * Busca todos os clientes de um plano de fidelidade
 */
export async function fetchPlanClients(planId: string): Promise<LoyaltyPlanClient[]> {
    const { data, error } = await supabase
        .from('loyalty_plan_clients')
        .select(`
      *,
      client:unit_clients(*)
    `)
        .eq('plan_id', planId)
        .order('joined_at', { ascending: false });

    if (error) throw error;
    return (data || []) as LoyaltyPlanClient[];
}

/**
 * Busca clientes ativos de um plano
 */
export async function fetchActivePlanClients(planId: string): Promise<LoyaltyPlanClient[]> {
    const { data, error } = await supabase
        .from('loyalty_plan_clients')
        .select(`
      *,
      client:unit_clients(*)
    `)
        .eq('plan_id', planId)
        .eq('is_active', true)
        .order('current_balance', { ascending: false });

    if (error) throw error;
    return (data || []) as LoyaltyPlanClient[];
}

/**
 * Adiciona um cliente a um plano de fidelidade
 */
export async function addClientToPlan(planId: string, clientId: string, isVip: boolean = false): Promise<LoyaltyPlanClient> {
    const { data, error } = await supabase
        .from('loyalty_plan_clients')
        .insert({
            plan_id: planId,
            client_id: clientId,
            current_balance: 0,
            total_earned: 0,
            total_redeemed: 0,
            is_active: true,
            is_vip: isVip
        })
        .select(`
      *,
      client:unit_clients(*)
    `)
        .single();

    if (error) {
        // Se já existe, retorna erro específico
        if (error.code === '23505') { // unique violation
            throw new Error('Cliente já está cadastrado neste plano');
        }
        throw error;
    }
    return data as LoyaltyPlanClient;
}

/**
 * Remove um cliente de um plano (desativa)
 */
export async function removeClientFromPlan(planClientId: string): Promise<void> {
    const { error } = await supabase
        .from('loyalty_plan_clients')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', planClientId);

    if (error) throw error;
}

/**
 * Reativa um cliente em um plano
 */
export async function reactivateClientInPlan(planClientId: string): Promise<void> {
    const { error } = await supabase
        .from('loyalty_plan_clients')
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq('id', planClientId);

    if (error) throw error;
}

/**
 * Busca o saldo atual de um cliente em um plano
 */
export async function getClientBalance(planClientId: string): Promise<number> {
    const { data, error } = await supabase
        .from('loyalty_plan_clients')
        .select('current_balance')
        .eq('id', planClientId)
        .single();

    if (error) throw error;
    return data?.current_balance || 0;
}

/**
 * Busca um cliente específico em um plano
 */
export async function getPlanClient(planId: string, clientId: string): Promise<LoyaltyPlanClient | null> {
    const { data, error } = await supabase
        .from('loyalty_plan_clients')
        .select(`
      *,
      client:unit_clients(*),
      plan:loyalty_plans(*)
    `)
        .eq('plan_id', planId)
        .eq('client_id', clientId)
        .maybeSingle();

    if (error) throw error;
    return data as LoyaltyPlanClient | null;
}

/**
 * Busca todos os planos que um cliente participa
 */
export async function getClientPlans(clientId: string): Promise<LoyaltyPlanClient[]> {
    const { data, error } = await supabase
        .from('loyalty_plan_clients')
        .select(`
      *,
      plan:loyalty_plans(*)
    `)
        .eq('client_id', clientId)
        .eq('is_active', true)
        .order('joined_at', { ascending: false });

    if (error) throw error;
    return (data || []) as LoyaltyPlanClient[];
}

/**
 * Busca clientes disponíveis para adicionar ao plano (não participantes ainda)
 */
export async function fetchAvailableClients(unitId: string, planId: string): Promise<UnitClient[]> {
    // Buscar todos os clientes da unidade
    const { data: allClients, error: clientsError } = await supabase
        .from('unit_clients')
        .select('*')
        .eq('unit_id', unitId)
        .order('nome');

    if (clientsError) throw clientsError;

    // Buscar clientes já no plano
    const { data: planClients, error: planError } = await supabase
        .from('loyalty_plan_clients')
        .select('client_id')
        .eq('plan_id', planId);

    if (planError) throw planError;

    const planClientIds = new Set((planClients || []).map(pc => pc.client_id));

    // Filtrar clientes que não estão no plano
    return (allClients || []).filter(client => !planClientIds.has(client.id));
}

/**
 * Ativar/desativar cliente no plano
 */
export async function toggleClientStatus(
    planClientId: string,
    isActive: boolean
): Promise<void> {
    const { error } = await supabase
        .from('loyalty_plan_clients')
        .update({
            is_active: isActive,
            updated_at: new Date().toISOString()
        })
        .eq('id', planClientId);

    if (error) throw error;
}

/**
 * Atualiza o status VIP de um cliente
 */
export async function updateClientVipStatus(
    planClientId: string,
    isVip: boolean
): Promise<void> {
    const { error } = await supabase
        .from('loyalty_plan_clients')
        .update({
            is_vip: isVip,
            updated_at: new Date().toISOString()
        })
        .eq('id', planClientId);

    if (error) throw error;
}
