import { supabase } from '../supabaseClient';
import type { UnitKey } from '../../types';

// Configuração única por unidade. Retorna null se não existir.
export async function fetchUnitKeys(unitId: string): Promise<UnitKey[]> {
  const { data, error } = await supabase
    .from('unit_keys')
    .select('*')
    .eq('unit_id', unitId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []) as UnitKey[];
}

export async function createUnitKey(unitId: string, payload: Partial<UnitKey>): Promise<UnitKey> {
  const body: Partial<UnitKey> & { unit_id: string } = {
    unit_id: unitId,
    umbler: payload.umbler ?? null,
    whats_profi: payload.whats_profi ?? null,
    whats_client: payload.whats_client ?? null,
    botID: payload.botID ?? null,
    organizationID: payload.organizationID ?? null,
    trigger: payload.trigger ?? null,
    description: payload.description ?? null,
    is_active: payload.is_active ?? true,
  };
  const { data, error } = await supabase
    .from('unit_keys')
    .insert(body as any)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as UnitKey;
}

export async function updateUnitKey(id: string, payload: Partial<UnitKey>) {
  const body: any = {};
  if (payload.umbler !== undefined) body.umbler = payload.umbler;
  if (payload.whats_profi !== undefined) body.whats_profi = payload.whats_profi;
  if (payload.whats_client !== undefined) body.whats_client = payload.whats_client;
  if (payload.botID !== undefined) body.botID = payload.botID;
  if (payload.organizationID !== undefined) body.organizationID = payload.organizationID;
  if (payload.trigger !== undefined) body.trigger = payload.trigger;
  if (payload.description !== undefined) body.description = payload.description;
  if (payload.is_active !== undefined) body.is_active = payload.is_active;
  const { error } = await supabase.from('unit_keys').update(body).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteUnitKey(id: string) {
  const { error } = await supabase.from('unit_keys').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
