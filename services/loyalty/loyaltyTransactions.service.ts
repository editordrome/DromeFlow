import { supabase } from '../supabaseClient';
import { LoyaltyTransaction } from '../../types';

/**
 * Busca transações de um cliente em um plano
 */
export async function fetchTransactions(
    planClientId: string,
    limit: number = 50,
    offset: number = 0
): Promise<LoyaltyTransaction[]> {
    const { data, error } = await supabase
        .from('loyalty_transactions')
        .select('*')
        .eq('plan_client_id', planClientId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (error) throw error;
    return (data || []) as LoyaltyTransaction[];
}

/**
 * Busca todas as transações de um plano (agregado de todos os clientes)
 */
export async function fetchPlanTransactions(
    planId: string,
    limit: number = 100
): Promise<LoyaltyTransaction[]> {
    const { data, error } = await supabase
        .from('loyalty_transactions')
        .select(`
      *,
      plan_client:loyalty_plan_clients!inner(
        plan_id,
        client:unit_clients(nome)
      )
    `)
        .eq('plan_client.plan_id', planId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) throw error;
    return (data || []) as LoyaltyTransaction[];
}

/**
 * Registra acúmulo de pontos manual
 */
export async function earnPoints(
    planClientId: string,
    amount: number,
    description?: string,
    atendimentoId?: string,
    purchaseValue?: number
): Promise<LoyaltyTransaction> {
    // 0. Buscar validade do plano
    const { data: planData } = await supabase
        .from('loyalty_plan_clients')
        .select(`
            plan:loyalty_plans(validity_days)
        `)
        .eq('id', planClientId)
        .single();

    const validityDays = (planData?.plan as any)?.validity_days || 90;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + validityDays);

    // 1. Criar transação
    const { data: transaction, error: txError } = await supabase
        .from('loyalty_transactions')
        .insert({
            plan_client_id: planClientId,
            type: 'earn',
            points: amount,
            atendimento_id: atendimentoId,
            purchase_value: purchaseValue,
            description: description || `Acúmulo manual de ${amount} pontos`,
            expires_at: expiresAt.toISOString()
        })
        .select('*')
        .single();

    if (txError) throw txError;

    // 2. Atualizar saldo do cliente via RPC
    const { error: updateError } = await supabase.rpc('update_loyalty_balance', {
        p_plan_client_id: planClientId,
        p_amount: amount,
        p_operation: 'earn'
    });

    if (updateError) throw updateError;

    return transaction as LoyaltyTransaction;
}

/**
 * Registra resgate de pontos
 */
export async function redeemPoints(
    planClientId: string,
    amount: number,
    description?: string
): Promise<LoyaltyTransaction> {
    // 1. Verificar saldo
    const { data: planClient, error: fetchError } = await supabase
        .from('loyalty_plan_clients')
        .select('current_balance')
        .eq('id', planClientId)
        .single();

    if (fetchError) throw fetchError;
    if (!planClient || planClient.current_balance < amount) {
        throw new Error('Saldo insuficiente para resgate');
    }

    // 2. Criar transação
    const { data: transaction, error: txError } = await supabase
        .from('loyalty_transactions')
        .insert({
            plan_client_id: planClientId,
            type: 'redeem',
            points: -amount,
            description: description || `Resgate de ${amount} pontos`
        })
        .select('*')
        .single();

    if (txError) throw txError;

    // 3. Atualizar saldo do cliente via RPC
    const { error: updateError } = await supabase.rpc('update_loyalty_balance', {
        p_plan_client_id: planClientId,
        p_amount: amount,
        p_operation: 'redeem'
    });

    if (updateError) throw updateError;

    return transaction as LoyaltyTransaction;
}

/**
 * Busca estatísticas de transações de um cliente
 */
export async function fetchClientTransactionStats(planClientId: string): Promise<{
    totalTransactions: number;
    totalEarned: number;
    totalRedeemed: number;
    lastTransaction: LoyaltyTransaction | null;
}> {
    const { data, error } = await supabase
        .from('loyalty_transactions')
        .select('*')
        .eq('plan_client_id', planClientId)
        .order('created_at', { ascending: false });

    if (error) throw error;

    const transactions = data || [];
    const earnTransactions = transactions.filter(t => t.type === 'earn');
    const redeemTransactions = transactions.filter(t => t.type === 'redeem');

    return {
        totalTransactions: transactions.length,
        totalEarned: earnTransactions.reduce((sum, t) => sum + (t.points || 0), 0),
        totalRedeemed: redeemTransactions.reduce((sum, t) => sum + Math.abs(t.points || 0), 0),
        lastTransaction: transactions[0] || null
    };
}

/**
 * Busca transações por período
 */
