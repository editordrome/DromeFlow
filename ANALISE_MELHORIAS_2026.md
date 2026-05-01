# Análise de Estrutura e Melhorias - DromeFlow

## 📋 Resumo Executivo

Este documento apresenta uma análise crítica da estrutura atual do projeto DromeFlow e identifica oportunidades de melhoria organizadas por prioridade.

**Status Geral:** ✅ Arquitetura sólida com boas práticas, mas requer atenção em segurança e otimização.

---

## 🔴 Crítico - Segurança (Prioridade Máxima)

### 1. Autenticação Insegura
**Problema:** Senhas armazenadas em texto plano na tabela `profiles`.

```typescript
// contexts/AuthContext.tsx - Linha ~120
const { data, error } = await supabase
  .from('profiles')
  .select('*')
  .eq('email', email)
  .eq('password', password)  // ❌ SENHA EM TEXTO PLANO
  .single();
```

**Riscos:**
- Exposição total em caso de breach
- Não conformidade com LGPD/GDPR
- Vulnerável a ataques de força bruta

**Solução Recomendada:**
```typescript
// Fase 1: Hash imediato (bcrypt/scrypt)
import bcrypt from 'bcryptjs';

const hashedPassword = await bcrypt.hash(password, 10);
const isValid = await bcrypt.compare(password, storedHash);

// Fase 2: Migrar para auth.users do Supabase
// Fase 3: Triggers de sincronização profiles ↔ auth.users
// Fase 4: JWT claims para Row Level Security
```

**Ação:** Criar migration script para:
1. Adicionar coluna `password_hash`
2. Migrar senhas existentes (requer reset ou criptografia reversível temporária)
3. Implementar hash no registro/login
4. Remover coluna `password` antiga

---

### 2. Row Level Security (RLS) Permissivo
**Problema:** Filtragem de dados feita na aplicação, não no banco.

```typescript
// Services filtram manualmente
const { data } = await supabase
  .from('processed_data')
  .select('*')
  .eq('unidade_code', unitCode);  // ❌ Filtro na aplicação
```

**Riscos:**
- Dados vazados se filtro falhar
- Query ineficiente (busca tudo, filtra depois)
- Sem garantia de isolamento entre unidades

**Solução:**
```sql
-- RLS restritivo por unidade
CREATE POLICY "Unidade isolada"
ON processed_data
FOR ALL
USING (
  unidade_code IN (
    SELECT unit_code 
    FROM user_units 
    WHERE user_id = auth.uid()
  )
);
```

**Benefícios:**
- Segurança no banco (última linha de defesa)
- Performance (filtro no índice)
- Auditoria simplificada

---

## 🟡 Alto - Performance e Escalabilidade

### 3. Bundles Grandes sem Lazy Loading
**Problema:** Páginas de 100KB+ carregadas inicialmente.

```typescript
// App.tsx - Todas páginas importadas no topo
import DashboardMetricsPage from './components/pages/DashboardMetricsPage';  // 157KB
import DashboardSistemaPage from './components/pages/DashboardSistemaPage'; // 115KB
import ManageUnitsPage from './components/pages/ManageUnitsPage';           // 122KB
```

**Impacto:**
- Initial load lento (~2-3s em 3G)
- Memory usage alto
- Poor Lighthouse score

**Solução: Lazy Loading**
```typescript
import { lazy, Suspense } from 'react';

const DashboardMetricsPage = lazy(() => import('./components/pages/DashboardMetricsPage'));
const DashboardSistemaPage = lazy(() => import('./components/pages/DashboardSistemaPage'));

// No ContentArea
<Suspense fallback={<LoadingSpinner />}>
  {activeView === 'dashboard-metrics' && <DashboardMetricsPage />}
</Suspense>
```

**Ganho Esperado:**
- Initial bundle: ~430KB → ~150KB
- FCP (First Contentful Paint): -40%

---

### 4. Múltiplas Queries Redundantes
**Problema:** Mesmo dado buscado em vários componentes.

```typescript
// Sidebar.tsx - Busca unidades
const { data: units } = await fetchUnits();

// DashboardPage.tsx - Busca unidades novamente
const { data: units } = await fetchUnits();

// AuthContext já tem userUnits mas não é compartilhado eficientemente
```

