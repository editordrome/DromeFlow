
import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { Icon } from './Icon';

interface FinancialSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    unitId: string;
}

export const FinancialSettingsModal: React.FC<FinancialSettingsModalProps> = ({ isOpen, onClose, unitId }) => {
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isOpen && unitId) {
            fetchSettings();
        }
    }, [isOpen, unitId]);

    const fetchSettings = async () => {
        setLoading(true);
        try {
            // First get module id for 'financial_module'
            const { data: moduleData, error: moduleError } = await supabase
                .from('modules')
                .select('id')
                .eq('code', 'financial_module')
                .single();

            if (moduleError || !moduleData) throw new Error("Módulo financeiro não encontrado.");

            const { data, error } = await supabase
                .from('unit_modules')
                .select('msg_cobrar')
                .eq('unit_id', unitId)
                .eq('module_id', moduleData.id)
                .single();

            if (data) {
                setMessage(data.msg_cobrar || '');
            }
        } catch (err) {
            console.error("Erro ao carregar configurações:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const { data: moduleData } = await supabase
                .from('modules')
                .select('id')
                .eq('code', 'financial_module')
                .single();

            if (!moduleData) throw new Error("Módulo financeiro não encontrado.");

            // Upsert ensures the row exists even if it wasn't there before
            const { error } = await supabase
                .from('unit_modules')
                .upsert({
                    unit_id: unitId,
                    module_id: moduleData.id,
                    msg_cobrar: message
                }, { onConflict: 'unit_id, module_id' });

            if (error) throw error;

            alert("Configurações salvas!");
            onClose();
        } catch (err) {
            console.error("Erro ao salvar:", err);
            alert("Erro ao salvar configurações.");
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className="bg-bg-secondary w-full max-w-lg rounded-lg shadow-xl border border-border-secondary flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-4 py-3 border-b border-border-secondary">
                    <h3 className="font-bold text-text-primary flex items-center gap-2">
                        <Icon name="Settings" className="w-5 h-5" />
                        Configurações Financeiras
                    </h3>
                    <button onClick={onClose}><Icon name="X" className="w-5 h-5 text-text-secondary" /></button>
                </div>

                <div className="p-4 space-y-4">
                    {loading ? (
                        <div className="text-center py-4 text-text-secondary">Carregando...</div>
                    ) : (
                        <div>
                            <label className="block text-sm font-medium text-text-primary mb-1">
                                Mensagem de Cobrança (Webhook)
                            </label>
                            <p className="text-xs text-text-secondary mb-2">
                                Esta mensagem será enviada junto com o webhook de agendamento de cobrança.
                            </p>
                            <textarea
                                value={message}
                                onChange={e => setMessage(e.target.value)}
                                className="w-full h-32 bg-bg-tertiary border border-border-secondary rounded px-3 py-2 text-text-primary focus:border-accent-primary focus:outline-none resize-none"
                                placeholder="Digite a mensagem padrão..."
                            />
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-border-secondary flex justify-end gap-2">
                    <button onClick={onClose} className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary">Cancelar</button>
                    <button
                        onClick={handleSave}
                        disabled={saving || loading}
                        className="px-3 py-1.5 text-sm bg-accent-primary text-white rounded hover:bg-accent-primary/90 disabled:opacity-50"
                    >
                        {saving ? 'Salvando...' : 'Salvar'}
                    </button>
                </div>
            </div>
        </div>
    );
};
