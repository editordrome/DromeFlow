# Plano de Migração — Segmentação de `services/mockApi.ts` (Em andamento)

Este guia descreve, passo a passo, como segmentar o arquivo `services/mockApi.ts` em serviços por domínio, mantendo a aplicação funcional durante todo o processo. Status: Fase 6 pendente.

Última atualização: 07/11/2025 — Fase 5 concluída; Fase 6 pendente (barrel e mockApi ainda ativos)

## Estado atual da migração

✅ **Fase 0 concluída**: estrutura de pastas criada e barrel `services/index.ts` adicionado (ainda ativo por compatibilidade).

✅ **Fase 1 aplicada**: migradas para serviços dedicados e reexportadas no barrel
  - `services/units/units.service.ts`: fetchAllUnits, createUnit, updateUnit, deleteUnit
  - `services/modules/modules.service.ts`: fetchAllModules, createModule, updateModule, deleteModule, toggleModuleStatus, updateModulesOrder
  - `services/access/accessCredentials.service.ts`: fetchAllAccessCredentials, createAccessCredential, updateAccessCredential, deleteAccessCredential
  - `services/content/content.service.ts`: fetchWebhookContent

✅ **Fase 1b (limpeza) concluída**: implementações duplicadas removidas de `services/mockApi.ts` para os domínios acima; mantidos apenas reexports via barrel.

✅ **Fase 2 aplicada**: `services/auth/users.service.ts` com fetchAllUsers, fetchUsersForAdminUnits, fetchUsersForUnit, fetchUserAssignments, createUser, updateUser, deleteUser. `mockApi.ts` reexporta e duplicatas foram removidas.

✅ **Fase 3 aplicada**: `services/data/dataTable.service.ts` com fetchDataTable, fetchAppointments, updateDataRecord, deleteDataRecord. `mockApi.ts` reexporta e duplicatas foram removidas.

✅ **Fase 4 aplicada**: `services/analytics/*` com dashboard/clients/repasse/serviceAnalysis migrados. `mockApi.ts` agora reexporta todas as funções de analytics e removeu implementações duplicadas; `MonthlyChartData` também reexportada.

✅ **Fase 5 aplicada**: `services/ingestion/upload.service.ts` criado com `uploadXlsxData` e helpers (`processMultipleProfessionalsRecords`, `processRepasseValues`, `removeObsoleteRecords`). `mockApi.ts` reexporta tudo e as duplicatas foram removidas do legado.

✅ **Serviços adicionais implementados**:
  - `services/comercial/comercial.service.ts`: CRUD e ordenação de cards no Kanban
  - `services/profissionais/profissionais.service.ts`: Gestão de profissionais e recrutadora
  - `services/posVendas/posVendas.service.ts`: Gestão de pós-vendas com sincronização automática
  - `services/recrutadora/recrutadora.service.ts`: Métricas e análise de recrutamento
  - `services/units/unitKeys.service.ts`: Configuração de keys por unidade
  - `services/units/unitKeysAdmin.service.ts`: Administração de colunas dinâmicas

✅ **Compatibilidade preservada durante migração**: componentes continuam podendo importar de `services/mockApi.ts` (via reexport) até a Fase 6.

**Qualidade atual (Quality Gates):**
- ✅ Tipos (tsc --noEmit): PASS
- ✅ Build (vite build): PASS (apenas avisos de tamanho de bundle e import dinâmico/estático misto, sem impacto funcional)
- ✅ Smoke (Analytics): PASS — Dashboard, Dashboard Metrics e Clientes funcionando sem erros.
- ✅ Smoke (Ingestion): PASS — Upload testado com planilhas reais, expansão multi-profissional e limpeza funcionando.
- ✅ Smoke (Comercial): PASS — Kanban com DnD, persistência otimista e sincronização.
- ✅ Smoke (Profissionais): PASS — Ranking, drill-down e painel de recrutadora funcionais.
- ✅ Smoke (Pós-Vendas): PASS — Sincronização bidirecional via triggers funcionando.

