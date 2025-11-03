# Visão Geral do Sistema e Mapa de Configuração

Este documento descreve a arquitetura e a configuração atual da aplicação DromeFlow, servindo como um mapa para entender como os diferentes componentes se interconectam.

## 1. Estrutura de Arquivos Principal

A aplicação está organizada da seguinte forma:

- **`/index.html`**: Ponto de entrada da aplicação. Configura o `importmap` para as bibliotecas (React, Supabase, SheetJS) e o Tailwind CSS.
- **`/index.tsx`**: Monta a aplicação React no elemento `#root` do HTML.
- **`/App.tsx`**: Componente raiz que gerencia o fluxo de autenticação, decidindo se renderiza a `LoginPage` ou a `DashboardPage`.
- **`/types.ts`**: Arquivo central que define todas as interfaces e tipos de dados TypeScript usados na aplicação (User, Unit, Module, DataRecord, etc.).
- **`/contexts/`**: Contém os provedores de contexto do React para gerenciamento de estado global.
  - `AuthContext.tsx`: Gerencia o estado de autenticação do usuário (login, logout, sessão).
  - `AppContext.tsx`: Gerencia o estado da interface, como a unidade selecionada e a visualização ativa.
- **`/services/`**: Camada de comunicação com o backend, segmentada por domínio.
  - `supabaseClient.ts`: Configura e exporta o cliente Supabase, conectando a aplicação ao banco de dados.
  - `auth/users.service.ts`, `units/units.service.ts`, `modules/modules.service.ts`, `analytics/*.service.ts`, `data/dataTable.service.ts`, `ingestion/upload.service.ts`, `content/content.service.ts`, `access/accessCredentials.service.ts`.
  - Barrel temporário `services/index.ts` e compatibilidade `services/mockApi.ts` permanecem ativos até a Fase 6 de limpeza (não remover até PR dedicado atualizar todos os imports).
- **`/components/`**: Onde residem todos os componentes React.
  - `/layout/`: Componentes estruturais como `Sidebar` e `ContentArea`.
  - `/pages/`: Componentes que representam as telas principais de cada módulo (Dashboard, Dados, Gerenciamento de Usuários, etc.).
  - `/ui/`: Componentes de interface reutilizáveis (Ícones, Modais, etc.).

## 2. Fluxo de Autenticação e Sessão

1.  **Login**: O usuário insere e-mail e senha na `LoginPage`.
2.  **Verificação**: A função `login` do `AuthContext` realiza uma consulta direta na tabela `profiles` do Supabase para encontrar um usuário com o e-mail e a senha fornecidos. **Este é um fluxo de autenticação personalizado e não utiliza o `supabase.auth`** (migração futura planejada para `auth.users` + triggers e hash de senha).
3.  **Sessão**: Se as credenciais forem válidas, o `AuthContext` armazena os dados do perfil do usuário no estado do React e em `sessionStorage` para persistir a sessão no navegador.
4.  **Gerenciamento**: O `App.tsx` verifica a existência do usuário no `AuthContext` para decidir se renderiza a `DashboardPage` ou a `LoginPage`.
5.  **Persistência**: A sessão é mantida através do `sessionStorage` do navegador, permitindo que o usuário permaneça logado ao recarregar a página.

## 3. Papéis de Usuário e Controle de Acesso

O sistema possui três papéis definidos na tabela `profiles`:

1.  **`super_admin`**:
    -   **Interface**: Vê uma `Sidebar` administrativa com links de gestão (Usuários, Módulos, Unidades, Credenciais) e apenas módulos cujo `allowed_profiles` contenha explicitamente `super_admin` (não herda módulos públicos automaticamente).
    -   **Acesso**: Permissões amplas (MVP), porém exibidos somente módulos explicitamente autorizados — prepara terreno para RLS mais estrito.
2.  **`admin` / `user`**:
    -   **Interface**: Vêem uma `Sidebar` dinâmica com um seletor de unidades e uma lista de módulos aos quais têm permissão. Os módulos visíveis são filtrados com base no campo `allowed_profiles` da tabela `modules`.
    -   **Acesso**: O acesso aos dados é rigorosamente controlado por Políticas de Segurança (RLS) no Supabase. Eles só podem ver e interagir com os dados das unidades (`user_units`) e módulos (`user_modules`) que lhes foram explicitamente atribuídos.

## 4. Interação com o Banco de Dados (Supabase)

A comunicação com o backend é organizada por domínio em `services/*/*.service.ts` (ex: analytics, data, auth, units, modules, ingestion), todos usando `supabaseClient`.

