---
trigger: always_on
glob: "**/*"
description: "Instruções completas para desenvolvimento no sistema DromeFlow - Regras de arquitetura, banco de dados, permissões e padrões de código"
---

# DromeFlow - Instruções para Agentes de IA

## 🎯 Visão Geral do Sistema

**DromeFlow** é uma aplicação SaaS multi-tenant de gestão empresarial construída com:
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: Supabase (PostgreSQL 17 + Realtime + Auth + RLS)
- **Região**: sa-east-1 (São Paulo)
- **Projeto Supabase**: DromeSTART (`uframhbsgtxckdxttofo`)

---

## 📊 ESTRUTURA DE BANCO DE DADOS

### Tabelas Principais (33 tabelas, TODAS com RLS habilitado)

#### 🔐 Autenticação e Permissões
- **profiles** - Usuários do sistema (super_admin, admin, user)
- **user_units** - Relação usuário ↔ unidades
- **user_modules** - Relação usuário ↔ módulos (atribuições individuais)

#### 🏢 Unidades e Configurações
- **units** - Unidades/clientes do sistema (multi-tenant)
- **unit_modules** - Módulos disponíveis por unidade
- **unit_keys** - Configurações únicas por unidade (API keys, webhooks)
- **unit_services** - Serviços oferecidos por unidade
- **unit_integrations** - Integrações externas por unidade
- **unit_plans** - Planos de assinatura das unidades
- **unit_payments** - Pagamentos das unidades
- **unit_clients** - Diretório de clientes por unidade

#### 📋 Dados Operacionais (CORE)
- **processed_data** - Atendimentos/orçamentos (68k+ registros)
  - Chave única: `(unidade_code, ATENDIMENTO_ID)`
  - Campos principais: DATA, HORARIO, VALOR, SERVIÇO, TIPO, CLIENTE, PROFISSIONAL, ENDEREÇO, REPASSE, STATUS
  - Suporta multi-profissional via sufixos `_1`, `_2` no ATENDIMENTO_ID
  - Campo `IS_DIVISAO`: 'SIM' para derivados, 'NAO' para originais

#### 👥 Gestão de Pessoas
- **profissionais** - Cadastro de prestadores de serviço
- **recrutadora** - Kanban de recrutamento (cards)
- **recrutadora_columns** - Colunas do Kanban de recrutamento
- **recruta_metrica** - Métricas de recrutamento

#### 💼 Comercial
- **comercial** - Kanban comercial (oportunidades)
- **comercial_columns** - Colunas do Kanban comercial
- **comercial_admin** - Kanban administrativo (super_admin)
- **comercial_admin_columns** - Colunas do Kanban admin

#### 📞 Pós-Vendas
- **pos_vendas** - Acompanhamento pós-venda
  - Sincronização bidirecional com `processed_data`
  - Trigger automático: INSERT em processed_data → CREATE em pos_vendas
  - Trigger reverso: UPDATE status em pos_vendas → UPDATE coluna "pos vendas" em processed_data

#### 💰 Financeiro
- **financial_categories** - Categorias financeiras (receita/despesa)
- **payment_records** - Registros de pagamentos (integração Asaas)
- **invoices** - Notas fiscais
- **plans** - Planos de assinatura disponíveis

#### 🔧 Sistema
- **modules** - Módulos dinâmicos do sistema
- **actions** - Ações rastreáveis do sistema
- **activity_logs** - Logs de atividades
- **error_logs** - Logs de erros
- **n8n_logs** - Logs de workflows N8N
- **webhook_schedules** - Agendamento de webhooks
- **access_credentials** - Credenciais de acesso (API keys, tokens)
- **atend_status** - Status de atendimentos

---

## 🔒 REGRAS DE ROW LEVEL SECURITY (RLS)

### ⚠️ CRÍTICO: RLS Habilitado em TODAS as Tabelas

**NUNCA**:
- ❌ Criar tabelas sem RLS
- ❌ Desabilitar RLS em tabelas existentes
- ❌ Modificar policies sem documentar
- ❌ Usar `service_role` key no frontend

**SEMPRE**:
- ✅ Habilitar RLS em novas tabelas
- ✅ Criar policies baseadas em `unit_id` para multi-tenancy
- ✅ Testar policies com diferentes perfis (super_admin, admin, user)
- ✅ Documentar mudanças em migrations SQL

### Padrão de Policies por Perfil

