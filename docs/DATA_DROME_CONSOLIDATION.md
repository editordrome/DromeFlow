# Consolidação Data Drome → DromeFlow

**Data**: 2025-11-16  
**Objetivo**: Consolidar tabelas de logs/monitoramento do Data Drome para o DromeFlow  
**Benefício**: Economia de **$180/ano** + simplificação arquitetural

---

## 📋 Resumo da Migração

### **Antes (Arquitetura Dual)**
```
DromeFlow (Principal):
- Autenticação, unidades, módulos
- Atendimentos (processed_data)
- Profissionais, comercial, pós-vendas
- Tamanho: ~200MB

Data Drome (Secundário):
- Logs N8N (monitoramento_dromeboard)
- Erros (error_dromeboard)
- Actions (mapeamento de ações)
- Tamanho: 0.24MB (0.02% uso)
- Custo: $15/mês
```

### **Depois (Arquitetura Consolidada)**
```
DromeFlow (Tudo Integrado):
- Dados operacionais (existentes)
+ activity_logs (ex-monitoramento_dromeboard)
+ error_logs (ex-error_dromeboard)
+ actions (migrado)
- Tamanho: ~200.24MB
- Custo: $25/mês (mesmo de antes)

Data Drome:
- Status: Pausado/Deletado
- Economia: $180/ano
```

---

## 🎯 Tabelas Criadas

### **1. actions (Dicionário de Ações)**
```sql
CREATE TABLE actions (
  id UUID PRIMARY KEY,
  action_code TEXT UNIQUE,  -- 'resp_atend_prof', 'envio_atend_client'
  action_name TEXT,          -- 'Resposta Atendimento Profissional'
  description TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

**Dados Populados**: 10 ações padrão
- `resp_atend_prof`, `envio_atend_client`, `create_atend`, `update_atend`
- `cancel_atend`, `confirm_atend`, `reschedule_atend`
- `notify_prof`, `notify_client`, `sync_data`

---

### **2. activity_logs (Logs de Workflows N8N)**
```sql
CREATE TABLE activity_logs (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  unit_code TEXT REFERENCES units(unit_code),
  workflow TEXT,             -- 'DROMEBOARD - UMBLER'
  action_code TEXT REFERENCES actions(action_code),
  atend_id TEXT,            -- Referência ao ATENDIMENTO_ID
  user_identifier TEXT,     -- Email, telefone ou ID
  status TEXT,              -- 'success', 'error', 'pending', 'cancelled'
  horario TIMESTAMPTZ,      -- Timestamp da execução
  metadata JSONB            -- Dados adicionais flexíveis
);
```

**Índices**:
- `idx_activity_logs_unit_date` - Busca por unidade e período
- `idx_activity_logs_atend_id` - Busca por atendimento
- `idx_activity_logs_action` - Estatísticas por ação
- `idx_activity_logs_workflow` - Análise por workflow
- `idx_activity_logs_metadata_gin` - Busca em JSON

**Substituí**: `monitoramento_dromeboard` (Data Drome)

---

### **3. error_logs (Logs de Erros)**
```sql
CREATE TABLE error_logs (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  workflow TEXT,
  url_workflow TEXT,
  error_message TEXT,
  error_type TEXT,
  severity TEXT,            -- 'info', 'warning', 'error', 'critical'
  stack_trace TEXT,
  user_id UUID REFERENCES profiles(id),
  unit_code TEXT REFERENCES units(unit_code),
  context JSONB,
  -- Resolução
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  resolution_notes TEXT
);
```

**Índices**:
- `idx_error_logs_workflow` - Filtro por workflow
- `idx_error_logs_severity` - Filtro por severidade
- `idx_error_logs_unresolved` - Erros pendentes
- `idx_error_logs_context_gin` - Busca em JSON

**Substituí**: `error_dromeboard` (Data Drome)

---

## 🔐 Segurança (RLS Policies)

Todas as tabelas têm RLS habilitado:

```sql
-- actions: Leitura pública, escrita autenticada
ALTER TABLE actions ENABLE ROW LEVEL SECURITY;

