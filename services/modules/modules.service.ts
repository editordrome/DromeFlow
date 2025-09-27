/**
 * modules.service.ts
 * Serviço para operações de Módulos.
 */
import { supabase } from '../supabaseClient';
import type { Module } from '../../types';

const isMissingParentIdColumn = (err: any) => {
    if (!err) return false;
    const msg = (err.message || err.details || err.hint || '').toString().toLowerCase();
    return msg.includes('parent_id') && (msg.includes('does not exist') || msg.includes('column') || msg.includes('unknown'));
};

export const fetchAllModules = async (): Promise<Module[]> => {
	let { data, error } = await supabase
		.from('modules')
		.select('*')
		.order('parent_id', { ascending: true, nullsFirst: true })
		.order('position', { ascending: true })
		.order('name', { ascending: true });
	if (error && isMissingParentIdColumn(error)) {
		// Fallback: ambiente sem a migration aplicada ainda
		const fallback = await supabase
			.from('modules')
			.select('*')
			.order('position', { ascending: true })
			.order('name', { ascending: true });
		if (fallback.error) throw fallback.error;
		return fallback.data || [];
	}
	if (error) throw error;
	return data || [];
};

export const createModule = async (moduleData: Partial<Module>) => {
	const { data: maxData } = await supabase
		.from('modules')
		.select('position')
		.eq('parent_id', moduleData.parent_id ?? null)
		.order('position', { ascending: false })
		.limit(1);
	const nextPosition = (maxData && maxData[0]?.position ? maxData[0].position : 0) + 1;

	const dataToInsert = {
		...moduleData,
		allowed_profiles: moduleData.allowed_profiles || ['super_admin'],
		position: moduleData.position ?? nextPosition,
		parent_id: moduleData.parent_id ?? null,
	} as Partial<Module>;
	let { error } = await supabase.from('modules').insert(dataToInsert);
	if (error && isMissingParentIdColumn(error)) {
		// Fallback: tenta inserir sem parent_id
		const { error: fbErr } = await supabase.from('modules').insert({
			...moduleData,
			allowed_profiles: moduleData.allowed_profiles || ['super_admin'],
			position: moduleData.position ?? nextPosition,
		} as Partial<Module>);
		if (fbErr) throw fbErr;
		return;
	}
	if (error) throw error;
};

export const updateModule = async (moduleId: string, moduleData: Partial<Module>) => {
	const dataToUpdate = {
		...moduleData,
		allowed_profiles: moduleData.allowed_profiles || ['super_admin'],
		parent_id: moduleData.parent_id ?? null,
	} as Partial<Module>;
	let { error } = await supabase.from('modules').update(dataToUpdate).eq('id', moduleId);
	if (error && isMissingParentIdColumn(error)) {
		const { error: fbErr } = await supabase
			.from('modules')
			.update({
				...moduleData,
				allowed_profiles: moduleData.allowed_profiles || ['super_admin'],
			})
			.eq('id', moduleId);
		if (fbErr) throw fbErr;
		return;
	}
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

export const updateModulesOrder = async (ordered: { id: string; position: number; parent_id: string | null }[]) => {
	const updates = ordered.map(item =>
		supabase.from('modules').update({ position: item.position, parent_id: item.parent_id ?? null }).eq('id', item.id)
	);
	const results = await Promise.all(updates);
	const firstError = results.find(r => (r as any).error)?.error;
	if (firstError && isMissingParentIdColumn(firstError)) {
		// Fallback: atualizar apenas position quando parent_id não existir
		const fbUpdates = ordered.map(item =>
			supabase.from('modules').update({ position: item.position }).eq('id', item.id)
		);
		const fbResults = await Promise.all(fbUpdates);
		const fbErr = fbResults.find(r => (r as any).error)?.error;
		if (fbErr) throw fbErr;
		return;
	}
	if (firstError) throw firstError;
};