```sql
-- Super Admin: acesso total
CREATE POLICY "super_admin_all" ON table_name
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'super_admin'
    )
  );

-- Admin: acesso às suas unidades
CREATE POLICY "admin_own_units" ON table_name
  FOR ALL USING (
    unit_id IN (
      SELECT unit_id FROM user_units 
      WHERE user_id = auth.uid()
    )
  );

-- User: acesso restrito
CREATE POLICY "user_restricted" ON table_name
  FOR SELECT USING (
    unit_id IN (
      SELECT unit_id FROM user_units 
      WHERE user_id = auth.uid()
    )
  );
```

---

## 👤 HIERARQUIA DE PERMISSÕES

### 1. Super Admin (`super_admin`)
- **Acesso**: APENAS módulos com `'super_admin'` em `allowed_profiles`
- **Não herda**: Módulos públicos ou de outros perfis
- **Ignora**: `unit_modules` e `user_modules`
- **Exemplo**: Gerenciar Usuários, Gerenciar Módulos, Gerenciar Unidades, Dashboard Sistema

### 2. Admin (`admin`)
- **Acesso**: TODOS os módulos da unidade via `unit_modules`
- **Não precisa**: Atribuição em `user_modules`
- **Query**: `SELECT module_id FROM unit_modules WHERE unit_id = ?`
- **Exemplo**: Dashboard, Dados, Atendimentos, Clientes, Comercial, Pós-Vendas

### 3. User (`user`)
- **Acesso**: Interseção de `user_modules` ∩ `unit_modules`
- **Precisa estar**: Em ambas as tabelas
- **Query**: Módulos onde `user_id` E `unit_id` coincidem
- **Exemplo**: Apenas módulos explicitamente atribuídos pelo admin

### Fluxo de Atribuição

```
1. Super Admin cria módulo na tabela `modules`
2. Super Admin atribui módulo à unidade em `unit_modules`
3. Admin da unidade atribui módulo ao usuário em `user_modules`
4. User vê módulo na Sidebar (interseção)
```

---

## 📁 ARQUITETURA DE CÓDIGO

### Estrutura de Diretórios

```
DromeFlow/
├── components/
│   ├── layout/          # Sidebar, ContentArea
│   ├── pages/           # 19 páginas (DashboardPage, DataPage, etc.)
│   └── ui/              # 15 componentes reutilizáveis (modais, gráficos)
├── contexts/
│   ├── AuthContext.tsx  # Autenticação e permissões
│   └── AppContext.tsx   # Estado da UI (view, unidade)
├── services/            # 26 arquivos segmentados por domínio
│   ├── auth/            # users.service.ts
│   ├── units/           # units, unitKeys, unitModules, unitKeysAdmin
│   ├── modules/         # modules.service.ts
│   ├── analytics/       # dashboard, clients, storage, serviceAnalysis, repasse, activityLogs, prestadoras
│   ├── data/            # dataTable, agendamentos
│   ├── ingestion/       # upload.service.ts
│   ├── profissionais/   # profissionais.service.ts
│   ├── recrutadora/     # recrutadora.service.ts
│   ├── comercial/       # comercial.service.ts
│   ├── posVendas/       # posVendas, diagnostics
│   ├── access/          # accessCredentials.service.ts
│   ├── content/         # content.service.ts
│   └── utils/           # dates.ts, activityLogger.service.ts
├── types.ts             # 551 linhas - TODAS as interfaces TypeScript
└── docs/                # 21 arquivos de documentação técnica
```

### Padrões de Nomenclatura

```typescript
// Arquivos
Pages:     DashboardMetricsPage.tsx
Modals:    UserFormModal.tsx
Services:  dashboard.service.ts
Utils:     dates.ts
Contexts:  AuthContext.tsx

// Código
function fetchDashboardMetrics() { }        // camelCase
const handleSaveUser = () => { };           // camelCase
interface DataRecord { }                    // PascalCase
type UserRole = 'admin' | 'user';           // PascalCase
const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;   // UPPER_SNAKE_CASE
const DashboardPage = () => { };            // PascalCase (componentes)
```

### Logs Padronizados

```typescript
// Formato: [ComponentName] Action: details
console.log('[UserFormModal] Módulos carregados:', moduleIds);
console.log('[AuthContext] Login successful:', profile);
console.log('[handleModuleToggle] Toggling module:', moduleId);
```

⚠️ **Produção**: Todos `console.log` são removidos automaticamente via terser (`drop_console: true`)

---

