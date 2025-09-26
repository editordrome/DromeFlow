/**
 * accessCredentials.service.ts
 * Serviço para operações de credenciais/acessos.
 */
import { supabase } from '../supabaseClient';
import type { AccessCredential } from '../../types';

export const fetchAllAccessCredentials = async (): Promise<AccessCredential[]> => {
	const { data, error } = await supabase.from('access_credentials').select('*').order('name');
	if (error) throw error;
	return data || [];
};

export const createAccessCredential = async (credData: Partial<AccessCredential>) => {
	const { error } = await supabase.from('access_credentials').insert(credData);
	if (error) throw error;
};

export const updateAccessCredential = async (credId: string, credData: Partial<AccessCredential>) => {
	const { error } = await supabase.from('access_credentials').update(credData).eq('id', credId);
	if (error) throw error;
};

export const deleteAccessCredential = async (credId: string) => {
	const { error } = await supabase.from('access_credentials').delete().eq('id', credId);
	if (error) throw error;
};

