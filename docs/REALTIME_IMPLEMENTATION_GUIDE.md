# Guia de Implementação Realtime - Módulos Restantes

## ✅ Módulos já implementados:
1. ✅ PosVendasPage (tabela `pos_vendas`)
2. ✅ DashboardMetricsPage (tabela `processed_data`)
3. ✅ DataPage (tabela `processed_data`)

---

## 📋 Módulos pendentes e padrão de implementação:

### 1. RecrutadoraPage (tabela `recrutadora`)

```typescript
// No topo do arquivo, adicionar import:
import { useRealtimeSubscription } from '../../hooks/useRealtimeSubscription';

// Após os useEffects principais, adicionar:
useRealtimeSubscription({
  table: 'recrutadora',
  filter: (record: any) => {
    if (selectedUnit && selectedUnit.unit_code !== 'ALL') {
      if (record.unit_id !== selectedUnit.id) return false;
    }
    return true;
  },
  callbacks: {
    onInsert: (newRecord) => {
      console.log('[Recrutadora] Novo candidato');
      loadRecrutadoraData(); // Ou atualizar estado diretamente
    },
    onUpdate: (updatedRecord) => {
      console.log('[Recrutadora] Candidato atualizado');
      // Atualizar card no Kanban
      setCards(prev => prev.map(c => c.id === updatedRecord.id ? updatedRecord : c));
    },
    onDelete: (deletedRecord) => {
      console.log('[Recrutadora] Candidato removido');
      setCards(prev => prev.filter(c => c.id !== deletedRecord.id));
    }
  },
  enabled: !loading
});
```

---

### 2. ComercialPage (tabelas `comercial` + `comercial_columns`)

**Duas subscriptions necessárias:**

```typescript
import { useRealtimeSubscription } from '../../hooks/useRealtimeSubscription';

// Subscription 1: Cards (comercial)
useRealtimeSubscription({
  table: 'comercial',
  filter: (record: any) => {
    if (selectedUnit && selectedUnit.id !== 'ALL') {
      if (record.unit_id !== selectedUnit.id) return false;
    }
    return true;
  },
  callbacks: {
    onInsert: (newRecord) => loadCards(),
    onUpdate: (updatedRecord) => {
      setCards(prev => prev.map(c => c.id === updatedRecord.id ? updatedRecord : c));
    },
    onDelete: (deletedRecord) => {
      setCards(prev => prev.filter(c => c.id !== deletedRecord.id));
    }
  },
  enabled: !loadingCards
});

// Subscription 2: Colunas (comercial_columns)
useRealtimeSubscription({
  table: 'comercial_columns',
  callbacks: {
    onInsert: () => loadColumns(),
    onUpdate: () => loadColumns(),
    onDelete: () => loadColumns()
  },
  enabled: !loadingColumns
});
```

---

### 3. ClientsPage (tabela `processed_data`)

```typescript
import { useRealtimeSubscription } from '../../hooks/useRealtimeSubscription';

useRealtimeSubscription({
  table: 'processed_data',
  filter: (record: any) => {
    if (selectedUnit && selectedUnit.unit_code !== 'ALL') {
      if (record.unidade_code !== selectedUnit.unit_code) return false;
    }
    // Filtrar por período se necessário
    if (record.DATA) {
      const [year, month] = selectedPeriod.split('-');
      const recordDate = new Date(record.DATA);
      const recordMonth = recordDate.getMonth() + 1;
      const recordYear = recordDate.getFullYear();
      if (recordYear !== parseInt(year) || recordMonth !== parseInt(month)) return false;
    }
    return true;
  },
  callbacks: {
    onInsert: () => loadClientData(),
    onUpdate: () => loadClientData(),
    onDelete: () => loadClientData()
  },
  enabled: !loading
});
```

---

### 4. PrestadorasPage (tabela `profissionais`)

```typescript
import { useRealtimeSubscription } from '../../hooks/useRealtimeSubscription';

useRealtimeSubscription({
  table: 'profissionais',
  filter: (record: any) => {
    if (selectedUnit && selectedUnit.unit_code !== 'ALL') {
      if (record.unit_id !== selectedUnit.id) return false;
    }
    return true;
  },
  callbacks: {
    onInsert: () => loadPrestadorasData(),
    onUpdate: (updatedRecord) => {
      setPrestadoras(prev => prev.map(p => p.id === updatedRecord.id ? updatedRecord : p));
    },
    onDelete: (deletedRecord) => {
      setPrestadoras(prev => prev.filter(p => p.id !== deletedRecord.id));
    }
  },
  enabled: !loading
});
```

