# Status de Implementação Realtime

Este documento rastreia o status de implementação de atualizações em tempo real (Supabase Realtime) por módulo da aplicação DromeFlow.

**Última atualização**: 07/11/2025

---

## Visão Geral

O Supabase Realtime permite que a aplicação receba atualizações automáticas do banco de dados via WebSocket, eliminando a necessidade de polling manual e melhorando a experiência do usuário em ambientes colaborativos.

### Benefícios do Realtime

- ✅ Atualizações instantâneas sem reload da página
- ✅ Melhor colaboração entre usuários (mudanças refletidas em tempo real)
- ✅ Redução de carga no servidor (elimina polling)
- ✅ UX mais fluida e responsiva

### Hook Padrão

Todas as implementações Realtime utilizam o hook customizado `useRealtimeSubscription` localizado em `hooks/useRealtimeSubscription.ts`.

**Assinatura do hook:**
```typescript
useRealtimeSubscription<T>(
  table: string,
  eventTypes: ('INSERT' | 'UPDATE' | 'DELETE')[],
  onEvent: (payload: RealtimePayload<T>) => void,
  filter?: string,
  enabled?: boolean
)
```

---

## Status por Módulo

### ✅ Pós-Vendas (Completo)

**Implementado em**: `components/pages/PosVendasPage.tsx`

**Tabela monitorada**: `pos_vendas`

**Eventos subscritos**: `INSERT`, `UPDATE`, `DELETE`

**Comportamento**:
- Inserts: Adiciona novos cards automaticamente à lista
- Updates: Atualiza cards existentes (status, campos editados)
- Deletes: Remove cards da visualização
- Filtro de unidade aplicado quando não está em modo "ALL"

**Sincronização bidirecional**:
- Triggers automáticos entre `processed_data` ↔ `pos_vendas`
- Ver `docs/sql/2025-10-31_populate_pos_vendas.sql` para detalhes

**Status**: ✅ **Produção** - Funcionando corretamente

---

### 🔄 Comercial (Planejado)

**Página**: `components/pages/ComercialPage.tsx`

**Tabela alvo**: `comercial`

**Eventos a monitorar**: `INSERT`, `UPDATE`, `DELETE`

**Benefícios esperados**:
- Múltiplos usuários podem arrastar cards simultaneamente
- Mudanças de status refletem instantaneamente
- Novos leads aparecem automaticamente no Kanban

**Desafios**:
- Resolver conflitos de DnD (drag-and-drop) simultâneos
- Manter posições (`position`) consistentes entre clientes
- Implementar estratégia de merge otimista

**Status**: 📋 **Planejado** - Aguardando definição de estratégia de conflitos

---

### 🔄 Profissionais/Recrutadora (Planejado)

**Páginas**: 
- `components/pages/PrestadorasPage.tsx`
- `components/pages/RecrutadoraPage.tsx`

**Tabelas alvo**: 
- `profissionais`
- `recrutadora`

**Eventos a monitorar**: `INSERT`, `UPDATE`, `DELETE`

**Benefícios esperados**:
- Novos cadastros aparecem automaticamente no Kanban
- Mudanças de status refletem em tempo real
- Métricas atualizadas automaticamente

**Status**: 📋 **Planejado** - Prioridade média

---

### 🔄 Dados/Atendimentos (Em Análise)

**Página**: `components/pages/DataPage.tsx`, `components/pages/AppointmentsPage.tsx`

**Tabela alvo**: `processed_data`

**Eventos a monitorar**: `INSERT`, `UPDATE`, `DELETE`

**Considerações**:
- Volume alto de dados (necessita filtros eficientes)
- Paginação pode complicar sincronização
- Upload em lote pode gerar muitos eventos simultâneos

**Estratégias em avaliação**:
1. Realtime apenas para registros visíveis (filtro por período/unidade)
2. Debouncing de eventos para uploads em lote
3. Invalidação de cache + refetch ao invés de merge incremental

**Status**: 🔍 **Em análise** - Avaliando viabilidade técnica

---

### ❌ Dashboard/Métricas (Não Planejado)

**Páginas**: 
- `components/pages/DashboardPage.tsx`
- `components/pages/DashboardMetricsPage.tsx`

**Motivo**: 
- Métricas são recalculadas localmente de `processed_data`
- Realtime em `processed_data` exigiria recalcular todas as métricas a cada evento
- Melhor abordagem: atualização manual ou intervalo de polling (se necessário)

**Status**: ⛔ **Não planejado** - Custo/benefício desfavorável

---

### ❌ Clientes (Não Planejado)

**Página**: `components/pages/ClientsPage.tsx`

