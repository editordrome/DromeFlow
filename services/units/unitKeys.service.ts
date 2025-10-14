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
  // Monta o corpo dinamicamente: envia apenas as chaves presentes no payload
  const dynamic: Record<string, any> = {};
  Object.entries(payload || {}).forEach(([k, v]) => {
    if (v !== undefined) dynamic[k] = v;
  });
  const body = {
    unit_id: unitId,
    is_active: payload?.is_active ?? true,
    ...dynamic,
  } as any;
  const { data, error } = await supabase
    .from('unit_keys')
    .insert(body as any)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as UnitKey;
}

export async function updateUnitKey(id: string, payload: Partial<UnitKey>) {
  const body: Record<string, any> = {};
  Object.entries(payload || {}).forEach(([k, v]) => {
    if (v !== undefined) body[k] = v;
  });
  if (Object.keys(body).length === 0) return;
  const { error } = await supabase.from('unit_keys').update(body).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteUnitKey(id: string) {
  const { error } = await supabase.from('unit_keys').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
