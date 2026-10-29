import { documentTemplatesService } from '../../../services/documentTemplates.service';

/**
 * Converte dados do formato camelCase/nested para flat snake_case
 * que os templates esperam
 */
export function prepareTemplateData(documentData: any): Record<string, any> {
    const { profissional, unidade, contrato } = documentData;

    return {
        // Profissional - Prefixed (Legacy)
        profissional_nome: profissional?.nome || '',
        profissional_cpf: profissional?.cpf || '',
        profissional_rg: profissional?.rg || '',
        profissional_data_nascimento: profissional?.dataNascimento || '',
        profissional_estado_civil: profissional?.estadoCivil || '',
        profissional_endereco: profissional?.endereco || '',
        profissional_whatsapp: profissional?.whatsapp || '',
        profissional_assinatura: profissional?.assinatura || '',

        // Profissional - Direct
        nome: profissional?.nome || '',
        cpf: profissional?.cpf || '',
        rg: profissional?.rg || '',
        data_nascimento: profissional?.dataNascimento || '',
        dataNascimento: profissional?.dataNascimento || '',
        estado_civil: profissional?.estadoCivil || '',
        estadoCivil: profissional?.estadoCivil || '',
        endereco_profissional: profissional?.endereco || '', // Alias
        prof_endereco: profissional?.endereco || '', // Alias
        whatsapp: profissional?.whatsapp || '',

        // Unidade - Prefixed (Legacy)
        unidade_razao_social: unidade?.razaoSocial || '',
        unidade_cnpj: unidade?.cnpj || '',
        unidade_endereco: unidade?.endereco || '',
        unidade_responsavel: unidade?.responsavel || '',
        unidade_contato: unidade?.contato || '',
        unidade_email: unidade?.email || '',
        unidade_unit_name: unidade?.unitName || '',
        unidade_nome: unidade?.unitName || '',
        unidade_unit_code: unidade?.unitCode || '',
        unidade_uniform_value: unidade?.uniformValue || '',
        unidade_id: unidade?.id || '',

        // Unidade - Direct
        razao_social: unidade?.razaoSocial || '',
        razaoSocial: unidade?.razaoSocial || '',
        cnpj: unidade?.cnpj || '',
        unit_name: unidade?.unitName || '',
        unit_nome: unidade?.unitName || '',
        unitName: unidade?.unitName || '',
        unit_code: unidade?.unitCode || '',
        unitCode: unidade?.unitCode || '',
        uni_id: unidade?.id || '',
        responsavel: unidade?.responsavel || '',
        contato: unidade?.contato || '',
        email: unidade?.email || '',
        uniform_value: unidade?.uniformValue || '',
        uniformValue: unidade?.uniformValue || '',
        endereco_unidade: unidade?.endereco || '', // Alias
        unit_endereco: unidade?.endereco || '', // Alias
        endereco: unidade?.endereco || '', // O endereço da unidade agora tem prioridade se houver colisão

        // Contrato
        contrato_data_assinatura: contrato?.dataAssinatura || '',
        data_assinatura: contrato?.dataAssinatura || '',
        dataAssinatura: contrato?.dataAssinatura || '',
        contrato_percentual_profissional: contrato?.percentualProfissional || '55',
        percentual_profissional: contrato?.percentualProfissional || '55',
        percentualProfissional: contrato?.percentualProfissional || '55',
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
    documentData: any,
    moduleContext?: 'recrutadora' | 'profissional'  // NOVO: contexto do módulo
): Promise<string> {
    console.log(`[getDocumentTemplate] Called with:`, { unitId, templateName, moduleContext });

    try {
        // Busca template (custom ou global)
        const template = await documentTemplatesService.getTemplate(unitId, templateName);

        console.log(`[getDocumentTemplate] Template fetched:`, {
            found: !!template,
            contentLength: template?.content?.length,
            availableIn: template?.available_in
        });

        if (!template) {
            throw new Error(`Template ${templateName} não encontrado`);
        }

        // NOVO: Verifica disponibilidade do template para o módulo atual
        if (moduleContext && template.available_in) {
            if (!template.available_in.includes(moduleContext)) {
                throw new Error(`Template ${templateName} não está disponível para o módulo ${moduleContext}`);
            }
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