### Leitura de Dados (Queries Simples)

-   Para buscar listas de dados (ex: `fetchAllUnits`, `fetchAllModules`, `fetchDataTable`), a aplicação usa consultas diretas do Supabase:
    ```javascript
    supabase.from('nome_da_tabela').select('*');
    ```

### Operações Complexas e Seguras (Funções de Banco de Dados - RPCs)

Para operações que exigem cálculos complexos ou permissões elevadas, a aplicação chama Funções de Banco de Dados (RPCs). Isso move a lógica para o servidor, tornando-a mais segura e eficiente.

-   `get_user_units(p_user_id)`: Busca as unidades de um usuário.
-   `get_user_modules(p_user_id)`: Busca os módulos de um usuário.
-   `get_dashboard_metrics(p_unit_code, p_start_date, p_end_date)`: Calcula as métricas principais do dashboard (receita, atendimentos, etc.) no servidor.
-   `process_xlsx_upload(unit_code_arg, records_arg)`: Processa o upload de arquivos XLSX, realizando uma operação de upsert para evitar duplicatas.
-   `delete_app_user(user_id_to_delete)`: Função segura (SECURITY DEFINER) para que o Super Admin possa deletar usuários.

## 5. Módulos Principais e Configuração

-   Dashboard:
  -   Fonte de Dados: Tabela `processed_data`.
  -   Lógica: `services/analytics/dashboard.service.ts` recalcula localmente serviços (originais), receita, ticket, repasse (originais + derivados) e clientes.
  -   Submétricas clicáveis: os cards de Faturamento, Atendimentos e Clientes alternam o gráfico anual para submétricas específicas (Média por Atendimento, Margem, Margem por Atendimento; Início do Mês, Evolução, Média/Dia Produtivo; Recorrentes, Atend. por Cliente, Churn). Estados e mapeamento em `components/pages/DashboardMetricsPage.tsx`.
  -   Gráfico mensal: `components/ui/MonthlyComparisonChart.tsx` aceita métricas estendidas e calcula campos derivados (`margin`, `marginPerService`); alterna Line/Bar conforme tipo.
-   Dados:
  -   Fonte de Dados: Tabela `processed_data`.
  -   Upload (XLSX):
    1.  `UploadModal.tsx` lê arquivo com SheetJS.
    2.  `uploadXlsxData` executa: expansão multi-profissional (sufixos `_N`), divisão de repasse (`processRepasseValues`), normalização de horários/datas, limpeza seletiva (`removeObsoleteRecords`) usando orçamento base (`IS_DIVISAO = 'NAO'`).
    3.  Envio em lotes (500) para RPC `process_xlsx_upload`.
-   Módulos de Administração:
  -   Usuários, Módulos, Unidades: Interfaces de CRUD que interagem com `profiles`, `modules`, `units` via serviços segmentados.
  -   Permissões: Atribuições em `user_units` e `user_modules` pelo modal de "Editar Usuário".
-   **Pós-Vendas (Sincronização Automática)**:
  -   **Fonte de Dados**: Tabelas `pos_vendas` (principal) e `processed_data` (origem).
  -   **Triggers Bidirecionais**:
    - `auto_create_pos_vendas_from_processed`: Cria registros em `pos_vendas` ao inserir em `processed_data` (AFTER INSERT).
    - `sync_pos_vendas_status`: Atualiza coluna `"pos vendas"` em `processed_data` quando `status` muda (AFTER UPDATE).
  -   **Chave Lógica**: `ATENDIMENTO_ID` (UNIQUE constraint em `pos_vendas`).
  -   **Status Padrão**: Novos registros criados com `status = 'pendente'` e `reagendou = false`.
  -   **Serviço**: `services/posVendas/posVendas.service.ts` (CRUD + métricas).
  -   **UI**: `components/pages/PosVendasPage.tsx` com cards filtráveis, tabelas paginadas e webhook opcional.
  -   **Performance**: Trigger usa `ON CONFLICT DO NOTHING` para evitar duplicações; índice em `ATENDIMENTO_ID`.
  -   Ícones e Visibilidade de Módulos: Em "Gerenciar Módulos", define ícone (lucide) e `allowed_profiles`.

