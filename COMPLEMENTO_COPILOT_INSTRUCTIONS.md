# Complemento ao copilot-instructions.md

## Informações Importantes Não Documentadas

### 1. Progressive Web App (PWA) - Configuração Completa

O DromeFlow é uma **Progressive Web App** totalmente funcional:

#### Características PWA
- **Instalável:** Pode ser instalado como app nativo no desktop/mobile
- **Offline-capable:** Service Worker com estratégias de cache inteligente
- **Auto-update:** Atualizações automáticas quando nova versão disponível
- **Manifest completo:** Ícones, tema, display mode configurados

#### Estratégias de Cache (workbox)
```javascript
1. Google Fonts: CacheFirst - 1 ano
2. Imagens (.png/.jpg/.svg): CacheFirst - 30 dias  
3. API Supabase: NetworkFirst - 5 minutos (timeout 10s)
4. Assets estáticos: Pré-cache durante instalação
```

#### Arquivos Importantes
- `vite.config.ts` - Configuração VitePWA
- `/public/pwa-*.png` - Ícones do app
- Service Worker gerado automaticamente no build

#### Testando PWA
1. Build: `npm run build`
2. Preview: `npm run preview`
3. DevTools → Application → Service Workers
4. Lighthouse → PWA score

**Importante:** Em desenvolvimento, Service Worker pode causar confusão com cache. Use DevTools para limpar quando necessário.

---

### 2. Build Otimizado - Detalhes Técnicos

#### Code Splitting Estratégico
```javascript
manualChunks: {
  'vendor-react': ['react', 'react-dom'],      // ~150KB gzipped
  'vendor-supabase': ['@supabase/supabase-js'] // ~80KB gzipped
}
```

**Benefício:** Primeiro carregamento mais rápido, melhor cache de vendors.

#### Compressão Dual (Brotli + Gzip)
- **Brotli (.br):** 20% melhor compressão que gzip, suportado por navegadores modernos
- **Gzip (.gz):** Fallback para servidores/browsers antigos
- **Threshold:** 10KB (arquivos menores não são comprimidos)

#### Terser - Minificação Agressiva
```javascript
drop_console: true,   // Remove ALL console.log em produção
drop_debugger: true   // Remove debugger statements
```

**⚠️ Atenção:** Console logs não funcionarão em produção. Use ferramentas de monitoring externas se necessário.

#### Performance Targets
```
First Contentful Paint:  < 1.5s
Time to Interactive:     < 3.5s
Total Bundle (gzipped):  < 500KB
Lighthouse Score:        > 90
```

---

### 3. TypeScript - Configurações Avançadas

#### Path Alias
```typescript
// tsconfig.json
"paths": {
  "@/*": ["./*"]
}

// Uso:
import { fetchUsers } from '@/services/auth/users.service';
import { DataRecord } from '@/types';
```

**Benefício:** Imports mais limpos, sem `../../../`

#### Experimental Decorators
```json
"experimentalDecorators": true
```

**Nota:** Habilitado para suporte futuro de decorators (não usado atualmente).

#### Module Resolution: Bundler
```json
"moduleResolution": "bundler"
```

**Importante:** Otimizado para Vite, permite imports modernos.

---

### 4. Variáveis de Ambiente - Guia Completo

#### Estrutura Completa
```bash
# === OBRIGATÓRIAS ===
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# === OPCIONAIS ===
# Data Drome (N8N Logs)
VITE_DATA_DROME_URL=https://logs.supabase.co
VITE_DATA_DROME_ANON_KEY=eyJ...

# Gemini AI (se usado)
GEMINI_API_KEY=AIza...
```

#### Regras de Nomenclatura
- **Prefixo `VITE_`:** Exposto ao cliente (bundle JS)
- **Sem prefixo:** Apenas build-time, não exposto

#### Injeção no Build
```javascript
// vite.config.ts
define: {
  'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
}
```

#### ⚠️ Segurança
- ✅ `.env.local` está no `.gitignore`
- ❌ Nunca commitar chaves de API
- ⚠️ `VITE_` variables são públicas (visíveis no bundle)
- ✅ Usar Supabase RLS para proteção real

---

### 5. Roteamento Personalizado - Sem React Router