**Solução:**
```typescript
// Centralizar no AuthContext (já iniciado)
const { userUnits, userModules } = useAuth();

// React Query para cache automático
import { useQuery } from '@tanstack/react-query';

const { data: units } = useQuery({
  queryKey: ['units', userId],
  queryFn: fetchUnits,
  staleTime: 5 * 60 * 1000,  // 5 minutos
});
```

**Recomendação:** Implementar React Query ou SWR
- Cache inteligente
- Deduplicação automática
- Background refetch
- Optimistic updates

---

### 5. Falta de Índices Analíticos
**Problema:** Queries lentas em tabelas grandes.

```sql
-- Query comum sem índice
SELECT * FROM processed_data 
WHERE unidade_code = 'XYZ' 
  AND DATA >= '2025-01-01'
  AND IS_DIVISAO = false;
```

**Solução:**
```sql
-- Índice composto
CREATE INDEX idx_processed_data_analytics 
ON processed_data(unidade_code, DATA DESC, IS_DIVISAO)
WHERE is_active = true;

-- Índice para status
CREATE INDEX idx_pos_vendas_status 
ON pos_vendas(unit_id, status)
WHERE is_active = true;
```

**Impacto:** Query de 2s → 50ms

---

## 🟢 Médio - DX e Manutenibilidade

### 6. Código Boilerplate em Modais
**Problema:** 28 modais com estrutura repetida.

```typescript
// Padrão repetido em 20+ arquivos
const [isOpen, setIsOpen] = useState(false);
const [loading, setLoading] = useState(false);
const [data, setData] = useState(null);

useEffect(() => {
  if (isOpen) fetchData();
}, [isOpen]);

return (
  <>
    <button onClick={() => setIsOpen(true)}>...</button>
    <Modal open={isOpen} onOpenChange={setIsOpen}>
      {loading ? <Spinner /> : content}
    </Modal>
  </>
);
```

**Solução: Custom Hook + Componente Base**
```typescript
// hooks/useModal.ts
export function useModal<T>(fetchFn?: () => Promise<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);

  const onOpen = async () => {
    setLoading(true);
    if (fetchFn) setData(await fetchFn());
    setLoading(false);
    setIsOpen(true);
  };

  return { isOpen, open: onOpen, close: () => setIsOpen(false), data, loading };
}

// components/ui/BaseModal.tsx
export function BaseModal({ hook, title, children }) {
  const { isOpen, close, loading } = hook;
  return <Dialog open={isOpen} onOpenChange={close}>{children}</Dialog>;
}
```

**Redução:** 3000 linhas → 800 linhas (-73%)

---

### 7. Constants Magic Numbers
**Problema:** Valores hardcoded espalhados.

```typescript
// Em múltiplos arquivos
if (status === 'Em Atenção') { ... }
if (days > 30) { ... }
const threshold = 10000;
```

**Solução:**
```typescript
// constants/index.ts
export const STATUS = {
  ATENCAO: 'Em Atenção',
  AGUARDANDO: 'Aguardando',
  CONCLUIDO: 'Concluído',
} as const;

export const THRESHOLDS = {
  CHURN_DAYS: 30,
  UPLOAD_SIZE_MB: 10,
  PAGINATION_DEFAULT: 50,
} as const;

// Uso tipado
if (status === STATUS.ATENCAO) { ... }
```

---

### 8. Error Handling Inconsistente
**Problema:** Mistura de console.error, toast, e silent failures.

```typescript
// Alguns lugares
console.error('Error:', error);  // ❌ Usuário não vê

// Outros
toast.error('Erro ao salvar');  // ✅

// Alguns
// Nenhum handling  // ❌❌
```

**Solução: Error Boundary + Service Layer**
```typescript
// services/errorHandler.ts
export class ApiError extends Error {
  constructor(message: string, public code: string) {
    super(message);
  }
}

export function handleApiError(error: unknown, context: string) {
  if (error instanceof ApiError) {
    toast.error(error.message);
    logToMonitoring(error, context);
  } else {
    toast.error('Erro inesperado. Tente novamente.');
    captureException(error, { context });
  }
}

// Uso uniforme
try {
  await createUser(data);
} catch (error) {
  handleApiError(error, 'UserFormModal.create');
}
```

---

## 🔵 Baixo - Otimizações Futuras

### 9. Dependências Não Utilizadas
**Problema:** AWS SDK instalado mas não usado.

```json
{
  "@aws-sdk/client-s3": "^3.932.0",      // ❌ Não usado
  "@aws-sdk/s3-request-presigner": "..." // ❌ Não usado
}
```

