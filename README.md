<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

## DromeFlow

Aplicação de gestão e análise construída em React (Vite + TypeScript) com Supabase como backend e Tailwind para estilização. Inclui:

## Configuração por Unidade (Keys)

Cada unidade possui uma configuração única armazenada na tabela `unit_keys`. Essa configuração é gerenciada na UI em Gerenciar Unidades → Editar → aba "Keys" (visível para perfis super_admin).

Campos disponíveis (todos opcionais, texto):
- umbler
- whats_profi
- whats_client
- botID
- organizationID
- trigger

Outros campos de apoio:
- description (texto)
- is_active (booleano)

Comportamento na UI (layout atual):
- Aba "Keys" no modal da Unidade exibe uma tabela com colunas NOME (tipo da key) e KEY (valor). Edição inline salva automaticamente ao sair do campo ou pressionar Enter.
- O botão "Adicionar Key" fica na mesma barra das abas; ao clicar, escolhe-se o tipo e uma nova linha é criada.
- A coluna AÇÕES permite excluir a key.

Requisitos de backend:
- RLS habilitado e políticas permissivas (SELECT/INSERT/UPDATE/DELETE) foram aplicadas para permitir o fluxo atual, com a restrição de permissão feita na UI (apenas super_admin vê/edita Keys). Em produção, recomenda‑se vincular a role via JWT (Supabase Auth) e restringir as políticas pelo claim.

## Pós-Vendas - Sincronização Automática

### Fluxo Bidirecional
- **processed_data → pos_vendas**: Trigger `auto_create_pos_vendas_from_processed` cria registros automaticamente ao inserir novos atendimentos com `ATENDIMENTO_ID`.
- **pos_vendas → processed_data**: Trigger `sync_pos_vendas_status` atualiza coluna `"pos vendas"` quando `status` muda.

### Realtime
Os seguintes módulos implementam atualizações em tempo real via Supabase Realtime. Mudanças feitas por qualquer usuário são refletidas instantaneamente para todos os visualizadores:

- ✅ **Pós-Vendas**: Completo - sincronização bidirecional com `processed_data`
- ✅ **Agendamentos**: Completo - atualização automática da tabela de agendamentos
- ✅ **Dashboard/Métricas**: Completo - recalculo automático de métricas

**Status**: ✅ Implementado e funcionando. Para detalhes técnicos, consulte [`docs/REALTIME_STATUS.md`](docs/REALTIME_STATUS.md).

### Campos Mapeados
| pos_vendas | ← | processed_data |
|-----------|---|----------------|
| `ATENDIMENTO_ID` | ← | `ATENDIMENTO_ID` |
| `nome` | ← | `CLIENTE` |
| `contato` | ← | `whatscliente` |
| `unit_id` | ← | `units.id` (via `unidade_code`) |
| `data` | ← | `DATA` |
| `status` | ← | `'pendente'` (padrão) |
| `reagendou` | ← | `false` (padrão) |

### Comportamento
- População inicial: Script [`populate_pos_vendas_from_processed_data()`](docs/sql/2025-10-31_populate_pos_vendas.sql)
- Novos registros: Criados automaticamente via trigger (ON CONFLICT DO NOTHING)
- Atualizações: Status editado em `pos_vendas` reflete em `processed_data."pos vendas"`

---

- Autenticação customizada via tabela `profiles` (MVP – sem `supabase.auth` ainda).  
   Nota: O barrel `services/index.ts` e o arquivo de compatibilidade `services/mockApi.ts` seguem ativos até a Fase 6 de limpeza.
- Módulos dinâmicos (icones + allowed_profiles + ordenação drag & drop persistida).
- Dashboard com métricas recalculadas localmente (repasse, ticket médio real).
- Upload de planilhas XLSX com expansão de múltiplos profissionais e sincronização por período.
- **Controle de acesso baseado em unidades**: Sistema hierárquico de permissões com `unit_modules` e `user_modules`.
- Visualização multi-unidade ("Todos") em módulos selecionados com agregações corretas por período.
 - Módulo Prestadoras com dois painéis: Profissionais (ativos) e Recrutadora (cadastros), incluindo métricas mensais, ranking e drill‑down de atendimentos por profissional.

---

## Sistema de Controle de Acesso (Unit-Based Access Control)

### Visão Geral

O sistema implementa um controle de acesso granular baseado em **unidades** e **perfis de usuário**, permitindo que administradores definam quais módulos cada unidade pode acessar e quais usuários têm permissão específica dentro de suas unidades.

### Estrutura de Tabelas

#### `unit_modules` (Nova - 2025-11-11)
Define os módulos disponíveis para cada unidade:
- **Composite PK**: `(unit_id, module_id)`
- **Campos**: `unit_id`, `module_id`, `created_at`, `updated_at`
- **Índices**: 3 índices otimizados para consultas por unidade, módulo e lookup
- **RLS**: Políticas permissivas (authenticated users)
- **Trigger**: Auto-atualização de `updated_at`

**RPCs Disponíveis**:
```sql
get_unit_modules(p_unit_id uuid) -- Lista módulos de uma unidade
assign_modules_to_unit(p_unit_id uuid, p_module_ids uuid[]) -- Atribui múltiplos
check_unit_module_access(p_unit_id uuid, p_module_id uuid) -- Verifica acesso
```

