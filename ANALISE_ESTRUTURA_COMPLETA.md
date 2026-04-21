# Análise Completa da Estrutura do DromeFlow

## 📊 Visão Geral da Arquitetura

### Stack Tecnológica Completa
```
Frontend:
├── React 19.1.1 (latest)
├── TypeScript 5.8.2
├── Vite 6.2.0 (build tool)
├── Tailwind CSS (styling)
└── Lucide React 0.544.0 (icons)

Backend:
├── Supabase (PostgreSQL + Realtime + Storage)
└── Node.js 18+ (runtime)

Bibliotecas Especializadas:
├── @supabase/supabase-js 2.x (cliente)
├── xlsx (latest) - processamento de planilhas
├── @hello-pangea/dnd 18.0.1 - drag and drop
├── recharts 3.2.1 - gráficos
├── jspdf 2.5.1 - geração de PDFs
├── html2canvas 1.4.1 - screenshots
├── @aws-sdk/client-s3 3.932.0 - S3 integration
└── uuid 13.0.0 - identificadores únicos

Build & Optimization:
├── vite-plugin-pwa 1.1.0 - Progressive Web App
├── vite-plugin-compression 0.5.1 - Brotli + Gzip
└── terser 5.44.0 - minificação JS
```

---

## 🏗️ Estrutura de Diretórios Detalhada

### Componentes (60 arquivos)
```
components/
├── layout/ (2 arquivos)
│   ├── Sidebar.tsx - Navegação lateral com seletor de unidade
│   └── ContentArea.tsx - Container principal de conteúdo
│
├── pages/ (19 arquivos)
│   ├── LoginPage.tsx - Autenticação
│   ├── WelcomePage.tsx - Página inicial
│   ├── DashboardPage.tsx - Dashboard principal
│   ├── DashboardMetricsPage.tsx - Métricas avançadas
│   ├── DashboardSistemaPage.tsx - Dashboard do sistema
│   ├── DataPage.tsx - Gestão de dados de atendimentos
│   ├── AppointmentsPage.tsx - Agendamentos
│   ├── ClientsPage.tsx - Base de clientes (deprecated)
│   ├── ClientsBasePage.tsx - Nova base de clientes
│   ├── PosVendasPage.tsx - Pós-vendas
│   ├── ComercialPage.tsx - Kanban comercial
│   ├── PrestadorasPage.tsx - Profissionais ativos
│   ├── ProfissionaisPage.tsx - Gestão de profissionais
│   ├── RecrutadoraPage.tsx - Pipeline de recrutamento
│   ├── ManageUsersPage.tsx - Admin: Usuários
│   ├── ManageUnitsPage.tsx - Admin: Unidades
│   ├── ManageModulesPage.tsx - Admin: Módulos
│   ├── ManageAccessPage.tsx - Admin: Credenciais
│   └── UnitKeysPage.tsx - Admin: Configurações dinâmicas
│
└── ui/ (15 arquivos)
    ├── Icon.tsx - Wrapper para Lucide icons
    ├── MonthlyComparisonChart.tsx - Gráfico mensal reutilizável
    ├── DataDetailModal.tsx - Detalhes de atendimento (3 abas)
    ├── EditRecordModal.tsx - Edição rápida
    ├── ClientDetailModal.tsx - Detalhes do cliente
    ├── ComercialCardModal.tsx - Edição de oportunidades
    ├── PosVendaFormModal.tsx - Formulário pós-venda
    ├── ProfissionalDetailModal.tsx - Detalhes profissional
    ├── ProfissionalFormModal.tsx - Formulário profissional
    ├── RecrutadoraCardModal.tsx - Card recrutadora
    ├── ProfessionalAppointmentsModal.tsx - Atendimentos por profissional
    ├── UnitClientModal.tsx - Modal de cliente da unidade
    ├── UserFormModal.tsx - Formulário de usuário (multi-unidade)
    ├── ProfileModal.tsx - Perfil do usuário
    └── UploadModal.tsx - Upload de planilhas XLSX
```

