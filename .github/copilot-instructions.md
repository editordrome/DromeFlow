# Orientações para o Agente de Codificação de IA

Este documento fornece orientações para agentes de codificação de IA que trabalham nesta base de código.

## Arquitetura e Padrões

### Visão Geral

Esta é uma aplicação React (`.tsx`) construída com Vite, usando TypeScript. A interface do usuário é estilizada com Tailwind CSS. O gerenciamento de estado é feito através dos Contextos React, e o backend é fornecido pelo Supabase. A autenticação é personalizada, validando credenciais diretamente na tabela `profiles`.

### Estrutura de Diretórios

-   `components`: Contém componentes React, divididos em `layout`, `pages` e `ui`.
    -   `pages`: Componentes que representam visualizações completas da página.
    -   `layout`: Componentes estruturais como `Sidebar` e `ContentArea`.
    -   `ui`: Componentes de UI reutilizáveis como `Icon`, modais e gráficos.
-   `contexts`: Contém os provedores de Contexto React para gerenciamento de estado global.
    -   `AuthContext.tsx`: Gerencia a autenticação do usuário, perfil e sessões. Lida com um fluxo de login personalizado.
    -   `AppContext.tsx`: Gerencia o estado da aplicação, como a visualização ativa e a unidade selecionada.
-   `services`: Contém módulos para interagir com serviços externos.
    -   `supabaseClient.ts`: Inicializa e exporta o cliente Supabase.
    -   Serviços segmentados por domínio em `services/*/*.service.ts` (analytics, data, auth, units, modules, ingestion, content, access, utils).

### Fluxo de Dados e Gerenciamento de Estado

1.  **Autenticação**: O `App.tsx` envolve a aplicação no `AuthProvider`. O `AuthProvider` (`contexts/AuthContext.tsx`) lida com um fluxo de login/logout personalizado que verifica as credenciais do usuário na tabela `profiles` do Supabase.
2.  **Estado da Aplicação**: O `AppContextProvider` (`contexts/AppContext.tsx`) gerencia o estado da interface do usuário, como a visualização atualmente exibida (`activeView`) e a unidade selecionada.
3.  **Renderização de Conteúdo**: O componente `ContentArea` (`components/layout/ContentArea.tsx`) renderiza dinamicamente os componentes da página com base no `activeView` do `AppContext`. Para visualizações de "módulo", ele busca e exibe conteúdo de um webhook.

### Roteamento e Navegação

A aplicação não usa uma biblioteca de roteamento tradicional como o React Router. Em vez disso, a navegação é controlada pelo estado `activeView` no `AppContext`. O `Sidebar` e outros componentes atualizam essa visualização usando a função `setView` do contexto para alterar o conteúdo exibido no `ContentArea`.

### Integração com o Supabase

-   O cliente Supabase é configurado em `services/supabaseClient.ts`. As credenciais são codificadas, o que é adequado para chaves anônimas públicas, mas deve ser gerenciado com variáveis de ambiente em produção.
-   O `AuthContext` implementa uma lógica de autenticação personalizada, consultando a tabela `profiles` para validar o usuário. **Não utiliza `supabase.auth.signInWithPassword`**.
-   Os dados do perfil do usuário são buscados da tabela `profiles` no Supabase.
-   A lógica de negócios complexa, como o processamento de uploads de planilhas e cálculos de métricas, está nos serviços segmentados (por exemplo, `services/ingestion/upload.service.ts`, `services/analytics/*.service.ts`), que por sua vez chamam funções de banco de dados (RPCs) no Supabase.

## Fluxos de Trabalho de Desenvolvimento

### Confirmação prévia antes de editar (Obrigatório)

Antes de criar/editar/excluir qualquer arquivo, rodar comandos ou aplicar migrações:

- Informe ao usuário exatamente o que pretende fazer, listando:
    - Arquivo(s) a serem alterados e tipo de mudança (ex.: título do cabeçalho, nova prop, ajuste de estilo, etc.).
    - Objetivo e impacto esperado (ex.: alterar o título do módulo para exibir o dia da semana).
    - Passos a executar (ex.: editar arquivo X, atualizar Y, rodar build/teste se aplicável).
- Aguarde uma confirmação explícita do usuário (ex.: “Pode prosseguir”, “Aprovado”).
- Apenas após a confirmação execute as alterações e comandos.
- Se houver múltiplas opções de implementação, apresente as alternativas e peça a escolha do usuário.
- Não inicie servidores, nem execute comandos potencialmente destrutivos (mutações em dados, migrações, resets) sem aprovação explícita.
- Respostas puramente explicativas (sem editar arquivos) são permitidas sem confirmação; caso, depois, decida aplicar mudanças, retorne e solicite aprovação antes de executar.

### Executando a Aplicação

Para executar a aplicação localmente, siga os passos no `README.md`:

1.  Instale as dependências:
    ```bash
    npm install
    ```
2.  Execute o servidor de desenvolvimento:
    ```bash
    npm run dev
    ```

Não há um passo de build explícito mencionado para desenvolvimento, pois o Vite lida com isso com seu servidor de desenvolvimento.

### Convenções de Código

