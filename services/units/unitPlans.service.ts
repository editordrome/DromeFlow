/**
 * unitPlans.service.ts
 * Gerencia o vínculo de Unidades com Planos e pagamentos mensais.
 */
import { supabase } from '../supabaseClient';
import type { UnitPlan, UnitPayment } from '../../types';

export const fetchUnitPlan = async (unitId: string): Promise<UnitPlan | null> => {
    const { data, error } = await supabase
        .from('unit_plans')
        .select('*')
        .eq('unit_id', unitId)
        // Se permitir histórico, aqui pegamos o ativo ou o mais recente
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data as UnitPlan | null;
};

export const upsertUnitPlan = async (payload: Partial<UnitPlan>) => {
    // Se for criar, precisamos garantir regras de negócio (ex: desativar anterior)
    // Por simplicidade, assumindo insert/update direto.
    const { data, error } = await supabase
        .from('unit_plans')
        .upsert(payload)
        .select();

    if (error) throw error;
    // Return first item or null
    return (data && data.length > 0) ? (data[0] as UnitPlan) : (null as any);
};

export const fetchUnitPayments = async (unitPlanId: string): Promise<UnitPayment[]> => {
    const { data, error } = await supabase
        .from('unit_payments')
        .select('*')
        .eq('unit_plan_id', unitPlanId)
        .order('reference_date', { ascending: true });

    if (error) throw error;
    return data as UnitPayment[];
};

export const upsertUnitPayment = async (payload: Partial<UnitPayment>) => {
    const { error } = await supabase
        .from('unit_payments')
        .upsert(payload);
    if (error) throw error;
};

// Vanilla JS Date Helpers
const addMonths = (date: Date, months: number): Date => {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
};

const formatDateISO = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Gera pagamentos mensais para um período.
 * Cria registros com status 'pending' se não existirem.
 */
export const generatePaymentsForPeriod = async (
    unitPlanId: string,
    amount: number,
    startDateStr: string,
    endDateStr: string | null,
    dueDay: number = 1 // Default to 1st if not specified
) => {
    if (!startDateStr) return;

    // Check if unit is linked (has parent_unit_id). If so, do NOT generate payments.
    const { data: currentPlan } = await supabase
        .from('unit_plans')
        .select('parent_unit_id')
        .eq('id', unitPlanId)
        .single();

    if (currentPlan?.parent_unit_id) {
        // console.log('Skipping payment generation for linked unit plan:', unitPlanId);
        return;
    }

    // Start of month logic for iteration
    const startRaw = new Date(startDateStr);
    const start = new Date(startRaw.getFullYear(), startRaw.getMonth(), 1);

    let end: Date;
    if (endDateStr) {
        const endRaw = new Date(endDateStr);
        end = new Date(endRaw.getFullYear(), endRaw.getMonth(), 1);
    } else {
        end = addMonths(start, 11); // 12 meses total
    }

    let current = new Date(start);
    // Proteção contra loop infinito
    let safetyCounter = 0;

    // Fetch existing payments to check against
    const existingPayments = await fetchUnitPayments(unitPlanId);

    const updates: Partial<UnitPayment>[] = [];
    const inserts: Partial<UnitPayment>[] = [];

    while (current <= end && safetyCounter < 60) {
        const year = current.getFullYear();
        const month = current.getMonth();

        // Calculate the target due date for this month
        const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
        const day = Math.min(dueDay, lastDayOfMonth);
        const dueDate = new Date(year, month, day);
        const dueDateStr = formatDateISO(dueDate);

        // Find if there is already a payment for this specific month/year
        const existingForMonth = existingPayments.find(p => {
            const pDate = new Date(p.reference_date);
            return pDate.getFullYear() === year && pDate.getMonth() === month;
        });

        if (existingForMonth) {
            // If exists and pending, update it (amount, due date)
            if (existingForMonth.status === 'pending') {
                // Only update if changed
                if (existingForMonth.reference_date !== dueDateStr || Number(existingForMonth.amount) !== amount) {
                    updates.push({
                        id: existingForMonth.id,
                        unit_plan_id: unitPlanId,
                        reference_date: dueDateStr,
                        amount: amount
                        // Keep status pending
                    });
                }
            }
            // If paid/overdue/cancelled, treat as immutable for auto-generation (skip)
        } else {
            // New payment
            inserts.push({
                unit_plan_id: unitPlanId,
                reference_date: dueDateStr,
                amount: amount,
                status: 'pending'
            });
        }

        current = addMonths(current, 1);
        safetyCounter++;
    }

    // Execute Batch Operations
    if (inserts.length > 0) {
        const { error } = await supabase
            .from('unit_payments')
            .insert(inserts);
        if (error) throw error;
    }

    if (updates.length > 0) {
        // Upsert by ID should work for updates
        const { error } = await supabase
            .from('unit_payments')
            .upsert(updates);
        if (error) throw error;
    }
};
