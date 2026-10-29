// Tipos para os dados dos documentos
export interface DocumentData {
    profissional: {
        nome: string;
        cpf: string;
        rg: string;
        dataNascimento: string;
        estadoCivil: string;
        endereco: string;
        whatsapp: string;
        fumante: boolean;
        filhos: boolean;
        qtosFilhos: number;
        rotinaFilhos: string;
        // Profissional
        diasLivres: string;
        diasSemana: string;
        expResidencial: string;
        refResidencial: string;
        expComercial: string;
        refComercial: string;
        sitAtual: string;
        motivoCadastro: string;
        transporte: string;
    };

    unidade: {
        razaoSocial: string;
        cnpj: string;
        endereco: string;
        responsavel: string;
        contato: string;
        email: string;
        unitName: string;
        unitCode: string;
        uniformValue?: number;
        id?: string;
    };

    contrato: {
        dataAssinatura: string;
        percentualProfissional: number;
    };
}

export interface DocumentTemplateProps {
    data: DocumentData;
}

export const DOCUMENT_HEADER_URL = 'https://uframhbsgtxckdxttofo.supabase.co/storage/v1/object/public/mb-docs/cabe-mb-doc.png';