-   **TypeScript**: A base de código usa TypeScript. Os tipos são definidos em `types.ts`.
-   **Estilo**: O Tailwind CSS é usado para estilização.
-   **Componentes**: Os componentes são funcionais e usam Hooks do React.
-   **Nomenclatura de Arquivos**: Os componentes e contextos são nomeados em PascalCase (`MeuComponente.tsx`), enquanto os serviços são em camelCase (`meuServico.ts`).

## Pontos Importantes (Atualizados)

- **Segurança de Conteúdo**: `ContentArea.tsx` só injeta HTML de URLs iniciando com `internal://`.
- **Camada de Acesso a Dados** (serviços segmentados):
    - Upload XLSX: expansão multi-profissional (sufixos `_N`), divisão de repasse e limpeza baseada em orçamentos base (`orcamento`).
    - Sincronização: `removeObsoleteRecords` elimina registros cujo orçamento base não está mais presente no arquivo importado.
    - Métricas: `fetchDashboardMetrics` e `fetchMonthlyChartData` recalculam contagem de serviços (orçamentos base, ignorando derivados) e repasse (soma total de originais + derivados).
    - Ordenação de Módulos: drag & drop persistido via `updateModulesOrder` atualiza `position`.
- **Mescla de Módulos**: Lógica no `AuthContext` já entrega a lista final (atribuições + `allowed_profiles` + públicos). Sidebar apenas filtra `is_active`.
- **Gerenciamento de Estado**: Novos estados globais — decidir entre `AuthContext` (identidade/permissões) e `AppContext` (UI / view / unidade).
- **Chave Lógica de Sincronização**: Usar `orcamento` (base) como identificador; evitar reutilizar `ATENDIMENTO_ID` (legado presente só em alguns registros antigos).
- **Expansão de Profissionais**: Registro original mantém `VALOR`; derivados recebem `VALOR = 0` e mesma proporção de `REPASSE` (se aplicável).
- **Contagem de Serviços**: Baseada exclusivamente em orçamentos originais (`IS_DIVISAO != 'SIM'`).
- **Repasse**: Sempre soma todos os registros (originais + derivados) para refletir distribuição integral.
- **Futuro (Planejado)**: hash de senha, migração para `auth.users` + triggers, RPC batch para ordenação, políticas RLS restritivas e índices analíticos.
 - **Super Admin**: Exibe apenas módulos cujo `allowed_profiles` contém `super_admin` (sem herdar públicos automaticamente).
 - **Ordenação densa**: Após drag & drop reatribuir `position` como sequência contínua (1..n); evitar gaps.
 - **Webhook Agendamentos**: Fluxo preferencial POST JSON completo; fallback automático GET com payload compactado + chunking (limite ~3000 chars) em falha de rede/CORS; inclui campo `endereco` e forma compacta (`e`).
- **Centralização**: Qualquer nova regra de upload / métricas deve ir para os serviços segmentados apropriados (por exemplo, `services/ingestion/upload.service.ts` ou `services/analytics/*.service.ts`), não duplique em componentes.
 - **Evolução**: Próxima otimização para reorder será RPC única (batch JSON) reduzindo round-trips.

## Guia Rápido: Criar um Novo Módulo (padrão)

Ao adicionar um novo “módulo” de negócio (aparece na Sidebar), siga este padrão para manter a consistência:

1) Banco de Dados (tabela `modules`)
- Crie/ajuste um registro com os campos:
    - `code` (string única, usada como chave de view)
    - `name` (rótulo na UI)
    - `description` (opcional)
    - `icon_name` (nome do ícone lucide, ex: "BarChart3")
    - `allowed_profiles` (array: ["admin", "user"], inclua "super_admin" apenas quando exclusivo)
    - `position` (número; mantido denso pelo reorder)
    - `is_active` (boolean)

2) Página de UI
- Crie `components/pages/SeuModuloPage.tsx` seguindo o padrão de páginas existentes (com hook de período/unidade quando aplicável). Ex.: filtros no topo, cards e tabela ou gráfico. Estilização com Tailwind.

3) Serviço(s) de Dados
- Caso precise de dados, crie um serviço por domínio em `services/<dominio>/<nome>.service.ts`.
    - Exemplos: `services/analytics/seuModulo.service.ts` (regras de métricas), `services/data/seuModulo.service.ts` (CRUD/listas).
    - Consuma o `supabaseClient` e mantenha a lógica de negócio no serviço (não no componente).

4) Navegação/Renderização
- O `AuthContext` já compõe a lista final de módulos permitidos; a `Sidebar` mostra apenas `is_active`.
- O `ContentArea` renderiza a página com base em `activeView` (normalmente, igual ao `code` do módulo) ou carrega HTML externo quando a origem começar com `internal://`.

5) Permissões
- Para restringir acesso por perfil, defina `allowed_profiles` no módulo e, se necessário, atribua o módulo ao usuário em `user_modules` (para admins/users). Super Admin não herda módulos públicos automaticamente.

6) Ordem de Exibição
- Arraste na UI de “Gerenciar Módulos”; o serviço `updateModulesOrder` persistirá `position` como 1..n.

7) Boas práticas
- Tipos no `types.ts` sempre que expor novas estruturas de dados.
- Evite duplicar regras nos componentes — centralize em `services/*/*.service.ts`.
- Para gráficos reutilize `components/ui/MonthlyComparisonChart.tsx` quando fizer sentido.
