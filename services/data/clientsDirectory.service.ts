import { supabase } from '../supabaseClient';
import { UnitClient } from '../../types';

export async function listUnitClients(unitId: string, q?: string): Promise<UnitClient[]> {
  let query = supabase
    .from('unit_clients')
    .select('*')
    .eq('unit_id', unitId)
    .order('nome', { ascending: true });
  if (q && q.trim()) {
    // Busca simples por nome (case-insensitive) usando ilike
    query = query.ilike('nome', `%${q.trim()}%`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as UnitClient[];
}

export async function createUnitClient(unitId: string, payload: Omit<UnitClient, 'id' | 'unit_id'>): Promise<UnitClient> {
  const insert = { ...payload, unit_id: unitId } as any;
  const { data, error } = await supabase.from('unit_clients').insert(insert).select('*').single();
  if (error) throw error;
  return data as UnitClient;
}

export async function updateUnitClient(id: string, payload: Partial<UnitClient>): Promise<UnitClient> {
  const update = { ...payload } as any;
  delete update.id;
  delete update.unit_id;
  const { data, error } = await supabase.from('unit_clients').update(update).eq('id', id).select('*').single();
  if (error) throw error;
  return data as UnitClient;
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
