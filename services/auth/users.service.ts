/**
 * users.service.ts
 * Serviço para operações de usuários e atribuições.
 */
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../supabaseClient';
import type { User, Profile } from '../../types';
import type { Unit, Module } from '../../types';

type FullUser = User & Profile;
type UserDataPayload = Partial<FullUser> & {
	password?: string;
	unit_ids?: string[];
	module_ids?: string[];
};

export const fetchAllUsers = async (): Promise<FullUser[]> => {
	const { data, error } = await supabase.from('profiles').select('*, user_email:email');
	if (error) throw error;
	return (data || []).map(({ user_email, ...rest }: any) => ({ ...rest, email: user_email }));
};

export const fetchUsersForAdminUnits = async (adminUserId: string): Promise<FullUser[]> => {
	const { data: adminUnits, error: adminUnitsError } = await supabase
		.from('user_units')
		.select('unit_id')
		.eq('user_id', adminUserId);
	if (adminUnitsError) throw adminUnitsError;
	const unitIds = (adminUnits || []).map((u: any) => u.unit_id);
	if (unitIds.length === 0) return [];

	const { data: links, error: linksError } = await supabase
		.from('user_units')
		.select('user_id, unit_id')
		.in('unit_id', unitIds);
	if (linksError) throw linksError;
	const userIds = Array.from(new Set((links || []).map((l: any) => l.user_id)));
	if (userIds.length === 0) return [];

	const { data: profilesData, error: profilesError } = await supabase
		.from('profiles')
		.select('*, user_email:email')
		.in('id', userIds as string[]);
	if (profilesError) throw profilesError;

	return (profilesData || []).map(({ user_email, ...rest }: any) => ({ ...rest, email: user_email }));
};

export const fetchUserAssignments = async (userId: string): Promise<{ unit_ids: string[]; module_ids: string[] }> => {
	const [unitsRes, modulesRes] = await Promise.all([
		supabase.from('user_units').select('unit_id').eq('user_id', userId),
		supabase.from('user_modules').select('module_id').eq('user_id', userId),
	]);
	if (unitsRes.error) throw unitsRes.error;
	if (modulesRes.error) throw modulesRes.error;

	return {
		unit_ids: unitsRes.data?.map((u: any) => u.unit_id) || [],
		module_ids: modulesRes.data?.map((m: any) => m.module_id) || [],
	};
};

const updateUserAssignments = async (userId: string, unitIds: string[], moduleIds: string[]) => {
	await Promise.all([
		supabase.from('user_units').delete().eq('user_id', userId),
		supabase.from('user_modules').delete().eq('user_id', userId),
	]);

	if (unitIds.length > 0) {
		const unitAssignments = unitIds.map((unit_id) => ({ user_id: userId, unit_id }));
		const { error } = await supabase.from('user_units').insert(unitAssignments);
		if (error) throw error;
	}
	if (moduleIds.length > 0) {
		const moduleAssignments = moduleIds.map((module_id) => ({ user_id: userId, module_id }));
		const { error } = await supabase.from('user_modules').insert(moduleAssignments);
		if (error) throw error;
	}
};

export const createUser = async (userData: UserDataPayload & { auto_unit_id?: string }): Promise<void> => {
	if (!userData.email || !userData.password) throw new Error('Email e senha são obrigatórios.');

	const { data: existing, error: existingError } = await supabase
		.from('profiles')
		.select('id')
		.eq('email', userData.email)
		.limit(1);
	if (existingError) throw existingError;

	let userId = existing && existing.length > 0 ? (existing[0] as any).id : uuidv4();

	if (!existing || existing.length === 0) {
		const { error: profileError } = await supabase.from('profiles').insert({
			id: userId,
			full_name: userData.full_name,
			email: userData.email,
			role: (userData as any).role || 'user',
			password: userData.password,
		} as any);
		if (profileError) {
			if ((profileError as any).code === '23505') throw new Error('Já existe um usuário com este e-mail.');
			throw profileError;
		}
	} else {
		const updatePayload: any = {
			full_name: userData.full_name,
			role: (userData as any).role,
		};
		if (userData.password) updatePayload.password = userData.password;
		const { error: updErr } = await supabase.from('profiles').update(updatePayload).eq('id', userId);
		if (updErr) throw updErr;
	}

	let unitIds = userData.unit_ids || [];
	if (unitIds.length === 0 && (userData as any).auto_unit_id) {
		unitIds = [(userData as any).auto_unit_id as string];
	}
	await updateUserAssignments(userId, unitIds, userData.module_ids || []);
};