---

### 5. ProfissionaisPage (tabela `profissionais`)

```typescript
import { useRealtimeSubscription } from '../../hooks/useRealtimeSubscription';

useRealtimeSubscription({
  table: 'profissionais',
  filter: (record: any) => {
    if (selectedUnit && selectedUnit.unit_code !== 'ALL') {
      if (record.unit_id !== selectedUnit.id) return false;
    }
    return true;
  },
  callbacks: {
    onInsert: (newRecord) => {
      setProfissionais(prev => [...prev, newRecord]);
    },
    onUpdate: (updatedRecord) => {
      setProfissionais(prev => prev.map(p => p.id === updatedRecord.id ? updatedRecord : p));
    },
    onDelete: (deletedRecord) => {
      setProfissionais(prev => prev.filter(p => p.id !== deletedRecord.id));
    }
  },
  enabled: !loading
});
```

---

### 6. AppointmentsPage (tabela `processed_data`)

```typescript
import { useRealtimeSubscription } from '../../hooks/useRealtimeSubscription';

useRealtimeSubscription({
  table: 'processed_data',
  filter: (record: any) => {
    if (selectedUnit && selectedUnit.unit_code !== 'ALL') {
      if (record.unidade_code !== selectedUnit.unit_code) return false;
    }
    // Filtrar por período (dia/mês/ano conforme necessário)
    if (record.DATA) {
      const [year, month, day] = selectedDate.split('-');
      const recordDate = new Date(record.DATA);
      const recordDay = recordDate.getDate();
      const recordMonth = recordDate.getMonth() + 1;
      const recordYear = recordDate.getFullYear();
      
      if (recordYear !== parseInt(year) || 
          recordMonth !== parseInt(month) || 
          recordDay !== parseInt(day)) {
        return false;
      }
    }
    return true;
  },
  callbacks: {
    onInsert: () => loadAppointments(),
    onUpdate: () => loadAppointments(),
    onDelete: () => loadAppointments()
  },
  enabled: !loading
});
```

---

## 🎯 Checklist de Implementação

Para cada módulo:

- [ ] Adicionar import do hook no topo do arquivo
- [ ] Identificar a tabela principal do módulo
- [ ] Adicionar `useRealtimeSubscription` após os useEffects principais
- [ ] Configurar filtros apropriados (unidade, período, etc.)
- [ ] Implementar callbacks (onInsert, onUpdate, onDelete)
- [ ] Definir `enabled` baseado no estado de loading
- [ ] Testar em ambiente de desenvolvimento

---

## 📝 Notas Importantes

1. **Performance**: Subscription só fica ativa quando `enabled: true`
2. **Filtros**: Aplicados localmente para reduzir processamento
3. **Callbacks**: Podem recarregar dados ou atualizar estado diretamente
4. **Console.log**: Útil para debug, pode ser removido em produção
5. **RLS**: Políticas do Supabase continuam aplicadas automaticamente

---

## 🧪 Teste de Verificação

Para cada módulo implementado, testar:

1. ✅ Abrir o módulo no navegador
2. ✅ Verificar no console: "✅ Conectado com sucesso à tabela: X"
3. ✅ Inserir/editar/deletar registro via SQL ou outro cliente
4. ✅ Verificar se a UI atualiza automaticamente
5. ✅ Confirmar que filtros estão funcionando (unidade/período)

---

## 🔧 Troubleshooting

**Problema**: Subscription não conecta
- Verificar se Realtime está habilitado no Supabase
- Verificar console para erros
- Confirmar que `enabled: true`

**Problema**: Eventos não chegam
- Verificar filtros (podem estar bloqueando)
- Confirmar RLS da tabela
- Testar com filtro vazio temporariamente

**Problema**: Múltiplas atualizações
- Usar debounce nos callbacks se necessário
- Considerar merge inteligente ao invés de reload completo