## 📤 UPLOAD DE DADOS (XLSX)

### Chave Única e Comportamento

**Chave**: `(unidade_code, ATENDIMENTO_ID)`

| Situação | Ação | Descrição |
|----------|------|-----------|
| **Novo ATENDIMENTO_ID** | `INSERT` | Cria novo registro |
| **ATENDIMENTO_ID existente** | `UPDATE` | Atualiza todos os campos |
| **ID não está mais no arquivo** | `DELETE` | Removido por `removeObsoleteRecords()` |
| **Multi-profissionais** | `INSERT múltiplos` | Original + derivados com `_1`, `_2` |

### Pipeline de Processamento

```typescript
// services/ingestion/upload.service.ts
uploadXlsxData():
  1. Leitura do arquivo XLSX (SheetJS)
  2. Expansão multi-profissional (sufixos _1, _2, _3...)
     - Original: ATENDIMENTO_ID sem sufixo, VALOR integral, IS_DIVISAO='NAO'
     - Derivados: ATENDIMENTO_ID com sufixo, VALOR=0, IS_DIVISAO='SIM'
  3. Divisão de repasse (processRepasseValues)
  4. STATUS automático (applyWaitStatusForAfternoonShifts)
     - Marca STATUS="esperar" para múltiplos atendimentos "Tarde" no mesmo dia
  5. Limpeza de obsoletos (removeObsoleteRecords)
     - Remove IDs base que não estão mais no arquivo
  6. Envio em lotes de 500 para RPC process_xlsx_upload
  7. Retorna métricas (inserted, updated, ignored, deleted)
```

### STATUS Condicional

- **Preservado**: Se PROFISSIONAL não mudou
- **Atualizado**: Se PROFISSIONAL mudou (permite reatribuição)

### Campos Preservados no UPDATE

- `id` (primary key)
- `created_at` (timestamp de criação)

---

## 🧩 MÓDULOS DINÂMICOS

### Estrutura da Tabela `modules`

```typescript
interface Module {
  id: string;
  code: string;              // Chave única (ex: "dashboard")
  name: string;              // Rótulo na UI (ex: "Dashboard")
  icon_name: string;         // Nome do ícone Lucide (ex: "BarChart3")
  description?: string;      // Descrição opcional
  webhook_url?: string;      // URL para conteúdo externo
  view_id?: string;          // ID da view (se não usar webhook)
  is_active: boolean;        // Ativo/inativo
  allowed_profiles: string[]; // ['admin', 'user'] ou ['super_admin']
  position: number;          // Ordem de exibição (1..n)
  parent_id?: string;        // Hierarquia (nulo = topo)
}
```

### Criando um Novo Módulo

```sql
-- 1. Criar registro na tabela modules
INSERT INTO modules (code, name, icon_name, allowed_profiles, position, is_active)
VALUES ('meu_modulo', 'Meu Módulo', 'FileText', ARRAY['admin', 'user'], 10, true);

-- 2. Atribuir à unidade
INSERT INTO unit_modules (unit_id, module_id)
VALUES ('uuid-da-unidade', 'uuid-do-modulo');

-- 3. Atribuir ao usuário (apenas para role 'user')
INSERT INTO user_modules (user_id, module_id)
VALUES ('uuid-do-usuario', 'uuid-do-modulo');
```

```typescript
// 4. Criar página React
// components/pages/MeuModuloPage.tsx
export const MeuModuloPage = () => {
  const { selectedUnit } = useAppContext();
  const { userProfile } = useAuthContext();
  
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Meu Módulo</h1>
      {/* Conteúdo */}
    </div>
  );
};

// 5. Criar serviço
// services/meuDominio/meuModulo.service.ts
import { supabase } from '../supabaseClient';

export const fetchMeuModuloData = async (unitId: string) => {
  const { data, error } = await supabase
    .from('minha_tabela')
    .select('*')
    .eq('unit_id', unitId);
  
  if (error) throw error;
  return data;
};
```

### Ordenação Drag & Drop

- **Biblioteca**: `@hello-pangea/dnd`
- **Serviço**: `updateModulesOrder` em `services/modules/modules.service.ts`
- **Comportamento**: Reatribui `position` como sequência densa (1..n)
- **Otimização futura**: RPC batch para reduzir round-trips

---

## ⚡ REALTIME

### Módulos com Realtime Implementado