**Ação:** Remover na próxima limpeza (Fase 6).
```bash
npm uninstall @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

**Economia:** ~2MB no node_modules

---

### 10. Barra de Progresso de Upload Genérica
**Problema:** UploadModal não mostra progresso granular.

```typescript
// Apenas estado binário
const [uploading, setUploading] = useState(false);
```

**Melhoria:**
```typescript
const [progress, setProgress] = useState<{
  current: number;
  total: number;
  percentage: number;
  phase: 'parsing' | 'validating' | 'inserting';
} | null>(null);
```

---

### 11. Testes Automatizados Ausentes
**Problema:** Zero testes unitários ou E2E.

**Recomendação Mínima:**
```typescript
// tests/services/users.service.test.ts
describe('users.service', () => {
  it('should hash password before saving', async () => {
    const user = await createUser({ password: '123' });
    expect(user.password).not.toBe('123');
  });
  
  it('should filter by unit_id', async () => {
    const users = await fetchUsers({ unitId: 'abc' });
    expect(users.every(u => u.unit_id === 'abc')).toBe(true);
  });
});
```

**Stack Sugerida:**
- Vitest (unitários)
- Playwright (E2E)
- Testing Library (componentes)

---

## 📊 Matriz de Priorização

| # | Item | Impacto | Esforço | ROI | Prioridade |
|---|------|---------|---------|-----|------------|
| 1 | Hash de senhas | 🔴 Crítico | Médio | Alto | **P0** |
| 2 | RLS restritivo | 🔴 Crítico | Alto | Alto | **P0** |
| 3 | Lazy loading | 🟡 Alto | Baixo | Médio | **P1** |
| 4 | React Query | 🟡 Alto | Médio | Alto | **P1** |
| 5 | Índices SQL | 🟡 Alto | Baixo | Alto | **P1** |
| 6 | Modal boilerplate | 🟢 Médio | Médio | Médio | **P2** |
| 7 | Constants | 🟢 Médio | Baixo | Baixo | **P3** |
| 8 | Error handling | 🟢 Médio | Médio | Médio | **P2** |
| 9 | Remover AWS | 🔵 Baixo | Mínimo | Baixo | **P3** |
| 10 | Upload progress | 🔵 Baixo | Médio | Baixo | **P3** |
| 11 | Testes | 🔵 Baixo | Alto | Médio | **P2** |

---

## 🚀 Plano de Ação Recomendado

### Sprint 1-2 (Segurança)
- [ ] Implementar bcrypt nas senhas
- [ ] Migration de senhas existentes
- [ ] Política RLS para `processed_data`
- [ ] Política RLS para `pos_vendas`

### Sprint 3-4 (Performance)
- [ ] Lazy loading em todas páginas >50KB
- [ ] Implementar React Query
- [ ] Criar índices analíticos
- [ ] Code splitting de vendors

### Sprint 5-6 (DX)
- [ ] Criar hook `useModal`
- [ ] Refatorar 10 modais principais
- [ ] Centralizar constants
- [ ] Padronizar error handling

### Backlog
- [ ] Remover dependências não usadas
- [ ] Implementar testes críticos
- [ ] Melhorar feedback de upload
- [ ] Tooltip system compartilhado

---

## ✅ Pontos Fortes a Manter

1. ✅ **Arquitetura modular** - Serviços bem segmentados por domínio
2. ✅ **TypeScript completo** - Tipagem consistente
3. ✅ **PWA configurado** - Offline-first ready
4. ✅ **Build otimizado** - Brotli, chunking, tree-shaking
5. ✅ **Realtime implementado** - Atualizações em tempo real
6. ✅ **Documentação rica** - 20+ docs técnicos
7. ✅ **Design system** - Componentes UI reutilizáveis

---

## 📈 Métricas de Sucesso

Após implementação das melhorias:

| Métrica | Atual | Meta |
|---------|-------|------|
| Lighthouse Performance | ~65 | 90+ |
| Initial Bundle Size | ~430KB | ~150KB |
| First Contentful Paint | ~2.5s | <1s |
| Time to Interactive | ~4s | <2.5s |
| Security Score | ⚠️ Médio | ✅ Alto |
| Test Coverage | 0% | 60%+ |

---

**Última atualização:** 2026-04-17  
**Autor:** Análise baseada em revisão de código e documentação existente  
**Próxima revisão:** Após Sprint 2
