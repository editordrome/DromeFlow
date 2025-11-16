# ✅ Status da Configuração FDW

## 🎯 Configuração Completa - Bidirecional

**Data de Atualização**: 15 de novembro de 2025  
**Status**: ✅ **CONFIGURADO COM SUCESSO**

---

## Configurações Implementadas

### **Direção 1: DromeFlow → Data Drome** ✅
- **Servidor**: `data_drome_server`
- **Schema**: `data_drome`
- **Tabelas Importadas**: 3
  - `monitoramento_dromeboard`
  - `error_dromeboard`
  - `actions`
- **Status**: Configurado e testado (6 logs acessíveis)

### **Direção 2: Data Drome → DromeFlow** ✅
- **Servidor**: `dromeflow_server`
- **Schema**: `dromeflow`
- **Tabelas Importadas**: 1
  - `recruta_metrica`
- **Status**: Configurado e testado (7 métricas acessíveis)
- **Senha**: DRom@29011725

---

## Views Analíticas Criadas no Data Drome

### 1. `public.workflow_errors` ✅
- **Descrição**: Erros de workflows N8N com contagem por tipo
- **Teste**: 1 erro registrado

### 2. `public.available_actions` ✅
- **Descrição**: Catálogo de ações disponíveis do sistema

### 3. `public.recruta_metrics_view` ✅
- **Descrição**: Métricas de recrutamento acessadas via FDW
- **Fonte**: `dromeflow.recruta_metrica`
- **Teste**: 7 métricas acessíveis

### 4. `public.unit_health_status` ✅
- **Descrição**: Status de saúde por unidade (últimas 24h)
- **Campos**: unit_code, total_logs, error_count, error_rate, health_status

### 5. `public.activity_timeline_24h` ✅
- **Descrição**: Timeline de atividade agrupada por hora (24h)
- **Campos**: hour, hour_label, total_logs, success_count, error_count

### 6. `public.top_problematic_workflows` ✅
- **Descrição**: Top 10 workflows com mais erros (últimos 7 dias)
- **Campos**: workflow, error_count, total_executions, error_rate

---

## Funções Analíticas Criadas no Data Drome

### 1. `get_atendimento_logs(p_atendimento_id TEXT)` ✅
- **Retorna**: Logs de um atendimento específico

### 2. `get_unit_log_stats(p_unit_code TEXT, p_days INTEGER)` ✅
- **Retorna**: Estatísticas de logs por unidade

### 3. `get_workflow_report_by_unit(p_unit_code TEXT, p_days INTEGER)` ✅
- **Retorna**: Relatório de performance de workflows

---

## Índices Criados (Performance) ✅

No projeto **Data Drome**:
- `idx_monitoramento_atend_id`
- `idx_monitoramento_unit`
- `idx_monitoramento_created_at`
- `idx_monitoramento_status`
- `idx_monitoramento_workflow`
- `idx_error_workflow`
- `idx_error_created_at`

---

## Testes de Conectividade

### DromeFlow → Data Drome ✅
```sql
SELECT COUNT(*) FROM data_drome.monitoramento_dromeboard;
-- Resultado: 6 logs
```

### Data Drome → DromeFlow ✅
```sql
SELECT COUNT(*) FROM dromeflow.recruta_metrica;
-- Resultado: 7 métricas
```

---

## ⚠️ Impacto no DromeFlow

✅ **NENHUMA TABELA FOI REMOVIDA**
- Todas as 19 tabelas originais permanecem intactas
- Apenas 1 tabela (`recruta_metrica`) é acessada remotamente
- Zero impacto na aplicação existente

---

## 📋 Próximos Passos Recomendados

### Dashboard Sistema
- [ ] Atualizar `DashboardSistemaPage.tsx` para usar novas views
- [ ] Implementar KPIs visuais
- [ ] Adicionar gráfico de timeline 24h
- [ ] Exibir health score por unidade
- [ ] Mostrar top workflows problemáticos

