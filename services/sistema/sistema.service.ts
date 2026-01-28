import { supabase } from '../supabaseClient';
import { SystemManual, Module } from '../../types';

export const sistemaService = {
    /**
     * Busca todos os manuais cadastrados
     */
    async getAllManuals(): Promise<SystemManual[]> {
        const { data, error } = await supabase
            .from('system_manuals')
            .select(`
        *,
        modules:module_id ( name, code )
      `)
            .order('module_id')
            .order('position', { ascending: true });

        if (error) {
            console.error('[SistemaService] Erro ao buscar manuais:', error);
            throw error;
        }

        return (data || []).map((m: any) => ({
            ...m,
            module_name: m.modules?.name,
            module_code: m.modules?.code
        }));
    },

    /**
     * Busca manuais por ID do módulo
     */
    async getManualsByModuleId(moduleId: string): Promise<SystemManual[]> {
        const { data, error } = await supabase
            .from('system_manuals')
            .select('*')
            .eq('module_id', moduleId)
            .order('position', { ascending: true });

        if (error) {
            console.error('[SistemaService] Erro ao buscar manuais por módulo:', error);
            throw error;
        }

        return data || [];
    },

    /**
     * Salva ou atualiza um manual
     */
    async upsertManual(manual: Partial<SystemManual>): Promise<SystemManual> {
        const { data, error } = await supabase
            .from('system_manuals')
            .upsert({
                id: manual.id,
                module_id: manual.module_id,
                title: manual.title,
                content: manual.content,
                image_url: manual.image_url,
                image_position: (manual.image_position as any) === 'side' ? 'left' : (manual.image_position || 'top'),
                image_size: manual.image_size || 'full',
                position: manual.position || 0,
                updated_at: new Date().toISOString()
            }, { onConflict: 'module_id, title' })
            .select()
            .single();

        if (error) {
            console.error('[SistemaService] Erro ao salvar manual:', error);
            throw error;
        }

        return data;
    },

    /**
     * Deleta um manual
     */
    async deleteManual(id: string): Promise<void> {
        const { error } = await supabase
            .from('system_manuals')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('[SistemaService] Erro ao deletar manual:', error);
            throw error;
        }
    },

    /**
     * Busca histórico de atualizações (app_versions)
     */
    async getAppVersions(): Promise<any[]> {
        const { data, error } = await supabase
            .from('app_versions')
            .select('*')
            .order('release_date', { ascending: false });

        if (error) {
            console.error('[SistemaService] Erro ao buscar versões:', error);
            throw error;
        }

        return data || [];
    }
};
