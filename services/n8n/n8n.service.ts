import { supabase } from '../supabaseClient';

const N8N_URL = 'https://n8n.paineldromedario.top/api/v1/';

export interface N8NExecution {
    id: string;
    workflowId: string;
    workflowName?: string;
    status: 'success' | 'error' | 'waiting' | 'running' | 'new';
    startedAt: string;
    stoppedAt?: string;
    mode: string;
    retryOf?: string;
    retrySuccessId?: string;
}

export interface N8NWorkflow {
    id: string;
    name: string;
    active: boolean;
    createdAt: string;
    updatedAt: string;
}

/**
 * Busca a API Key do n8n armazenada em access_credentials
 */
async function getN8NApiKey(): Promise<string | null> {
    try {
        const { data, error } = await supabase
            .from('access_credentials')
            .select('value')
            .eq('name', 'n8n')
            .single();

        if (error) {
            console.error('[N8N Service] Erro ao buscar API Key:', error);
            return null;
        }

        return data?.value || null;
    } catch (err) {
        console.error('[N8N Service] Falha ao buscar credenciais:', err);
        return null;
    }
}

/**
 * Realiza chamadas para a API do n8n
 */
async function n8nFetch(endpoint: string, options: RequestInit = {}): Promise<any> {
    const apiKey = await getN8NApiKey();
    if (!apiKey) throw new Error('API Key do n8n não encontrada nas credenciais.');

    const response = await fetch(`${N8N_URL}${endpoint}`, {
        ...options,
        headers: {
            ...options.headers,
            'X-N8N-API-KEY': apiKey,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[N8N API] Erro ${response.status}:`, errorBody);
        throw new Error(`N8N API error: ${response.status}`);
    }

    return response.json();
}

export const n8nService = {
    /**
     * Lista as últimas execuções
     */
    async getExecutions(limit = 100, cursor?: string): Promise<{ data: N8NExecution[], nextCursor?: string }> {
        let endpoint = `/executions?limit=${limit}`;
        if (cursor) endpoint += `&cursor=${cursor}`;

        const result = await n8nFetch(endpoint);
        return {
            data: result.data || [],
            nextCursor: result.nextCursor
        };
    },

    /**
     * Lista todos os workflows
     */
    async getWorkflows(): Promise<N8NWorkflow[]> {
        const result = await n8nFetch('/workflows');
        return result.data || [];
    },

    /**
     * Busca estatísticas de execução
     * Nota: Verifique se o endpoint existe na versão da API usada
     */
    async getStats(): Promise<any> {
        try {
            // n8n API might not have a direct global stats endpoint in all versions
            // so we might need to calculate from executions or use specific endpoints
            return await n8nFetch('/stats/executions');
        } catch (e) {
            return null;
        }
    }
};