### Serviços (26 arquivos)
```
services/
├── supabaseClient.ts - Cliente único Supabase
├── index.ts - Barrel (será removido Fase 6)
├── mockApi.ts - Compatibilidade (será removido Fase 6)
│
├── auth/
│   └── users.service.ts - CRUD usuários, atribuições
│
├── units/
│   ├── units.service.ts - CRUD unidades
│   ├── unitKeys.service.ts - Configurações por unidade
│   ├── unitModules.service.ts - Módulos por unidade (9 funções)
│   └── unitKeysAdmin.service.ts - Admin de colunas dinâmicas
│
├── modules/
│   └── modules.service.ts - CRUD módulos, ordenação
│
├── analytics/
│   ├── dashboard.service.ts - Métricas dashboard
│   ├── clients.service.ts - Análise de clientes
│   ├── storage.service.ts - Métricas storage (apenas Supabase)
│   ├── serviceAnalysis.service.ts - Submétricas mensais
│   ├── repasse.service.ts - Análise de repasse
│   └── prestadoras.service.ts - Métricas profissionais
│
├── data/
│   ├── dataTable.service.ts - CRUD atendimentos
│   └── clientHistory.service.ts - Histórico de clientes
│
├── ingestion/
│   └── upload.service.ts - Pipeline XLSX (expansão, divisão, limpeza)
│
├── profissionais/
│   └── profissionais.service.ts - CRUD profissionais
│
├── recrutadora/
│   └── recrutadora.service.ts - Pipeline recrutamento
│
├── comercial/
│   └── comercial.service.ts - Kanban CRM
│
├── posVendas/
│   ├── posVendas.service.ts - CRUD pós-vendas
│   └── diagnostics.service.ts - Diagnósticos
│
├── access/
│   └── accessCredentials.service.ts - Credenciais de integração
│
├── content/
│   └── content.service.ts - Webhook content
│
├── integration/
│   └── dataDrome.service.ts - N8N logs (opcional)
│
└── utils/
    └── dates.ts - Utilitários de data
```

---

## 🔑 Informações Importantes Não Documentadas

### 1. **Progressive Web App (PWA)**
O sistema está configurado como PWA completo:

```javascript
// vite.config.ts
VitePWA({
  registerType: 'autoUpdate',
  manifest: {
    name: 'DromeFlow',
    short_name: 'DromeFlow',
    theme_color: '#010d32',
    display: 'standalone'
  }
})
```

**Capacidades:**
- ✅ Instalável no desktop/mobile
- ✅ Service Worker com cache estratégico
- ✅ Funciona offline (recursos estáticos)
- ✅ Auto-update automático
- ✅ Cache inteligente:
  - Google Fonts: 1 ano
  - Imagens: 30 dias
  - API Supabase: 5 minutos (NetworkFirst)

**Arquivos PWA:**
- `/public/android-chrome-192x192.png`
- `/public/android-chrome-512x512.png`
- `/public/favicon.ico`
- `/public/apple-touch-icon.png`

---

### 2. **Build Otimizado para Produção**

#### Chunking Estratégico
```javascript
manualChunks: {
  'vendor-react': ['react', 'react-dom'],
  'vendor-supabase': ['@supabase/supabase-js']
}
```

#### Compressão Dual
- **Brotli** (`.br`): Compressão superior (~20% melhor que gzip)
- **Gzip** (`.gz`): Fallback para servidores antigos
- Threshold: 10KB (não comprime arquivos pequenos)

#### Terser Minification
```javascript
terserOptions: {
  compress: {
    drop_console: true,    // Remove console.log em produção
    drop_debugger: true    // Remove debugger statements
  }
}
```

#### Otimizações Adicionais
- ❌ Source maps desabilitados em produção
- ❌ Report de tamanho comprimido desabilitado (build mais rápido)
- ⚡ Limit de chunk: 1000KB

---

### 3. **TypeScript Configuration Avançada**

```json
{
  "target": "ES2022",
  "experimentalDecorators": true,
  "moduleResolution": "bundler",
  "jsx": "react-jsx",
  "paths": {
    "@/*": ["./*"]  // Import alias
  }
}
```

**Features Importantes:**
- ✅ Decorators experimentais habilitados
- ✅ Path alias `@/` aponta para raiz
- ✅ Isolated modules (performance)
- ✅ Force module detection
- ✅ Permite importar `.ts` extensions

**Exemplo de uso:**
```typescript
import { fetchUsers } from '@/services/auth/users.service';
```