Correções TypeScript aplicadas junto às fases (não alteram comportamento):
- tsconfig: inclusão de `vite/client` em `compilerOptions.types` (tipagem de `import.meta.env`).
- types/Profile: agora inclui `id: string` e `email?: string | null` para alinhar com o uso nos contexts/UI.
- Icon: uso de `React.ReactElement` no mapa de ícones (evita erro de namespace JSX).
- ManageModulesPage: ajuste do `key` (fora de `DraggableProps`, aplicado no `<tr>`).
- ClientsPage: tipagem forte para cartões de métricas (elimina `never`).
- PageView: adicionadas views `clients`, `comercial`, `profissionais`, `pos_vendas` e roteamento correspondente.

**Próximos passos imediatos:**
1) ✅ Smoke test completo de todos os módulos principais (concluído).
2) 🔄 Iniciar Fase 6 — Encerramento: atualizar imports para apontar para os serviços segmentados, remover barrel e `mockApi.ts`.
3) 📝 Documentar padrões de Realtime implementados (ver `docs/REALTIME_STATUS.md`).

Qualidade atual (Quality Gates):
- Tipos (tsc --noEmit): PASS
- Build (vite build): PASS (apenas avisos de tamanho de bundle e import dinâmico/estático misto, sem impacto funcional)
- Smoke (Analytics): PASS básico — Dashboard, Dashboard Metrics e Clientes dependem das novas funções sem erros de build.
- Smoke (Ingestion): aguardando teste manual com planilha pequena; build validado e tipos ok.

Correções TypeScript aplicadas junto às fases (não alteram comportamento):
- tsconfig: inclusão de `vite/client` em `compilerOptions.types` (tipagem de `import.meta.env`).
- types/Profile: agora inclui `id: string` e `email?: string | null` para alinhar com o uso nos contexts/UI.
- Icon: uso de `React.ReactElement` no mapa de ícones (evita erro de namespace JSX).
- ManageModulesPage: ajuste do `key` (fora de `DraggableProps`, aplicado no `<tr>`).
- ClientsPage: tipagem forte para cartões de métricas (elimina `never`).
- PageView: adicionada a view `clients` e roteamento correspondente em `ContentArea`.

Próximos passos imediatos:
1) Smoke test do fluxo de upload no `UploadModal` com uma planilha pequena (verificar expansão multi-profissional, REPASSE, limpeza seletiva por orçamentos base e métricas pós-upload).
2) Iniciar Fase 6 — Encerramento: atualizar imports para apontar para os serviços segmentados, remover barrel e `mockApi.ts` quando seguro.
3) Abrir PR “feat(services): Fases 4 e 5 — analytics + ingestion” com os resultados dos quality gates.

## Objetivos

- Reduzir o tamanho e a complexidade de `mockApi.ts`.
- Separar a lógica por domínios (auth, units, modules, data, analytics, ingestion, etc.).
- Centralizar regras de negócio na camada de serviços; componentes permanecem “finos”.
- Manter tipos em `types.ts` (evitar duplicação).
- Migrar de forma incremental e segura, sem regressões.

## Escopo

- Refatoração interna da pasta `services/` sem alterar funcionalidades visíveis ao usuário.
- Sem mudanças de UI/UX.
- Sem alteração de contratos públicos (nomes e parâmetros das funções) até a fase final.

## Pré-requisitos

- Node e NPM instalados.
- Projeto instalável e executável localmente.
- Acesso ao Supabase (mesmo projeto usado hoje) e RPCs existentes.
- Git configurado e branch dedicado para a migração.

## Convenções

- Tipos centrais continuam em `types.ts`.
- Cada serviço é responsável por um domínio, com nomes explícitos (ex.: `units.service.ts`).
- Funções devem lançar erro (“fail fast”) e retornar tipos estritos.
- Regras de upload/métricas permanecem exclusivamente na camada de serviços.

## Nova estrutura-alvo (visão)

```
services/
  auth/
    users.service.ts
  units/
    units.service.ts
  modules/
    modules.service.ts
  access/
    accessCredentials.service.ts
  content/
    content.service.ts
  data/
    dataTable.service.ts
  analytics/
    dashboard.service.ts
    clients.service.ts
    repasse.service.ts
    serviceAnalysis.service.ts
  ingestion/
    upload.service.ts
  utils/
    dates.ts
    records.ts
    errors.ts
    log.ts
  index.ts          # barrel temporário (reexports)
  supabaseClient.ts # já existente (inalterado)
  mockApi.ts        # vira um reexportador temporário (até fase final)
```

## Fases de Migração

