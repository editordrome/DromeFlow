import { supabase } from '../supabaseClient';
import { 
  ProductionColumn, 
  ProductionColumnTemplate, 
  ProductionCard, 
  ProductionCardProgress 
} from '../../types';

// ============================================================================
// Columns & Templates
// ============================================================================

export const fetchProductionColumns = async (): Promise<ProductionColumn[]> => {
  const { data, error } = await supabase
    .from('production_columns')
    .select('*, templates:production_column_templates(*)')
    .order('position', { ascending: true });

  if (error) throw error;
  
  // Ordenar os templates dentro de cada coluna localmente por posição
  return (data || []).map(col => ({
    ...col,
    templates: col.templates?.sort((a: any, b: any) => a.position - b.position) || []
  }));
};

export const createProductionColumn = async (name: string, position: number): Promise<ProductionColumn> => {
  const { data, error } = await supabase
    .from('production_columns')
    .insert([{ name, position, is_fixed: false }])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateProductionColumn = async (id: string, payload: Partial<ProductionColumn>): Promise<void> => {
  const { error } = await supabase
    .from('production_columns')
    .update(payload)
    .eq('id', id);

  if (error) throw error;
};

export const deleteProductionColumn = async (id: string): Promise<void> => {
  // Nota: Cascade cuidará dos templates vinculados
  const { error } = await supabase
    .from('production_columns')
    .delete()
    .eq('id', id);

  if (error) throw error;
};

// ============================================================================
// Column Item Templates
// ============================================================================

export const createColumnTemplate = async (columnId: string, title: string, position: number): Promise<ProductionColumnTemplate> => {
  const { data, error } = await supabase
    .from('production_column_templates')
    .insert([{ column_id: columnId, title, position }])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateColumnTemplate = async (id: string, title: string): Promise<void> => {
  const { error } = await supabase
    .from('production_column_templates')
    .update({ title })
    .eq('id', id);

  if (error) throw error;
};

export const deleteColumnTemplate = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('production_column_templates')
    .delete()
    .eq('id', id);

  if (error) throw error;
};

// ============================================================================
// Cards
// ============================================================================

export const fetchProductionCards = async (): Promise<ProductionCard[]> => {
  const { data, error } = await supabase
    .from('production_cards')
    .select(`
      *,
      unit:units(id, unit_name),
      progress:production_card_progress(*)
    `)
    .order('position', { ascending: true });

  if (error) throw error;
  return data || [];
};

export const createProductionCard = async (unitId: string, columnId: string, position: number): Promise<ProductionCard> => {
  const { data, error } = await supabase
    .from('production_cards')
    .insert([{ unit_id: unitId, current_column_id: columnId, position }])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateProductionCard = async (id: string, payload: Partial<ProductionCard>): Promise<void> => {
  const { error } = await supabase
    .from('production_cards')
    .update(payload)
    .eq('id', id);

  if (error) throw error;
};

export const deleteProductionCard = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('production_cards')
    .delete()
    .eq('id', id);

  if (error) throw error;
};

// ============================================================================
// Progress Tracking
// ============================================================================

export const toggleCheckpoint = async (
  cardId: string, 
  templateItemId: string, 
  columnId: string, 
  isCompleted: boolean
): Promise<void> => {
  const { error } = await supabase
    .from('production_card_progress')
    .upsert({
      card_id: cardId,
      template_item_id: templateItemId,
      column_id: columnId,
      is_completed: isCompleted,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'card_id,template_item_id'
    });

  if (error) throw error;
};

export const fetchCardProgress = async (cardId: string): Promise<ProductionCardProgress[]> => {
  const { data, error } = await supabase
    .from('production_card_progress')
    .select('*')
    .eq('card_id', cardId);

  if (error) throw error;
  return data || [];
};