-   Recrutadora:
  -   Fonte de Dados: Tabela `recrutadora` (cards) e modelo de colunas em memória compartilhado entre unidades.
  -   Colunas: Template global imutável no cliente (ex.: Qualificadas, Contato, Envio Doc, Truora, Treinamento, Finalizado, Não Aprovadas, Desistentes). Os cards são por unidade.
  -   Drag & Drop: Movimentação dentro da mesma unidade; prevenções para drops inválidos quando a visualização for "Todos".
  -   Métricas Rápidas: Chips inline no cabeçalho com contagens de Hoje, Semana e Mês (baseadas em `created_at >= início do período`). Serviços: `services/recrutadora/recrutadora.service.ts` com utilitários de data em `services/utils/dates.ts`.
  -   Visualização "Todos" (ALL): A coluna "Qualificadas" é duplicada por unidade; as demais colunas agregam cards de todas as unidades. DnD permanece restrito por unidade.

-   Comercial:
  -   Fonte de Dados: Tabelas `comercial` (cards) e `comercial_columns` (metadados de colunas).
  -   Colunas/Status: `leads`, `andamento`, `ganhos`, `perdidos`, `aguardando`. Badge com contagem por coluna; header opcional com imagem.
  -   Drag & Drop: ordenação otimista e densa (1..n) por coluna; persistência sem recarregar (updates por `id`, sem `upsert`). Stripe visual lateral via `border-left` com cor da coluna (fallback `--color-accent-primary`).
  -   ALL: após drop, executa refresh silencioso de cards/métricas (sem spinner) para refletir agregação multi‑unidade.
  -   Sincronização: trigger `comercial_sync_unit_clients` espelha status `ganhos` em `unit_clients` (upsert por unidade+nome) mantendo `endereco` e `contato` atualizados.

-   Configuração por Unidade (unit_keys):
  -   Tabela `unit_keys` com colunas: `umbler`, `whats_profi`, `whats_client`, `botID`, `organizationID`, `trigger`, `description`, `is_active`.
  -   Serviço: `services/units/unitKeys.service.ts` com `fetchUnitKeys`, `createUnitKey`, `updateUnitKey`, `deleteUnitKey`.
  -   UI: Em “Gerenciar Unidades” → Editar → aba “Keys” (somente `super_admin`). Layout atual em formato de tabela com colunas NOME (tipo da key) e KEY (valor), com edição inline e ação de excluir por linha. O botão “Adicionar Key” agora fica na mesma barra das abas.

-   **Profissionais (CRUD Completo)**:
  -   **Fonte de Dados**: Tabela `profissionais` (gestão de prestadores de serviço).
  -   **Funcionalidades**:
    - **Listagem**: Visualização paginada (25 itens/página) com busca por nome/WhatsApp.
    - **Filtros por Status**: Abas "Todas", "Ativas", "Inativas" com contadores dinâmicos.
    - **Cadastro**: Botão "Novo Cadastro" no cabeçalho abre modal para criar profissional.
    - **Edição**: Duplo clique na linha abre modal `ProfissionalDetailModal` com 3 abas (Início, Dados, Histórico).
    - **Toggle de Status**: Switch moderno (verde/cinza) para ativar/inativar com um clique.
  -   **Modal de Detalhes**:
    - Suporta **modo criação** (profissional = null) e **modo edição**.
    - Campos disponíveis: Nome*, WhatsApp, RG, CPF, Data Nascimento, Tipo, Preferência, Habilidade, Estado Civil, Fumante, Filhos, Endereço, Contatos de Recado, Observações.
    - Aba "Histórico": Lista últimos atendimentos da profissional filtrados por período (YYYY-MM).
    - Métricas de pós-venda: Avaliação média geral, comercial e residencial (estrelas 0-5).
  -   **Serviços**: `services/profissionais/profissionais.service.ts` com `fetchProfissionais`, `createProfissional`, `updateProfissional`, `updateProfissionalStatus`, `fetchProfessionalHistory`, `fetchProfessionalPosVendaMetrics`.
  -   **UX Aprimorada**: Toggle switch intuitivo, validação de campos obrigatórios, feedback visual de loading.

-   Prestadoras (Profissionais + Recrutadora):
    - Ponto de entrada: `components/pages/PrestadorasPage.tsx`.
    - Serviços: `services/analytics/prestadoras.service.ts` (contagens, métricas mensais, ranking e drill‑down).
    - Cards: Profissionais (ativos), Recrutadora (cadastros), Atendimentos (mês).
    - Painel Profissionais: resumo (médias e atuantes) + ranking (ordenável por atendimentos ou ganhos). Ao clicar numa linha abre modal com atendimentos do profissional no mês.
    - Painel Recrutadora: métricas mensais inline (cadastros, qualificadas, não aprovadas, desistentes) + "Ativadas no mês (profissionais)" a partir da tabela `profissionais`.
    - Comportamento: o ranking fica oculto quando o painel Recrutadora está ativo; Profissionais recarrega automaticamente ao mudar período/unidade quando ativo e é auto-ativado ao entrar.