**View Agregada**:
```sql
unit_modules_summary -- Estatísticas: unit_id, module_count, module_names
```

#### `user_modules` (Existente)
Define atribuições individuais de módulos para usuários:
- **Composite PK**: `(user_id, module_id)`
- **Campos**: `user_id`, `module_id`, `created_at`
- **Nota**: Não possui relação com `unit_id` (atribuição global)

### Hierarquia de Permissões

A função `AuthContext.getModulesForUnit(unitId)` implementa a seguinte hierarquia:

#### 1. Super Admin
- **Acesso**: Apenas módulos com `'super_admin'` em `allowed_profiles`
- **Regra**: Ignora `unit_modules` e `user_modules`
- **Comportamento**: Não herda módulos de outros perfis automaticamente

#### 2. Admin
- **Acesso**: TODOS os módulos atribuídos à unidade via `unit_modules`
- **Regra**: Não precisa de atribuição em `user_modules`
- **Query**: `SELECT module_id FROM unit_modules WHERE unit_id = ?`

#### 3. User
- **Acesso**: Interseção de `user_modules` ∩ `unit_modules`
- **Regra**: Precisa estar em ambas as tabelas para ter acesso
- **Query**: Módulos onde `user_id` E `unit_id` coincidem

### Interface de Gerenciamento

#### Aba "Módulos" em Unidades (ManageUnitsPage)
**Local**: Gerenciar Unidades → Editar Unidade → Aba "Módulos"

**Funcionalidades**:
- Grid de checkboxes (2 colunas, responsivo)
- Lista todos os módulos ativos (`is_active = true`)
- Checkboxes pré-selecionados baseados em `unit_modules`
- Feedback visual: "Salvando..." → "Salvo!" → "Salvar Módulos"

**Fluxo**:
```
Admin seleciona checkboxes → Clica "Salvar Módulos" → 
updateUnitModules(unitId, moduleIds) → 
DELETE FROM unit_modules WHERE unit_id → 
INSERT batch de novos módulos
```

#### Aba "Módulos" em Usuários (UserFormModal)
**Local**: Gerenciar Usuários → Editar Usuário → Aba "Módulos"

**Funcionalidades**:
- **Multi-unit**: Dropdown para selecionar unidade (quando usuário tem múltiplas)
- Grid de checkboxes filtrado por unidade selecionada
- Módulos disponíveis = `unit_modules` da unidade escolhida

**Comportamento por Perfil**:
- **Super Admin**: Checkboxes desabilitados (acesso automático a módulos super_admin)
- **Admin**: Vê módulos da unidade (não salva em `user_modules`, herda tudo automaticamente)
- **User**: Marca módulos que terá acesso (salva em `user_modules`)

**Estado Gerenciado**:
```typescript
modulesByUnit: Map<unitId, Set<moduleId>> // Distribui módulos por unidade
selectedUnitForModules: string // Unidade atualmente selecionada no dropdown
```

**Fluxo de Salvamento**:
```
Admin marca checkboxes → Clica "Salvar" → 
updateUserAssignments(userId, unitIds, moduleIds) → 
DELETE FROM user_modules WHERE user_id → 
INSERT batch de novos módulos (globalmente, sem unit_id)
```

### Navegação e Sidebar

#### AuthContext
- Função `getModulesForUnit(unitId)` retorna módulos filtrados por perfil
- Implementa a hierarquia de permissões descrita acima

#### AppContext
- **Inicialização**: Carrega primeiro módulo ativo da unidade ao fazer login
- **Detecção de view_id**: Se módulo tem `view_id`, navega direto (sem webhook)
- **Mudança de unidade**: Recarrega automaticamente o primeiro módulo ativo da nova unidade

#### Sidebar
- Filtra módulos por `is_active = true`
- Lista dinâmica baseada em `getModulesForUnit(selectedUnitId)`
- Atualiza automaticamente ao mudar unidade selecionada

### Fluxo Completo de Uso

#### 1. Configurar Módulos da Unidade
```
Super Admin/Admin →
ManageUnitsPage → Editar Unidade → Aba "Módulos" →
Marcar módulos desejados → Salvar →
Registros criados em unit_modules
```

#### 2. Atribuir Módulos ao Usuário (Role: User)
```
Admin →
ManageUsersPage → Editar Usuário → Aba "Módulos" →
Selecionar Unidade no dropdown →
Marcar módulos específicos → Salvar →
Registros criados em user_modules
```

#### 3. Login e Visualização
```
Usuário faz login →
AuthContext carrega profile e unidades →
AppContext chama getModulesForUnit(selectedUnit) →
Sidebar renderiza módulos filtrados →
Navega para primeiro módulo ativo (view_id ou webhook)
```

### Serviços TypeScript