-- activity_logs: Apenas autenticados
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- error_logs: Apenas autenticados
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;
```

---

## 🛠️ Serviço TypeScript

### **Arquivo**: `services/analytics/activityLogs.service.ts`

**Funções Principais**:

```typescript
// Actions
fetchActions() → Action[]
fetchActionByCode(code) → Action | null
upsertAction({action_code, action_name, description}) → Action

// Activity Logs
logActivity({unit_code, workflow, action_code, ...}) → ActivityLog
fetchActivityLogs(filters) → ActivityLog[]
fetchActivityLogsByAtendimento(atendId) → ActivityLog[]
fetchActivityStatsByAction(unitCode?, days) → ActivityStats[]

// Error Logs
logError({workflow, error_message, severity, ...}) → ErrorLog
fetchErrorLogs(filters) → ErrorLog[]
resolveError(errorId, userId, notes?) → ErrorLog
fetchUnresolvedErrorCounts() → Record<string, number>

// Manutenção
cleanupOldActivityLogs(retentionDays) → number
```

---

## 📊 RPCs (Stored Procedures)

### **get_activity_logs_by_unit**
```sql
SELECT get_activity_logs_by_unit(
  'mb-londrina',                    -- unit_code
  NOW() - INTERVAL '7 days',        -- start_date
  NOW()                              -- end_date
);
```

### **get_activity_stats_by_action**
```sql
SELECT get_activity_stats_by_action(
  'mb-londrina',  -- unit_code (opcional)
  30               -- days
);
-- Retorna: action_code, action_name, total_executions, success_count, error_count, success_rate
```

### **cleanup_old_activity_logs**
```sql
SELECT cleanup_old_activity_logs(90); -- Deleta logs > 90 dias
-- Retorna: deleted_count
```

---

## 🔄 Integração N8N

### **Webhook Endpoint (Atualizar no N8N)**

**Antes** (Data Drome):
```
POST https://jeoegybltyqbdcjpuhbc.supabase.co/rest/v1/monitoramento_dromeboard
Authorization: Bearer <DATA_DROME_SERVICE_KEY>
```

**Depois** (DromeFlow):
```
POST https://uframhbsgtxckdxttofo.supabase.co/rest/v1/activity_logs
Authorization: Bearer <DROMEFLOW_ANON_KEY>
Content-Type: application/json

{
  "unit_code": "mb-londrina",
  "workflow": "DROMEBOARD - UMBLER",
  "action_code": "envio_atend_client",
  "atend_id": "43234",
  "user_identifier": "admin@example.com",
  "status": "success",
  "horario": "2025-11-14T17:02:03.743-03:00"
}
```

### **Exemplo N8N Node (HTTP Request)**
```json
{
  "method": "POST",
  "url": "={{ $env.DROMEFLOW_URL }}/rest/v1/activity_logs",
  "authentication": "genericCredentialType",
  "genericAuthType": "httpHeaderAuth",
  "httpHeaderAuth": {
    "name": "Authorization",
    "value": "Bearer ={{ $env.DROMEFLOW_ANON_KEY }}"
  },
  "body": {
    "unit_code": "={{ $json.unit }}",
    "workflow": "DROMEBOARD - UMBLER",
    "action_code": "={{ $json.action }}",
    "atend_id": "={{ $json.atend_id }}",
    "user_identifier": "={{ $json.user }}",
    "status": "success"
  }
}
```

---

## 📝 Checklist de Implementação

### **Fase 1: Preparação** ✅
- [x] Criar script SQL de migração
- [x] Criar serviço TypeScript
- [x] Atualizar types.ts
- [x] Documentar mudanças

### **Fase 2: Deploy no DromeFlow**
- [ ] Executar SQL migration no Supabase:
  ```bash
  # Via Supabase Dashboard → SQL Editor
  # Copiar conteúdo de: docs/sql/2025-11-16_consolidate_data_drome_to_dromeflow.sql
  # Executar
  ```

### **Fase 3: Atualizar N8N Workflows**
- [ ] Atualizar endpoint de logs:
  - Webhook URL: `https://uframhbsgtxckdxttofo.supabase.co/rest/v1/activity_logs`
  - Header: `Authorization: Bearer <DROMEFLOW_ANON_KEY>`
- [ ] Ajustar campos do payload:
  - `unit` → `unit_code`
  - `user` → `user_identifier`
  - `action` → `action_code`
