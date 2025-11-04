/**
 * Evolution Instances Service
 * 
 * Serviço para gerenciamento local de instâncias Evolution no Supabase.
 * Faz o CRUD das instâncias e orquestra chamadas à Evolution API.
 */

import { supabase } from '../supabaseClient';
import type {
  EvolutionInstance,
  CreateEvolutionInstanceData,
  UpdateEvolutionInstanceData,
  EvolutionStats,
} from '../../types';
import {
  createEvolutionApiInstance,
  getEvolutionQRCode,
  checkEvolutionConnectionState,
  logoutEvolutionInstance,
  deleteEvolutionApiInstance,
  validateEvolutionApiCredentials,
} from './evolutionApi.service';

/**
 * Busca todas as instâncias (com filtro opcional por unidade)
 */
export async function fetchInstances(unitId?: string): Promise<EvolutionInstance[]> {
  let query = supabase
    .from('evolution_instances')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (unitId) {
    query = query.eq('unit_id', unitId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Erro ao buscar instâncias:', error);
    throw new Error(error.message);
  }

  return (data || []) as EvolutionInstance[];
}

/**
 * Busca uma instância específica por ID
 */
export async function fetchInstanceById(id: string): Promise<EvolutionInstance | null> {
  const { data, error } = await supabase
    .from('evolution_instances')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Erro ao buscar instância:', error);
    throw new Error(error.message);
  }

  return data as EvolutionInstance;
}

/**
 * Cria uma nova instância localmente E na Evolution API
 */
export async function createInstance(
  instanceData: CreateEvolutionInstanceData
): Promise<EvolutionInstance> {
  const apiUrl = instanceData.api_url || 'https://api.evolution-api.com';

  // 1. Validar credenciais antes de criar
  const validation = await validateEvolutionApiCredentials(apiUrl, instanceData.api_key);
  if (!validation.valid) {
    throw new Error(validation.error || 'Credenciais inválidas');
  }

  // 2. Criar instância na Evolution API
  try {
    const apiResponse = await createEvolutionApiInstance(
      apiUrl,
      instanceData.api_key,
      instanceData.instance_name,
      instanceData.webhook_url,
      instanceData.webhook_events
    );

    // 3. Salvar no banco local
    const dbPayload = {
      unit_id: instanceData.unit_id,
      instance_name: instanceData.instance_name,
      display_name: instanceData.display_name || instanceData.instance_name,
      api_url: apiUrl,
      api_key: instanceData.api_key,
      webhook_url: instanceData.webhook_url || null,
      webhook_events: instanceData.webhook_events || null,
      status: 'disconnected' as const,
      qr_code: apiResponse.qrcode?.base64 || null,
      is_active: true,
    };

    const { data, error } = await supabase
      .from('evolution_instances')
      .insert(dbPayload)
      .select()
      .single();

    if (error) {
      console.error('Erro ao salvar instância no banco:', error);
      throw new Error(error.message);
    }

    return data as EvolutionInstance;
  } catch (error: any) {
    console.error('Erro ao criar instância na Evolution API:', error);
    throw new Error(`Falha ao criar instância: ${error.message}`);
  }
}

/**
 * Atualiza uma instância existente
 */
export async function updateInstance(
  id: string,
  updates: UpdateEvolutionInstanceData
): Promise<void> {
  const { error } = await supabase
    .from('evolution_instances')
    .update(updates)
    .eq('id', id);

  if (error) {
    console.error('Erro ao atualizar instância:', error);
    throw new Error(error.message);
  }
}

/**
 * Exclui uma instância (soft delete local + hard delete na Evolution API)
 */
export async function deleteInstance(id: string): Promise<void> {
  // 1. Buscar instância para obter credenciais
  const instance = await fetchInstanceById(id);
  if (!instance) {
    throw new Error('Instância não encontrada');
  }

  // 2. Tentar excluir da Evolution API (não bloqueia se falhar)
  try {
    await deleteEvolutionApiInstance(
      instance.api_url,
      instance.api_key,
      instance.instance_name
    );
  } catch (error) {
    console.warn('Não foi possível excluir da Evolution API:', error);
  }

  // 3. Soft delete no banco local
  const { error } = await supabase
    .from('evolution_instances')
    .update({ is_active: false })
    .eq('id', id);

  if (error) {
    console.error('Erro ao excluir instância:', error);
    throw new Error(error.message);
  }
}