#### `services/units/unitModules.service.ts` (9 funções)
1. `fetchUnitModules(unitId)` - Lista módulos de uma unidade
2. `assignModulesToUnit(unitId, moduleIds)` - Atribui múltiplos (RPC)
3. `assignModuleToUnit(unitId, moduleId)` - Atribui único
4. `removeModuleFromUnit(unitId, moduleId)` - Remove único
5. `checkUnitModuleAccess(unitId, moduleId)` - Verifica acesso (RPC)
6. `fetchUnitModulesSummary()` - Estatísticas agregadas (VIEW)
7. `fetchUnitModuleAssignments()` - Todas as atribuições
8. `updateUnitModules(unitId, moduleIds)` - Delete all + insert batch
9. `fetchUnitModuleIds(unitId)` - Retorna apenas IDs

#### `services/auth/users.service.ts`
- `updateUserAssignments(userId, unitIds, moduleIds)`:
  - Delete-then-insert pattern para `user_units` e `user_modules`
  - Logging abrangente para debug
  - Tratamento de conflitos com composite PKs

### Boas Práticas

#### Debug
Console logs disponíveis para troubleshooting:
- `[UserFormModal] Módulos carregados do usuário: [...]`
- `[handleModuleToggle] Toggling module: ...`
- `[updateUserAssignments] user_modules inseridos com sucesso`

#### Validações
1. Sempre usar `new Set()` ao atualizar estados com Sets (imutabilidade React)
2. Filtrar `null`/`undefined` em `.map()` antes de renderizar listas
3. Recarregar dados ANTES de fechar modais (evita tela branca)
4. Adicionar `selectedUnit` como dependência em callbacks que filtram por unidade

---
## Comercial (Kanban)

O módulo Comercial exibe oportunidades em colunas de status com arrastar‑e‑soltar e persistência otimista.

- Colunas/Status padrão: `leads`, `andamento`, `ganhos`, `perdidos`, `aguardando` (tabela `comercial_columns`).
- Cards (tabela `comercial`): `id, unit_id, nome, tipo, endereco, contato, status, observacao, position, created_at, updated_at`.
- Drag & Drop:
   - Atualização otimista no cliente, reatribuindo `position` densamente por coluna (1..n).
   - Persistência sem recarregar a tela: aplica `update` individual por card alterado (sem `upsert`), evitando erro 400.
   - Stripe lateral colorido: usa `border-left` com a cor da coluna; fallback para `var(--color-accent-primary)`.
- ALL (todas as unidades): após o drop, ocorre um refresh silencioso apenas dos cards/métricas (sem spinner), mantendo a UI estável.
- Sincronização com Clientes: trigger `comercial_sync_unit_clients` espelha cards "ganhos" em `unit_clients` (upsert por unidade+nome).
- **Realtime**: 🔄 Planejado (não implementado ainda)

Troubleshooting
- Erro 400 em reordenação: ocorreu ao usar `upsert` com `on_conflict=id`. Resolvido trocando por `update` simples por `id` (sequencial) e enviando somente os cards efetivamente alterados (status/position mudaram).
- Stripe sem cor: garanta que `index.html` contenha `--color-accent-primary: var(--accent-primary);` no `:root`.

---
## 1. Requisitos

- Node.js 18+
- NPM 9+
- Projeto Supabase com tabelas e RPCs: `get_user_units`, `get_user_modules`, `get_dashboard_metrics`, `process_xlsx_upload`, `delete_app_user`, `unit_keys_list_columns`, `unit_keys_add_column`, `unit_keys_rename_column`, `unit_keys_drop_column`, `unit_keys_columns_stats`, `unit_keys_set_column_status`, `sync_unit_clients_from_processed`.

---
## 2. Configuração de Ambiente

Crie `.env.local` na raiz:

```
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_CHAVE_ANON
```

O cliente é inicializado em `services/supabaseClient.ts` usando `import.meta.env`.

---
## 3. Instalação e Execução

```bash
npm install
npm run dev
```

Build produção:

```bash
npm run build
npm run preview
```

---
## 4. Arquitetura (Resumo)

| Camada | Arquivo(s) | Função |
|--------|------------|--------|
| Entrada | `index.html` / `index.tsx` | Montagem raiz Vite/React |
| Contextos | `contexts/AuthContext.tsx`, `contexts/AppContext.tsx` | Autenticação + estado de UI |
| Serviços | `services/*/*.service.ts`, `services/supabaseClient.ts` | Acesso a dados / RPC / regras de negócio |
| UI Layout | `components/layout/Sidebar.tsx`, `ContentArea.tsx` | Navegação e slot principal |
| Páginas | `components/pages/*.tsx` | Telas funcionais (Dashboard, Dados, Gestão, etc.) |
| Tipos | `types.ts` | Contratos TypeScript |

Notas:
- O `ContentArea` só injeta HTML quando a origem começa com `internal://` (segurança de conteúdo).

---
## 5. Autenticação

Fluxo MVP simples (sem Supabase Auth oficial):

1. `login(email, password)` consulta `profiles` diretamente.
2. Perfil armazenado em `localStorage`.
3. Módulos carregados via `fetchUserModules` no `AuthContext`:
   - `super_admin`: apenas módulos cujo `allowed_profiles` contém explicitamente `super_admin` (não herda mais módulos públicos por padrão).
   - Demais perfis: união de (atribuições diretas em `user_modules`) + (módulos cujo `allowed_profiles` contém o papel) + módulos públicos (allowed_profiles null/vazio), removendo duplicatas; filtro final por `is_active`.

