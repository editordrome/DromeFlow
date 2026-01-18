import { supabase } from '../supabaseClient';
import { Unit } from '../../types';

/**
 * Busca os dados de configuração de uma unidade
 */
export async function getUnitConfig(unitId: string): Promise<Unit | null> {
    try {
        const { data, error } = await supabase
            .from('units')
            .select('*')
            .eq('id', unitId)
            .single();

        if (error) {
            console.error('Erro ao buscar configuração da unidade:', error);
            return null;
        }

        return data;
    } catch (error) {
        console.error('Erro ao buscar configuração da unidade:', error);
        return null;
    }
}

/**
 * Atualiza os dados de configuração de uma unidade
 */
export async function updateUnitConfig(
    unitId: string,
    data: Partial<Unit>
): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase
            .from('units')
            .update({
                razao_social: data.razao_social,
                cnpj: data.cnpj,
                endereco: data.endereco,
                contato: data.contato,
                email: data.email,
                responsavel: data.responsavel,
            })
            .eq('id', unitId);

        if (error) {
            console.error('Erro ao atualizar configuração da unidade:', error);
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (error: any) {
        console.error('Erro ao atualizar configuração da unidade:', error);
        return { success: false, error: error.message };
    }
}