-   **Clientes**:
  -   **Fonte de Dados**: Somente `processed_data`.
  -   **Período**: Seleção `YYYY-MM` (mesma UI do Dashboard); a lista exibe apenas clientes com atendimento em `M`.
  -   **Lógica Alinhada ao Dashboard**:
    - Recorrentes = interseção de clientes entre `M` e `M-1` via duas consultas discretas.
    - Atenção (churn) = clientes em `M-1` que não retornaram em `M`.
    - Outros (novos) = clientes em `M` que não estavam em `M-1`.
  -   **Detalhes de Implementação**:
    - Serviço `fetchClientMetricsFromProcessed` retorna `{ total, recorrente, atencao, outros, churnRatePercent }`.
    - Serviço `fetchClients` retorna lista de `M` e, para Atenção, metadados com `tipo`, `lastAttendance` e `monthlyCounts` (para `M`, `M-1`, `M-2`).
  -   **UI**:
    - Cartão Atenção mostra quantidade; ao clicar, filtra tabela para não-retornos.
  - Tabela em Atenção exibe colunas de `M`, `M-1`, `M-2` (ordem invertida) com cabeçalhos `Abrev/AAAA`. Quando ativa, a linha do cliente abre `ClientDetailModal` por duplo clique; o modal possui abas (Dados/Atendimentos) com filtro mensal e permite abrir `DataDetailModal` ao dar duplo clique no histórico. A Base de Clientes contém a coluna “Último Atendimento” e modal espelhado.
    - Paginação de 25 itens por página, reset em mudanças de período/filtros.

### 5.1 Visualização "Todos" (ALL) – Comportamento por Módulo

- Seleção de Unidade "Todos":
  - A fonte desta seleção é a lista de unidades do usuário (`AuthContext.userUnits`).
  - O `AppContext` expõe a unidade selecionada; os serviços e páginas adotam ramificações específicas para ALL.
- Dashboard: Agrega por múltiplas unidades respeitando o período ativo; serviços e clientes são conjuntos únicos unificados entre unidades; receita e repasse são somas diretas (ticket médio recalculado). As submétricas mensais de Atendimentos e Clientes possuem variantes multi-unidade dedicadas nos serviços de análise mensal.
- Dados: `fetchDataTableMulti` aplica `.in('unidade_code', ...)` e filtros de período/paginação de forma unificada.
- Agendamentos: `fetchAppointmentsMulti` agrega por data; o envio de webhook fica desabilitado quando a unidade selecionada é "Todos" (por segurança e semântica do endpoint).
- Clientes: Visualização multi-unidade ainda não implementada; a página informa explicitamente essa limitação quando "Todos" é selecionado.
- Recrutadora: Semântica ALL específica (vide acima), com DnD restrito e colunas globais.

## 6. Sincronização entre `auth.users` e `profiles`

Para viabilizar rapidamente o MVP com autenticação customizada (consulta direta à tabela `profiles`) e, ao mesmo tempo, preparar o terreno para futura migração para o Supabase Auth completo, foram adotadas as seguintes decisões temporárias:

### 6.1 Remoção da Foreign Key

A constraint `profiles_id_fkey` (`FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE`) foi removida para permitir inserções diretas em `profiles` sem precisar criar previamente um registro em `auth.users`.

Risco assumido: perda de integridade referencial rígida enquanto o fluxo híbrido existir.

### 6.2 Trigger de Espelhamento

Foi criada a função `public.handle_new_auth_user()` (`SECURITY DEFINER`) e o trigger:

```
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
```

Comportamento da função:
- Se já existir `profiles.id = NEW.id`, não faz nada (idempotente).
- Cria novo registro em `profiles` preenchendo:
  - `id = NEW.id`
  - `email = NEW.email`
  - `full_name = raw_user_meta_data->>'full_name'` ou prefixo do e‑mail
  - `role = raw_user_meta_data->>'role'` ou `'user'` como default
  - `created_at = now()`

### 6.3 Fluxos Atuais de Criação de Usuário

1. Via App (CRUD atual):
    - Insere diretamente em `profiles` (gera novo UUID caso não exista).
    - Atribui unidades e módulos (`user_units`, `user_modules`).