export async function fetchTransactionsByPeriod(
    planClientId: string,
    startDate: string,
    endDate: string
): Promise<LoyaltyTransaction[]> {
    const { data, error } = await supabase
        .from('loyalty_transactions')
        .select('*')
        .eq('plan_client_id', planClientId)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as LoyaltyTransaction[];
}

/**
 * Ajuste manual de saldo
 */
export async function adjustBalance(
    planClientId: string,
    points: number,
    reason: string,
    userId: string
): Promise<LoyaltyTransaction> {
    // 1. Criar transação de ajuste manual
    const { data: transaction, error: txError } = await supabase
        .from('loyalty_transactions')
        .insert({
            plan_client_id: planClientId,
            type: 'manual_adjustment',
            points: points,
            description: `Ajuste manual: ${reason}`,
            source_type: 'manual',
            adjusted_by_user_id: userId,
            adjustment_reason: reason
        })
        .select('*')
        .single();

    if (txError) throw txError;

    // 2. Atualizar saldo do cliente
    const { data: currentData } = await supabase
        .from('loyalty_plan_clients')
        .select('current_balance, total_earned, total_redeemed')
        .eq('id', planClientId)
        .single();

    if (currentData) {
        const updates: any = {
            current_balance: currentData.current_balance + points,
            last_transaction_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        // Se positivo, adiciona ao total_earned; se negativo, ao total_redeemed
        if (points > 0) {
            updates.total_earned = currentData.total_earned + points;
        } else {
            updates.total_redeemed = currentData.total_redeemed + Math.abs(points);
        }

        const { error: updateError } = await supabase
            .from('loyalty_plan_clients')
            .update(updates)
            .eq('id', planClientId);

        if (updateError) throw updateError;
    }

    return transaction as LoyaltyTransaction;
}

/**
 * Calcular pontos a vencer (próximos 60 dias)
 */
export async function fetchExpiringPoints(planClientId: string): Promise<number> {
    const today = new Date();
    const in60Days = new Date();
    in60Days.setDate(today.getDate() + 60);

    const { data, error } = await supabase
        .from('loyalty_transactions')
        .select('points')
        .eq('plan_client_id', planClientId)
        .eq('type', 'earn')
        .not('expires_at', 'is', null)
        .gte('expires_at', today.toISOString())
        .lte('expires_at', in60Days.toISOString());

    if (error) throw error;

    return (data || []).reduce((sum, tx) => sum + (tx.points || 0), 0);
}

/**
 * Buscar transações com informações do usuário que ajustou
 */
export async function fetchTransactionsWithUser(
    planClientId: string,
    limit: number = 50
): Promise<LoyaltyTransaction[]> {
    const { data, error } = await supabase
        .from('loyalty_transactions')
        .select(`
            *,
            adjusted_by:profiles!adjusted_by_user_id(
                id,
                full_name
            )
        `)
        .eq('plan_client_id', planClientId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) throw error;
    return (data || []) as LoyaltyTransaction[];
}

/**
 * Busca pontos a vencer nos próximos 60 dias para todos os clientes de um plano
 */
export async function fetchAllExpiringPoints(
    planId: string
): Promise<Record<string, { amount: number; date: string }>> {
    // 1. Buscar a próxima transação a vencer para cada cliente
    // Usamos uma query que pega o vencimento mais próximo no futuro para cada plan_client_id
    const { data, error } = await supabase
        .from('loyalty_transactions')
        .select('points, plan_client_id, expires_at')
        .eq('type', 'earn')
        .not('expires_at', 'is', null)
        .gt('expires_at', new Date().toISOString())
        .order('expires_at', { ascending: true });

    if (error) throw error;

    // 2. Agrupar por plan_client_id, pegando apenas a data mais próxima e somando os pontos daquela data específica
    const expiringMap: Record<string, { amount: number; date: string }> = {};

    (data || []).forEach(tx => {
        const clientId = tx.plan_client_id;
        const expiryDate = tx.expires_at!.split('T')[0]; // Pegar apenas YYYY-MM-DD para agrupar

        if (!expiringMap[clientId]) {
            // É a primeira (e mais próxima devido ao order by) data de vencimento deste cliente
            expiringMap[clientId] = {
                amount: tx.points || 0,
                date: tx.expires_at!
            };
        } else if (expiringMap[clientId].date.startsWith(expiryDate)) {
            // Se houver mais transações no mesmo dia da próxima expiração, somamos
            expiringMap[clientId].amount += (tx.points || 0);
        }
    });

    return expiringMap;
}

/**
 * Sincroniza pontos retroativamente a partir da processed_data
 */
export async function syncLoyaltyPoints(planClientId: string): Promise<{
    synced_count: number;
    points_added: number;
}> {
    const { data, error } = await supabase.rpc('sync_loyalty_points', {
        p_plan_client_id: planClientId
    });

    if (error) throw error;
    return data as { synced_count: number; points_added: number };
}
