import { supabase } from '../supabaseClient';
import { Profile, Unit } from '../../types';

export interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: boolean;
  column_default: string | null;
  ordinal_position: number;
}

export interface ColumnStats {
  column_name: string;
  usage_count: number;
  active_count: number;
}

export const listUnitKeysColumns = async (includeSystem = false): Promise<ColumnInfo[]> => {
  const { data, error } = await supabase.rpc('unit_keys_list_columns', { p_include_system: includeSystem });
  if (error) throw new Error(error.message);
  return data as ColumnInfo[];
};

export const addUnitKeysColumn = async (
  callerProfile: Profile,
  columnName: string,
  dataType: string,
  nullable = true,
  defaultExpr: string | null = null
): Promise<void> => {
  const { error } = await supabase.rpc('unit_keys_add_column', {
    p_caller_id: callerProfile.id,
    p_column_name: columnName,
    p_data_type: dataType,
    p_nullable: nullable,
    p_default: defaultExpr,
  });
  if (error) throw new Error(error.message);
};

export const getUnitKeysColumnsStats = async (includeSystem = false): Promise<ColumnStats[]> => {
  const { data, error } = await supabase.rpc('unit_keys_columns_stats', { p_include_system: includeSystem });
  if (error) throw new Error(error.message);
  return data as ColumnStats[];
};

export const setUnitKeysColumnStatus = async (
  callerProfile: Profile,
  columnName: string,
  active: boolean
): Promise<void> => {
  const { error } = await supabase.rpc('unit_keys_set_column_status', {
    p_caller_id: callerProfile.id,
    p_column_name: columnName,
    p_active: active,
  });
  if (error) throw new Error(error.message);
};

export const fetchUnitsBasic = async (): Promise<Unit[]> => {
  const { data, error } = await supabase
    .from('units')
    .select('id, unit_name, unit_code')
    .order('unit_name', { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []) as Unit[];
};

export interface UnitKeyValueRow {
  id: string;
  unit_id: string;
  created_at: string;
  value: any;
}

export const fetchUnitKeysValuesFor = async (columnName: string): Promise<UnitKeyValueRow[]> => {
  // Busca linhas de unit_keys com a coluna informada não nula
  const selectStr = `id, unit_id, created_at, ${columnName}`;
  const { data, error } = await supabase
    .from('unit_keys')
    .select(selectStr)
    .not(columnName, 'is', null)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (data || []) as any[];
  return rows.map(r => ({ id: r.id, unit_id: r.unit_id, created_at: r.created_at, value: r[columnName] })) as UnitKeyValueRow[];
};

export const updateUnitKeyValueById = async (
  rowId: string,
  columnName: string,
  value: any
): Promise<void> => {
  const payload: Record<string, any> = {};
  payload[columnName] = value;
  const { error } = await supabase
    .from('unit_keys')
    .update(payload)
    .eq('id', rowId);
  if (error) throw new Error(error.message);
};

export const insertUnitKeyValue = async (
  unitId: string,
  columnName: string,
  value: any
): Promise<void> => {
  const payload: Record<string, any> = { unit_id: unitId, is_active: true };
  payload[columnName] = value;
  const { error } = await supabase
    .from('unit_keys')
    .insert(payload);
  if (error) throw new Error(error.message);
};

export const renameUnitKeysColumn = async (
  callerProfile: Profile,
  oldName: string,
  newName: string
): Promise<void> => {
  const { error } = await supabase.rpc('unit_keys_rename_column', {
    p_caller_id: callerProfile.id,
    p_old_name: oldName,
    p_new_name: newName,
  });
  if (error) throw new Error(error.message);
};

export const dropUnitKeysColumn = async (
  callerProfile: Profile,
  columnName: string
): Promise<void> => {
  const { error } = await supabase.rpc('unit_keys_drop_column', {
    p_caller_id: callerProfile.id,
    p_column_name: columnName,
  });
  if (error) throw new Error(error.message);
};
