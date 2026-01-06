import { supabase } from '../supabaseClient';
import { UnitClient } from '../../types';

export async function listUnitClients(unitId: string, q?: string, page: number = 1, pageSize: number = 20): Promise<{ items: UnitClient[]; total: number }> {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  let query = supabase
    .from('unit_clients')
    .select('*', { count: 'exact' })
    .eq('unit_id', unitId)
    .order('nome', { ascending: true })
    .range(from, to);
  if (q && q.trim()) {
    // Busca simples por nome (case-insensitive) usando ilike
    query = query.ilike('nome', `%${q.trim()}%`);
  }
  const { data, error, count } = await query;
  if (error) throw error;
  return { items: (data || []) as UnitClient[], total: count || 0 };
}

export async function createUnitClient(unitId: string, payload: Omit<UnitClient, 'id' | 'unit_id'>): Promise<UnitClient> {
  const insert = { ...payload, unit_id: unitId } as any;
  // 1. Insert local
  const { data, error } = await supabase.from('unit_clients').insert(insert).select('*').single();
  if (error) throw error;

  let result = data as UnitClient;

  // 2. Sync to Asaas (Fire and Forget or Await? Better await to show error if fails)
  try {
    const { data: asaasCustomer, error: asaasError } = await supabase.functions.invoke('asaas-api', {
      body: {
        action: 'upsert_customer',
        unit_id: unitId,
        data: result
      }
    });

    if (asaasError) {
      console.error('Failed to sync client to Asaas:', asaasError);
      // We don't rollback local creation, but maybe warn user?
    } else if (asaasCustomer && asaasCustomer.id) {
      // 3. Update local with asaas_id
      const { data: updated, error: updateError } = await supabase
        .from('unit_clients')
        .update({ asaas_id: asaasCustomer.id })
        .eq('id', result.id)
        .select('*')
        .single();

      if (!updateError && updated) {
        result = updated as UnitClient;
      }
    }
  } catch (err) {
    console.error('Error calling asaas-api:', err);
  }

  return result;
}

export async function updateUnitClient(id: string, payload: Partial<UnitClient>): Promise<UnitClient> {
  // 1. Get current data (need unit_id and asaas_id)
  const { data: current, error: fetchError } = await supabase
    .from('unit_clients')
    .select('unit_id, asaas_id')
    .eq('id', id)
    .single();

  const update = { ...payload } as any;
  delete update.id;
  delete update.unit_id;

  // 2. Update local
  const { data, error } = await supabase.from('unit_clients').update(update).eq('id', id).select('*').single();
  if (error) throw error;

  let result = data as UnitClient;

  // 3. Sync to Asaas
  if (current && current.unit_id) {
    try {
      const asaasPayload = { ...result, asaas_id: current.asaas_id || result.asaas_id };

      const { data: asaasCustomer, error: asaasError } = await supabase.functions.invoke('asaas-api', {
        body: {
          action: 'upsert_customer',
          unit_id: current.unit_id,
          data: asaasPayload
        }
      });

      // If we didn't have an asaas_id but now we do (created in Asaas implicitly by upsert logic if we handled it that way)
      if (!current.asaas_id && asaasCustomer && asaasCustomer.id) {
        await supabase.from('unit_clients').update({ asaas_id: asaasCustomer.id }).eq('id', id);
        result.asaas_id = asaasCustomer.id;
      }
    } catch (err) {
      console.error('Error syncing update to Asaas:', err);
    }
  }

  return result;
}

export async function deleteUnitClient(id: string): Promise<void> {
  const { error } = await supabase.from('unit_clients').delete().eq('id', id);
  if (error) throw error;
}

export async function syncUnitClientsFromProcessed(unitCode: string): Promise<number> {
  const { data, error } = await supabase.rpc('sync_unit_clients_from_processed', { unit_code_arg: unitCode });
  if (error) throw error;
  return (data as number) || 0;
}

export async function getUnitClientByName(unitId: string, name: string): Promise<UnitClient | null> {
  if (!unitId || !name) return null;
  // Tenta match tolerante por nome usando ilike
  const { data, error } = await supabase
    .from('unit_clients')
    .select('*')
    .eq('unit_id', unitId)
    .ilike('nome', `%${name}%`)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return (data as UnitClient) || null;
}

/**
 * Atualiza o nome do cliente em todos os atendimentos vinculados
 * @param unitCode - Código da unidade
 * @param oldName - Nome antigo do cliente
 * @param newName - Novo nome do cliente
 * @returns Número de registros atualizados
 */
export async function updateClientNameInAppointments(
  unitCode: string,
  oldName: string,
  newName: string
): Promise<number> {
  if (!unitCode || !oldName || !newName || oldName === newName) return 0;

  const { data, error } = await supabase
    .from('processed_data')
    .update({ CLIENTE: newName })
    .eq('unidade_code', unitCode)
    .eq('CLIENTE', oldName)
    .select('id');

  if (error) {
    console.error('Error updating client name in appointments:', error);
    throw error;
  }

  return (data?.length || 0);
}

export async function fetchVerifiedClients(unitId: string): Promise<Set<string>> {
  if (!unitId) return new Set();

  const { data, error } = await supabase
    .from('unit_clients')
    .select('nome')
    .eq('unit_id', unitId)
    .eq('is_verified', true);

  if (error) {
    console.error('[fetchVerifiedClients] Error:', error);
    return new Set();
  }

  console.log('[fetchVerifiedClients] Clientes verificados carregados:', data);
  return new Set((data || []).map(c => c.nome));
}