#### Sistema de Views
```typescript
// AppContext.tsx
type View = 'welcome' | 'dashboard' | 'data' | ... | string;
const [activeView, setActiveView] = useState<View>('welcome');
```

#### ContentArea - Lógica de Renderização
```typescript
1. Switch no activeView
2. Se módulo tem view_id → Renderiza página específica
3. Se módulo tem webhook_url → Fetch HTML externo
4. Fallback → WelcomePage
```

#### Segurança de Conteúdo
```typescript
// Apenas URLs com prefixo interno://
if (webhookUrl.startsWith('internal://')) {
  // Injeta HTML
} else {
  // Bloqueia
}
```

**Benefício:** XSS protection, controle total sobre conteúdo injetado.

#### Navegação Programática
```typescript
const { setView } = useAppContext();

// Simples
setView('dashboard');

// Com estado
setView('data');
setSelectedUnit(unitId);
```

---

### 6. Padrões de Nomenclatura - Convenções

#### Arquivos
```
Pages:     DashboardMetricsPage.tsx
Modals:    UserFormModal.tsx
Services:  dashboard.service.ts
Utils:     dates.ts
Contexts:  AuthContext.tsx
```

#### Funções e Variáveis
```typescript
// Funções: camelCase
function fetchDashboardMetrics() { }
const handleSaveUser = () => { };

// Tipos: PascalCase
interface DataRecord { }
type UserRole = 'admin' | 'user';

// Constantes: UPPER_SNAKE_CASE
const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;
const DEFAULT_PAGE_SIZE = 25;

// React Components: PascalCase
const DashboardPage = () => { };
```

#### Pastas
```
kebab-case (preferido): data-table/
PascalCase (aceito):    DataTable/
```

---

### 7. Dependências AWS - Status e Recomendação

#### Instaladas mas Não Usadas
```json
"@aws-sdk/client-s3": "^3.932.0",
"@aws-sdk/s3-request-presigner": "^3.932.0"
```

#### Histórico
- Anteriormente usado para storage alternativo
- Removido junto com Cloudflare R2/D1
- Supabase Storage é a solução atual

#### Recomendação
```
Fase 6 (Limpeza):
1. Verificar se há planos de uso AWS
2. Se não → Remover do package.json
3. npm install (rebuild lock file)
4. Testar build
```

**Impacto:** ~2MB a menos no bundle (vendor chunks).

---

### 8. Realtime - Troubleshooting Guide

#### Problema: Infinite Loading Spinner

**Sintoma:**
```
Abrir modal → Editar → Salvar → Fechar → Spinner infinito
```

**Causa:**
```typescript
// ❌ ERRADO - Com Realtime ativo
const handleCloseModal = () => {
  setIsModalOpen(false);
  loadData(); // Dupla atualização!
};
```

**Fix:**
```typescript
// ✅ CORRETO
const handleCloseModal = () => {
  setIsModalOpen(false);
  // Realtime atualiza automaticamente
};
```

#### Problema: Dados Não Atualizam

**Verificar:**
```typescript
1. Subscription está ativa?
   → useRealtimeSubscription presente

2. Filtro correto?
   → filter: `unit_id=eq.${unitId}`

3. Callback funciona?
   → onUpdate: () => { console.log('Updated!') }

4. Realtime habilitado no Supabase?
   → Table Settings → Enable Realtime
```

#### Problema: Múltiplas Atualizações

**Causa:** Múltiplas subscriptions na mesma tabela

**Fix:**
```typescript
// Usar flag de loading
const [isLoading, setIsLoading] = useState(false);

const loadData = async () => {
  if (isLoading) return; // Previne duplicação
  setIsLoading(true);
  try {
    // fetch data
  } finally {
    setIsLoading(false);
  }
};
```

---

### 9. Upload XLSX - Pipeline Completo

#### Etapas Detalhadas
```
1. Leitura (SheetJS)
   → Arquivo XLSX parseado no browser

2. Validação
   → Colunas obrigatórias presentes
   → Tipos de dados corretos

3. Transformação
   → Normalização de datas/horários
   → Expansão multi-profissionais (sufixos _1, _2)
   → Divisão de repasse proporcional

4. Enriquecimento
   → STATUS automático ("esperar" para tardes múltiplas)
   → Cálculo de campos derivados

5. Limpeza
   → removeObsoleteRecords() elimina obsoletos
   → Baseado em ATENDIMENTO_ID base

6. Envio
   → Batches de 500 registros
   → RPC process_xlsx_upload
   → ON CONFLICT (unidade_code, ATENDIMENTO_ID) DO UPDATE

7. Pós-processamento
   → Triggers: processed_data → pos_vendas
   → Recalculo de métricas
```

