import { supabase } from '../supabaseClient';
import type { RecrutadoraCard, RecrutadoraColumn } from '../../types';

export const DEFAULT_COLUMNS: Array<Pick<RecrutadoraColumn, 'code' | 'name' | 'color'>> = [
  { code: 'qualificadas', name: 'QUALIFICADAS', color: null },
  { code: 'contato', name: 'CONTATO', color: null },
  { code: 'envio_doc', name: 'ENVIO DOS DOCUMENTOS', color: null },
  { code: 'truora', name: 'TRUORA', color: null },
  { code: 'treinamento', name: 'TREINAMENTO', color: null },
  { code: 'finalizado', name: 'FINALIZADO', color: null },
  { code: 'nao_aprovadas', name: 'NÃO APROVADAS', color: null },
  { code: 'desistentes', name: 'DESISTENTES', color: null },
];

export const fetchColumns = async (unitId: string): Promise<RecrutadoraColumn[]> => {
  const { data, error } = await supabase
    .from('recrutadora_columns')
    .select('*')
    .eq('unit_id', unitId)
    .eq('is_active', true)
    .order('position', { ascending: true });
  if (error) throw error;
  return data || [];
};

export const ensureDefaultColumnsForUnit = async (unitId: string, unitName?: string): Promise<void> => {
  const existing = await fetchColumns(unitId);
  if (existing.length > 0) return;
  const rows = DEFAULT_COLUMNS.map((c, idx) => ({
    unit_id: unitId,
    unidade: unitName || null,
    code: c.code,
    name: c.name,
    color: c.color,
    position: idx + 1,
    is_active: true,
  }));
  const { error } = await supabase.from('recrutadora_columns').upsert(rows, { onConflict: 'unit_id,code' } as any);
  if (error) throw error;
};

export const fetchCards = async (unitId: string): Promise<RecrutadoraCard[]> => {
  const { data, error } = await supabase
    .from('recrutadora')
    .select('id, created_at, unit_id, unidade, status, position, nome, whatsapp, color_card')
    .eq('unit_id', unitId)
    .order('status', { ascending: true })
    .order('position', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const createCard = async (payload: Partial<RecrutadoraCard>) => {
  const { error } = await supabase.from('recrutadora').insert(payload);
  if (error) throw error;
};

export const updateCard = async (id: number, payload: Partial<RecrutadoraCard>) => {
  const { error } = await supabase.from('recrutadora').update(payload).eq('id', id);
  if (error) throw error;
};

export const deleteCard = async (id: number) => {
  const { error } = await supabase.from('recrutadora').delete().eq('id', id);
  if (error) throw error;
};

export const moveCard = async (callerId: string, cardId: number, newStatus: string, newPosition: number) => {
  const { error } = await supabase.rpc('move_recrutadora_card', {
    caller_id: callerId,
    p_card_id: cardId,
    p_new_status: newStatus,
    p_new_position: newPosition,
  });
  if (error) throw error;
};