> Futuro: migrar para `auth.users` + trigger de espelhamento + hash de senha.

---
## 6. Módulos e Ordenação

Gerenciados em `ManageModulesPage` (CRUD) e ordenados por drag & drop (`@hello-pangea/dnd`). Persistência:

- Serviço: `updateModulesOrder` em `services/modules/modules.service.ts` (reatribui `position` como sequência densa 1..n). Planejada otimização futura via RPC batch para reduzir round-trips.
- Ordenação: `position` sequencial (densa; sempre reatribuída 1..n em reorder) + `name` como fallback secundário.
- Sidebar consome lista já consolidada do `AuthContext` (mescla + filtragem de permissões) e só exibe `is_active`.

Campos chave de um módulo (tabela `modules`):
```
id, code, name, icon_name, is_active, allowed_profiles[], position, description?, webhook_url?
```

### 6.1 Guia rápido: criar um novo módulo (padrão)

1) Banco de Dados (tabela `modules`)
- Defina `code` (chave única), `name`, `icon_name` (lucide), `allowed_profiles` (ex.: ["admin","user"]), `position` (número), `is_active` (boolean). `description` e `webhook_url` são opcionais.

2) Página de UI
- Crie `components/pages/SeuModuloPage.tsx` seguindo o padrão das páginas atuais (filtros, cards/tabelas/gráficos, Tailwind).

3) Serviço(s) de Dados
- Adicione um serviço por domínio em `services/<dominio>/<nome>.service.ts` (ex.: `analytics/seuModulo.service.ts` ou `data/seuModulo.service.ts`). Centralize a lógica de negócio no serviço.

4) Navegação/Renderização
- O `AuthContext` já compõe a lista final de módulos; a `Sidebar` filtra `is_active`.
- O `ContentArea` renderiza com base em `activeView` (normalmente igual ao `code` do módulo). Para conteúdo externo, use origem começando com `internal://` quando aplicável.

5) Permissões
- Restrinja por perfil via `allowed_profiles`; para admins/users, atribua em `user_modules` quando necessário. Super Admin enxerga apenas módulos com `super_admin` explicitamente em `allowed_profiles`.

6) Ordem de Exibição
- Use a tela de “Gerenciar Módulos” (drag & drop). O serviço `updateModulesOrder` persiste `position` como 1..n.

7) Boas práticas
- Tipos no `types.ts` para novas estruturas.
- Evite duplicar regras nos componentes — centralize em `services/*/*.service.ts`.
- Reutilize `components/ui/MonthlyComparisonChart.tsx` quando fizer sentido.

Notas adicionais:
- O barrel `services/index.ts` e o arquivo de compatibilidade `services/mockApi.ts` seguem ativos até a Fase 6 de limpeza. Não remova até um PR dedicado atualizar todos os imports.

---
## 7. Upload de Dados (XLSX)

### 7.1 Pipeline de Processamento

`uploadXlsxData` em `services/ingestion/upload.service.ts`:

1. **Leitura**: Arquivo XLSX lido no browser com SheetJS.
2. **Expansão Multi-Profissionais**: Registros com `PROFISSIONAL` contendo `;` são expandidos:
   - Registro original mantém `ATENDIMENTO_ID` sem sufixo, `VALOR` integral, `IS_DIVISAO='NAO'`
   - Derivados recebem sufixos `_1`, `_2`, etc. no `ATENDIMENTO_ID`, `VALOR=0`, `IS_DIVISAO='SIM'`, repasse proporcional
3. **Divisão de Repasse**: `processRepasseValues` divide valores múltiplos ou aplica divisão equitativa.
4. **STATUS Automático**: `applyWaitStatusForAfternoonShifts` marca `STATUS="esperar"` para atendimentos "Tarde" quando profissional tem múltiplos atendimentos no mesmo dia.
5. **Limpeza de Obsoletos**: `removeObsoleteRecords` remove registros cujo `ATENDIMENTO_ID` base não está mais no arquivo (escopo: período do arquivo + unidade).
6. **Envio em Lotes**: Dados enviados em batches de 500 para RPC `process_xlsx_upload`.
7. **Agregação de Métricas**: Retorna contadores (`inserted`, `updated`, `ignored`, `deleted`).

### 7.2 Comportamento de Atendimentos Existentes

**Chave Única**: `(unidade_code, ATENDIMENTO_ID)`

| Situação | Ação | Descrição |
|----------|------|-----------|
| **Novo ATENDIMENTO_ID** | `INSERT` | Cria novo registro com todos os campos |
| **ATENDIMENTO_ID existente** | `UPDATE` | Atualiza DATA, HORARIO, VALOR, SERVIÇO, TIPO, PERÍODO, MOMENTO, CLIENTE, PROFISSIONAL, ENDEREÇO, DIA, REPASSE, whatscliente, CUPOM, ORIGEM, IS_DIVISAO, CADASTRO, unidade. **STATUS** é preservado se PROFISSIONAL não mudou; atualizado se PROFISSIONAL mudou |
| **ID não está mais no arquivo** | `DELETE` | Removido por `removeObsoleteRecords()` (limitado ao período do arquivo) |
| **Multi-profissionais** | `INSERT múltiplos` | Original sem sufixo + derivados com `_1`, `_2`, etc. |