---

### 4. **Variáveis de Ambiente e Secrets**

#### Estrutura Completa do `.env.local`
```bash
# === PRINCIPAL (DromeFlow) ===
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_CHAVE_ANON

# === OPCIONAL (Data Drome - Logs N8N) ===
VITE_DATA_DROME_URL=https://SEU-PROJETO-LOGS.supabase.co
VITE_DATA_DROME_ANON_KEY=SUA_CHAVE_SERVICE_ROLE

# === IA (Opcional - se usar Gemini) ===
GEMINI_API_KEY=SUA_CHAVE_GEMINI
```

**⚠️ Atenção:**
- Cloudflare variables **foram removidas** (R2/D1 não mais usado)
- Usar `.env.local` (ignorado pelo git)
- Prefixo `VITE_` expõe para cliente
- `GEMINI_API_KEY` injetado via `define` no Vite config

---

### 5. **Metadados e Permissões**

#### metadata.json
```json
{
  "name": "DromeFlow",
  "description": "Aplicação web com sidebar dinâmica, papéis e webhooks",
  "requestFramePermissions": []
}
```

**Observação:** Campo `requestFramePermissions` vazio indica que não há requisitos especiais de iframe.

---

### 6. **Arquitetura de Tipos (types.ts)**

#### Enums Principais
```typescript
export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  USER = 'user'
}
```

#### Interfaces Core
```typescript
// Usuário e Perfil
Profile {
  id, email, full_name, role
}

// Unidades
Unit {
  id, unit_name, unit_code, slug, address, is_active
}

// Configurações Dinâmicas
UnitKey {
  id, unit_id,
  // Campos configuráveis:
  umbler, whats_profi, whats_client,
  botID, organizationID, trigger,
  conexao, description, is_active
}

// Módulos
Module {
  id, code, name, icon_name,
  allowed_profiles[], position,
  is_active, webhook_url, view_id
}
```

**Total de Interfaces:** ~25 (DataRecord, PosVenda, Comercial, Profissional, etc.)

---

### 7. **Padrões de Nomenclatura**

#### Arquivos
- **Componentes:** PascalCase + `.tsx`
  - `DashboardMetricsPage.tsx`
  - `UserFormModal.tsx`
- **Serviços:** camelCase + `.service.ts`
  - `dashboard.service.ts`
  - `unitModules.service.ts`
- **Contextos:** PascalCase + `Context.tsx`
  - `AuthContext.tsx`
  - `AppContext.tsx`

#### Código
- **Funções:** camelCase
  - `fetchDashboardMetrics()`
  - `updateUserAssignments()`
- **Tipos/Interfaces:** PascalCase
  - `DataRecord`, `UnitKey`
- **Constantes:** UPPER_SNAKE_CASE
  - `MAX_UPLOAD_SIZE`, `DEFAULT_PAGE_SIZE`

---

### 8. **Integração AWS S3**

**Observação Importante:** O projeto tem dependências AWS SDK instaladas:
```json
"@aws-sdk/client-s3": "^3.932.0",
"@aws-sdk/s3-request-presigner": "^3.932.0"
```

**Status Atual:**
- ❌ Não está sendo usado (removido junto com Cloudflare)
- ⚠️ Pode ser utilizado no futuro para storage alternativo
- ✅ Supabase Storage é a solução atual

**Ação Recomendada:** Remover na Fase 6 (limpeza) se não houver planos de uso.

---

### 9. **Sistema de Roteamento Personalizado**

#### Sem React Router
A aplicação **não usa** React Router. Navegação é controlada por:

```typescript
// AppContext.tsx
const { activeView, setView } = useAppContext();

// Navegação
setView('dashboard');  // Muda para dashboard
setView('data');       // Muda para dados
```

#### ContentArea.tsx - Renderização Dinâmica
```typescript
// Lógica de renderização:
1. Se view === 'welcome' → WelcomePage
2. Se view === 'dashboard' → DashboardPage
3. Se módulo tem view_id → Página específica
4. Se módulo tem webhook_url → Carrega HTML externo
```

**Segurança de Conteúdo:**
- ✅ Apenas URLs com `internal://` são injetadas
- ❌ URLs externas sem prefixo são bloqueadas

---