2. Via Supabase Auth (futuro / manual):
    - Ao inserir em `auth.users`, o trigger cria automaticamente o `profile` equivalente.

### 6.4 Ajuste em `createUser`

A função `createUser` em `services/auth/users.service.ts` agora:
1. Verifica se já existe `profiles.email`.
2. Se existir: atualiza campos básicos (nome, role, senha se fornecida) e reaplica atribuições.
3. Se não existir: cria novo profile.
4. Evita duplicidades (preparatório para cenário onde `auth.users` possa ter sido criado antes).

### 6.5 Próximos Passos Recomendados (Futuros)

- Adicionar trigger `AFTER UPDATE` em `auth.users` para refletir mudança de e‑mail/metadados em `profiles`.
- Reintroduzir integridade (FK) somente quando todo fluxo de criação passar por `auth.users`.
- Migrar senha para hash seguro (ex: bcrypt) e remover armazenamento em texto plano.
- Implementar fluxo de provisionamento: criar usuário com `supabase.auth.admin.createUser`, deixando trigger cuidar de `profiles`.

### 6.6 Considerações de Segurança

Enquanto as policies estão permissivas (anon CRUD), qualquer cliente com a chave pública pode alterar dados. Isso é aceitável para o MVP isolado, porém deve ser revisado antes de produção.

---
## 7. Atualizações Recentes (Changelog Técnico)

| Área | Alteração | Detalhes |
|------|-----------|----------|
| Ordenação de Módulos | Drag & Drop persistente | `@hello-pangea/dnd` + `updateModulesOrder` reatribui `position` denso (1..n). |
| Mescla de Módulos | Consolidação no `AuthContext` | União de módulos atribuídos (`user_modules`) + permitidos (`allowed_profiles`) sem duplicação. |
| Sidebar | Estado colapsado padrão | Inicia recolhida (`isCollapsed = true`) e footer adaptado (avatar + logout). |
| Upload XLSX | Chave lógica alterada | Limpeza e sincronização agora usam `orcamento` base em vez de `ATENDIMENTO_ID`. |
| Expansão Multi-profissional | Aprimorada | Sufixos `_N` + controle via `IS_DIVISAO`. Registro original mantém `VALOR`; derivados recebem `VALOR = 0`. |
| Repasse | Recalculo consistente | Dashboard e gráficos usam soma de todos os registros (originais + derivados). |
| Métricas Dashboard | Reimplementadas localmente | Reconta orçamentos originais únicos, repasse soma todos registros. |
| Clientes x Dashboard | Paridade de recorrentes/churn | Recorrentes pela interseção entre `M` e `M-1`; churn como `M-1` menos `M`; chaves de cliente brutas. |
| Clientes – Atenção | Tabela com série de 3 meses | Colunas `M`, `M-1`, `M-2` com cabeçalhos `Abrev/AAAA` e metadados `tipo`/`lastAttendance`. |
| Segurança (Provisório) | Policies permissivas | Backend aceita operações amplas (MVP) – reforço planejado. |
| Edição de Usuário | Módulos fora de escopo | Exibidos como somente leitura quando pertencem ao usuário mas não ao admin atual. |
| Limpeza de Dados | Remoção seletiva | `removeObsoleteRecords` identifica orçamentos base ausentes (originais) e remove derivados correlatos. |
| Webhook Agendamentos | POST + Fallback GET | Envia JSON completo (inclui `endereco`); se falha rede/CORS, usa GET chunkado até 3000 chars com payload compactado. |
| Comercial | DnD sem reload + fix 400 | Persistência por `update` individual (sem `upsert`), atualização silenciosa em ALL e stripe lateral com `border-left`. |
| Recrutadora | Métricas rápidas por período | Chips inline (Hoje/Semana/Mês) no cabeçalho; serviços em `services/recrutadora/recrutadora.service.ts` com `services/utils/dates.ts`. |
| Multi-Unidade (ALL) | Agregação por módulos | Dashboard, Dados e Agendamentos suportam ALL; webhook desabilitado em ALL; Recrutadora com semântica ALL; Clientes pendente. |
| Segurança de Conteúdo | Restrições no ContentArea | Injeção de HTML apenas de URLs que iniciem com `internal://`. |
| Ingestão CSV (MB Londrina) | Loader RAW → Recrutadora | Script SQL em `docs/sql/mblondrina_load_from_raw_csv.sql` usa `unit_id` fixo, normaliza status/telefones, deduplica e calcula posições. |
| Dashboard – Submétricas | Cliques alternam o gráfico anual | Estados de submétrica em `DashboardMetricsPage.tsx`; serviços mensais single/multi em `serviceAnalysis.service.ts`; gráfico `MonthlyComparisonChart.tsx` calcula margem e alterna Line/Bar. |

