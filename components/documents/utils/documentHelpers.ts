import { RecrutadoraCard, Unit } from '../../../types';
import { DocumentData } from '../types';

/**
 * Prepara os dados do card da recrutadora e da unidade para uso nos templates de documentos
 */
export function prepareDocumentData(
    profissionalData: RecrutadoraCard,
    unidadeData: Unit
): DocumentData {
    return {
        profissional: {
            nome: profissionalData.nome || '',
            cpf: profissionalData.cpf || '',
            rg: profissionalData.rg || '',
            dataNascimento: profissionalData.data_nascimento || profissionalData.data_nasc || '',
            estadoCivil: profissionalData.estado_civil || '',
            endereco: profissionalData.endereco || profissionalData['endereço'] || '',
            whatsapp: profissionalData.whatsapp || '',
            fumante: profissionalData.fumante || false,
            filhos: profissionalData.filhos || false,
            qtosFilhos: profissionalData.qtos_filhos || profissionalData.qto_filhos || 0,
            rotinaFilhos: profissionalData.rotina_filhos || '',
            diasLivres: profissionalData.dias_livres || '',
            diasSemana: profissionalData.dias_semana || '',
            expResidencial: profissionalData.exp_residencial || '',
            refResidencial: profissionalData.ref_residencial || profissionalData.ref_redidencial || '',
            expComercial: profissionalData.exp_comercial || '',
            refComercial: profissionalData.ref_comercial || '',
            sitAtual: profissionalData.sit_atual || '',
            motivoCadastro: profissionalData.motivo_cadastro || profissionalData.motivo_cadstro || '',
            transporte: profissionalData.transporte || '',
        },
        unidade: {
            razaoSocial: unidadeData.razao_social || '',
            cnpj: unidadeData.cnpj || '',
            endereco: unidadeData.endereco || unidadeData.address || '',
            responsavel: unidadeData.responsavel || '',
            contato: unidadeData.contato || '',
            email: unidadeData.email || '',
            unitName: unidadeData.unit_name,
            unitCode: unidadeData.unit_code,
        },
        contrato: {
            dataAssinatura: new Date().toLocaleDateString('pt-BR'),
            percentualProfissional: 55,
        },
    };
}

/**
 * Formata CPF: 000.000.000-00
 */
export function formatCPF(cpf: string): string {
    if (!cpf) return '';
    const numbers = cpf.replace(/\D/g, '');
    return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

/**
 * Formata CNPJ: 00.000.000/0000-00
 */
export function formatCNPJ(cnpj: string): string {
    if (!cnpj) return '';
    const numbers = cnpj.replace(/\D/g, '');
    return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

/**
 * Formata data de ISO para DD/MM/AAAA
 */
export function formatDate(date: string): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('pt-BR');
}