Cada fase termina com validações padrão (Quality Gates) e commit. Faça PRs pequenos.

### Quality Gates (ao final de cada fase)

```bash
# 1) Tipos
npx tsc --noEmit

# 2) Dev server (inspecionar console do navegador)
npm run dev

# 3) Smoke test manual
# - Navegar nas telas afetadas pela fase e validar as operações principais
```

---

### Fase 0 — Preparação (Infra de pastas e compatibilidade)

1. Criar as pastas de destino conforme a estrutura-alvo.
2. Criar `services/index.ts` reexportando das novas unidades (por enquanto vazio, só o arquivo).
3. Transformar `services/mockApi.ts` em um “barrel” temporário: reexporta de `./index` (sem lógica). Manter as assinaturas públicas atuais via reexport até a Fase 6.
4. Commit: “chore(services): estrutura de pastas e barrel temporário”.

Validação
- App sobe normalmente (nada deve quebrar).

---

### Fase 1 — CRUDs simples e baixo risco

Mover do `mockApi.ts` para serviços dedicados, sem alterar assinaturas públicas:

- access/accessCredentials.service.ts
  - fetchAllAccessCredentials, createAccessCredential, updateAccessCredential, deleteAccessCredential
- units/units.service.ts
  - fetchAllUnits, createUnit, updateUnit, deleteUnit
- modules/modules.service.ts
  - fetchAllModules, createModule, updateModule, deleteModule, toggleModuleStatus, updateModulesOrder
- content/content.service.ts
  - fetchWebhookContent

Ajustes
- `services/index.ts` deve reexportar essas funções dos novos arquivos.
- `mockApi.ts` continua reexportando de `./index` (compatibilidade).

Fase 1b — Limpeza pós-migração
- Em `services/mockApi.ts`, remover as implementações antigas dessas funções já migradas, mantendo apenas os reexports (garante fonte única de verdade).
- Confirmar que nenhum import direto das implementações antigas permaneceu.

Smoke test
- Páginas: Unidades, Módulos, Credenciais/Acessos, Webhook de Módulos.
- Verificar listagens, criação/edição/remoção, e ordenação de módulos (drag & drop persistindo `position`).

Commit: “feat(services): extrai access/units/modules/content”.

---

### Fase 2 — Usuários e atribuições

- auth/users.service.ts
  - fetchAllUsers, fetchUsersForAdminUnits, fetchUsersForUnit, fetchUserAssignments
  - createUser, updateUser, deleteUser
  - (se houver) updateUserAssignments
- Decidir onde ficam `fetchUserUnits` e `fetchUserModules` (auth/users ou units/modules). Escolher UMA opção e documentar em comentário de topo do arquivo.

Ajustes
- Reexportar via `services/index.ts`.
- Garantir que o `AuthContext` continua chamando as mesmas assinaturas.

Observação
- Decidir e documentar onde ficam `fetchUserUnits` e `fetchUserModules` (em `auth/users.service.ts` ou nos respectivos domínios). Manter essa decisão consistente para todo o projeto.

Smoke test
- Páginas: Usuários, Gerenciamento de Acesso, Login (fluxo custom por profiles).

Commit: “feat(services): extrai auth/users”.

---

### Fase 3 — Data table e agendamentos

- data/dataTable.service.ts
  - fetchDataTable, updateDataRecord, deleteDataRecord, fetchAppointments

Smoke test
- Páginas: DataPage (tabela), EditRecordModal, AppointmentsPage.
- Confirmar filtros e paginação local.

Commit: “feat(services): extrai data/dataTable”.

---

### Fase 4 — Analytics

- analytics/dashboard.service.ts
  - fetchDashboardMetrics, fetchDashboardMetricsMulti, fetchMonthlyChartData
- analytics/clients.service.ts
  - fetchClients, fetchClientMetrics, fetchClientMetricsFromProcessed, fetchClientAnalysisData
- analytics/repasse.service.ts
  - fetchRepasseAnalysisData
- analytics/serviceAnalysis.service.ts
  - fetchServiceAnalysisData

Notas de negócio
- Contagem de serviços: somente orçamentos originais (`IS_DIVISAO != 'SIM'`).
- Repasse: soma total (originais + derivados).

Smoke test
- Páginas: Dashboard, DashboardMetricsPage, Clientes, gráficos mensais.