**Motivo**:
- Dados derivados de `processed_data` (não tabela própria)
- Lógica de recorrentes/churn requer análise de múltiplos períodos
- Realtime complicaria controle de estado complexo

**Status**: ⛔ **Não planejado** - Complexidade excessiva

---

### ❌ Administração (Não Necessário)

**Páginas**:
- `ManageUsersPage.tsx`
- `ManageModulesPage.tsx`
- `ManageUnitsPage.tsx`
- `ManageAccessPage.tsx`

**Motivo**:
- Operações administrativas são pontuais (não colaborativas)
- Usuários geralmente trabalham sozinhos nessas telas
- Reload manual após operações é aceitável

**Status**: ⛔ **Não necessário** - Sem benefício significativo

---

## Padrão de Implementação

### 1. Configuração no Supabase

Habilitar Realtime na tabela:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE nome_da_tabela;
```

### 2. Uso do Hook no Componente

```typescript
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';

// Dentro do componente
useRealtimeSubscription<TipoDoRegistro>(
  'nome_da_tabela',
  ['INSERT', 'UPDATE', 'DELETE'],
  (payload) => {
    switch (payload.eventType) {
      case 'INSERT':
        // Adicionar novo registro ao estado
        break;
      case 'UPDATE':
        // Atualizar registro existente
        break;
      case 'DELETE':
        // Remover registro do estado
        break;
    }
  },
  filtro ? `unit_id=eq.${unitId}` : undefined, // Filtro opcional
  enabled // Controlar quando a subscription está ativa
);
```

### 3. Tratamento de Eventos

**INSERT**:
- Verificar se registro já existe (evitar duplicatas)
- Adicionar ao estado local
- Manter ordenação/agrupamento consistente

**UPDATE**:
- Localizar registro pelo ID
- Atualizar campos modificados
- Revalidar regras de negócio (ex: posições no Kanban)

**DELETE**:
- Remover do estado local
- Atualizar contadores/métricas dependentes

### 4. Filtros e Performance

- **Sempre** usar filtros de unidade quando possível: `unit_id=eq.${unitId}`
- Evitar subscriptions muito amplas (sem filtros)
- Desabilitar subscription quando componente não está visível
- Usar `enabled` prop para controlar ativação

### 5. Tratamento de Erros

```typescript
useRealtimeSubscription(
  'tabela',
  ['INSERT', 'UPDATE', 'DELETE'],
  (payload) => {
    try {
      // Lógica de atualização
    } catch (error) {
      console.error('Erro ao processar evento Realtime:', error);
      // Opcional: refetch completo em caso de erro
    }
  }
);
```

---

## Troubleshooting

### Eventos não estão sendo recebidos

1. ✅ Verificar se Realtime está habilitado na tabela:
   ```sql
   SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
   ```

2. ✅ Confirmar que RLS permite `SELECT` para o usuário autenticado

3. ✅ Verificar console do navegador por erros de WebSocket

4. ✅ Testar subscription manualmente:
   ```typescript
   supabase
     .channel('test')
     .on('postgres_changes', { event: '*', schema: 'public', table: 'tabela' }, payload => {
       console.log('Change received!', payload)
     })
     .subscribe()
   ```

### Eventos duplicados

- Verificar se há múltiplas instâncias do componente montadas
- Confirmar que `useRealtimeSubscription` está sendo chamado apenas uma vez
- Usar `React.StrictMode` pode causar subscriptions duplas em dev (comportamento esperado)

### Performance degradada

- Reduzir escopo com filtros mais específicos
- Usar `enabled={false}` quando dados não estão visíveis
- Implementar debouncing para eventos de alta frequência
- Considerar batching de updates (agrupar múltiplos eventos)

---

## Próximos Passos

1. **Comercial Realtime** (Alta prioridade)
   - Definir estratégia de resolução de conflitos DnD
   - Implementar merge otimista de posições
   - Testes com múltiplos usuários simultâneos

2. **Profissionais/Recrutadora** (Média prioridade)
   - Implementação similar ao Pós-Vendas
   - Sincronização de métricas inline

3. **Dados/Atendimentos** (Baixa prioridade)
   - Análise de viabilidade técnica
   - Prototipagem de filtros eficientes
   - Medição de impacto de performance

---

## Referências

- [Supabase Realtime Documentation](https://supabase.com/docs/guides/realtime)
- [Hook useRealtimeSubscription](../hooks/useRealtimeSubscription.ts)
- [Guia de Implementação Realtime](./REALTIME_IMPLEMENTATION_GUIDE.md)
- [SQL: Sincronização Pós-Vendas](./sql/2025-10-31_populate_pos_vendas.sql)

---

_Documento mantido pela equipe de desenvolvimento. Atualizar ao implementar/modificar funcionalidades Realtime._
