# Plano de Migração — Segmentação de `services/mockApi.ts`

Este guia descreve, passo a passo, como segmentar o arquivo `services/mockApi.ts` em serviços por domínio, mantendo a aplicação funcional durante todo o processo.

Última atualização: 26/09/2025

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
- Limpeza: `removeObsoleteRecords` remove registros cujo orçamento base não está no arquivo.
- Chave lógica: usar `orcamento` (evitar `ATENDIMENTO_ID` legado).

Smoke test
- Fluxo de upload com arquivo pequeno. Conferir:
  - Quantidade de serviços (baseados em originais) após upload.
  - Repasse total (originais + derivados) após upload.
  - Registros obsoletos removidos corretamente.

Commit: “feat(services): extrai ingestion/upload”.

---

### Fase 6 — Encerramento e limpeza

1. Atualizar IMPORTS nos componentes/contexts para apontar para `services/<domínio>/*` diretamente (deixar de usar o barrel).
2. Remover reexports de `services/index.ts` e apagar o arquivo.
3. Remover `services/mockApi.ts` (nome legado) e ajustar quaisquer referências finais.
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
import { fetchDashboardMetrics } from "services/mockApi"; // via barrel temporário
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
