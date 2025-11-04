/**
 * Serviço para gerenciar configurações globais da Evolution API
 * Armazena credenciais do servidor Evolution em unit_keys
 */

import { supabase } from '../supabaseClient';

export interface EvolutionConfig {
  api_url: string;
  api_key: string;
  global_webhook_url?: string;
}

const EVOLUTION_CONFIG_KEY = 'evolution_api_config';

/**
 * Busca configuração da Evolution API para uma unidade
 */
export async function fetchEvolutionConfig(unitId: string): Promise<EvolutionConfig | null> {
  try {
    const { data, error } = await supabase
      .from('unit_keys')
      .select('*')
      .eq('unit_id', unitId)
      .eq('is_active', true)
      .single();

    if (error) {
      console.error('Erro ao buscar configuração Evolution:', error);
      return null;
    }

    if (!data) return null;

    // Busca configuração no campo metadata ou em campos específicos
    const config: EvolutionConfig = {
      api_url: data.evolution_api_url || 'https://api.evolution-api.com',
      api_key: data.evolution_api_key || '',
      global_webhook_url: data.evolution_webhook_url || '',
    };

    return config;
  } catch (error) {
    console.error('Erro ao buscar configuração:', error);
    return null;
  }
}

/**
 * Salva configuração da Evolution API para uma unidade
 */
export async function saveEvolutionConfig(
  unitId: string,
  config: EvolutionConfig
): Promise<void> {
  try {
    // Busca registro existente
    const { data: existing } = await supabase
      .from('unit_keys')
      .select('id')
      .eq('unit_id', unitId)
      .single();

    const payload = {
      evolution_api_url: config.api_url,
      evolution_api_key: config.api_key,
      evolution_webhook_url: config.global_webhook_url || null,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      // Atualiza registro existente
      const { error } = await supabase
        .from('unit_keys')
        .update(payload)
        .eq('id', existing.id);

      if (error) throw error;
    } else {
      // Cria novo registro
      const { error } = await supabase
        .from('unit_keys')
        .insert({
          unit_id: unitId,
          is_active: true,
          ...payload,
        });

      if (error) throw error;
    }
  } catch (error: any) {
    console.error('Erro ao salvar configuração:', error);
    throw new Error(error.message || 'Erro ao salvar configuração');
  }
}

/**
 * Valida se as credenciais da Evolution API estão funcionando
 */
export async function validateEvolutionConfig(config: EvolutionConfig): Promise<{
  valid: boolean;
  error?: string;
}> {
  try {
    const url = `${config.api_url}/instance/fetchInstances`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': config.api_key,
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return {
        valid: false,
        error: `HTTP ${response.status}: ${text || response.statusText}`,
      };
    }

    return { valid: true };
  } catch (error: any) {
    return {
      valid: false,
      error: error.message || 'Erro ao conectar com a Evolution API',
    };
  }
}

/**
 * Testa conexão com a Evolution API
 */
export async function testEvolutionConnection(
  apiUrl: string,
  apiKey: string
): Promise<{ success: boolean; message: string; instancesCount?: number }> {
  try {
    const url = `${apiUrl}/instance/fetchInstances`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': apiKey,
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return {
        success: false,
        message: `Falha na conexão: HTTP ${response.status} - ${text || response.statusText}`,
      };
    }

    const data = await response.json();
    const instancesCount = Array.isArray(data) ? data.length : 0;

    return {
      success: true,
      message: `Conexão estabelecida! ${instancesCount} instância(s) encontrada(s).`,
      instancesCount,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Erro: ${error.message || 'Não foi possível conectar ao servidor Evolution'}`,
    };
  }
}
