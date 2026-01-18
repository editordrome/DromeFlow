import { supabase } from '../supabaseClient';
import { UnitService } from '../../types';

export const getUnitServices = async (unitId: string): Promise<UnitService[]> => {
    const { data, error } = await supabase
        .from('unit_services')
        .select('*')
        .eq('unit_id', unitId)
        .eq('active', true)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Erro ao buscar serviços:', error);
        throw error;
    }

    return data || [];
};

export const createUnitService = async (service: Omit<UnitService, 'id' | 'created_at'>): Promise<UnitService> => {
    // Obter user_id do localStorage (autenticação customizada)
    const storedProfile = localStorage.getItem('userProfile');
    if (!storedProfile) {
        throw new Error('Usuário não autenticado');
    }
    const profile = JSON.parse(storedProfile);

    // Usando RPC seguro com user_id explícito (compatível com auth customizada)
    const { data, error } = await supabase.rpc('create_unit_service_secure', {
        p_user_id: profile.id,
        p_unit_id: service.unit_id,
        p_name: service.name,
        p_repasse_value: service.repasse_value
    });

    if (error) {
        console.error('Erro ao criar serviço:', error);
        throw error;
    }

    return data as UnitService;
};

export const deleteUnitService = async (id: string): Promise<void> => {
    const { error } = await supabase
        .from('unit_services')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Erro ao deletar serviço:', error);
        throw error;
    }
};

export const updateUnitService = async (id: string, updates: Partial<UnitService>): Promise<UnitService> => {
    const { data, error } = await supabase
        .from('unit_services')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Erro ao atualizar serviço:', error);
        throw error;
    }

    return data;
};
