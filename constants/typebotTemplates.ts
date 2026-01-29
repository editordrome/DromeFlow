import templateBase from '../docs/testes/typebot-export-template-drome3.json';
import templateMultiEdited from '../docs/testes/typebot-editado-2unidades.json';
import templateUnico from '../docs/testes/typebot-export-recrutadora-mb-dromedario-uma.json';

// Função para gerar templates com N unidades baseado no template de 3 unidades
const generateMultiUnitTemplate = (numUnits: number, baseTemplate: any) => {
    if (numUnits <= 3) return baseTemplate;

    const template = JSON.parse(JSON.stringify(baseTemplate));
    const MENU_BLOCK_ID = 'jligv1oxrjpag2e8bvu7rzgr';

    // Encontrar o bloco de menu
    let menuBlock: any = null;
    let menuGroup: any = null;

    template.groups.forEach((group: any) => {
        if (group.blocks) {
            const found = group.blocks.find((b: any) => b.id === MENU_BLOCK_ID);
            if (found) {
                menuBlock = found;
                menuGroup = group;
            }
        }
    });

    if (!menuBlock || !menuBlock.items || menuBlock.items.length === 0) return template;

    const currentItems = menuBlock.items.length;
    const itemsToAdd = numUnits - currentItems;

    if (itemsToAdd <= 0) return template;

    // Usar o último item como referência
    const referenceItem = menuBlock.items[menuBlock.items.length - 1];
    const referenceEdge = template.edges.find((e: any) => e.id === referenceItem.outgoingEdgeId);

    if (!referenceEdge || !referenceEdge.to || !referenceEdge.to.groupId) return template;

    const referenceGroup = template.groups.find((g: any) => g.id === referenceEdge.to.groupId);

    if (!referenceGroup) return template;

    // Adicionar novos itens ao menu e grupos correspondentes
    for (let i = 0; i < itemsToAdd; i++) {
        const newIndex = currentItems + i + 1;

        // Criar novo item no menu
        const newItemId = `item_${Date.now()}_${i}`;
        const newEdgeId = `edge_${Date.now()}_${i}`;
        const newGroupId = `group_${Date.now()}_${i}`;

        const newItem = {
            ...JSON.parse(JSON.stringify(referenceItem)),
            id: newItemId,
            content: `UNIDADE ${newIndex}`,
            outgoingEdgeId: newEdgeId
        };

        menuBlock.items.push(newItem);

        // Criar nova edge
        const newEdge = {
            ...JSON.parse(JSON.stringify(referenceEdge)),
            id: newEdgeId,
            from: {
                blockId: MENU_BLOCK_ID,
                itemId: newItemId
            },
            to: {
                groupId: newGroupId
            }
        };

        template.edges.push(newEdge);

        // Criar novo grupo
        const newGroup = JSON.parse(JSON.stringify(referenceGroup));
        newGroup.id = newGroupId;
        newGroup.title = `Unidade ${newIndex}`;

        // Atualizar IDs dos blocos dentro do grupo
        if (newGroup.blocks) {
            newGroup.blocks = newGroup.blocks.map((block: any) => ({
                ...block,
                id: `${block.id}_${newIndex}`,
                groupId: newGroupId
            }));
        }

        template.groups.push(newGroup);
    }

    return template;
};

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
        description: 'Fluxo estruturado para 2 unidades.',
        data: templateMultiEdited
    },
    {
        id: 'base-unidades',
        name: 'Template 3 Unidades',
        description: 'Fluxo base com 3 unidades.',
        data: templateBase
    },
    {
        id: 'multi-4-unidades',
        name: 'Template 4 Unidades',
        description: 'Fluxo para 4 unidades.',
        data: generateMultiUnitTemplate(4, templateBase)
    },
    {
        id: 'multi-5-unidades',
        name: 'Template 5 Unidades',
        description: 'Fluxo para 5 unidades.',
        data: generateMultiUnitTemplate(5, templateBase)
    },
    {
        id: 'multi-6-unidades',
        name: 'Template 6 Unidades',
        description: 'Fluxo para 6 unidades.',
        data: generateMultiUnitTemplate(6, templateBase)
    },
    {
        id: 'multi-7-unidades',
        name: 'Template 7 Unidades',
        description: 'Fluxo para 7 unidades.',
        data: generateMultiUnitTemplate(7, templateBase)
    },
    {
        id: 'multi-8-unidades',
        name: 'Template 8 Unidades',
        description: 'Fluxo para 8 unidades.',
        data: generateMultiUnitTemplate(8, templateBase)
    },
    {
        id: 'multi-9-unidades',
        name: 'Template 9 Unidades',
        description: 'Fluxo para 9 unidades.',
        data: generateMultiUnitTemplate(9, templateBase)
    },
    {
        id: 'multi-10-unidades',
        name: 'Template 10 Unidades',
        description: 'Fluxo para 10 unidades.',
        data: generateMultiUnitTemplate(10, templateBase)
    }
];