**Campos Preservados no UPDATE**: `id`, `created_at` (garante idempotência - re-upload não duplica)

**RPC**: `process_xlsx_upload(unit_code_arg text, records_arg jsonb)` usa `ON CONFLICT (unidade_code, ATENDIMENTO_ID) DO UPDATE`.

Convenções:
- Registros derivados recebem sufixo `_N` em `ATENDIMENTO_ID` e `IS_DIVISAO = 'SIM'`.
- Métricas usam apenas originais para receita/contagem; repasse soma todos.

---
## 8. Dashboard e Métricas

`fetchDashboardMetrics` (por unidade) e `fetchDashboardMetricsMulti` (multi-unidade) recalculam localmente (substitui dependências de contagens pré-agregadas da RPC):

- `totalServices`: orçamentos originais únicos.
- `totalRevenue`: soma `VALOR` de originais.
- `uniqueClients`: clientes únicos de originais.
- `averageTicket`: revenue / services.
- `totalRepasse`: soma de `REPASSE` de todos (originais + derivados), garantindo que divisão multi-profissional não perca somatório.

Gráfico mensal (`fetchMonthlyChartData`):
- Agrupa por orçamento base.
- Evita duplicação de receita em ramificações.

### 8.1 Submétricas clicáveis no Dashboard (ano todo)

Os três cartões principais do Dashboard agora têm submétricas clicáveis que trocam o gráfico anual para a métrica acionada, com título dinâmico:

- Faturamento
   - Média por Atendimento (averageTicket)
   - Margem (receita − repasse)
   - Margem por Atendimento (margem / atendimentos)

- Atendimentos
   - Início do Mês (startOfMonth)
   - Evolução (evolution)
   - Média/Dia Produtivo (productiveDayAvg)

- Clientes
   - Recorrentes (recurringCount)
   - Atend. por Cliente (servicesPerClient)
   - Churn (churnRate)

Implementação:
- Página: `components/pages/DashboardMetricsPage.tsx` mantém estados de submétrica por cartão e ajusta o dataset mensal para o gráfico.
- Serviços mensais (single e multi-unidade) em `services/analytics/serviceAnalysis.service.ts`:
   - `fetchServiceMonthlySubmetrics(unitCode, year)` e `fetchServiceMonthlySubmetricsMulti(unitCodes, year)`
   - `fetchClientMonthlySubmetrics(unitCode, year)` e `fetchClientMonthlySubmetricsMulti(unitCodes, year)`
- Gráfico: `components/ui/MonthlyComparisonChart.tsx`
   - Aceita selectedMetric estendido: `totalRevenue | totalServices | uniqueClients | totalRepasse | averageTicket | margin | marginPerService`.
   - Calcula campos derivados no cliente: `margin = totalRevenue − totalRepasse` e `marginPerService = margin / totalServices`.
   - Usa LineChart para métricas monetárias e BarChart para contagens; tooltip e destaques de maior/menor valor por mês.

Observações:
- Em ALL (multi-unidade), as séries mensais de Atendimentos e Clientes usam agregação correta (união de conjuntos ou soma conforme a métrica). Revenue/Repasse somam entre unidades.
- O título do gráfico muda conforme a submétrica selecionada em cada cartão.

### 8.2 Visualização "Todos" (ALL)

- Dashboard: agrega múltiplas unidades respeitando o período ativo. Serviços/Clientes são conjuntos únicos globais; receita/repasse são somas; ticket médio é recalculado. As submétricas mensais (Atendimentos e Clientes) têm versões single/multi dedicadas e são suportadas no Dashboard.
- Dados: `fetchDataTableMulti` aplica `.in('unidade_code', ...)` com filtros e paginação unificados.
- Agendamentos: `fetchAppointmentsMulti` agrega por data; o envio de webhook fica desabilitado quando a unidade selecionada é "Todos".
- Recrutadora: Colunas são globais (template único), cards por unidade. Em ALL, "Qualificadas" é exibida por unidade e demais colunas agregam cards; DnD continua restrito por unidade.
- Clientes (página dedicada): Visualização ALL ainda não implementada; a página informa essa limitação. No Dashboard, as submétricas de clientes em ALL estão habilitadas.

### 8.2 Módulo de Clientes (Paridade com o Dashboard)

- Fonte de dados: somente `processed_data` (não há mais tabela separada de clientes).
- Escopo do período: seleção `YYYY-MM` (igual ao Dashboard). A lista exibe apenas clientes com atendimentos no mês corrente selecionado.
- Definições alinhadas ao Dashboard (duas consultas discretas, não range misto):
   - Recorrentes: interseção entre os conjuntos de clientes de `M` (mês atual) e `M-1` (mês anterior).
   - Atenção (churn): clientes presentes em `M-1` que não retornaram em `M`.
   - Outros (novos): clientes de `M` que não estavam em `M-1`.