export const updateUser = async (userId: string, userData: UserDataPayload): Promise<void> => {
	const profileUpdate: any = {
		full_name: userData.full_name,
		role: (userData as any).role,
		email: userData.email,
	};
	if (userData.password) profileUpdate.password = userData.password;

	const { error: profileError } = await supabase.from('profiles').update(profileUpdate).eq('id', userId);
	if (profileError) throw profileError;

	await updateUserAssignments(userId, userData.unit_ids || [], userData.module_ids || []);
};

export const deleteUser = async (userId: string): Promise<void> => {
	const { error } = await supabase.rpc('delete_app_user', { user_id_to_delete: userId });
	if (error) throw error;
};

export const removeUserFromUnit = async (userId: string, unitId: string, callerId: string): Promise<void> => {
	const { error } = await supabase.rpc('remove_user_from_unit', { p_caller_id: callerId, p_user_id: userId, p_unit_id: unitId });
    if (error) throw error;
};

export const fetchUsersForUnit = async (
	unitId: string
): Promise<{ id: string; full_name: string; email: string; role: string }[]> => {
	const { data: links, error: linkError } = await supabase
		.from('user_units')
		.select('user_id')
		.eq('unit_id', unitId);
	if (linkError) throw linkError;

	const userIds = (links || []).map((l: any) => l.user_id).filter(Boolean);
	if (userIds.length === 0) return [];

	const { data: profilesData, error: profilesError } = await supabase
		.from('profiles')
		.select('id, full_name, email, role')
		.in('id', userIds as string[]);
	if (profilesError) throw profilesError;

	return (profilesData || []).map((p: any) => ({
		id: p.id as string,
		full_name: p.full_name || '',
		email: p.email || '',
		role: p.role || 'user',
	}));
};

	// Unidades vinculadas a um usuário (RPC com fallback)
	export const fetchUserUnits = async (userId: string): Promise<Unit[]> => {
		try {
			const { data, error } = await supabase.rpc('get_user_units', { p_user_id: userId });
			if (error) throw error;
			return (data as Unit[]) || [];
		} catch (rpcErr) {
			console.warn('[fetchUserUnits] Falha RPC get_user_units, aplicando fallback manual:', rpcErr);
			const { data: linkData, error: linkError } = await supabase
				.from('user_units')
				.select('unit_id')
				.eq('user_id', userId);
			if (linkError) {
				console.error('[fetchUserUnits] Erro fallback user_units:', linkError);
				return [];
			}
			const unitIds = (linkData || []).map((r: any) => r.unit_id);
			if (unitIds.length === 0) return [];
			const { data: unitsData, error: unitsError } = await supabase
				.from('units')
				.select('*')
				.in('id', unitIds);
			if (unitsError) {
				console.error('[fetchUserUnits] Erro buscando units no fallback:', unitsError);
				return [];
			}
			return (unitsData as Unit[]) || [];
		}
	};

	// Módulos vinculados a um usuário via RPC (mantido aqui para simetria, apesar de AuthContext ter lógica própria)
	export const fetchUserModules = async (userId: string): Promise<Module[]> => {
		const { data, error } = await supabase.rpc('get_user_modules', { p_user_id: userId });
		if (error) throw error;
		return (data as Module[]) || [];
	};

