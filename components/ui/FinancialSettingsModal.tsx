
import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { Icon } from './Icon';

interface FinancialSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    unitId: string;
}

export const FinancialSettingsModal: React.FC<FinancialSettingsModalProps> = ({ isOpen, onClose, unitId }) => {
    const [msgCobrar, setMsgCobrar] = useState('');

    // Integration State
    const [apiKey, setApiKey] = useState('');
    const [walletId, setWalletId] = useState('');
    const [integrationActive, setIntegrationActive] = useState(false);
    const [webhookUrl, setWebhookUrl] = useState('');

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showKey, setShowKey] = useState(false);

    const [activeTab, setActiveTab] = useState<'integration' | 'messages'>('integration');

    useEffect(() => {
        if (isOpen && unitId) {
            fetchSettings();
        }
    }, [isOpen, unitId]);

    const fetchSettings = async () => {
        setLoading(true);
        try {
            // 1. Fetch Module Settings (Message)
            const { data: moduleData, error: moduleError } = await supabase
                .from('modules')
                .select('id, webhook_url')
                .eq('code', 'financial_module')
                .single();

            if (moduleError || !moduleData) throw new Error("Módulo financeiro não encontrado.");

            // Set base webhook URL from module configuration if available
            setWebhookUrl(moduleData.webhook_url || '');

            const { data: unitModuleData } = await supabase
                .from('unit_modules')
                .select('msg_cobrar')
                .eq('unit_id', unitId)
                .eq('module_id', moduleData.id)
                .single();

            if (unitModuleData) {
                setMsgCobrar(unitModuleData.msg_cobrar || '');
            }

            // 2. Fetch Integration Settings
            const { data: integrationData } = await supabase
                .from('unit_integrations')
                .select('api_key, wallet_id, webhook_url, is_active')
                .eq('unit_id', unitId)
                .eq('provider', 'asaas')
                .single();

            if (integrationData) {
                setApiKey(integrationData.api_key || '');
                setIntegrationActive(integrationData.is_active || false);
                setWalletId(integrationData.wallet_id || '');
                // If the integration has a specific webhook URL saved (unlikely if dynamic, but check) 
                // or if we want to show the one bound to the unit.
                // Actually the webhook URL is usually standard + unit param. 
                // But let's check if we should override the module default.
                if (integrationData.webhook_url) {
                    setWebhookUrl(integrationData.webhook_url);
                }
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
            // 1. Save Module Settings
            const { data: moduleData } = await supabase
                .from('modules')
                .select('id')
                .eq('code', 'financial_module')
                .single();

            if (!moduleData) throw new Error("Módulo financeiro não encontrado.");

            const { error: modError } = await supabase
                .from('unit_modules')
                .upsert({
                    unit_id: unitId,
                    module_id: moduleData.id,
                    msg_cobrar: msgCobrar
                }, { onConflict: 'unit_id, module_id' });

            if (modError) throw modError;

            // 2. Save Integration Settings
            const { error: intError } = await supabase
                .from('unit_integrations')
                .upsert({
                    unit_id: unitId,
                    provider: 'asaas',
                    api_key: apiKey,
                    is_active: integrationActive,
                    wallet_id: walletId,
                    // We don't save webhook_url here usually unless user edits it, but it's read-only.
                    updated_at: new Date().toISOString()
                }, { onConflict: 'unit_id, provider' });

            if (intError) throw intError;

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
            <div className="bg-bg-secondary w-full max-w-lg rounded-lg shadow-xl border border-border-secondary flex flex-col max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-4 py-3 border-b border-border-secondary">
                    <h3 className="font-bold text-text-primary flex items-center gap-2">
                        <Icon name="Settings" className="w-5 h-5" />
                        Configurações Financeiras
                    </h3>
                    <button onClick={onClose}><Icon name="X" className="w-5 h-5 text-text-secondary" /></button>
                </div>

                {/* Tabs Header */}
                <div className="flex border-b border-border-secondary">
                    <button
                        onClick={() => setActiveTab('integration')}
                        className={`flex-1 py-3 text-sm font-medium transition-colors relative ${activeTab === 'integration' ? 'text-accent-primary' : 'text-text-secondary hover:text-text-primary'}`}
                    >
                        Integração Asaas
                        {activeTab === 'integration' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-accent-primary" />}
                    </button>
                    <button
                        onClick={() => setActiveTab('messages')}
                        className={`flex-1 py-3 text-sm font-medium transition-colors relative ${activeTab === 'messages' ? 'text-accent-primary' : 'text-text-secondary hover:text-text-primary'}`}
                    >
                        Mensagens
                        {activeTab === 'messages' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-accent-primary" />}
                    </button>
                </div>

                <div className="p-5 space-y-6 overflow-y-auto custom-scrollbar">
                    {loading ? (
                        <div className="text-center py-8 text-text-secondary">Carregando...</div>
                    ) : (
                        <>
                            {/* Conteúdo Aba Integração */}
                            {activeTab === 'integration' && (
                                <div className="space-y-4 animate-fade-in">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm text-text-primary">Ativar Integração</label>
                                        <button
                                            type="button"
                                            onClick={() => setIntegrationActive(!integrationActive)}
                                            className={`w-11 h-6 flex items-center rounded-full transition-colors ${integrationActive ? 'bg-accent-primary' : 'bg-bg-tertiary border border-border-secondary'}`}
                                        >
                                            <div className={`w-4 h-4 rounded-full bg-white shadow transform transition-transform ${integrationActive ? 'translate-x-6' : 'translate-x-1'}`} />
                                        </button>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-text-secondary mb-1">
                                            API Key (Asaas)
                                        </label>
                                        <div className="relative">
                                            <input
                                                type={showKey ? "text" : "password"}
                                                value={apiKey}
                                                onChange={e => setApiKey(e.target.value)}
                                                className="w-full bg-bg-tertiary border border-border-secondary rounded px-3 py-2 text-text-primary focus:border-accent-primary focus:outline-none pr-10 text-sm"
                                                placeholder="$$..."
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowKey(!showKey)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
                                            >
                                                <Icon name={showKey ? "EyeOff" : "Eye"} className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-text-tertiary mt-1">
                                            Chave de API do ambiente (Produção ou Sandbox).
                                        </p>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-text-secondary mb-1">
                                            Wallet ID (Opcional)
                                        </label>
                                        <input
                                            type="text"
                                            value={walletId}
                                            onChange={e => setWalletId(e.target.value)}
                                            className="w-full bg-bg-tertiary border border-border-secondary rounded px-3 py-2 text-text-primary focus:border-accent-primary focus:outline-none text-sm"
                                            placeholder="Ex: 66a6a..."
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-text-secondary mb-1">
                                            Webhook URL
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                readOnly
                                                value={webhookUrl}
                                                className="w-full bg-bg-primary/50 border border-border-secondary rounded px-3 py-2 text-text-secondary text-xs font-mono"
                                            />
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(webhookUrl);
                                                    alert('Copiado!');
                                                }}
                                                className="p-2 border border-border-secondary rounded hover:bg-bg-tertiary text-text-secondary"
                                                title="Copiar"
                                            >
                                                <Icon name="Copy" className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-text-tertiary mt-1">
                                            Configure esta URL no painel do Asaas para receber atualizações automáticas.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Conteúdo Aba Mensagens */}
                            {activeTab === 'messages' && (
                                <div className="space-y-4 animate-fade-in">
                                    <div>
                                        <label className="block text-xs font-medium text-text-secondary mb-1">
                                            Mensagem Padrão de Cobrança
                                        </label>
                                        <p className="text-[10px] text-text-secondary mb-2">
                                            Esta mensagem será pré-carregada ao enviar cobranças por WhatsApp ou outros canais.
                                        </p>
                                        <textarea
                                            value={msgCobrar}
                                            onChange={e => setMsgCobrar(e.target.value)}
                                            className="w-full h-32 bg-bg-tertiary border border-border-secondary rounded px-3 py-2 text-text-primary focus:border-accent-primary focus:outline-none resize-none text-sm"
                                            placeholder="Olá, segue seu link de pagamento..."
                                        />
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className="p-4 border-t border-border-secondary flex justify-end gap-2 bg-bg-secondary">
                    <button onClick={onClose} className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary">Cancelar</button>
                    <button
                        onClick={handleSave}
                        disabled={saving || loading}
                        className="px-3 py-1.5 text-sm bg-accent-primary text-white rounded hover:bg-accent-primary/90 disabled:opacity-50 min-w-[80px]"
                    >
                        {saving ? 'Salvando...' : 'Salvar'}
                    </button>
                </div>
            </div>
        </div>
    );
};
