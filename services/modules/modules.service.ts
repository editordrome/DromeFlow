/**
 * modules.service.ts
 * Serviço para operações de Módulos.
 */
import { supabase } from '../supabaseClient';
import type { Module } from '../../types';

export const fetchAllModules = async (): Promise<Module[]> => {
	const { data, error } = await supabase
		.from('modules')
		.select('*')
		.order('position', { ascending: true })
		.order('name', { ascending: true });
	if (error) throw error;
	return data || [];
};

export const createModule = async (moduleData: Partial<Module>) => {
	const { data: maxData } = await supabase
		.from('modules')
		.select('position')
		.order('position', { ascending: false })
		.limit(1);
	const nextPosition = (maxData && maxData[0]?.position ? maxData[0].position : 0) + 1;

	const dataToInsert = {
		...moduleData,
		allowed_profiles: moduleData.allowed_profiles || ['super_admin'],
		position: moduleData.position ?? nextPosition,
	} as Partial<Module>;
	const { error } = await supabase.from('modules').insert(dataToInsert);
	if (error) throw error;
};

export const updateModule = async (moduleId: string, moduleData: Partial<Module>) => {
	const dataToUpdate = {
		...moduleData,
		allowed_profiles: moduleData.allowed_profiles || ['super_admin'],
	} as Partial<Module>;
	const { error } = await supabase.from('modules').update(dataToUpdate).eq('id', moduleId);
	if (error) throw error;
};

export const deleteModule = async (moduleId: string) => {
	const { error } = await supabase.from('modules').delete().eq('id', moduleId);
	if (error) throw error;
};

export const toggleModuleStatus = async (moduleId: string, newStatus: boolean) => {
	const { error } = await supabase.from('modules').update({ is_active: newStatus }).eq('id', moduleId);
	if (error) throw error;
};

export const updateModulesOrder = async (ordered: { id: string; position: number }[]) => {
	const updates = ordered.map(item =>
		supabase.from('modules').update({ position: item.position }).eq('id', item.id)
	);
	const results = await Promise.all(updates);
	const firstError = results.find(r => (r as any).error)?.error;
	if (firstError) throw firstError;
};

