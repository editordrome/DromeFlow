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
        console.log('[updateUnitConfig] Updating unit:', unitId, 'with data:', data);

        const { data: result, error } = await supabase
            .from('units')
            .update({
                razao_social: data.razao_social,
                cnpj: data.cnpj,
                endereco: data.endereco,
                contato: data.contato,
                email: data.email,
                responsavel: data.responsavel,
                uniform_value: typeof data.uniform_value === 'string'
                    ? parseFloat(data.uniform_value.replace(',', '.'))
                    : data.uniform_value,
            })
            .eq('id', unitId)
            .select();

        if (error) {
            console.error('[updateUnitConfig] Supabase error:', error);
            return { success: false, error: error.message };
        }

        console.log('[updateUnitConfig] Update successful:', result);
        return { success: true };
    } catch (error: any) {
        console.error('[updateUnitConfig] Catch error:', error);
        return { success: false, error: error.message || 'Erro desconhecido' };
    }
}