### 10. **Changelog e Versionamento**

#### Estrutura do CHANGELOG.md
```
[YYYY-MM-DD] - Título da Mudança

### 🎨 UI/UX | 🐛 Bug | 🚀 Feature | 🔧 Config

#### Seção
- Detalhes da mudança
- Arquivos modificados
- Benefícios

---
```

**Últimas Mudanças Importantes:**
1. **2025-11-07:** Padronização de Modais (UX otimizado)
2. **2025-11-06:** Upload preserva STATUS condicionalmente
3. **2025-11-03:** Sincronização pós-vendas bidirecional
4. **2025-10-31:** Sistema de agendamentos pós-venda

---

### 11. **Documentação SQL (docs/sql/)**

#### Categorias de Scripts
```
docs/sql/
├── Tabelas Core
│   ├── 2025-09-27_profissionais.sql
│   ├── 2025-10-31_pos_vendas_table.sql
│   ├── 2025-10-15_comercial.sql
│   └── 2025-11-11_unit_modules.sql
│
├── Triggers e Automações
│   ├── 2025-10-31_pos_vendas_sync_trigger.sql
│   ├── 2025-11-03_auto_sync_processed_to_pos_vendas.sql
│   └── 2025-11-03_fix_pos_vendas_status_sync_trigger.sql
│
├── RPCs e Funções
│   ├── 2025-10-03_rpc_sync_unit_clients.sql
│   ├── 2025-10-31_batch_update_positions.sql
│   ├── 2025-11-15_database_metrics_rpc.sql
│   └── 2025-11-15_database_general_metrics_rpc.sql
│
├── Migrações e Fixes
│   ├── 2025-11-04_migrate_orcamento_to_atendimento_id.sql
│   ├── 2025-11-06_fix_upload_preserve_status.sql
│   └── 2025-11-03_normalize_processed_data_structure.sql
│
├── Infraestrutura
│   └── 2025-10-10_subdomains_and_module_routes.sql
│
└── Realtime & RLS
    ├── 2025-11-03_enable_realtime_processed_data.sql
    ├── 2025-10-02_unit_keys_policies.sql
    └── 2025-11-15_data_drome_rls_policies.sql
```

**Total:** 39 scripts SQL documentados

---

### 12. **Features Documentadas (docs/features/)**

```
docs/features/
├── pos-vendas-contatados-table.md
│   └── Tabela de contatados no pós-vendas
└── prestadoras-atencao-ultimo-atendimento.md
    └── Último atendimento em "Atenção"
```

---

### 13. **Estatísticas do Projeto**

#### Contagem de Arquivos
```
Páginas (components/pages):      19 arquivos
Modais/UI (components/ui):       15 arquivos
Serviços (services):             26 arquivos
Scripts SQL (docs/sql):          39 arquivos
Documentação (docs/*.md):        12 arquivos
```

#### Linhas de Código (estimativa)
```
TypeScript/TSX:  ~15.000 linhas
SQL:             ~3.000 linhas
Markdown:        ~5.000 linhas
Total:           ~23.000 lineas
```

---

## 🔐 Segurança e Permissões

### Row Level Security (RLS)

#### Status Atual (MVP)
- ✅ Políticas permissivas (authenticated users)
- ⚠️ Filtragem feita na aplicação (não no banco)
- 🔮 **Planejado:** RLS restritivo por unidade/módulo

#### Tabelas com RLS Ativo
```sql
-- Já implementado
✅ unit_keys
✅ unit_modules
✅ data_drome_actions
✅ profissionais

-- Pendente (prioridade alta)
⏳ processed_data (filtrar por unidade)
⏳ pos_vendas (filtrar por unit_id)
⏳ comercial (filtrar por unit_id)
```

### Autenticação Customizada

**⚠️ Importante:**
- Sistema atual NÃO usa `supabase.auth`
- Login valida diretamente tabela `profiles`
- Senhas armazenadas em **texto plano** (❌ inseguro)

**Migração Planejada:**
```
Fase 1: Hash de senhas (bcrypt/scrypt)
Fase 2: Migrar para auth.users
Fase 3: Triggers de sincronização profiles ↔ auth.users
Fase 4: JWT claims para RLS
```

---

## 🚀 Deploy e Infraestrutura

