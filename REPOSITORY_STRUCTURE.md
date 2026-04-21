# DromeFlow - Estrutura do Repositório

**Data:** 2026-03-28  
**Versão:** 1.2.0  
**Build Status:** ✅ Estável (Março 2026)

---

## 📊 Estatísticas do Projeto

### Resumo de Arquivos (Ativo)
```
Total de componentes:        67 arquivos (.tsx)
  - Páginas:                 36 arquivos (Dashboard, Admin, Onboarding, etc.)
  - Modais/UI:               31 arquivos (Modais complexos, Gráficos, Pickers)
  
Total de serviços:           45 arquivos (.ts)
  - Analytics & Data:        15 serviços
  - Units & Auth:            12 serviços
  - Business Operations:     10 serviços (CRM, Pós-Venda, Admin)
  - Utils & Core:            8 serviços
```

### Tamanho do Build (Produção)
```
Bundle principal:            743KB → 201KB (gzip) → 164KB (brotli)
Vendor React:                ~12KB → 8KB (gzip) → 4KB (brotli)
Vendor Supabase:             ~124KB → 32KB (gzip) → 28KB (brotli)
Service Worker (PWA):        22KB → 7.48KB (gzip) → 6.79KB (brotli)
Páginas (lazy loaded):       ~10-50KB cada (com .br/.gz)
```

---

## 🗂️ Estrutura de Diretórios

