/**
 * Serviço para gerenciar a atribuição de módulos a unidades
 * Implementa o controle de acesso baseado em unidade
 */

import { supabase } from '../supabaseClient';
import type { Module } from '../../types';

export interface UnitModule {
  id: string;
  unit_id: string;
  module_id: string;
  created_at: string;
  updated_at: string;
}

export interface UnitModuleSummary {
  unit_id: string;
  unit_name: string;
  unit_code: string;
  total_modules: number;
  module_names: string[];
}

/**
 * Busca todos os módulos atribuídos a uma unidade específica
 * @param unitId - UUID da unidade
 * @returns Array de módulos ordenados por position
 */
export async function fetchUnitModules(unitId: string): Promise<Module[]> {
  try {
    const { data, error } = await supabase.rpc('get_unit_modules', {
      unit_id_arg: unitId
    });

    if (error) {
      console.error('Erro ao buscar módulos da unidade:', error);
      throw error;
    }

    return data || [];
  } catch (err) {
    console.error('Erro na chamada fetchUnitModules:', err);
    throw err;
  }
}

/**
 * Atribui múltiplos módulos a uma unidade (substitui antigas atribuições)
 * @param unitId - UUID da unidade
 * @param moduleIds - Array de UUIDs dos módulos a serem atribuídos
 */
export async function assignModulesToUnit(
  unitId: string,
  moduleIds: string[]
): Promise<void> {
  try {
    const { error } = await supabase.rpc('assign_modules_to_unit', {
      unit_id_arg: unitId,
      module_ids_arg: moduleIds
    });

    if (error) {
      console.error('Erro ao atribuir módulos à unidade:', error);
      throw error;
    }
  } catch (err) {
    console.error('Erro na chamada assignModulesToUnit:', err);
    throw err;
  }
}

/**
 * Adiciona um único módulo a uma unidade (sem remover atribuições existentes)
 * @param unitId - UUID da unidade
 * @param moduleId - UUID do módulo
 */
export async function assignModuleToUnit(
  unitId: string,
  moduleId: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('unit_modules')
      .insert({
        unit_id: unitId,
        module_id: moduleId
      });

    if (error) {
      console.error('Erro ao adicionar módulo à unidade:', error);
      throw error;
    }
  } catch (err) {
    console.error('Erro na chamada assignModuleToUnit:', err);
    throw err;
  }
}

/**
 * Remove um módulo específico de uma unidade
 * @param unitId - UUID da unidade
 * @param moduleId - UUID do módulo
 */
export async function removeModuleFromUnit(
  unitId: string,
  moduleId: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('unit_modules')
      .delete()
      .eq('unit_id', unitId)
      .eq('module_id', moduleId);

    if (error) {
      console.error('Erro ao remover módulo da unidade:', error);
      throw error;
    }
  } catch (err) {
    console.error('Erro na chamada removeModuleFromUnit:', err);
    throw err;
  }
}

/**
 * Verifica se uma unidade tem acesso a um módulo específico
 * @param unitId - UUID da unidade
 * @param moduleId - UUID do módulo
 * @returns true se a unidade tem acesso, false caso contrário
 */
export async function checkUnitModuleAccess(
  unitId: string,
  moduleId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('check_unit_module_access', {
      unit_id_arg: unitId,
      module_id_arg: moduleId
    });

    if (error) {
      console.error('Erro ao verificar acesso ao módulo:', error);
      throw error;
    }

    return data || false;
  } catch (err) {
    console.error('Erro na chamada checkUnitModuleAccess:', err);
    return false;
  }
}

/**
 * Busca o resumo de módulos por unidade
 * @returns Array com resumo de todas as unidades
 */
export async function fetchUnitModulesSummary(): Promise<UnitModuleSummary[]> {
  try {
    const { data, error } = await supabase
      .from('unit_modules_summary')
      .select('*');

    if (error) {
      console.error('Erro ao buscar resumo de módulos:', error);
      throw error;
    }

    return data || [];
  } catch (err) {
    console.error('Erro na chamada fetchUnitModulesSummary:', err);
    throw err;
  }
}

/**
 * Busca todas as atribuições de uma unidade (raw data)
 * @param unitId - UUID da unidade
 * @returns Array de atribuições unit_modules
 */
export async function fetchUnitModuleAssignments(
  unitId: string
): Promise<UnitModule[]> {
  try {
    const { data, error } = await supabase
      .from('unit_modules')
      .select('*')
      .eq('unit_id', unitId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar atribuições de módulos:', error);
      throw error;
    }

    return data || [];
  } catch (err) {
    console.error('Erro na chamada fetchUnitModuleAssignments:', err);
    throw err;
  }
}

/**
 * Atualiza atribuições de módulos para uma unidade (modo incremental)
 * Permite adicionar/remover módulos sem substituir toda a lista
 * @param unitId - UUID da unidade
 * @param modulesToAdd - Array de UUIDs de módulos a adicionar
 * @param modulesToRemove - Array de UUIDs de módulos a remover
 */
export async function updateUnitModules(
  unitId: string,
  modulesToAdd: string[] = [],
  modulesToRemove: string[] = []
): Promise<void> {
  try {
    // Remove módulos primeiro
    if (modulesToRemove.length > 0) {
      const { error: deleteError } = await supabase
        .from('unit_modules')
        .delete()
        .eq('unit_id', unitId)
        .in('module_id', modulesToRemove);

      if (deleteError) {
        console.error('Erro ao remover módulos:', deleteError);
        throw deleteError;
      }
    }

    // Adiciona novos módulos
    if (modulesToAdd.length > 0) {
      const insertData = modulesToAdd.map(moduleId => ({
        unit_id: unitId,
        module_id: moduleId
      }));

      const { error: insertError } = await supabase
        .from('unit_modules')
        .insert(insertData);

      if (insertError) {
        console.error('Erro ao adicionar módulos:', insertError);
        throw insertError;
      }
    }
  } catch (err) {
    console.error('Erro na chamada updateUnitModules:', err);
    throw err;
  }
}

/**
 * Busca IDs dos módulos atribuídos a uma unidade (apenas IDs)
 * Útil para comparações e checkboxes
 * @param unitId - UUID da unidade
 * @returns Array de UUIDs dos módulos
 */
export async function fetchUnitModuleIds(unitId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('unit_modules')
      .select('module_id')
      .eq('unit_id', unitId);

    if (error) {
      console.error('Erro ao buscar IDs dos módulos:', error);
      throw error;
    }

    return data?.map(item => item.module_id) || [];
  } catch (err) {
    console.error('Erro na chamada fetchUnitModuleIds:', err);
    throw err;
  }
}