### Hospedagem Atual
- **Frontend:** Hostinger (HTML/JS estático)
- **Backend:** Supabase Cloud
- **CDN/Proxy:** Cloudflare (apenas DNS/CDN)

### Processo de Deploy (SSH/SFTP)
- **Método:** Sincronização recursiva via SFTP (SSH) utilizando o script `scripts/deploy.js`.
- **Servidor:** Hostinger (Porta **65002**).
- **Diretório Remoto:** `domains/dromeflow.com/public_html/`.
- **Credenciais:** Armazenadas no arquivo `.env.local` (não versionado).
- **Variáveis Necessárias:**
  - `SFTP_HOST`: IP do servidor.
  - `SFTP_PORT`: 65002.
  - `SFTP_USER`: Usuário SSH.
  - `SFTP_PASSWORD`: Senha SSH.
  - `SFTP_DEST`: Caminho de destino.

### Arquivos de Deploy
```
public/
├── .htaccess - Rewrite rules para SPA + Brotli/Gzip estático + cache + headers de segurança
├── favicon.ico
├── android-chrome-192x192.png
└── android-chrome-512x512.png

dist/ (gerado)
├── index.html
├── assets/
│   ├── index-[hash].js
│   ├── index-[hash].css
│   └── vendor-react-[hash].js
└── workbox-[hash].js (service worker)
```

### Comandos de Build
```bash
npm run dev      # Desenvolvimento (hot reload)
npm run build    # Produção (minificado)
npm run preview  # Preview local do build
```

---

## 📈 Métricas e Performance

### Otimizações Implementadas

#### 1. Code Splitting
- React/ReactDOM em chunk separado
- Supabase em chunk separado
- Lazy loading de páginas (não implementado ainda)

#### 2. Cache Strategy
```
Assets Estáticos:  Cache-First (1 ano)
API Calls:         Network-First (5min timeout)
Imagens:           Cache-First (30 dias)
```

#### 3. Compressão
- Brotli: ~40-60% redução
- Gzip: ~30-50% redução
- Threshold: 10KB

#### 4. Bundle Size (estimado)
```
vendor-react.js:    ~150 KB (gzipped)
vendor-supabase.js: ~80 KB (gzipped)
app.js:             ~200 KB (gzipped)
Total inicial:      ~430 KB (gzipped)
```

---

## 🔄 Realtime e Sincronização

### Módulos com Realtime Ativo

#### Implementados (✅)
```typescript
1. PosVendasPage
   - Tabela: pos_vendas
   - Filter: unit_id
   - Events: INSERT, UPDATE, DELETE

2. DataPage
   - Tabela: processed_data
   - Filter: unidade_code
   - Events: INSERT, UPDATE, DELETE

3. DashboardMetricsPage
   - Tabelas: multiple
   - Recalcula métricas automaticamente

4. AppointmentsPage
   - Tabela: processed_data
   - Events: UPDATE (status changes)
```

#### Planejados (🔄)
```
5. ComercialPage (Kanban)
6. RecrutadoraPage (Pipeline)
```

### Pattern de Implementação
```typescript
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';

useRealtimeSubscription({
  tableName: 'pos_vendas',
  filter: `unit_id=eq.${unitId}`,
  onUpdate: () => {
    loadData(); // Recarrega sem spinner
  }
});
```

**⚠️ Regra Crítica:**
- COM Realtime: ❌ Nunca chamar `loadData()` após CRUD
- SEM Realtime: ✅ Manter `loadData()` após save/delete
- Error handlers: ✅ Sempre permitir reload manual

---

## 🐛 Problemas Conhecidos e Fixes

### 1. Infinite Loading Spinner (Resolvido)
**Causa:** Dupla atualização (manual + realtime)
**Fix:** Remover `loadData()` de `handleCloseModal()`

### 2. Upload Sobrepondo STATUS (Resolvido)
**Causa:** UPDATE sempre sobrescrevia STATUS
**Fix:** Preservar STATUS se PROFISSIONAL não mudou

### 3. Tela Branca ao Salvar (Resolvido)
**Causa:** Fechar modal antes de `await loadData()`
**Fix:** Garantir ordem: `await loadData() → handleCloseModal()`