- Implementação (serviço):
   - `fetchClientMetricsFromProcessed`: executa duas consultas (M e M-1) e retorna `{ total, recorrente, atencao, outros, churnRatePercent }`.
   - `fetchClients`: executa consultas para `M`, `M-1` e `M-2` para montar:
      - Lista principal: apenas clientes de `M` com último atendimento no mês (para exibição padrão).
      - Lista de Atenção: clientes que não retornaram em `M`, com metadados: `tipo` (derivado de `M-1`), `lastAttendance` (em `M-1`) e `monthlyCounts` para `M-2`, `M-1`, `M`.
- UI/Comportamento:
   - Cartão Atenção exibe quantidade (não percentual). Ao clicar, a tabela filtra para quem não retornou.
   - Tabela em modo Atenção inclui três colunas de contagem por mês (invertidas): `M`, `M-1`, `M-2`. Cabeçalhos formatados como `Abreviação/AAAA` (ex.: `Ago/2025`).
   - Paginação: 25 linhas por página, com reset ao mudar período, filtro ou busca.
   - Ícone do cartão "Outros" atualizado para `user-plus`.
   - Normalização: chaves de conjunto baseadas no campo bruto `CLIENTE` (sem `trim`/case transform) para manter paridade total com o Dashboard.
   - Duplo clique na linha abre `ClientDetailModal` (abas Dados e Atendimentos) com filtro mensal e drill‑down para `DataDetailModal`.
   - Em “Base de Clientes”, há a coluna “Último Atendimento” e o modal inclui aba Atendimentos espelhando o modal de Clientes, com duplo clique para abrir `DataDetailModal`.

### 8.3 Prestadoras (Profissionais + Recrutadora)

Página: `components/pages/PrestadorasPage.tsx`

Serviços: `services/analytics/prestadoras.service.ts`

- Cards principais:
   - Profissionais (ativos): total de profissionais ativos no escopo da unidade/período; ao clicar, ativa painel com resumo e ranking.
   - Recrutadora (cadastros): total de cadastros no mês; ao clicar, ativa painel com métricas mensais da recrutadora.
   - Atendimentos (mês): total de atendimentos no período (base `processed_data`).
- Painel Profissionais (ao ativar o card):
   - Resumo do mês: média de atendimentos por profissional, média de ganhos (repasse) por atendimento, profissionais atuantes.
   - Ranking (mês): ordenável por atendimentos ou ganhos; inclui coluna “Média” (repasse/atendimento).
   - Ao clicar em uma linha do ranking abre modal com atendimentos do profissional no mês (Data, Cliente, Período, Repasse).
   - Recarrega automaticamente ao mudar período/unidade quando este painel está ativo; ativa automaticamente ao entrar na página.
- Painel Recrutadora (ao ativar o card):
   - Métricas mensais inline: Cadastros no mês (total), Qualificadas, Não aprovadas, Desistentes.
   - Ativadas no mês (profissionais): conta baseada na tabela `profissionais` (status contendo “ativo” e data de ativação no mês).
   - O ranking de profissionais fica oculto quando o painel Recrutadora está ativo.
- Multi-unidade (ALL):
   - Para recrutadora/profissionais, usa `userUnits` (IDs) para agregar; para atendimentos usa `unit_code` (processed_data).
   - Período usa seletor `YYYY-MM` com dropdown customizado.
- Visual: cards com estado de seleção (ativo) com o mesmo efeito do Dashboard.

---
## 9. Status de Atendimentos

Os módulos **Atendimentos** e **Dados** utilizam um sistema padronizado de 5 status para controle do ciclo de vida dos atendimentos:

### Status Oficiais

| Status | Significado | Cor | Uso |
|--------|-------------|-----|-----|
| **CONFIRMADO** | Atendimento confirmado com cliente | Verde | Status final positivo |
| **PENDENTE** | Aguardando confirmação inicial | Amarelo | Status inicial padrão |
| **RECUSADO** | Cliente recusou o atendimento | Vermelho | Status final negativo |
| **AGUARDANDO** | Em processo de confirmação | Azul | Status intermediário |
| **ESPERAR** | Marcado para acompanhamento posterior | Roxo | Status de follow-up |

### Comportamento nos Modais

#### DataDetailModal (Atendimentos e Dados)
- **Localização**: Status e Profissional ficam no header do modal, na aba "Detalhes"
- **Auto-save**: Mudanças nos campos Status e Profissional são salvas automaticamente
- **Indicador**: Mostra feedback visual ("salvando…", "✓ salvo", "✗ erro")
- **3 Abas**: Detalhes (edição), Pós-venda (sincronização) e Histórico (atendimentos anteriores do cliente)

#### EditRecordModal (Edição rápida)
- **Localização**: Status no header, ao lado do botão fechar
- **Dropdown padrão**: Os mesmos 5 status
- **Salvamento**: Junto com demais campos ao clicar em "Salvar"

### Métricas e Filtros

Os cards de métricas no módulo Atendimentos agrupam status relacionados:
- **Pendente**: Mostra apenas `PENDENTE`
- **Aguardando**: Mostra apenas `AGUARDANDO`
- **Confirmado**: Agrupa `CONFIRMADO` e `FINALIZADO` (compatibilidade)
- **Recusado**: Agrupa `RECUSADO` e `CANCELADO` (compatibilidade)
- **Esperar**: Mostra apenas `ESPERAR`

