import React, { useEffect, useState } from 'react';
import { supabase } from '../../services/supabaseClient';
import { Icon } from './Icon';

interface Integration {
    id: string;
    provider: string;
    api_key: string;
    is_active: boolean;
    wallet_id?: string;
}

interface Props {
    unitId: string;
}

export const UnitIntegrationsManager: React.FC<Props> = ({ unitId }) => {
    const [loading, setLoading] = useState(false);
    const [integrations, setIntegrations] = useState<Integration[]>([]);
    const [asaasKey, setAsaasKey] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const fetchIntegrations = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('unit_integrations')
                .select('*')
                .eq('unit_id', unitId);

            if (error) throw error;
            setIntegrations(data || []);

            const asaas = data?.find(i => i.provider === 'asaas');
            if (asaas) {
                setAsaasKey(asaas.api_key);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchIntegrations();
    }, [unitId]);

    const handleSaveAsaas = async () => {
        setSaving(true);
        setError(null);
        try {
            // Check if exists
            const existing = integrations.find(i => i.provider === 'asaas');

            const payload = {
                unit_id: unitId,
                provider: 'asaas',
                api_key: asaasKey,
                is_active: true,
                webhook_token: crypto.randomUUID(), // Generate a token for webhook validation
                updated_at: new Date().toISOString()
            };

            if (existing) {
                const { error } = await supabase
                    .from('unit_integrations')
                    .update(payload)
                    .eq('id', existing.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('unit_integrations')
                    .insert(payload);
                if (error) throw error;
            }

            await fetchIntegrations();
            alert('Integração Asaas salva com sucesso!');

        } catch (err: any) {
            setError(err.message || 'Erro ao salvar integração');
        } finally {
            setSaving(false);
        }
    };

    // Webhook URL generator
    const getWebhookUrl = () => {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        // Handle potential trailing slash
        const baseUrl = supabaseUrl.endsWith('/') ? supabaseUrl.slice(0, -1) : supabaseUrl;
        return `${baseUrl}/functions/v1/asaas-webhook?unit_id=${unitId}`;
    };

    return (
        <div className="space-y-6">
            <div className="border border-border-secondary rounded-lg p-5 bg-bg-secondary">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                            {/* Asaas Logo Placeholder or generic Icon */}
                            <Icon name="credit-card" className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-medium text-text-primary">Asaas</h3>
                            <p className="text-xs text-text-secondary">Gestão financeira, cobranças e notas fiscais.</p>
                        </div>
                    </div>
                    <div>
                        {integrations.find(i => i.provider === 'asaas')?.is_active ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Ativo
                            </span>
                        ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                Não Configurado
                            </span>
                        )}
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">API Key (Produção/Sandbox)</label>
                        <input
                            type="text"
                            value={asaasKey}
                            onChange={(e) => setAsaasKey(e.target.value)}
                            placeholder="$aact_..."
                            className="w-full px-3 py-2 border rounded-md bg-bg-tertiary border-border-secondary focus:ring-accent-primary focus:border-accent-primary font-mono text-sm"
                        />
                        <p className="text-xs text-text-tertiary mt-1">
                            Obtenha sua chave no painel do Asaas em Configurações &gt; Integração.
                        </p>
                    </div>

                    <div className="bg-bg-tertiary p-3 rounded-md border border-border-secondary">
                        <h4 className="text-xs font-bold text-text-secondary uppercase mb-2">Configuração de Webhook</h4>
                        <p className="text-xs text-text-secondary mb-2">
                            Para receber atualizações automáticas, configure este URL no seu painel Asaas:
                        </p>
                        <div className="flex items-center gap-2">
                            <code className="flex-1 bg-bg-primary px-2 py-1.5 rounded text-xs font-mono border border-border-primary overflow-x-auto whitespace-nowrap">
                                {getWebhookUrl()}
                            </code>
                            <button
                                onClick={() => navigator.clipboard.writeText(getWebhookUrl())}
                                className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-bg-primary rounded"
                                title="Copiar URL"
                            >
                                <Icon name="copy" className="w-4 h-4" />
                            </button>
                        </div>
                        {integrations.find(i => i.provider === 'asaas')?.webhook_token && (
                            <div className="mt-2 text-xs text-text-secondary">
                                <strong>Token de Autenticação (Header `asaas-access-token`):</strong>
                                <br />
                                <code className="bg-bg-primary px-1 py-0.5 rounded">{integrations.find(i => i.provider === 'asaas')?.webhook_token}</code>
                            </div>
                        )}
                    </div>

                    {error && <div className="text-sm text-danger">{error}</div>}

                    <div className="flex justify-end pt-2">
                        <button
                            onClick={handleSaveAsaas}
                            disabled={saving || loading}
                            className="px-4 py-2 bg-accent-primary text-white rounded-md hover:bg-accent-secondary disabled:opacity-50 transition-colors flex items-center gap-2"
                        >
                            {saving ? 'Salvando...' : 'Salvar Integração'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
