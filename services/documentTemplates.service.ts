import { supabase } from './supabaseClient';

/**
 * Interface para templates de documentos
 */
export interface DocumentTemplate {
    id: string;
    name: string;  // 'aditamento' | 'contrato' | 'termo'
    content: string;
    unit_id: string | null;
    created_at: string;
    updated_at: string;
}

/**
 * Service para gerenciar templates de documentos
 * Suporta templates globais (unit_id = NULL) e customizados por unidade
 */
export const documentTemplatesService = {
    /**
     * Busca template customizado da unidade ou fallback para global
     * Lógica: Tenta unit_id específico primeiro, depois unit_id NULL
     * 
     * @param unitId - ID da unidade
     * @param templateName - Nome do template ('aditamento', 'contrato', 'termo')
     * @returns Template encontrado ou null
     */
    async getTemplate(unitId: string, templateName: string): Promise<DocumentTemplate | null> {
        console.log(`[documentTemplatesService] getTemplate called with unitId: ${unitId}, templateName: ${templateName}`);

        try {
            // Busca templates (da unidade E global) em uma única query
            // Ordenamos por unit_id DESC para que o ID da unidade venha antes de NULL
            const { data, error } = await supabase
                .from('document_templates')
                .select('*')
                .eq('name', templateName)
                .or(`unit_id.eq.${unitId},unit_id.is.null`)
                .order('unit_id', { ascending: false, nullsFirst: false })
                .limit(1)
                .maybeSingle();

            if (error) {
                console.error('[documentTemplatesService] Error fetching template:', error);
                return null;
            }

            if (data) {
                console.log(`[documentTemplatesService] ✅ Found ${data.unit_id ? 'custom' : 'global'} template for ${templateName}`);
                return data;
            }

            console.warn(`[documentTemplatesService] ⚠️ No template found for ${templateName}`);
            return null;
        } catch (error) {
            console.error('[documentTemplatesService] Unexpected error in getTemplate:', error);
            return null;
        }
    },

    /**
     * Salva ou atualiza template customizado para uma unidade
     * 
     * @param unitId - ID da unidade
     * @param templateName - Nome do template
     * @param content - Conteúdo HTML do template
     * @returns Template salvo
     */
    async saveCustomTemplate(
        unitId: string,
        templateName: string,
        content: string
    ): Promise<DocumentTemplate> {
        const { data, error } = await supabase
            .from('document_templates')
            .upsert({
                name: templateName,
                content: content,
                unit_id: unitId,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'name,unit_id'
            })
            .select()
            .single();

        if (error) {
            console.error('[documentTemplatesService] Error saving custom template:', error);
            throw error;
        }

        console.log(`[documentTemplatesService] Saved custom template ${templateName} for unit ${unitId}`);
        return data;
    },

    /**
     * Remove customização da unidade (volta ao template global)
     * 
     * @param unitId - ID da unidade
     * @param templateName - Nome do template
     */
    async deleteCustomTemplate(unitId: string, templateName: string): Promise<void> {
        const { error } = await supabase
            .from('document_templates')
            .delete()
            .eq('name', templateName)
            .eq('unit_id', unitId);

        if (error) {
            console.error('[documentTemplatesService] Error deleting custom template:', error);
            throw error;
        }

        console.log(`[documentTemplatesService] Deleted custom template ${templateName} for unit ${unitId}`);
    },

    /**
     * Lista todos os templates (globais + customizados da unidade)
     * 
     * @param unitId - ID da unidade (opcional)
     * @returns Array de templates
     */
    async listTemplates(unitId?: string): Promise<DocumentTemplate[]> {
        let query = supabase
            .from('document_templates')
            .select('*')
            .order('name');

        if (unitId) {
            // Busca templates globais OU da unidade específica, ordenando para facilitar posterior filtragem manual de duplicatas se necessário
            // No entanto, para simplicidade de listagem, podemos apenas retornar tudo e o frontend decide
            query = query.or(`unit_id.is.null,unit_id.eq.${unitId}`).order('unit_id', { ascending: false, nullsFirst: false });
        } else {
            // Apenas templates globais
            query = query.is('unit_id', null);
        }

        const { data, error } = await query;

        if (error) {
            console.error('[documentTemplatesService] Error listing templates:', error);
            throw error;
        }

        if (!data) return [];

        // Filtra para garantir que apenas um template com cada nome seja retornado (priorizando o da unidade)
        const uniqueTemplates = data.reduce((acc: DocumentTemplate[], current) => {
            const existing = acc.find(t => t.name === current.name);
            if (!existing) {
                acc.push(current);
            }
            return acc;
        }, []);

        return uniqueTemplates;
    },

    /**
     * Verifica se uma unidade possui template customizado
     * 
     * @param unitId - ID da unidade
     * @param templateName - Nome do template
     * @returns true se existe customização
     */
    async hasCustomTemplate(unitId: string, templateName: string): Promise<boolean> {
        const { data } = await supabase
            .from('document_templates')
            .select('id')
            .eq('name', templateName)
            .eq('unit_id', unitId)
            .maybeSingle();

        return !!data;
    }
};
