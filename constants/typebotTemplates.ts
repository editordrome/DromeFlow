import templateBase from '../docs/testes/typebot-export-template-drome3.json';
import templateMultiEdited from '../docs/testes/typebot-editado-2unidades.json';
import templateUnico from '../docs/testes/typebot-export-recrutadora-mb-dromedario-uma.json';

export const TYPEBOT_TEMPLATES = [
    {
        id: 'unico',
        name: 'Template 1 Unidade',
        description: 'Fluxo simplificado para configuração de uma única unidade.',
        data: templateUnico
    },
    {
        id: 'multi-2-unidades',
        name: 'Template 2 Unidades',
        description: 'Fluxo estruturado para 2 unidades em branco.',
        data: templateMultiEdited
    },
    {
        id: 'base-unidades',
        name: 'Template 3 Unidades (Padrão)',
        description: 'Fluxo base padrão com 3 unidades em branco.',
        data: templateBase
    }
];
