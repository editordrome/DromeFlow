# Tabela n8n_logs - Guia de Uso

## Descrição

Tabela dedicada para receber logs de workflows N8N através de webhooks. Possui estrutura idêntica à `activity_logs`, mas **sem triggers ou automações internas**.

## Estrutura da Tabela

| Coluna | Tipo | Descrição | Padrão |
|--------|------|-----------|--------|
| `id` | BIGSERIAL | ID sequencial (auto-incremento) | - |
| `unit_code` | TEXT | Código da unidade | NULL |
| `workflow` | TEXT | Nome/ID do workflow N8N | NULL |
| `action_code` | TEXT | Código da ação (ref. tabela `actions`) | NULL |
| `atend_id` | TEXT | ID do atendimento relacionado | NULL |
| `user_identifier` | TEXT | Email ou nome do usuário | NULL |
| `status` | TEXT | Status da execução (success, error) | NULL |
| `horario` | TIMESTAMP | Timestamp do evento | NOW() |
| `metadata` | JSONB | Dados adicionais em JSON | {} |
| `created_at` | TIMESTAMP | Data de inserção no banco | NOW() |

## Índices Criados

- `idx_n8n_logs_unit_code` - Busca por unidade
- `idx_n8n_logs_workflow` - Busca por workflow
- `idx_n8n_logs_action_code` - Busca por ação
- `idx_n8n_logs_status` - Busca por status
- `idx_n8n_logs_created_at` - Ordenação por data (DESC)
- `idx_n8n_logs_horario` - Ordenação por horário (DESC)
- `idx_n8n_logs_unit_status_date` - Índice composto (otimizado para filtros)

## Permissões (RLS)

- **SELECT**: Apenas usuários autenticados (`authenticated`)
- **INSERT**: Webhooks externos (`anon`, `service_role`)

## Exemplo de Uso em Workflow N8N

### 1. Configuração do Webhook

```javascript
// Node HTTP Request no N8N
// URL: https://seu-projeto.supabase.co/rest/v1/n8n_logs
// Method: POST
// Headers:
{
  "apikey": "sua_anon_key",
  "Content-Type": "application/json",
  "Prefer": "return=representation"
}
```

### 2. Payload Exemplo

```json
{
  "unit_code": "mb_londrina",
  "workflow": "envio_confirmacao_agendamento",
  "action_code": "envio_atend_client",
  "atend_id": "ATEND_2025_001",
  "user_identifier": "joao@exemplo.com",
  "status": "success",
  "metadata": {
    "message": "WhatsApp enviado com sucesso",
    "channel": "whatsapp",
    "phone": "+5543999999999",
    "template": "confirmacao_agendamento"
  }
}
```

### 3. Payload de Erro

```json
{
  "unit_code": "mb_londrina",
  "workflow": "envio_confirmacao_agendamento",
  "action_code": "envio_atend_client",
  "atend_id": "ATEND_2025_002",
  "user_identifier": "maria@exemplo.com",
  "status": "error",
  "metadata": {
    "error_message": "Número de telefone inválido",
    "error_code": "INVALID_PHONE",
    "attempted_phone": "+554399999999X"
  }
}
```

## Diferenças entre `n8n_logs` e `activity_logs`

| Característica | `activity_logs` | `n8n_logs` |
|----------------|-----------------|------------|
| **Origem** | Frontend (aplicação React) | Webhooks N8N externos |
| **Triggers** | ✅ Possui triggers/automações | ❌ Sem triggers |
| **Realtime** | ✅ Subscription ativa | ⚠️ Configurar se necessário |
| **Uso no Dashboard** | "Atividades em Tempo Real" | "N8N - Workflows" (tab dedicada) |
| **Inserção** | `activityLogger.service.ts` | Webhook direto do N8N |

## Consultas Úteis

### Logs das últimas 24 horas
```sql
SELECT * FROM n8n_logs
WHERE created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

### Contar execuções por workflow
```sql
SELECT 
  workflow,
  COUNT(*) as total_executions,
  COUNT(*) FILTER (WHERE status = 'success') as successes,
  COUNT(*) FILTER (WHERE status = 'error') as errors
FROM n8n_logs
GROUP BY workflow
ORDER BY total_executions DESC;
```

### Buscar erros de um workflow específico
```sql
SELECT 
  created_at,
  atend_id,
  user_identifier,
  metadata->>'error_message' as error_message
FROM n8n_logs
WHERE workflow = 'envio_confirmacao_agendamento'
  AND status = 'error'
ORDER BY created_at DESC
LIMIT 50;
```

### Taxa de sucesso por unidade
```sql
SELECT 
  unit_code,
  COUNT(*) as total,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'success') / COUNT(*), 2) as success_rate
FROM n8n_logs
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY unit_code
ORDER BY total DESC;
```

## Integração com Dashboard Sistema

Para exibir esses logs no Dashboard Sistema, adicionar consulta em `DashboardSistemaPage.tsx`:

```typescript
const fetchN8NLogs = async (limit: number = 100) => {
  const { data, error } = await supabase
    .from('n8n_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (error) throw error;
  return data || [];
};
```

## Observações Importantes

1. **Não há validação de schema** - O N8N pode enviar qualquer estrutura JSON no `metadata`
2. **Limpeza manual** - Considerar criar job para deletar logs antigos (ex: > 90 dias)
3. **Monitoramento** - Criar alertas para volume anormal de erros
4. **Rate limiting** - Configurar no Supabase se necessário para evitar spam

## Arquivo SQL

Criado em: `docs/sql/2025-11-17_create_n8n_logs_table.sql`
