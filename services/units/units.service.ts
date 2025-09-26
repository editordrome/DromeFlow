/**
 * units.service.ts
 * Serviço para operações de Unidades.
 */
import { supabase } from '../supabaseClient';
import type { Unit } from '../../types';

export const fetchAllUnits = async (): Promise<Unit[]> => {
	const { data, error } = await supabase.from('units').select('*').order('unit_name');
	if (error) throw error;
	return data || [];
};

export const createUnit = async (unitData: Partial<Unit>) => {
	const payload = {
		id: (unitData as any).id,
		unit_name: unitData.unit_name?.trim(),
		unit_code: unitData.unit_code?.trim(),
	};
	if (!payload.unit_name || !payload.unit_code) {
		throw new Error('Nome e código da unidade são obrigatórios.');
	}
	const { error } = await supabase.from('units').insert(payload);
	if (error) {
		console.error('Erro ao criar unidade:', error);
		if ((error as any).code === '23505') {
			throw new Error('Código de unidade já existe.');
		}
		throw new Error(`Falha ao criar unidade: ${error.message}`);
	}
};

export const updateUnit = async (unitId: string, unitData: Partial<Unit>) => {
	const payload = {
		unit_name: unitData.unit_name?.trim(),
		unit_code: unitData.unit_code?.trim(),
	} as Partial<Unit>;
	if (!payload.unit_name || !payload.unit_code) {
		throw new Error('Nome e código da unidade são obrigatórios.');
	}
	const { error } = await supabase.from('units').update(payload).eq('id', unitId);
	if (error) {
		console.error('Erro ao atualizar unidade:', error);
		if ((error as any).code === '23505') {
			throw new Error('Código de unidade já existe.');
		}
		throw new Error(`Falha ao atualizar unidade: ${error.message}`);
	}
};

export const deleteUnit = async (unitId: string) => {
	const { error } = await supabase.from('units').delete().eq('id', unitId);
	if (error) throw error;
};