#### Campos de Controle Interno
```typescript
IS_DIVISAO: 'SIM' | 'NAO'  // Identifica derivados
ATENDIMENTO_ID: string      // Base ou com sufixo _N
created_at: timestamp       // Preservado no UPDATE
id: uuid                    // Preservado no UPDATE
```

#### Métricas de Upload
```typescript
{
  inserted: number,    // Novos registros
  updated: number,     // Registros atualizados
  ignored: number,     // Duplicatas exatas
  deleted: number      // Obsoletos removidos
}
```

---

### 10. Módulos - Ciclo de Vida Completo

#### Criação
```sql
-- 1. Banco de dados
INSERT INTO modules (
  code, name, icon_name, allowed_profiles,
  position, is_active, description
) VALUES (
  'novo-modulo',
  'Novo Módulo',
  'BarChart3',
  ARRAY['admin', 'user'],
  10,
  true,
  'Descrição opcional'
);
```

```typescript
// 2. Página UI
// components/pages/NovoModuloPage.tsx
export const NovoModuloPage = () => {
  const { selectedUnit, period } = useAppContext();
  
  // Lógica da página
  return (
    <div>...</div>
  );
};
```

```typescript
// 3. Serviço
// services/analytics/novoModulo.service.ts
export const fetchNovoModuloData = async (
  unitCode: string,
  startDate: string,
  endDate: string
) => {
  const { data, error } = await supabase
    .from('tabela')
    .select('*')
    .eq('unidade_code', unitCode);
    
  return data;
};
```

```typescript
// 4. ContentArea (auto-detect)
// ContentArea.tsx já renderiza baseado no code
case 'novo-modulo':
  return <NovoModuloPage />;
```

#### Atribuição a Unidades
```
ManageUnitsPage → Editar Unidade → Aba "Módulos" → 
Marcar checkbox → Salvar → INSERT unit_modules
```

#### Atribuição a Usuários
```
ManageUsersPage → Editar Usuário → Aba "Módulos" →
Selecionar Unidade → Marcar módulos → Salvar → INSERT user_modules
```

#### Ordenação
```
ManageModulesPage → Drag & Drop → 
updateModulesOrder() → UPDATE position (1..n)
```

---

### 11. Métricas - Cálculos Locais vs RPC

#### Dashboard: Cálculos Locais
```typescript
// services/analytics/dashboard.service.ts

// ✅ Feito no cliente (flexibilidade)
const totalServices = originalRecords.length; // Exclui derivados
const totalRevenue = sum(originalRecords.VALOR);
const totalRepasse = sum(allRecords.REPASSE); // Inclui derivados
const averageTicket = totalRevenue / totalServices;
```

**Vantagens:**
- Flexível para multi-unidade
- Não depende de RPC atualizado
- Fácil debug

**Desvantagens:**
- Mais dados trafegados
- Processamento no cliente

#### Alternativa: RPC
```sql
-- Futuro: Mover para RPC otimizado
CREATE FUNCTION get_dashboard_metrics_v2(...)
RETURNS TABLE(...) AS $$
BEGIN
  -- Cálculos no banco
  -- Índices otimizados
  -- Retorna resultado agregado
END;
$$ LANGUAGE plpgsql;
```

**Quando usar RPC:**
- Agregações pesadas (>10k registros)
- Joins complexos
- Performance crítica

---

### 12. Debugging - Console Logs Padronizados

#### Formato
```typescript
console.log('[ComponentName] Action: details');

// Exemplos:
console.log('[UserFormModal] Módulos carregados:', moduleIds);
console.log('[AuthContext] Login successful:', profile);
console.log('[handleModuleToggle] Toggling module:', moduleId);
```

#### Categorias
```
[Component] - UI interactions
[Service] - API calls
[Context] - State changes
[Hook] - Hook lifecycle
```

#### Produção
```javascript
// ⚠️ Todos os console.log são REMOVIDOS em build de produção
// via terser: drop_console: true
```