```
DromeFlow/
├── .github/                        # Configurações GitHub
│   └── copilot-instructions.md    # Instruções para IA
│
├── components/                     # Componentes React
│   ├── layout/                    # Layout estrutural
│   │   ├── ContentArea.tsx        # Área de conteúdo principal
│   │   └── Sidebar.tsx            # Navegação lateral (com logging)
│   │
│   ├── pages/                     # Páginas completas (36 arquivos)
│   │   ├── AnnouncementsPage.tsx
│   │   ├── AppointmentsPage.tsx
│   │   ├── ClientsBasePage.tsx
│   │   ├── ClientsPage.tsx
│   │   ├── ComercialAdminPage.tsx  # ⭐ NOVO (Produção Hub)
│   │   ├── ComercialPage.tsx
│   │   ├── DashboardMetricsPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── DashboardSistemaPage.tsx
│   │   ├── DataPage.tsx
│   │   ├── FinancialPage.tsx
│   │   ├── LoginPage.tsx
│   │   ├── ManageAccessPage.tsx
│   │   ├── ManageModulesPage.tsx
│   │   ├── ManageUnitsPage.tsx
│   │   ├── ManageUsersPage.tsx
│   │   ├── OnboardingPage.tsx      # ⭐ NOVO (External Wizards)
│   │   ├── PosVendasPage.tsx
│   │   ├── PrestadorasPage.tsx
│   │   ├── ProfissionaisPage.tsx
│   │   ├── RecrutadoraPage.tsx
│   │   ├── TypebotPage.tsx
│   │   ├── UnitKeysPage.tsx
│   │   └── WelcomePage.tsx
│   │
│   └── ui/                        # Componentes de UI (15 arquivos)
│       ├── ClientDetailModal.tsx
│       ├── ComercialCardModal.tsx
│       ├── DataDetailModal.tsx
│       ├── EditRecordModal.tsx
│       ├── Icon.tsx
│       ├── MonthlyComparisonChart.tsx
│       ├── PosVendaFormModal.tsx
│       ├── ProfessionalAppointmentsModal.tsx
│       ├── ProfileModal.tsx
│       ├── ProfissionalDetailModal.tsx
│       ├── ProfissionalFormModal.tsx
│       ├── RecrutadoraCardModal.tsx
│       ├── UnitClientModal.tsx
│       ├── UploadModal.tsx
│       └── UserFormModal.tsx
│
├── contexts/                       # Contextos React (Estado Global)
│   ├── AppContext.tsx             # Estado da aplicação (UI/navegação)
│   └── AuthContext.tsx            # Autenticação e permissões
│
├── docs/                           # Documentação completa
│   ├── features/                  # Documentação de features
│   │   ├── pos-vendas-contatados-table.md
│   │   └── prestadoras-atencao-ultimo-atendimento.md
│   │
│   ├── sql/                       # Scripts SQL (39 arquivos)
│   │   ├── archived/              # Scripts históricos
│   │   │   ├── 2025-11-16_consolidate_data_drome_to_dromeflow.sql
│   │   │   └── 2025-11-15_data_drome_rls_policies.sql
│   │   │
│   │   ├── 2025-09-27_profissionais.sql
│   │   ├── 2025-09-27_recrutadora_logs.sql
│   │   ├── 2025-10-02_unit_keys_policies.sql
│   │   ├── 2025-10-03_rpc_sync_unit_clients.sql
│   │   ├── 2025-10-03_unit_clients.sql
│   │   ├── 2025-10-10_subdomains_and_module_routes.sql
│   │   ├── 2025-10-10_unit_keys_admin.sql
│   │   ├── 2025-10-15_comercial.sql
│   │   ├── 2025-10-31_batch_update_positions.sql
│   │   ├── 2025-10-31_populate_pos_vendas.sql
│   │   ├── 2025-10-31_pos_vendas_sync_trigger.sql
│   │   ├── 2025-10-31_pos_vendas_table.sql
│   │   ├── 2025-10-31_update_pos_vendas_unit_ids.sql
│   │   ├── 2025-11-03_alter_pos_vendas_data_column_to_date.sql
│   │   ├── 2025-11-03_auto_sync_processed_to_pos_vendas.sql
│   │   ├── 2025-11-03_enable_realtime_processed_data.sql
│   │   ├── 2025-11-03_fix_pos_vendas_status_sync_trigger.sql
│   │   ├── 2025-11-03_fix_pos_vendas_unique_constraint.sql
│   │   ├── 2025-11-03_fix_process_xlsx_upload_null_handling.sql
│   │   ├── 2025-11-03_fix_trigger_contato_field.sql
│   │   ├── 2025-11-03_fix_upload_configuration.sql
│   │   ├── 2025-11-03_fk_pos_vendas_processed_data.sql
│   │   ├── 2025-11-03_normalize_processed_data_structure.sql
│   │   ├── 2025-11-03_remove_redundant_trigger.sql
│   │   ├── 2025-11-04_fix_pos_vendas_trigger_derivados.sql
│   │   ├── 2025-11-04_migrate_orcamento_to_atendimento_id.sql
│   │   ├── 2025-11-06_fix_upload_preserve_status.sql
│   │   ├── 2025-11-06_profissionais_insert_anon_fix.sql
│   │   ├── 2025-11-11_unit_modules.sql
│   │   ├── 2025-11-14_dashboard_sistema_module.sql
│   │   ├── 2025-11-14_data_drome_actions_table.sql
│   │   ├── 2025-11-15_database_general_metrics_rpc.sql
│   │   ├── 2025-11-15_database_metrics_rpc.sql
│   │   ├── 2025-11-15_subdomain_migration.sql
│   │   ├── 2025-11-16_activity_logs_rls_policy.sql
│   │   ├── 2025-11-17_create_n8n_logs_table.sql        # ⭐ NOVO
│   │   ├── 2025-11-17_module_access_tracking.sql       # ⭐ NOVO
│   │   ├── 2025-11-17_remove_data_drome_fdw.sql
│   │   └── 2025-11-03_upload_fixes_summary.md
│   │
│   ├── ANALISE_ESTRUTURA_COMPLETA.md
│   ├── CHANGELOG.md
│   ├── COMPLEMENTO_COPILOT_INSTRUCTIONS.md
│   ├── CONFIGURACAO_SUBDOMINIOS_MODULOS.md
│   ├── DATA_DROME_CONSOLIDATION.md
│   ├── FIX_PROFISSIONAIS_INSERT_RLS.md
│   ├── FIX_TRIGGER_CONTATO.md
│   ├── MIGRACAO_SERVICOS.md
│   ├── N8N_LOGS_TABLE.md                               # ⭐ NOVO
│   ├── REALTIME_IMPLEMENTATION_GUIDE.md
│   ├── REALTIME_STATUS.md
│   ├── SUBDOMINIOS_E_URLS.md
│   ├── UNIT_BASED_ACCESS_CONTROL.md
│   ├── UPLOAD_BEHAVIOR.md
│   ├── UPLOAD_STATUS_FIX.md
│   └── UPLOAD_STATUS_LOGIC.md                          # ⭐ NOVO
│
├── hooks/                          # Custom Hooks React
│   └── useRealtimeSubscription.ts # Hook Realtime genérico
│
├── public/                         # Arquivos públicos
│   ├── android-chrome-192x192.png # Ícone PWA 192x192
│   ├── android-chrome-512x512.png # Ícone PWA 512x512
│   ├── apple-touch-icon.png
│   ├── favicon-16x16.png
│   ├── favicon-32x32.png
│   ├── favicon.ico
│   └── pwa-icons-placeholder.txt
│
├── services/                       # Camada de Serviços (26 arquivos)
│   ├── access/                    # Controle de Acesso
│   │   └── accessCredentials.service.ts
│   │
│   ├── analytics/                 # Analytics e Métricas (6 serviços)
│   │   ├── activityLogs.service.ts
│   │   ├── clients.service.ts
│   │   ├── dashboard.service.ts
│   │   ├── prestadoras.service.ts
│   │   ├── repasse.service.ts
│   │   ├── serviceAnalysis.service.ts
│   │   └── storage.service.ts
│   │
│   ├── auth/                      # Autenticação
│   │   └── users.service.ts
│   │
│   ├── comercial/                 # CRM e Oportunidades
│   │   └── comercial.service.ts
│   │
│   ├── content/                   # Conteúdo Dinâmico
│   │   └── content.service.ts
│   │
│   ├── data/                      # Dados e Clientes (3 serviços)
│   │   ├── clientHistory.service.ts
│   │   ├── clientsDirectory.service.ts
│   │   └── dataTable.service.ts
│   │
│   ├── ingestion/                 # Upload e Processamento
│   │   └── upload.service.ts
│   │
│   ├── modules/                   # Módulos de Negócio
│   │   └── modules.service.ts
│   │
│   ├── posVendas/                 # Pós-Vendas (2 serviços)
│   │   ├── diagnostics.service.ts
│   │   └── posVendas.service.ts
│   │
│   ├── profissionais/             # Profissionais
│   │   └── profissionais.service.ts
│   │
│   ├── recrutadora/               # Recrutamento
│   │   └── recrutadora.service.ts
│   │
│   ├── units/                     # Unidades (5 serviços)
│   │   ├── unitKeys.service.ts
│   │   ├── unitKeysAdmin.service.ts
│   │   ├── unitKeysColumns.service.ts
│   │   ├── unitModules.service.ts
│   │   └── units.service.ts
│   │
│   ├── comercial-admin/           # Gestão de Produção (Março 2026)
│   │   └── comercial-admin.service.ts
│   │
│   ├── infinitepay/               # Gateway de Pagamento
│   │   └── infinitepay.service.ts
│   │
│   ├── utils/                     # Utilitários (8 serviços)
│   │   ├── activityLogger.service.ts
│   │   ├── batch.service.ts
│   │   ├── dates.ts
│   │   ├── errors.ts
│   │   ├── export.service.ts
│   │   ├── log.ts
│   │   ├── records.ts
│   │   └── urlUtils.ts            # ⭐ NOVO (Subdomínios/Slugs)
│   │
│   ├── index.ts                   # Barrel export (temporário)
│   ├── mockApi.ts                 # Compatibilidade (temporário)
│   └── supabaseClient.ts          # Cliente Supabase
│
├── supabase/                       # Configurações Supabase
│   └── .temp/                     # Metadados temporários
│
├── tools/                          # Scripts Python
│   ├── generate_staging_insert_sql.py
│   ├── generate_staging_raw_insert_sql.py
│   └── normalize_mblondrina_csv.py
│
├── .env.example                    # Template de variáveis de ambiente
├── .env.local                      # Variáveis locais (não commitado)
├── .gitignore
├── App.tsx                         # Componente raiz da aplicação
├── DEPLOY_GUIDE.md
├── index.html                      # HTML raiz
├── index.tsx                       # Entry point React
├── metadata.json
├── package.json
├── README.md                       # ⭐ ATUALIZADO (3 novas seções)
├── REPOSITORY_STRUCTURE.md         # Este arquivo
├── SYSTEM_OVERVIEW.md
├── tsconfig.json
├── types.ts                        # Definições de tipos TypeScript
└── vite.config.ts                  # Configuração Vite + PWA
```