### 4. Checkboxes Não Marcam (Resolvido)
**Causa:** Mutação direta de Sets
**Fix:** Sempre usar `new Set(oldSet)` (imutabilidade React)

### 5. net::ERR_NAME_NOT_RESOLVED / Cache Obsoleto (Resolvido)
**Causa:** Navegador mantendo Service Workers ou cache de DNS de APIs (Supabase) após atualizações ou mudanças de rede.
**Fix:** Implementação de "Deep Cache Clear" no `UpdatePrompt` e `AgendaExternaPage`. O sistema agora desregistra Service Workers, limpa Storage (Local/Session) e força Hard Reload ao detectar nova versão ou finalizar envio de dados externos.

---

## 📚 Guias de Referência Rápida

### Criar Novo Módulo
```
1. Banco: INSERT INTO modules (code, name, icon_name, ...)
2. UI: components/pages/SeuModuloPage.tsx
3. Serviço: services/<dominio>/seuModulo.service.ts
4. Navegação: ContentArea detecta automaticamente
5. Permissões: allowed_profiles + unit_modules
6. Ordenação: Drag & drop em ManageModulesPage
```

### Adicionar Campo em UnitKey
```sql
-- Option A: Via UI (UnitKeysPage)
1. Abrir "Unit Keys" no menu (super_admin)
2. Clicar "Adicionar Coluna"
3. Preencher: nome, descrição, status
4. Salvar

-- Option B: Via SQL
SELECT unit_keys_add_column('nome_campo', 'Descrição');
```

### Debug Console Logs
```
[UserFormModal] Módulos carregados: [...]
[AuthContext] Login successful: {...}
[handleModuleToggle] Toggling module: dashboard
[updateUserAssignments] user_modules inseridos
```

---

## 🎯 Roadmap e Próximos Passos

### Prioridade Alta
1. ✅ Hash de senhas (substituir texto plano)
2. ✅ RLS restritivo por unidade
3. ⏳ Migrar para auth.users + triggers
4. ⏳ RPC batch para ordenação (reduzir round-trips)

### Prioridade Média
1. ⏳ Realtime no Comercial
2. ⏳ Realtime na Recrutadora
3. ⏳ Lazy loading de páginas
4. ⏳ Índices analíticos (unidade_code, DATA, IS_DIVISAO)
5. ⏳ Persistir colapso da Sidebar (localStorage)

### Prioridade Baixa
1. ⏳ Remover barrel services/index.ts (Fase 6)
2. ⏳ Remover AWS SDK (se não usado)
3. ⏳ Tooltips customizados
4. ⏳ PeriodDropdown compartilhado
5. ⏳ Churn como porcentagem no gráfico

---

## 📖 Documentação Adicional

### Arquivos de Referência
```
README.md                    - Setup e configuração geral
SYSTEM_OVERVIEW.md           - Arquitetura e fluxos
DEPLOY_GUIDE.md              - Deploy em produção
.github/copilot-instructions - Guia para IA coding agents

docs/
├── CHANGELOG.md             - Histórico de mudanças
├── REALTIME_STATUS.md       - Status do Realtime
├── UNIT_BASED_ACCESS_CONTROL.md - Sistema de permissões
├── UPLOAD_BEHAVIOR.md       - Comportamento de upload
└── SUBDOMINIOS_E_URLS.md    - Configuração de subdomínios
```

---

## ✅ Conclusão

### Pontos Fortes
- ✅ Arquitetura modular e bem organizada
- ✅ Serviços segmentados por domínio
- ✅ TypeScript completo
- ✅ PWA configurado
- ✅ Build otimizado
- ✅ Realtime implementado em módulos principais
- ✅ Documentação abrangente

### Pontos de Atenção
- ⚠️ Autenticação sem hash (MVP)
- ⚠️ RLS permissivo (a melhorar)
- ⚠️ Dependências AWS não usadas
- ⚠️ Sem lazy loading (bundles grandes)

### Pronto para
- ✅ Desenvolvimento de novos módulos
- ✅ Integração com webhooks
- ✅ Deploy em produção (com ressalvas de segurança)
- ✅ Expansão de funcionalidades

---

**Última atualização:** 2026-04-17  
**Versão:** 1.1  
**Autor:** Engenheiro de Software Sênior (Antigravity)
