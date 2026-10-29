# Plano de Implementação - Padronização UI Profissional e Recrutadora

Este plano descreve as mudanças necessárias para unificar a identidade visual (UI/UX) dos modais dos módulos **Profissional** e **Recrutadora**, garantindo que ambos sigam o novo padrão premium estabelecido.

## User Review Required
> [!IMPORTANT]
> A lógica de botões de salvar/editar será movida do cabeçalho para o rodapé no `ProfissionalDetailModal` para espelhar o comportamento do `RecrutadoraCardModal`.

## Mudanças Propostas

### Profissionais Module
#### [MODIFY] [ProfissionalDetailModal.tsx](file:///Users/jeanpetri/DromeFlow/components/ui/ProfissionalDetailModal.tsx)
- **Container**: Atualizar para `rounded-xl shadow-2xl overflow-hidden`.
- **Cabeçalho**:
  - Adicionar o ponto de cor (estático/branding) ao lado do título.
  - Reorganizar estrutura para: [Ponto Cor] [Nome] [Ícone Unidade + Unidade] [Ícone ID + ID].
  - Adicionar seletor de **Status** no canto superior direito (ao lado do fechar).
  - Remover botões de Salvar/Editar do cabeçalho.
- **Abas**: Ajustar cores e paddings para coincidência exata.
- **Rodapé**:
  - Implementar o padrão com `bg-bg-tertiary`, borda e padding consistente.
  - Consolidar botões em um único botão de ação (Editar -> Salvar) com animação de loading.
  - Adicionar botão de "Excluir" (se aplicável/necessário).

#### [MODIFY] [ProfissionalFormModal.tsx](file:///Users/jeanpetri/DromeFlow/components/ui/ProfissionalFormModal.tsx)
### Global Tab Overhaul (All Tabs)
- **Layout Grid Premium**: Aplicar o sistema de grid responsivo (10 colunas/4 colunas/etc) em **todas as abas** onde aplicável.
- **Estilo de Campos (Read-only & Edit)**:
  - Labels: `text-xs text-text-secondary mb-1` (uppercase opcional para labels fixas).
  - Values/Inputs: `border border-border-secondary rounded-md p-2 bg-bg-tertiary/30 text-sm text-text-primary`.
  - Input Focus: `focus:outline-none focus:border-accent-primary`.

#### Detalhamento por Modal
1. **ProfissionalDetailModal**:
   - **Aba Início**:
     - Converter métricas (Estrelas) para layout cards se necessário ou manter estilo limpo.
     - Converter campos básicos (WhatsApp, RG, CPF, Data Nasc) para Grid de 10 colunas.
   - **Aba Dados**:
     - Converter campos complementares (Endereço, Filhos, etc.) para Grid de 4/3 colunas.
   - **Aba Histórico**:
     - Padronizar tabela (se houver) com bordas e cores do tema premium.
   - **Aba Observação** (se houver/criada ou campo obs):
     - Estilizar textarea.

2. **ProfissionalFormModal**:
   - **Aba Dados**:
     - Aplicar o mesmo grid system de 10/4 colunas para criação/edição.
   - **Aba Atendimentos** / **Pós-venda**:
     - Padronizar tabelas e métricas visualmente.
   - **Aba Observação**:
     - Estilizar textarea mantendo consistência.

#### Mapeamento de Estilo (Referência Recrutadora)
- **Linha 1**: Nome (4 cols) | Data (3 cols) | Contato (3 cols)
- **Linha 2**: Documentos (RG/CPF) (2 cols cada) | Estado Civil (2-3 cols)
- **Linha 3**: Endereço (Full width ou grid diferenciado)
- **Containers**: `rounded-md`, `bg-bg-tertiary/30` para campos de leitura.

## Plano de Verificação

### Verificação Manual
1. Abrir o modal de **Recrutadora** e observar:
   - Header (gradiente, cor, status, fechar).
   - Abas (estilo ativo/inativo).
   - Footer (botões, background).
2. Abrir os modais de **Profissionais** e validar se:
   - A estrutura física (bordas, sombras) é idêntica.
   - O cabeçalho possui os mesmos elementos no mesmo lugar.
   - O rodapé contém os botões de ação unificados.
   - O seletor de status no cabeçalho funciona corretamente.