### Integração com Upload

Durante o upload de planilhas XLSX:
- Status pode ser atualizado se o campo `PROFISSIONAL` mudar
- Status é preservado se o profissional não mudar (permite reatribuição controlada)
- Campo `STATUS` na tabela `processed_data` armazena o valor em MAIÚSCULAS

---
## 10. Controle de Acesso

Tabelas de junção:
- `user_units(user_id, unit_id)`
- `user_modules(user_id, module_id)`

Admins:
- Veem apenas usuários de suas unidades (`fetchUsersForAdminUnits`).
- Ao criar usuário, unidade pode ser atribuída automaticamente (auto_unit_id).
- Ao editar, módulos fora do escopo aparecem como somente leitura (mantidos mas não editáveis).
Super Admin:
- Necessita estar em `allowed_profiles` de um módulo para visualizá-lo (não há mais privilégio implícito de "ver tudo").

---
## 10. Controle de Acesso

Tabelas de junção:
- `user_units(user_id, unit_id)`
- `user_modules(user_id, module_id)`

Admins:
- Veem apenas usuários de suas unidades (`fetchUsersForAdminUnits`).
- Ao criar usuário, unidade pode ser atribuída automaticamente (auto_unit_id).
- Ao editar, módulos fora do escopo aparecem como somente leitura (mantidos mas não editáveis).
Super Admin:
- Necessita estar em `allowed_profiles` de um módulo para visualizá-lo (não há mais privilégio implícito de "ver tudo").

---
## 11. Administração de Colunas Dinâmicas (Unit Keys)

### Visão Geral
Sistema de gerenciamento avançado para colunas da tabela `unit_keys`, permitindo adicionar, renomear, excluir e ativar/desativar campos de configuração por unidade.

### Página de Administração
**Localização**: Menu lateral → "Unit Keys" (visível apenas para `super_admin`)

**Arquivo**: `components/pages/UnitKeysPage.tsx`

**Serviços**: `services/units/unitKeysAdmin.service.ts`

### Funcionalidades

#### 1. Visualização de Colunas
- Tabela com estatísticas de uso: nome da coluna, tipo de dado, total de registros não-nulos, status (ativo/inativo)
- Ordenação por nome da coluna
- Indicadores visuais: colunas inativas aparecem com opacidade reduzida

#### 2. Adicionar Nova Coluna
- Botão "Adicionar Coluna" no cabeçalho
- Modal com validação:
  - Nome obrigatório (apenas letras minúsculas, números e underscores)
  - Descrição opcional
  - Status inicial (ativo/inativo)
- Cria coluna do tipo `TEXT` por padrão

#### 3. Renomear Coluna
- Ícone de edição em cada linha
- Modal com preview do nome atual
- Validação: impede nomes duplicados ou inválidos
- Mantém dados existentes após renomeação

#### 4. Excluir Coluna
- Ícone de lixeira em cada linha
- Modal de confirmação com contagem de registros afetados
- **Ação irreversível**: remove a coluna e todos os dados associados
- Colunas do sistema (padrão) não podem ser excluídas

#### 5. Ativar/Desativar Coluna
- Toggle switch em cada linha
- Atualização instantânea do status
- Colunas inativas não aparecem na interface de edição de unidades

### RPCs do Backend

| RPC | Descrição |
|-----|-----------|
| `unit_keys_list_columns()` | Lista todas as colunas com metadados |
| `unit_keys_columns_stats()` | Retorna estatísticas de uso (count não-nulos) |
| `unit_keys_add_column(name, description)` | Cria nova coluna TEXT |
| `unit_keys_rename_column(old_name, new_name)` | Renomeia coluna preservando dados |
| `unit_keys_drop_column(column_name)` | Remove coluna e dados (irreversível) |
| `unit_keys_set_column_status(column_name, is_active)` | Ativa/desativa coluna |

### Segurança
- Acesso restrito a `super_admin` via UI
- RLS: políticas permissivas no banco (recomenda-se vincular ao JWT em produção)
- Validação de nomes de colunas (SQL injection prevention)
- Confirmação obrigatória para ações destrutivas

### Casos de Uso
1. **Adicionar integração nova**: Criar campo `api_token_parceiro` para armazenar credenciais
2. **Deprecar campo antigo**: Desativar `whats_profi_old` sem perder dados
3. **Reorganização**: Renomear `botID` para `chatbot_id` para padronização
4. **Limpeza**: Excluir campos não mais utilizados após migração

---
## 12. Boas Práticas Internas

- Centralizar chamadas ao Supabase nos serviços segmentados em `services/*/*.service.ts`.
- Não repetir lógica de expansão/divisão em componentes.
- Validar tipos novos em `types.ts`.
- Manter comentários explicando decisões (ex: mescla de módulos no `AuthContext`).
- Manter `position` densamente sequencial após drag & drop (sem gaps).
- Preferir futura RPC batch para reorder ao invés de múltiplas updates paralelas.
- Webhook de Agendamentos: usar POST JSON; fallback GET chunkado é automático somente em falha de rede/CORS.
   - Payload mínimo: `{ unidade_code, data }`, com `keyword` opcional e `atendimento_id` em envios individuais; fallback GET usa chaves compactas (`u`, `d`, `kw`, `aid`).