Commit: “feat(services): extrai analytics/*”.

---

### Fase 5 — Ingestão/Upload

- ingestion/upload.service.ts
  - uploadXlsxData
  - helpers: processMultipleProfessionalsRecords, processRepasseValues, removeObsoleteRecords

Regras críticas (preservar)
- Expansão multi-profissional: sufixos `_N`. Registro original mantém `VALOR`; derivados `VALOR = 0` com repasse proporcional.
- Limpeza: `removeObsoleteRecords` remove registros cujo ATENDIMENTO_ID base não está no arquivo.
- Chave lógica: usar `ATENDIMENTO_ID` como identificador único (com sufixos para derivados).

Smoke test
- Fluxo de upload com arquivo pequeno. Conferir:
  - Quantidade de serviços (baseados em originais) após upload.
  - Repasse total (originais + derivados) após upload.
  - Registros obsoletos removidos corretamente.

Commit: “feat(services): extrai ingestion/upload”.

---

### Fase 6 — Encerramento e limpeza (PENDENTE)

1. Atualizar IMPORTS nos componentes/contexts para apontar para `services/<domínio>/*` diretamente (deixar de usar o barrel).
2. Remover reexports de `services/index.ts` e apagar o arquivo.
3. Remover `services/mockApi.ts` (nome legado) e ajustar quaisquer referências finais. [Pendente]
4. Atualizar docs: `README.md` e `.github/copilot-instructions.md` (seções que mencionam `mockApi.ts`).

Smoke test completo
- Telas: Dashboard, Data, Upload, Clientes, Unidades, Módulos, Usuários, Agendamentos.
- Verificar métricas idênticas “antes x depois” para um mesmo período/unidade (baseline salvo da Fase 4/5).

Commit: “refactor(services): remove barrel e mockApi.ts; imports apontam para novos serviços”.

---

## Mapeamento de Funções (referência rápida)

- auth/users.service
  - fetchAllUsers, fetchUsersForAdminUnits, fetchUsersForUnit, fetchUserAssignments, createUser, updateUser, deleteUser
- units/units.service
  - fetchAllUnits, createUnit, updateUnit, deleteUnit, fetchUserUnits
- modules/modules.service
  - fetchAllModules, createModule, updateModule, deleteModule, toggleModuleStatus, updateModulesOrder, fetchUserModules
- access/accessCredentials.service
  - CRUD de access_credentials
- content/content.service
  - fetchWebhookContent
- data/dataTable.service
  - fetchDataTable, updateDataRecord, deleteDataRecord, fetchAppointments
- analytics/dashboard.service
  - fetchDashboardMetrics, fetchDashboardMetricsMulti, fetchMonthlyChartData
- analytics/clients.service
  - fetchClients, fetchClientMetrics, fetchClientMetricsFromProcessed, fetchClientAnalysisData
- analytics/repasse.service
  - fetchRepasseAnalysisData
- analytics/serviceAnalysis.service
  - fetchServiceAnalysisData
- ingestion/upload.service
  - uploadXlsxData, processMultipleProfessionalsRecords, processRepasseValues, removeObsoleteRecords

## RPCs e Banco (checklist)

- Confirmar nomes/assinaturas das RPCs usadas (exemplos):
  - get_user_units, get_user_modules, process_xlsx_upload, get_client_metrics, delete_app_user
- Conferir políticas RLS e permissões de leitura/escrita para as tabelas envolvidas.
- Verificar índices necessários para consultas de analytics.

### Triggers de Sincronização

#### Pós-Vendas (Bidirecionais)
1. **`auto_create_pos_vendas_from_processed`**
   - Evento: `AFTER INSERT` em `processed_data`
   - Função: Cria registros em `pos_vendas` automaticamente
   - Validação: `ATENDIMENTO_ID` não nulo e não vazio
   - Conflito: `ON CONFLICT (ATENDIMENTO_ID) DO NOTHING`

2. **`sync_pos_vendas_status`**
   - Evento: `AFTER UPDATE` em `pos_vendas`
   - Função: Atualiza coluna `"pos vendas"` em `processed_data`
   - Condição: Mudança no campo `status`

#### Checklist de Verificação
- [ ] Índice em `pos_vendas.ATENDIMENTO_ID` (UNIQUE)
- [ ] Índice em `processed_data.ATENDIMENTO_ID`
- [ ] Constraint `UNIQUE (ATENDIMENTO_ID)` em `pos_vendas`
- [ ] RLS configurado em ambas as tabelas
- [ ] Função `auto_create_pos_vendas_from_processed()` criada
- [ ] Trigger `trigger_auto_create_pos_vendas` ativo

## Armadilhas e notas de TypeScript/Build (observadas)

Estas questões não foram introduzidas pela migração de serviços e podem ser tratadas em PRs paralelos, sem bloquear a segmentação:

- Tipagem de `import.meta.env` (Vite)
  - Sintoma: `Property 'env' does not exist on type 'ImportMeta'` em `services/supabaseClient.ts` e `pages/LoginPage.tsx`.
  - Ação: garantir tipos do Vite incluídos (ex.: adicionar `/// <reference types="vite/client" />` ou configurar `tsconfig.json` com `types: ["vite/client"]`).

- Namespace JSX ausente
  - Sintoma: `Cannot find namespace 'JSX'` em `components/ui/Icon.tsx`.
  - Ação: confirmar `@types/react` instalado e `tsconfig.json` com `jsx: "react-jsx"` (ou compatível) e `lib` contendo `dom`.

- Tipos de `Profile`
  - Sintoma: uso de `profile.id` e `profile.email` no código, mas `Profile` em `types.ts` define apenas `full_name` e `role`.
  - Ação: alinhar tipos (ex.: criar `UserProfile` que compõe `User & Profile`, ou estender `Profile` com `id` e `email`). Tratar em PR de tipos separado.

- `DraggableProps` e `key`
  - Sintoma: erro de `key` em `ManageModulesPage.tsx` com `react-beautiful-dnd`.
  - Ação: mover `key` para o elemento filho imediato conforme docs da lib. PR de UI rápido, fora do escopo de serviços.

- Tipagem de métricas em `ClientsPage.tsx`
  - Sintoma: acesso a `cfg.key` num tipo `never`.
  - Ação: refinar tipos do config das métricas. PR de UI/tipos específico.

Recomendação: abrir issues para essas pendências e corrigir em paralelo (não bloqueiam a migração por serviços).

## Riscos e Mitigações

- Quebra de imports
  - Mitigar com barrel (`services/index.ts` + `mockApi.ts` reexportando) até a Fase 6.
- Divergência de tipos
  - Usar apenas `types.ts`; não duplicar interfaces em serviços.
- Regressão em upload/métricas
  - Migrar helpers juntos e comparar resultados antes/depois com um dataset de teste.
- Round-trips excessivos
  - Planejar, depois da migração, uma RPC batch para `updateModulesOrder` (otimização futura prevista).

## Rollback rápido

Se algo quebrar em produção de desenvolvimento:

```bash
# Voltar ao commit anterior
git reset --hard HEAD~1

# OU reverter PR via GitHub UI
```

Para desfazer apenas os imports da Fase 6, repontar para o barrel:

```ts
// de
import { fetchDashboardMetrics } from "services/analytics/dashboard.service";
// para
import { fetchDashboardMetrics } from "services/analytics/dashboard.service";
```

## Critérios de Aceite

- Build sem erros (tsc) e app sobe (Vite) em todas as fases.
- Telas críticas funcionam: Dashboard, DataTable, Upload, Clientes, Unidades, Módulos, Usuários, Agendamentos.
- Métricas idênticas antes/depois (mesmo período e unidade) e repasse total consistente.
- `mockApi.ts` removido ao final, sem imports remanescentes.

## Sequência de PRs sugerida

1. PR1: Estrutura + barrel (sem mudança funcional).
2. PR2: access + units + modules + content.
3. PR3: auth/users.
4. PR4: data (tabela/agendamentos).
5. PR5: analytics.
6. PR6: ingestion.
7. PR7: trocar imports e remover `mockApi.ts`/barrel.

## Dicas Operacionais

- Commits pequenos e descritivos por domínio.
- Use feature branches por fase (`feat/services-analytics`, etc.).
- Abra PR cedo e itere (early feedback).
- Registre um “baseline” de métricas e contagens antes da Fase 4/5 para comparar após a migração.

---

Qualquer mudança de regra de negócio nova (upload/métricas) deve entrar na camada de serviços (não em componentes), conforme nossas orientações em `.github/copilot-instructions.md`.