/**
 * Conecta uma instância (obtém QR Code)
 */
export async function connectInstance(id: string): Promise<string> {
  const instance = await fetchInstanceById(id);
  if (!instance) {
    throw new Error('Instância não encontrada');
  }

  try {
    // 1. Obter QR Code da Evolution API
    const qrData = await getEvolutionQRCode(
      instance.api_url,
      instance.api_key,
      instance.instance_name
    );

    // 2. Atualizar status e QR Code no banco
    await updateInstance(id, {
      status: 'connecting',
      qr_code: qrData.base64,
      error_message: null,
    });

    return qrData.base64;
  } catch (error: any) {
    console.error('Erro ao conectar instância:', error);
    
    // Atualizar status de erro
    await updateInstance(id, {
      status: 'error',
      error_message: error.message || 'Erro ao obter QR Code',
    });

    throw error;
  }
}

/**
 * Desconecta uma instância (logout)
 */
export async function disconnectInstance(id: string): Promise<void> {
  const instance = await fetchInstanceById(id);
  if (!instance) {
    throw new Error('Instância não encontrada');
  }

  try {
    // 1. Fazer logout na Evolution API
    await logoutEvolutionInstance(
      instance.api_url,
      instance.api_key,
      instance.instance_name
    );

    // 2. Atualizar status no banco
    await updateInstance(id, {
      status: 'disconnected',
      qr_code: null,
      phone_number: null,
      profile_name: null,
      disconnected_at: new Date().toISOString(),
      error_message: null,
    });
  } catch (error: any) {
    console.error('Erro ao desconectar instância:', error);
    
    await updateInstance(id, {
      status: 'error',
      error_message: error.message || 'Erro ao desconectar',
    });

    throw error;
  }
}

/**
 * Sincroniza o status de uma instância com a Evolution API
 */
export async function syncInstanceStatus(id: string): Promise<void> {
  const instance = await fetchInstanceById(id);
  if (!instance) {
    throw new Error('Instância não encontrada');
  }

  try {
    const stateData = await checkEvolutionConnectionState(
      instance.api_url,
      instance.api_key,
      instance.instance_name
    );

    const updates: UpdateEvolutionInstanceData = {
      last_sync: new Date().toISOString(),
    };

    // Mapear estado da Evolution API para nosso status
    if (stateData.instance.state === 'open') {
      updates.status = 'connected';
      updates.qr_code = null; // Limpar QR Code quando conectado
      if (!instance.connected_at) {
        updates.connected_at = new Date().toISOString();
      }
    } else if (stateData.instance.state === 'close') {
      updates.status = 'disconnected';
      updates.qr_code = null;
    } else if (stateData.instance.state === 'connecting') {
      updates.status = 'connecting';
    }

    await updateInstance(id, updates);
  } catch (error: any) {
    console.error('Erro ao sincronizar status:', error);
    
    await updateInstance(id, {
      status: 'error',
      error_message: error.message || 'Erro ao sincronizar',
      last_sync: new Date().toISOString(),
    });
  }
}

/**
 * Sincroniza todas as instâncias ativas
 */
export async function syncAllInstances(): Promise<void> {
  const instances = await fetchInstances();
  
  await Promise.allSettled(
    instances.map(instance => syncInstanceStatus(instance.id))
  );
}

/**
 * Calcula estatísticas das instâncias
 */
export async function getInstanceStats(unitId?: string): Promise<EvolutionStats> {
  const instances = await fetchInstances(unitId);

  const stats: EvolutionStats = {
    total: instances.length,
    connected: instances.filter(i => i.status === 'connected').length,
    disconnected: instances.filter(i => i.status === 'disconnected').length,
    connecting: instances.filter(i => i.status === 'connecting').length,
    error: instances.filter(i => i.status === 'error').length,
  };

  return stats;
}