---
## 13. Próximos Passos Recomendados

| Prioridade | Item | Descrição |
|------------|------|-----------|
| Alta | Hash de senhas | Substituir armazenamento em texto plano |
| Alta | RLS restritivo | Políticas por unidade/módulo reais |
| Média | RPC batch order | Atualizar posições em lote (JSONB) |
| Média | Índices métricas | Índices (`unidade_code, DATA, IS_DIVISAO`) e (`unidade_code, ATENDIMENTO_ID`) |
| Média | Persistir colapso Sidebar | Salvar preferência no `localStorage` |
| Média | Assinatura Webhook | HMAC opcional para integridade do payload |
| Baixa | Tooltips customizados | Melhorar UX em estado colapsado |
| Baixa | Churn como % | Ajustar eixo e rótulos do gráfico para porcentagem quando Churn estiver ativo |
| Baixa | PeriodDropdown compartilhado | Extrair o seletor de período para um componente reutilizável e padronizar nas páginas |

Notas finais:
- ContentArea injeta HTML apenas quando `webhook_url` começa com `internal://`.
- Em ALL, o botão de envio de webhook de Agendamentos fica desabilitado por segurança/semântica.

---
## 14. Scripts

| Uso | Comando |
|-----|---------|
| Dev | `npm run dev` |
| Build | `npm run build` |
| Preview | `npm run preview` |

---
## 15. Licença

Projeto em estágio de MVP — defina licença antes de distribuição pública.

---
## 16. Suporte / Contribuição

1. Abra issue descrevendo contexto.
2. Forneça logs/prints relevantes.
3. Sugira melhoria se aplicável.

---
## 17. Glossário Rápido

- Orçamento Base: Registro original (sem sufixo `_N`).
- Registro Derivado: Divisão de profissional (`IS_DIVISAO = 'SIM'`) com `VALOR=0`.
- Repasse: Soma distribuída entre profissionais (originais + derivados).
- Módulo Público: `allowed_profiles` vazio ou null.
- Position: Campo de ordenação denso reatribuído sempre que a ordem muda.
- Webhook Agenda: Envio inclui endereço (`endereco`) e versão compacta; fallback GET para cenários de bloqueio POST.
- Conexao: Campo de configuração opcional na tabela `unit_keys`, usado para passar informações específicas da unidade em webhooks e integrações.

---
## 18. FAQ Curto

| Pergunta | Resposta |
|----------|----------|
| Por que não usar ainda `supabase.auth`? | Adoção incremental; MVP priorizou velocidade. |
| Como evitar duplicações no upload? | Limpeza por período + upsert RPC + chave lógica `ATENDIMENTO_ID`. |
| Por que recalcular repasse localmente? | Garantir consistência após expansão de profissionais. |
| Quais módulos têm Realtime? | Pós-Vendas, Agendamentos e Dashboard (completos). Consulte `docs/REALTIME_STATUS.md` para detalhes. |

---
_Documento atualizado automaticamente para refletir estado atual do sistema._

---
## 19. Resumo: Alinhamento de Recorrentes

Contexto: Houve divergência entre a contagem de recorrentes/atenção no módulo de Clientes e no Dashboard.

Decisões e correções aplicadas:
- Evitar consultas com range contínuo misturando meses; usar duas consultas discretas: uma para `M` e outra para `M-1`.
- Recorrentes = interseção entre conjuntos de clientes de `M` e `M-1`.
- Atenção (churn) = clientes em `M-1` que não retornaram em `M`.
- Chave de comparação: `CLIENTE` bruto (sem `trim`/casefold) para espelhar 100% o comportamento do Dashboard.
- Métricas e listas do módulo de Clientes agora derivadas exclusivamente de `processed_data`.

Resultados:
- Paridade confirmada com o Dashboard para recorrentes e churn.
- Maior previsibilidade e performance ao limitar as consultas aos meses relevantes.

---
## 20. Recrutadora – Métricas Rápidas e Ingestão CSV
---
## 21. Subdomínios e URLs de Módulo

Para servir cada unidade em um subdomínio e manter o módulo no path (ex.: `https://<slug>.dromeboard.com.br/<module>`), siga o guia detalhado em `docs/SUBDOMINIOS_E_URLS.md`.


- Métricas Rápidas: chips inline no cabeçalho com contagens de Hoje, Semana e Mês. Implementadas em `services/recrutadora/recrutadora.service.ts` usando utilitários de data em `services/utils/dates.ts` (início do dia/semana/mês).
- Semântica ALL: colunas globais; DnD restrito por unidade; "Qualificadas" duplicada por unidade, demais colunas agregadas.
 - Ingestão CSV (MB Londrina): pipeline RAW → `recrutadora` com status mapeados e telefones normalizados. Ver arquivos atuais em `docs/sql/` (ex.: `2025-09-27_profissionais.sql`, `2025-09-27_recrutadora_logs.sql`).
