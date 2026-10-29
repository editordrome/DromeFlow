
import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { Icon } from './Icon';

interface WebhookScheduleModalProps {
    isOpen: boolean;
    onClose: () => void;
    payment: any | null;
    unitCode: string;
    webhookUrl: string | null;
}

export const WebhookScheduleModal: React.FC<WebhookScheduleModalProps> = ({ isOpen, onClose, payment, unitCode, webhookUrl }) => {
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (isOpen && unitCode) {
            fetchMessage();
        }
    }, [isOpen, unitCode]);

    const fetchMessage = async () => {
        try {
            const { data: moduleData } = await supabase.from('modules').select('id').eq('code', 'financial_module').single();
            if (!moduleData) return;
            // Need unit_id, but props only have unitCode. Need to resolve unitId or parent passes unitId.
            // FinancialPage passes unitCode. 
            // Uh oh, unit_modules needs unit_id.
            // I should pass unitId to this modal OR assume unitCode is enough to find unit.
            // I'll fetch unit_id by code first.
            const { data: unitData } = await supabase.from('units').select('id').eq('unit_code', unitCode).single();
            if (!unitData) return;

            const { data } = await supabase.from('unit_modules')
                .select('msg_cobrar')
                .eq('unit_id', unitData.id)
                .eq('module_id', moduleData.id)
                .single();

            if (data) setMessage(data.msg_cobrar || '');
        } catch (e) {
            console.error("Erro ao buscar mensagem", e);
        }
    };

    if (!isOpen || !payment) return null;

    const handleSave = async () => {
        if (!date || !time) {
            alert("Selecione data e hora.");
            return;
        }

        setSaving(true);
        try {
            if (!webhookUrl) throw new Error("URL do Webhook não configurada.");

            const scheduledAt = new Date(`${date}T${time}:00`).toISOString();

            const payload = {
                action: 'agenda_cobrar',
                unit_code: unitCode,
                id_pagamento_asaas: payment.id_pagamento_asaas,
                cliente_asaas_id: payment.cliente_asaas_id,
                message: message,
                data_agendamento: date,
                horario_agendamento: time
            };

            // Send directly to Webhook (n8n/Asaas middleware)
            await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            // Log in DB as 'SENT' (delegated to n8n)
            const { error } = await supabase
                .from('webhook_schedules')
                .insert({
                    payment_id: payment.id,
                    scheduled_at: scheduledAt,
                    status: 'SENT', // Immediately mark as sent since we passed it to n8n
                    payload: payload
                });

            if (error) throw error;

            alert("Agendamento criado com sucesso!");
            onClose();
        } catch (err) {
            console.error("Erro ao agendar:", err);
            alert("Erro ao agendar envio.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className="bg-bg-secondary w-full max-w-sm rounded-lg shadow-xl border border-border-secondary flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-4 py-3 border-b border-border-secondary">
                    <h3 className="font-bold text-text-primary">Agendar Envio</h3>
                    <button onClick={onClose}><Icon name="X" className="w-5 h-5 text-text-secondary" /></button>
                </div>

                <div className="p-4 space-y-4">
                    <div>
                        <label className="block text-xs uppercase text-text-secondary mb-1">Data</label>
                        <input
                            type="date"
                            value={date}
                            onChange={e => setDate(e.target.value)}
                            className="w-full bg-bg-tertiary border border-border-secondary rounded px-3 py-2 text-text-primary focus:border-accent-primary focus:outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs uppercase text-text-secondary mb-1">Hora</label>
                        <input
                            type="time"
                            value={time}
                            onChange={e => setTime(e.target.value)}
                            className="w-full bg-bg-tertiary border border-border-secondary rounded px-3 py-2 text-text-primary focus:border-accent-primary focus:outline-none"
                        />
                    </div>
                </div>

                <div className="p-4 border-t border-border-secondary flex justify-end gap-2">
                    <button onClick={onClose} className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary">Cancelar</button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-3 py-1.5 text-sm bg-accent-primary text-white rounded hover:bg-accent-primary/90 disabled:opacity-50"
                    >
                        {saving ? 'Salvando...' : 'Agendar'}
                    </button>
                </div>
            </div>
        </div>
    );
};