### Serviços TypeScript
- [ ] Criar `services/integration/dataDromeViews.service.ts`
- [ ] Adicionar tipos TypeScript para views

---

```bash
# 1. Obter senha do Data Drome no dashboard
export DATA_DROME_PASSWORD="sua_senha_aqui"

# 2. Obter senha do DromeFlow no dashboard  
export DROMEFLOW_PASSWORD="sua_senha_aqui"

# 3. Editar script com a senha
sed "s/COLE_SENHA_AQUI/$DATA_DROME_PASSWORD/g" \
  docs/sql/2025-11-15_fdw_setup_manual.sql > /tmp/fdw_setup.sql

# 4. Executar no DromeFlow
psql "postgresql://postgres:$DROMEFLOW_PASSWORD@db.uframhbsgtxckdxttofo.supabase.co:6543/postgres" \
  -f /tmp/fdw_setup.sql

# 5. Executar views e funções
psql "postgresql://postgres:$DROMEFLOW_PASSWORD@db.uframhbsgtxckdxttofo.supabase.co:6543/postgres" \
  -f docs/sql/2025-11-15_fdw_data_drome_connection.sql
```

---

## 🧪 Testar se FDW está funcionando

Após completar a configuração, execute estes testes:

### **Teste 1: Listar tabelas estrangeiras**
```sql
SELECT 
  foreign_table_schema,
  foreign_table_name
FROM information_schema.foreign_tables
WHERE foreign_table_schema = 'data_drome';
```

**Resultado esperado:**
```
foreign_table_schema | foreign_table_name
---------------------+------------------------
data_drome          | monitoramento_dromeboard
data_drome          | error_dromeboard
data_drome          | actions
```

### **Teste 2: Query cross-database**
```sql
SELECT 
  pd."ATENDIMENTO_ID",
  pd."CLIENTE",
  COUNT(m.id) as total_logs
FROM processed_data pd
LEFT JOIN data_drome.monitoramento_dromeboard m 
  ON pd."ATENDIMENTO_ID" = m.atend_id
GROUP BY pd."ATENDIMENTO_ID", pd."CLIENTE"
HAVING COUNT(m.id) > 0
LIMIT 10;
```

### **Teste 3: Usar função helper**
```sql
SELECT * FROM get_atendimento_logs('ATD-2024-001');
```

---

## 📊 Views disponíveis após configuração

Após completar, estas views estarão disponíveis:

1. **`atendimentos_with_logs`** - Atendimentos + logs de monitoramento
2. **`workflow_errors`** - Erros de workflows N8N  
3. **`available_actions`** - Catálogo de ações do sistema

---

## 🚨 Troubleshooting

### **Erro: "password authentication failed"**
- Verifique se copiou a senha correta do dashboard
- A senha deve ser a do **banco PostgreSQL**, não a API key

### **Erro: "could not connect to server"**
- Verifique se o host está correto: `db.jeoegybltyqbdcjpuhbc.supabase.co`
- Porta deve ser `6543` (não 5432)

### **Erro: "relation does not exist"**
- O FDW ainda não foi configurado completamente
- Execute o `2025-11-15_fdw_setup_manual.sql` primeiro

---

## 💡 Próximos Passos

1. ⏳ Completar configuração FDW no DromeFlow
2. ⏳ Executar mesmo processo no Data Drome (direção inversa)
3. ⏳ Testar serviço TypeScript (`services/integration/crossDatabase.service.ts`)
4. ⏳ Criar dashboard usando views cross-database

---

## 📚 Arquivos Criados

- ✅ `docs/sql/2025-11-15_fdw_data_drome_connection.sql` (script completo)
- ✅ `docs/sql/2025-11-15_fdw_dromeflow_connection.sql` (Data Drome → DromeFlow)
- ✅ `docs/sql/2025-11-15_fdw_setup_manual.sql` (versão simplificada)
- ✅ `docs/CROSS_DATABASE_INTEGRATION.md` (documentação completa)
- ✅ `services/integration/crossDatabase.service.ts` (serviço TypeScript)
- ✅ Este arquivo de status
