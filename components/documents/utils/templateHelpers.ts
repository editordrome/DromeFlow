import { documentTemplatesService } from '../../../services/documentTemplates.service';

/**
 * Converte dados do formato camelCase/nested para flat snake_case
 * que os templates esperam
 */
export function prepareTemplateData(documentData: any): Record<string, any> {
    const { profissional, unidade, contrato } = documentData;

    return {
        // Profissional - flat snake_case
        profissional_nome: profissional?.nome || '',
        profissional_cpf: profissional?.cpf || '',
        profissional_rg: profissional?.rg || '',
        profissional_data_nascimento: profissional?.dataNascimento || '',
        profissional_estado_civil: profissional?.estadoCivil || '',
        profissional_endereco: profissional?.endereco || '',
        profissional_whatsapp: profissional?.whatsapp || '',
        profissional_assinatura: profissional?.assinatura || '',

        // Unidade - flat snake_case
        unidade_razao_social: unidade?.razaoSocial || '',
        unidade_cnpj: unidade?.cnpj || '',
        unidade_endereco: unidade?.endereco || '',
        unidade_responsavel: unidade?.responsavel || '',
        unidade_contato: unidade?.contato || '',
        unidade_email: unidade?.email || '',
        unidade_unit_name: unidade?.unitName || '',
        unidade_unit_code: unidade?.unitCode || '',
        unidade_uniform_value: unidade?.uniformValue || unidade?.uniform_value || '',

        // Contrato - flat snake_case
        contrato_data_assinatura: contrato?.dataAssinatura || '',
        contrato_percentual_profissional: contrato?.percentualProfissional || '55',
    };
}

/**
 * Injeta variáveis em um template HTML
 * Substitui {{variavel}} pelos valores do objeto data
 */
export function injectVariables(template: string, data: Record<string, any>): string {
    let result = template;

    // Substituir todas as variáveis {{chave}}
    result = result.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
        const trimmedName = varName.trim();
        const value = data[trimmedName];

        if (value !== undefined && value !== null) {
            return String(value);
        }

        // Mantém placeholder se não encontrar
        return match;
    });

    return result;
}

/**
 * Busca template customizado da unidade ou fallback para global
 * Injeta variáveis automaticamente
 */
export async function getDocumentTemplate(
    unitId: string,
    templateName: 'aditamento' | 'contrato' | 'termo' | 'notificacao' | 'distrato',
    documentData: any
): Promise<string> {
    console.log(`[getDocumentTemplate] Called with:`, { unitId, templateName });

    try {
        // Busca template (custom ou global)
        const template = await documentTemplatesService.getTemplate(unitId, templateName);

        console.log(`[getDocumentTemplate] Template fetched:`, {
            found: !!template,
            contentLength: template?.content?.length
        });

        if (!template) {
            throw new Error(`Template ${templateName} não encontrado`);
        }

        // Prepara dados no formato que o template espera
        const templateData = prepareTemplateData(documentData);
        console.log(`[getDocumentTemplate] Template data prepared:`, Object.keys(templateData));

        // Injeta variáveis
        const result = injectVariables(template.content, templateData);
        console.log(`[getDocumentTemplate] Variables injected, result length:`, result.length);

        return result;
    } catch (error) {
        console.error('[getDocumentTemplate] Error:', error);
        throw error;
    }
}