- [ ] Testar workflow com atendimento real

### **Fase 4: Validação**
- [ ] Verificar logs sendo criados em `activity_logs`
- [ ] Confirmar ausência de erros no N8N
- [ ] Testar queries no Dashboard Sistema (se houver)
- [ ] Verificar performance (deve ser igual ou melhor)

### **Fase 5: Desativação Data Drome**
- [ ] Aguardar 7 dias de monitoramento
- [ ] Pausar projeto Data Drome no Supabase Dashboard
- [ ] Após 30 dias: Deletar permanentemente
- [ ] **Economia confirmada**: $180/ano

---

## 🎯 Casos de Uso

### **1. Log de Atividade Automático (N8N)**
```typescript
// N8N envia POST para /rest/v1/activity_logs
// Registro criado automaticamente
```

### **2. Buscar Logs de um Atendimento**
```typescript
import { fetchActivityLogsByAtendimento } from '@/services/analytics/activityLogs.service';

const logs = await fetchActivityLogsByAtendimento('43234');
// Retorna: [
//   {action_code: 'create_atend', status: 'success', workflow: 'DROMEBOARD - UMBLER'},
//   {action_code: 'envio_atend_client', status: 'success', ...}
// ]
```

### **3. Dashboard de Monitoramento**
```typescript
import { fetchActivityStatsByAction } from '@/services/analytics/activityLogs.service';

const stats = await fetchActivityStatsByAction('mb-londrina', 30);
// Retorna: [
//   {action_code: 'envio_atend_client', total_executions: 120, success_rate: 98.5},
//   {action_code: 'resp_atend_prof', total_executions: 95, success_rate: 100}
// ]
```

### **4. Alertas de Erros Críticos**
```typescript
import { fetchUnresolvedErrorCounts } from '@/services/analytics/activityLogs.service';

const errorCounts = await fetchUnresolvedErrorCounts();
// Retorna: {critical: 2, error: 15, warning: 8, info: 0}
```

---

## 📊 Métricas de Sucesso

| Métrica | Antes | Depois | Melhoria |
|---------|-------|--------|----------|
| **Custo Mensal** | $40 | $25 | -$15 (-37.5%) |
| **Custo Anual** | $480 | $300 | -$180 (-37.5%) |
| **Bancos Ativos** | 2 | 1 | -50% |
| **Latência Cross-DB** | ~50ms | 0ms | -100% |
| **Queries JOIN** | Impossível | Direto | ✅ |
| **Tokens MCP** | 2 | 1 | -50% |
| **Complexidade** | Alta | Baixa | ✅ |

---

## ⚠️ Notas Importantes

### **Data Drome como Backup?**
**❌ Não Recomendado**

**Razões**:
1. Supabase já faz **backups automáticos** diários (PITR - Point-in-Time Recovery)
2. Data Drome tem apenas 0.24MB de dados (7 logs em 3 dias)
3. **Custo de backup**: $180/ano para armazenar dados insignificantes
4. **Melhor alternativa**:
   - Histórico frio: Migrar dados >1 ano para AWS S3 Glacier ($0.004/GB/mês)
   - Backup real: Usar pg_dump manual + armazenar em Google Drive/Dropbox (grátis)

### **Quando Manter Data Drome?**
Considere manter APENAS se:
- ✅ Logs > 100K/dia (não é o caso: 2.3/dia)
- ✅ Compliance exige segregação (não mencionado)
- ✅ Múltiplos produtos compartilhando (não aplicável)

**Situação Atual**: Nenhum critério atendido → **Deletar e economizar $180/ano**

---

## 🚀 Próximos Passos

1. **Executar migração SQL** no Supabase Dashboard
2. **Atualizar webhooks N8N** com novo endpoint
3. **Testar integração** com workflow real
4. **Monitorar por 7 dias** antes de desativar Data Drome
5. **Pausar/Deletar Data Drome** → **Economia ativada**

---

**Documentação criada em**: 2025-11-16  
**Autor**: DromeFlow Team  
**Arquivo SQL**: `docs/sql/2025-11-16_consolidate_data_drome_to_dromeflow.sql`  
**Serviço TS**: `services/analytics/activityLogs.service.ts`