**Alternativa para produção:**
```typescript
// Use Supabase Edge Functions ou serviço externo
import { logEvent } from '@/services/integration/dataDrome.service';

logEvent('user_login', { userId, timestamp });
```

---

### 13. Testes - Estado Atual

#### ❌ Não Implementado
```
Sem Jest / Vitest
Sem React Testing Library
Sem testes unitários
Sem testes E2E
```

#### ⚠️ Recomendação Futura
```
Prioridade Alta:
1. Testes unitários para services (lógica de negócio)
2. Testes de integração para upload pipeline

Prioridade Média:
3. Testes de componentes UI críticos
4. Testes E2E para fluxos principais

Prioridade Baixa:
5. Coverage report
6. CI/CD integration
```

#### Setup Sugerido
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom

# vite.config.ts
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.ts'
  }
})
```

---

### 14. Deploy - Checklist Completo

#### Pré-Deploy
```
✅ npm run build (sem erros)
✅ npm run preview (testar local)
✅ Variáveis de ambiente configuradas
✅ Supabase RLS policies revisadas
✅ Secrets não commitados
✅ CHANGELOG atualizado
```

#### Deploy
```
1. Build: npm run build
2. Verificar dist/:
   - index.html
   - assets/*.js (chunks)
   - assets/*.css
   - workbox-*.js
   - .br / .gz files

3. Upload para Hostinger:
   - FTP ou painel
   - Copiar dist/* para public_html/

4. Verificar .htaccess:
   - Rewrite rules para SPA
   - Compressão habilitada
```

#### Pós-Deploy
```
✅ Lighthouse audit (PWA, Performance)
✅ Testar em múltiplos browsers
✅ Verificar Service Worker
✅ Console sem erros
✅ Realtime funcionando
✅ Upload testado
```

#### .htaccess Essencial
```apache
# SPA Routing
RewriteEngine On
RewriteBase /
RewriteRule ^index\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]

# Compressão
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/css text/javascript
</IfModule>
```

---

### 15. Monitoramento e Observabilidade

#### Ferramentas Recomendadas
```
Performance:
- Lighthouse CI
- Web Vitals
- Google Analytics

Erros:
- Sentry (frontend errors)
- Supabase Logs (backend)
- DataDrome (custom logs via N8N)

Métricas de Negócio:
- Dashboard interno (já implementado)
- Supabase Analytics
```

#### DataDrome Integration
```typescript
// services/integration/dataDrome.service.ts
export const logAction = async (action: string, metadata: any) => {
  const { data } = await dataDromeClient
    .from('actions')
    .insert({
      action,
      metadata,
      timestamp: new Date().toISOString()
    });
};

// Uso:
logAction('upload_xlsx', {
  unitCode,
  recordCount,
  duration: endTime - startTime
});
```

---

## Conclusão - Informações Críticas

### O que NÃO está no copilot-instructions:

1. ✅ **PWA completo** - Instalável, offline-capable, auto-update
2. ✅ **Build otimizado** - Brotli + Gzip, code splitting, terser minification
3. ✅ **TypeScript avançado** - Path alias, decorators, module resolution
4. ✅ **Roteamento customizado** - Sem React Router, view-based navigation
5. ✅ **Pipeline XLSX detalhado** - 7 etapas de processamento
6. ✅ **Realtime troubleshooting** - Infinite spinner, duplicação, filters
7. ✅ **Métricas locais vs RPC** - Quando usar cada abordagem
8. ✅ **Deploy checklist** - Pré/durante/pós deploy
9. ✅ **Debugging patterns** - Console logs padronizados
10. ✅ **Dependências não usadas** - AWS SDK a remover

### Próximas Ações Recomendadas

#### Documentação
- [ ] Adicionar seção PWA ao README
- [ ] Documentar estratégias de cache
- [ ] Guia de troubleshooting Realtime

#### Código
- [ ] Remover AWS SDK (Fase 6)
- [ ] Implementar testes unitários
- [ ] Lazy loading de páginas
- [ ] RPC para métricas pesadas

#### Segurança
- [ ] Hash de senhas (bcrypt)
- [ ] RLS restritivo
- [ ] Migrar para auth.users
- [ ] JWT claims para permissões

---

**Data:** 2025-11-16  
**Versão:** 1.0  
**Complementa:** .github/copilot-instructions.md