---
## 8. Convenções Atuais de Dados

| Conceito | Regra |
|----------|------|
| Orçamento Base | Registro sem sufixo, `IS_DIVISAO = 'NAO'`. |
| Derivado (Divisão) | `orcamento` com sufixo `_N`, `IS_DIVISAO = 'SIM'`. |
| Repasse Derivado | Distribuído por valor individual ou divisão igual. |
| Contagem de Serviços | Número de orçamentos base únicos no período. |
| Ticket Médio | Receita (somente originais) / Serviços. |
| Endereço (Agendamentos) | Incluído em payload webhook (`endereco` / chave compacta `e`). |
| Webhook Fallback | GET com `payload` JSON compactado + chunking adaptativo. |
| Módulo Ativo | `is_active = true` (filtro final no Sidebar). |
| Módulo Público | `allowed_profiles` null/vazio (incluído para todos não-super admins). |

---
## 9. Melhorias Futuras Planejadas

1. Hash de senhas (bcrypt) + migração para `auth.users` integral.
2. RPC batch para reordenar módulos (reduzir múltiplas round-trips).
3. Reforço de RLS: políticas por unidade/módulo com base em joins.
4. Índices: `(unidade_code, DATA, IS_DIVISAO)` e `(unidade_code, orcamento)`.
5. Cache de métricas agregadas mensais (materialized view ou tabela incremental).
6. Logging estruturado para upload (tabela de auditoria).

---
## 10. Notas para Colaboradores / Agentes

Ao adicionar nova feature:
- Centralize a interação com Supabase nos serviços segmentados em `services/*/*.service.ts`.
- Reuse as convenções de expansão de profissionais (não duplique lógica em componentes).
- Mantenha ordenação de módulos consistente (sempre atualizar `position`).
- Evite dependência residual em `ATENDIMENTO_ID` (legado). Priorize `orcamento` e flags existentes.

## 11. Guia Rápido para Novos Módulos

Siga estes passos ao introduzir um novo módulo que aparecerá na Sidebar:

1) Registro em `modules`
- Defina `code`, `name`, `icon_name`, `allowed_profiles`, `position`, `is_active`.

2) Página React
- Crie `components/pages/NomeDoModuloPage.tsx` com estrutura de filtros, conteúdo (cards/tabelas/gráficos) e responsividade via Tailwind.

3) Serviços
- Crie/estenda serviços em `services/analytics|data|content|.../nomeDoModulo.service.ts`.
- Centralize regras de negócio no serviço; componentes só orquestram UI.

4) Navegação
- Use `setView(code)` via `AppContext` para abrir a página; `ContentArea` resolverá qual componente exibir.

5) Permissões e Atribuições
- Ajuste `allowed_profiles` do módulo e atribuições em `user_modules` conforme necessário.

---
_Documento ampliado para refletir estado operacional atualizado (02/10/2025)._ 

## 12. Configuração Única por Unidade (unit_keys) – 03/10/2025

- Tabela `public.unit_keys` reestruturada para um registro por unidade (`UNIQUE (unit_id)`).
- Novas colunas: `umbler`, `whats_profi`, `whats_client`, `botID`, `organizationID`, `trigger` (todas texto), além de `description` e `is_active`.
- RLS: habilitado com políticas permissivas para SELECT/INSERT/UPDATE/DELETE (restrição de edição assegurada na UI ao perfil `super_admin`). Recomendado evoluir para RLS restritiva com Supabase Auth (claims de role) no futuro.
- Serviço: `services/units/unitKeys.service.ts` provê `fetchUnitKeys`, `createUnitKey`, `updateUnitKey`, `deleteUnitKey` para a configuração única.
- UI: Em "Gerenciar Unidades" → Editar → aba "Keys" (somente `super_admin`). Formulário único com auto‑save por debounce (~600ms), indicador de salvamento e botão "Remover" quando existir configuração.

---
### Referência: Subdomínios e URLs por Módulo

Para publicar cada unidade em seu subdomínio e manter o módulo no path (ex.: `https://<slug>.dromeboard.com.br/<module>`), consulte `docs/SUBDOMINIOS_E_URLS.md`.