---

## 🆕 Atualizações Recentes (2025-11-17)

### 1. **Rastreamento de Acesso a Módulos**
- ✅ **Tabela `actions`**: +16 ações automáticas (`access_module_*`)
- ✅ **Trigger Database**: `auto_create_module_action` (sincronização automática)
- ✅ **Frontend**: `Sidebar.tsx` registra acesso a cada clique
- ✅ **Serviço**: `activityLogger.service.ts` método `logModuleAccess()`
- 📄 **SQL**: `docs/sql/2025-11-17_module_access_tracking.sql`

### 2. **Logs N8N (Webhooks Externos)**
- ✅ **Tabela `n8n_logs`**: Estrutura completa com 10 campos
- ✅ **Índices**: 7 índices de performance para queries otimizadas
- ✅ **RLS Policies**: SELECT (authenticated) + INSERT (anon/service_role)
- 📄 **SQL**: `docs/sql/2025-11-17_create_n8n_logs_table.sql`
- 📚 **Documentação**: `docs/N8N_LOGS_TABLE.md`

### 3. **Upload de Planilhas - Lógica de STATUS**
- ✅ **Business Rule**: STATUS "esperar" apenas quando TODOS os atendimentos são Tarde
- ✅ **Implementação**: `applyWaitStatusForAfternoonShifts()` com verificação `hasManha`
- ✅ **Fix TypeScript**: `record.STATUS` → `record.status` (lowercase)
- 📄 **Arquivo**: `services/ingestion/upload.service.ts`
- 📚 **Documentação**: `docs/UPLOAD_STATUS_LOGIC.md`