- ✅ **Pós-Vendas**: Completo (sincronização bidirecional com processed_data)
- ✅ **Agendamentos**: Completo (atualização automática da tabela)
- ✅ **Dashboard/Métricas**: Completo (recalculo automático)
- ✅ **Dashboard Sistema**: Completo (logs em tempo real)

### ⚠️ REGRA CRÍTICA: Evitar Infinite Loading Spinner

```typescript
// ❌ ERRADO - Com Realtime ativo
const handleCloseModal = () => {
  setIsModalOpen(false);
  loadData(); // Duplicação! Realtime já atualiza
};

// ✅ CORRETO
const handleCloseModal = () => {
  setIsModalOpen(false);
  // Realtime atualiza automaticamente via subscription
};
```

### Configuração Realtime

```typescript
// Hook personalizado
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';

const MyComponent = () => {
  const [data, setData] = useState([]);
  
  // Subscription automática
  useRealtimeSubscription(
    'table_name',
    `unit_id=eq.${unitId}`,
    (payload) => {
      // Atualiza estado local
      setData(prev => [...prev, payload.new]);
    }
  );
  
  return <div>{/* Renderiza data */}</div>;
};
```

### Requisitos no Supabase

```sql
-- Habilitar Realtime na tabela
ALTER PUBLICATION supabase_realtime ADD TABLE processed_data;
ALTER PUBLICATION supabase_realtime ADD TABLE pos_vendas;
```

---

## 📱 PWA (Progressive Web App)

### Características

- ✅ **Instalável**: Desktop e mobile
- ✅ **Offline-capable**: Service Worker com cache estratégico
- ✅ **Auto-update**: `registerType: 'autoUpdate'`
- ✅ **Manifest completo**: Ícones 192x192 e 512x512

### Estratégias de Cache (Workbox)

```javascript
// vite.config.ts
{
  'Google Fonts':     CacheFirst - 1 ano
  'Imagens':          CacheFirst - 30 dias
  'API Supabase':     NetworkFirst - 5min (timeout 10s)
  'Assets estáticos': Pré-cache automático
}
```

### Arquivos Obrigatórios

```
public/
├── pwa-192x192.png
├── pwa-512x512.png
├── android-chrome-192x192.png
├── android-chrome-512x512.png
├── apple-touch-icon.png
├── favicon-16x16.png
├── favicon-32x32.png
└── favicon.ico
```

---

## 🏗️ BUILD E DEPLOY

### Code Splitting

```javascript
// vite.config.ts
manualChunks: {
  'vendor-react': ['react', 'react-dom'],      // ~4KB br / ~8KB gz
  'vendor-supabase': ['@supabase/supabase-js'] // ~28KB br / ~32KB gz
}
```

### Compressão Dual

- **Brotli** (`.br`): ~20% melhor que gzip
- **Gzip** (`.gz`): Fallback para servidores antigos
- **Threshold**: 10KB (arquivos menores não comprimidos)

### Terser Minification

```javascript
terserOptions: {
  compress: {
    drop_console: true,    // Remove TODOS console.log
    drop_debugger: true
  }
}
```

### Build Output

```
dist/
├── index.html (CSS inline no <head>)
├── manifest.webmanifest
├── registerSW.js
├── sw.js
├── workbox-[hash].js (+ .br + .gz)
└── assets/
    ├── index-[hash].js (~164KB br / ~201KB gz)
    ├── vendor-react-[hash].js (~4KB br / ~8KB gz)
    ├── vendor-supabase-[hash].js (~28KB br / ~32KB gz)
    └── [Page]-[hash].js (lazy loaded, ~10-50KB cada)
```

### Checklist de Deploy

```bash
# Pré-Deploy
✅ npm run build (sem erros)
✅ npm run preview (testar local)
✅ Variáveis de ambiente configuradas (.env.local)
✅ Supabase RLS policies revisadas
✅ Secrets não commitados
✅ CHANGELOG atualizado

# Pós-Deploy
✅ Lighthouse audit (PWA, Performance > 90)
✅ Testar em múltiplos browsers
✅ Verificar Service Worker (DevTools)
✅ Console sem erros
✅ Realtime funcionando
✅ Upload XLSX testado
```

---

## 🚫 REGRAS PROIBIDAS

### NUNCA Faça Isso

