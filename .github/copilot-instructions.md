# Orientações para o Agente de Codificação de IA

Este documento fornece orientações para agentes de codificação de IA que trabalham nesta base de código.

## Arquitetura e Padrões

### Visão Geral

Esta é uma aplicação React (`.tsx`) construída com Vite, usando TypeScript. A interface do usuário é estilizada com Tailwind CSS. O gerenciamento de estado é feito através dos Contextos React, e o backend é fornecido pelo Supabase. A autenticação é personalizada, validando credenciais diretamente na tabela `profiles`.

### Estrutura de Diretórios

-   `src/components`: Contém componentes React, divididos em `layout`, `pages` e `ui`.
    -   `pages`: Componentes que representam visualizações completas da página.
    -   `layout`: Componentes estruturais como `Sidebar` e `ContentArea`.
    -   `ui`: Componentes de UI reutilizáveis como `Icon`, modais e gráficos.
-   `src/contexts`: Contém os provedores de Contexto React para gerenciamento de estado global.
    -   `AuthContext.tsx`: Gerencia a autenticação do usuário, perfil e sessões. Lida com um fluxo de login personalizado.
    -   `AppContext.tsx`: Gerencia o estado da aplicação, como a visualização ativa e a unidade selecionada.
-   `src/services`: Contém módulos para interagir com serviços externos.
    -   `supabaseClient.ts`: Inicializa e exporta o cliente Supabase.
    -   `mockApi.ts`: **(Camada de Acesso a Dados)** Nome legado. Este arquivo é a camada de serviço principal que centraliza toda a comunicação com o Supabase, incluindo consultas, mutações e chamadas de funções (RPCs). Contém lógica de negócios crucial para processamento de dados.

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
-   A lógica de negócios complexa, como o processamento de uploads de planilhas e cálculos de métricas, é tratada em `services/mockApi.ts`, que por sua vez chama funções de banco de dados (RPCs) no Supabase.

## Fluxos de Trabalho de Desenvolvimento

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
- **Camada de Acesso a Dados** (`services/mockApi.ts`):
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
 - **Centralização**: Qualquer nova regra de upload / métricas deve ir para `mockApi.ts` (não duplicar em componentes).
 - **Evolução**: Próxima otimização para reorder será RPC única (batch JSON) reduzindo round-trips.