### 4. **Documentação Completa**
- ✅ **README.md**: Atualizado com 3 novas seções principais
- ✅ **Build**: Pasta `dist/` reconstruída com latest code
- ✅ **Estrutura**: Este arquivo (`REPOSITORY_STRUCTURE.md`) criado

---

## 🔧 Serviços por Categoria

### Analytics & Métricas (6 serviços)
```
activityLogs.service.ts      - Logs de atividade do sistema
clients.service.ts            - Análise de clientes
dashboard.service.ts          - Métricas do dashboard
prestadoras.service.ts        - Análise de profissionais
repasse.service.ts            - Cálculos de repasse
serviceAnalysis.service.ts    - Análise de serviços
```

### Gerenciamento de Unidades (5 serviços)
```
unitKeys.service.ts           - Chaves dinâmicas de unidades
unitKeysAdmin.service.ts      - Admin de chaves
unitKeysColumns.service.ts    - Colunas customizadas
unitModules.service.ts        - Módulos por unidade
units.service.ts              - CRUD de unidades
```

### Dados & Clientes (3 serviços)
```
clientHistory.service.ts      - Histórico de clientes
clientsDirectory.service.ts   - Diretório geral
dataTable.service.ts          - Tabela de dados processados
```

### Utilitários (6 serviços)
```
activityLogger.service.ts     - Logger centralizado (+ logModuleAccess)
batch.service.ts              - Operações em batch
dates.ts                      - Manipulação de datas
errors.ts                     - Tratamento de erros
log.ts                        - Console logging
records.ts                    - Transformações de registros
```

### Outros (6 serviços)
```
accessCredentials.service.ts  - Controle de acesso
users.service.ts              - Gerenciamento de usuários
comercial.service.ts          - CRM e oportunidades
content.service.ts            - Conteúdo dinâmico
upload.service.ts             - Upload e processamento XLSX
modules.service.ts            - Módulos de negócio
```

---

## 🗄️ Estrutura de Banco de Dados

### Tabelas Principais
```sql
-- Dados de Atendimentos
processed_data                  -- Dados processados de XLSX
pos_vendas                      -- Pós-vendas e reagendamentos

-- Gestão de Unidades
units                           -- Unidades cadastradas
unit_modules                    -- Módulos por unidade (composite PK)
unit_keys                       -- Chaves dinâmicas

-- Gestão de Usuários
profiles                        -- Perfis de usuários
user_modules                    -- Módulos atribuídos (composite PK)

-- Módulos e Navegação
modules                         -- Módulos disponíveis (15 ativos)
actions                         -- Ações do sistema (39 registros)
activity_logs                   -- Logs de atividade do usuário

-- Webhooks e Integrações
n8n_logs                        -- Logs de webhooks N8N (⭐ NOVO)

-- CRM e Profissionais
comercial                       -- Oportunidades comerciais
recrutadora                     -- Profissionais
profissionais                   -- Dados de profissionais
```

### Triggers Ativos
```sql
auto_create_module_action       -- Sincroniza modules → actions (⭐ NOVO)
sync_processed_to_pos_vendas    -- processed_data → pos_vendas
sync_pos_vendas_status          -- pos_vendas → processed_data (STATUS)
```

---

## 🚀 Build & Deploy

### Comandos Principais
```bash
# Desenvolvimento
npm run dev                     # Servidor dev (Vite)

# Produção
npm run build                   # Build completo (dist/)
npm run preview                 # Preview do build

# Linting
npm run lint                    # ESLint check
```