1. ❌ **Desabilitar RLS** em qualquer tabela
2. ❌ **Usar `service_role` key** no frontend
3. ❌ **Criar tabelas sem migrations** documentadas
4. ❌ **Modificar `types.ts`** sem atualizar interfaces relacionadas
5. ❌ **Duplicar lógica de negócio** nos componentes (use services)
6. ❌ **Chamar `loadData()`** após CRUD quando Realtime está ativo
7. ❌ **Remover `console.log`** manualmente (terser faz automaticamente)
8. ❌ **Criar módulos** sem registrar em `modules` table
9. ❌ **Modificar `ATENDIMENTO_ID`** de registros existentes
10. ❌ **Ignorar hierarquia de permissões** (super_admin ≠ admin ≠ user)

---

## ✅ BOAS PRÁTICAS

### SEMPRE Faça Isso

1. ✅ **Centralizar lógica** em `services/*/*.service.ts`
2. ✅ **Usar tipos** do `types.ts` (nunca `any`)
3. ✅ **Testar RLS policies** com diferentes perfis
4. ✅ **Documentar mudanças** em `docs/CHANGELOG.md`
5. ✅ **Criar migrations SQL** para alterações de schema
6. ✅ **Usar Tailwind CSS** (evitar CSS inline ou arquivos separados)
7. ✅ **Seguir padrão de modais** (header compacto, auto-save status)
8. ✅ **Atualizar `position`** densamente (1..n) após reordenação
9. ✅ **Validar permissões** no backend (RLS) e frontend (UI)
10. ✅ **Testar upload XLSX** com múltiplos profissionais

---

## 📚 DOCUMENTAÇÃO DE REFERÊNCIA

### Documentos Principais

- **README.md** - Setup e configuração geral (1239 linhas)
- **SYSTEM_OVERVIEW.md** - Visão geral da arquitetura (343 linhas)
- **.github/copilot-instructions.md** - Instruções para AI agents (637 linhas)
- **types.ts** - Todas as interfaces TypeScript (551 linhas)

### Documentos Técnicos (`/docs`)

- **CHANGELOG.md** - Histórico de mudanças
- **REALTIME_STATUS.md** - Status e guias Realtime
- **UNIT_BASED_ACCESS_CONTROL.md** - Sistema de permissões
- **UPLOAD_STATUS_LOGIC.md** - Lógica de upload XLSX
- **N8N_LOGS_TABLE.md** - Integração com N8N
- **DATA_DROME_CONSOLIDATION.md** - Consolidação de dados

### Migrations SQL (`/docs/sql`)

- 39 arquivos de migrations documentadas
- Sempre criar nova migration para alterações de schema
- Formato: `YYYY-MM-DD_descricao.sql`

---

## 🔍 TROUBLESHOOTING

### Problema: Módulos não aparecem na Sidebar

```typescript
// 1. Verificar unit_modules
SELECT * FROM unit_modules WHERE unit_id = 'uuid-da-unidade';

// 2. Verificar user_modules (apenas para role 'user')
SELECT * FROM user_modules WHERE user_id = 'uuid-do-usuario';

// 3. Verificar AuthContext.getModulesForUnit()
console.log('[AuthContext] Modules for unit:', modules);
```

### Problema: Tela branca ao salvar modal

```typescript
// ❌ ERRADO
const handleSave = async () => {
  await saveData();
  handleCloseModal(); // Fecha antes de recarregar
};

// ✅ CORRETO
const handleSave = async () => {
  await saveData();
  await loadData(); // Recarrega ANTES de fechar
  handleCloseModal();
};
```

### Problema: Upload XLSX não atualiza registros

```typescript
// Verificar chave única
SELECT unidade_code, ATENDIMENTO_ID, COUNT(*) 
FROM processed_data 
GROUP BY unidade_code, ATENDIMENTO_ID 
HAVING COUNT(*) > 1;

// Deve retornar 0 linhas (sem duplicatas)
```

### Problema: RLS bloqueando acesso

```sql
-- Verificar policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'nome_da_tabela';

-- Testar com service_role (bypass RLS)
-- APENAS para debug, NUNCA em produção
```

---

## 📞 CONTATO E SUPORTE

Para dúvidas sobre este sistema:
1. Consultar documentação em `/docs`
2. Revisar `README.md` e `SYSTEM_OVERVIEW.md`
3. Verificar `types.ts` para interfaces
4. Consultar `.github/copilot-instructions.md` para padrões de código

---

**Última atualização**: 2026-01-19  
**Versão do Banco**: PostgreSQL 17.6.1.003  
**Projeto Supabase**: DromeSTART (uframhbsgtxckdxttofo)  
**Região**: sa-east-1 (São Paulo, Brasil)
