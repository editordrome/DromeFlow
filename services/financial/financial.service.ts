
import { supabase } from '../supabaseClient';
import { PaymentRecord } from '../../types';

export const fetchPayments = async (unitId: string | null, filters?: { status?: string; startDate?: string; endDate?: string }) => {
    let query = supabase
        .from('payment_records')
        .select(`
            *,
            unit_clients (
                nome
            )
        `)
        .order('data_vencimento', { ascending: false });

    // Filter by unit_id directly (now that payment_records has unit_id column)
    if (unitId && unitId !== 'ALL') {
        query = query.eq('unit_id', unitId);
    }

    if (filters?.status) {
        query = query.eq('status_pagamento', filters.status);
    }

    if (filters?.startDate && filters?.endDate) {
        // Filter by data_vencimento OR data_pagamento within the range
        // This ensures validity for both 'Cash Flow' (Paid) and 'Competence' (Due) views
        const rangeFilter = `and(data_vencimento.gte.${filters.startDate},data_vencimento.lte.${filters.endDate}),and(data_pagamento.gte.${filters.startDate},data_pagamento.lte.${filters.endDate})`;
        query = query.or(rangeFilter);
    } else {
        // Fallback for single bounds if needed, though usually both are present
        if (filters?.startDate) {
            query = query.gte('data_vencimento', filters.startDate);
        }
        if (filters?.endDate) {
            query = query.lte('data_vencimento', filters.endDate);
        }
    }

    const { data, error } = await query;

    if (error) {
        console.error('Erro ao buscar pagamentos:', error);
        throw error;
    }

    return (data as any[]).map(item => ({
        ...item,
        // Ensure numeric values
        valor: item.valor || item.value || item.amount || 0,
        // Flatten nested relationship if needed (though !inner join usually flattens, sometimes supabase returns object)
        unit_clients: Array.isArray(item.unit_clients) ? item.unit_clients[0] : item.unit_clients
    })) as PaymentRecord[];
};

export const fetchClientAppointments = async (
    unitCode: string,
    clientName: string,
    startDate?: string, // YYYY-MM-DD
    endDate?: string   // YYYY-MM-DD
): Promise<{ id: string, date: string, time: string, status: string, day: string, period: string, atendimento_id: string }[]> => {
    // Default to current month if not provided
    if (!startDate || !endDate) {
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth();
        startDate = startDate || new Date(y, m, 1).toISOString().split('T')[0];
        endDate = endDate || new Date(y, m + 1, 0).toISOString().split('T')[0];
    }

    const { data, error } = await supabase
        .from('processed_data')
        .select('id, DATA, HORARIO, STATUS, TIPO, ATENDIMENTO_ID, DIA, "PERÍODO"') // Select necessary fields
        .eq('unidade_code', unitCode)
        .ilike('CLIENTE', `%${clientName}%`) // Fuzzy match name
        .gte('DATA', startDate)
        .lte('DATA', endDate)
        .order('DATA', { ascending: false });

    if (error) {
        console.error('Erro ao buscar agendamentos do cliente:', error);
        return [];
    }

    return (data || []).map(d => ({
        id: String(d.id),
        atendimento_id: d.ATENDIMENTO_ID, // Use ATENDIMENTO_ID for display if available
        date: d.DATA,
        time: d.HORARIO,
        status: d.STATUS || '',
        day: d.DIA || '',
        period: d['PERÍODO'] || '',
        tipo: d.TIPO
    }));
};

export const updatePaymentAppointment = async (paymentId: string, appointmentId: string | null) => {
    const { error } = await supabase
        .from('payment_records')
        .update({ atendimento_id: appointmentId })
        .eq('id', paymentId);

    if (error) throw error;
};

export const updatePaymentStatus = async (id: string, status: string) => {
    const { data, error } = await supabase
        .from('payment_records')
        .update({ status_pagamento: status })
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error updating payment status:', error);
        throw error;
    }

    return data;
};