### Configuração PWA
```javascript
// vite.config.ts
VitePWA({
  registerType: 'autoUpdate',
  workbox: {
    runtimeCaching: [
      // Google Fonts: CacheFirst - 1 ano
      // Imagens: CacheFirst - 30 dias
      // API Supabase: NetworkFirst - 5min
    ]
  }
})
```

### Otimizações de Build
- ✅ **Code Splitting**: React e Supabase separados
- ✅ **Compressão**: Gzip + Brotli dual
- ✅ **Terser**: `drop_console: true` (produção)
- ✅ **Source Maps**: Desabilitados
- ✅ **Chunk Size**: Limite 1000KB

---

## 📦 Dependências Principais

```json
{
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "@supabase/supabase-js": "^2.48.1",
  "lucide-react": "^0.468.0",
  "recharts": "^2.15.0",
  "xlsx": "^0.18.5",
  "jspdf": "^2.5.2",
  "dompurify": "^3.2.3",
  "@hello-pangea/dnd": "^17.0.0",
  "vite-plugin-pwa": "^0.20.5"
}
```

---

## 📊 Realtime Status

### Páginas com Realtime Ativo
```
✅ DataPage                      - processed_data
✅ PosVendasPage                 - pos_vendas
✅ RecrutadoraPage               - recrutadora
✅ ProfissionaisPage             - profissionais
✅ ComercialPage                 - comercial
✅ PrestadorasPage               - processed_data
✅ ManageUsersPage               - profiles
✅ DashboardSistemaPage          - activity_logs  # ⭐ NOVO
```

### Hook Genérico
```typescript
useRealtimeSubscription<T>(
  table: string,
  filter?: string,
  onUpdate: (payload) => void
)
```

---

## 🔐 Controle de Acesso (Unit-Based)

### Hierarquia de Permissões
```
Super Admin → Vê módulos com 'super_admin' em allowed_profiles
Admin       → Vê TODOS os módulos da unidade (via unit_modules)
User        → Vê interseção de user_modules ∩ unit_modules
```

### Fluxo de Atribuição
```
1. ManageUnitsPage → Atribuir módulos à unidade (unit_modules)
2. ManageUsersPage → Atribuir módulos ao usuário (user_modules)
3. AuthContext → getModulesForUnit(unitId) filtra por perfil
4. Sidebar → Renderiza módulos filtrados
5. ContentArea → Carrega página/webhook do módulo
```

---

## 📝 Convenções de Código

### Nomenclatura
```typescript
// Arquivos
Pages:     DashboardMetricsPage.tsx
Modals:    UserFormModal.tsx
Services:  dashboard.service.ts

// Código
Funções:   camelCase     (fetchDashboardMetrics)
Tipos:     PascalCase    (DataRecord)
Constantes: UPPER_SNAKE   (MAX_UPLOAD_SIZE)
Components: PascalCase    (DashboardPage)
```

### Console Logs Padronizados
```typescript
console.log('[ComponentName] Action: details');
// ⚠️ Removidos automaticamente em produção (terser)
```

---

## ⚠️ Notas Importantes

### Limpeza Futura (Fase 6)
```
❌ @aws-sdk/* (não usado, ~2MB)
❌ services/index.ts (barrel temporário)
❌ services/mockApi.ts (compatibilidade)
```

### Warnings Conhecidos
```
⚠️ 223 MD lint warnings no README (formatação, não bloqueia)
⚠️ Service Worker pode causar cache em dev (limpar manualmente)
```

---

## 📚 Documentação Adicional

Para informações detalhadas, consulte:

- **README.md** - Setup e configuração geral
- **SYSTEM_OVERVIEW.md** - Visão geral do sistema
- **ANALISE_ESTRUTURA_COMPLETA.md** - Análise arquitetural
- **COMPLEMENTO_COPILOT_INSTRUCTIONS.md** - Detalhes técnicos
- **docs/CHANGELOG.md** - Histórico de mudanças
- **docs/REALTIME_STATUS.md** - Status e guias Realtime
- **docs/UNIT_BASED_ACCESS_CONTROL.md** - Sistema de permissões
- **docs/N8N_LOGS_TABLE.md** - Tabela de logs N8N
- **docs/UPLOAD_STATUS_LOGIC.md** - Lógica de STATUS no upload

---

**Última atualização:** 2025-11-17  
**Build hash:** B1dEuVct (index) + 40c80ae4 (workbox)  
**Autor:** DromeFlow Team
