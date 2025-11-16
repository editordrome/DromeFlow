# 🔗 Integração Cross-Database: DromeFlow ↔ Data Drome

Este documento descreve a arquitetura de integração entre os dois projetos Supabase do sistema DromeFlow.

## 📊 Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                     APLICAÇÃO FRONTEND                       │
│                    (React + TypeScript)                      │
└──────────────┬──────────────────────────┬───────────────────┘
               │                          │
               │ MCP (Development)        │ Supabase Client (Production)
               │                          │
    ┌──────────▼──────────┐    ┌─────────▼──────────┐
    │   MCP supabase-data │    │  MCP supabase-drom │
    │   (DromeFlow)       │    │  (Data Drome)      │
    └──────────┬──────────┘    └─────────┬──────────┘
               │                          │
               │                          │
    ┌──────────▼──────────────────────────▼──────────┐
    │                                                  │
    │           Foreign Data Wrapper (FDW)            │
    │                                                  │
    │   ┌────────────────┐      ┌─────────────────┐  │
    │   │   DromeFlow    │◄────►│   Data Drome    │  │
    │   │   (Principal)  │      │   (Logs N8N)    │  │
    │   └────────────────┘      └─────────────────┘  │
    │                                                  │
    │   • processed_data         • monitoramento      │
    │   • units                  • error_dromeboard   │
    │   • modules                • actions            │
    │   • comercial                                   │
    │   • profissionais                               │
    │                                                  │
    └──────────────────────────────────────────────────┘
```

---

## 🎯 Estratégia Dual: FDW + MCP

### **Opção 1: Foreign Data Wrapper (FDW) - Produção**
**Uso:** Queries analíticas e relatórios complexos no backend

**Vantagens:**
- ✅ Performance nativa PostgreSQL
- ✅ Transações ACID entre bancos
- ✅ JOINs diretos sem overhead de rede
- ✅ Caching automático
- ✅ Ideal para análises e dashboards

**Quando usar:**
- Relatórios gerenciais
- Análises cross-database
- Dashboards com múltiplas fontes
- ETL e sincronização de dados

### **Opção 2: MCP Dual - Desenvolvimento**
**Uso:** Acesso granular durante desenvolvimento e debugging

**Vantagens:**
- ✅ Acesso direto via ferramentas MCP
- ✅ Queries independentes por projeto
- ✅ Facilita debugging e testes
- ✅ Separação lógica clara

**Quando usar:**
- Desenvolvimento e debug
- Migrations e scripts SQL
- Testes de integração
- Exploração de dados

---

## 📁 Estrutura de Schemas

### **DromeFlow (Projeto Principal)**
```
public/                     # Tabelas de negócio
  ├── processed_data        # 63.335 atendimentos
  ├── units                 # 19 unidades
  ├── modules               # 15 módulos
  ├── profiles              # 23 usuários
  ├── comercial             # 119 oportunidades
  ├── profissionais         # 502 profissionais
  └── pos_vendas            # 43.749 registros

data_drome/                 # Tabelas estrangeiras (FDW)
  ├── monitoramento_dromeboard
  ├── error_dromeboard
  └── actions
```

### **Data Drome (Logs N8N)**
```
public/                     # Tabelas de logs
  ├── monitoramento_dromeboard  # 6 logs
  ├── error_dromeboard          # 1 erro
  └── actions                   # 10 ações

dromeflow/                  # Tabelas estrangeiras (FDW)
  ├── processed_data
  ├── units
  ├── profiles
  ├── pos_vendas
  ├── comercial
  ├── profissionais
  └── recrutadora
```

---

## 🚀 Como Configurar

### **Passo 1: Instalar FDW no DromeFlow**

```bash
# Conectar ao projeto DromeFlow via SQL Editor no Supabase Dashboard
# Ou via psql:
psql "postgresql://postgres:[PASSWORD]@db.uframhbsgtxckdxttofo.supabase.co:6543/postgres"
```

Executar o script:
```bash
cat docs/sql/2025-11-15_fdw_data_drome_connection.sql
```

⚠️ **IMPORTANTE:** Substituir `SUA_SENHA_DB_DATA_DROME` pela senha real do banco Data Drome.

### **Passo 2: Instalar FDW no Data Drome**

```bash
# Conectar ao projeto Data Drome
psql "postgresql://postgres:[PASSWORD]@db.jeoegybltyqbdcjpuhbc.supabase.co:6543/postgres"
```

Executar o script:
```bash
cat docs/sql/2025-11-15_fdw_dromeflow_connection.sql
```

⚠️ **IMPORTANTE:** Substituir `SUA_SENHA_DB_DROMEFLOW` pela senha real do banco DromeFlow.

### **Passo 3: Obter Senhas do Banco**

1. Acessar **Supabase Dashboard**
2. Ir em **Project Settings → Database**
3. Copiar a senha em **Database Password**
4. Substituir nos scripts SQL

---

## 💻 Exemplos de Uso

### **Exemplo 1: Query Cross-Database no DromeFlow**

```sql
-- Atendimentos com logs de erro
SELECT 
  pd."ATENDIMENTO_ID",
  pd."CLIENTE",
  pd."DATA",
  pd.unidade,
  m.status as log_status,
  m.workflow,
  m.created_at as log_time
FROM public.processed_data pd
INNER JOIN data_drome.monitoramento_dromeboard m 
  ON pd."ATENDIMENTO_ID" = m.atend_id
WHERE m.status ILIKE '%erro%'
  AND m.created_at >= NOW() - INTERVAL '7 days'
ORDER BY m.created_at DESC
LIMIT 100;
```

### **Exemplo 2: Estatísticas por Unidade**

```sql
-- Taxa de erro por unidade
SELECT 
  u.unit_name,
  COUNT(m.id) as total_logs,
  COUNT(*) FILTER (WHERE m.status ILIKE '%erro%') as errors,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE m.status ILIKE '%erro%') / COUNT(*),
    2
  ) as error_rate
FROM public.units u
LEFT JOIN data_drome.monitoramento_dromeboard m 
  ON u.unit_code = m.unit
WHERE m.created_at >= NOW() - INTERVAL '30 days'
GROUP BY u.id, u.unit_name
ORDER BY error_rate DESC;
```

### **Exemplo 3: Usar Views Criadas**

```sql
-- View pré-configurada com dados enriquecidos
SELECT * FROM public.atendimentos_with_logs
WHERE log_status ILIKE '%erro%'
LIMIT 50;

-- Função helper para buscar logs de um atendimento
SELECT * FROM public.get_atendimento_logs('ATD-2024-001');

-- Estatísticas de logs por unidade
SELECT * FROM public.get_unit_log_stats('MB-JOINVILLE', 30);
```

---

## 🔧 Uso via MCP (Desenvolvimento)

### **Configuração Atual** (`~/.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "supabase-data": {
      "comment": "DromeFlow - Projeto Principal (Gestão de Negócio)",
      "command": "npx",
      "args": [
        "-y",
        "@supabase/mcp-server-supabase@latest",
        "--project-ref=uframhbsgtxckdxttofo"
      ],
      "env": {
        "SUPABASE_ACCESS_TOKEN": "sbp_7d1de4075f1906b17646d818e6b571d220a6ef9e"
      }
    },
    "supabase-drom": {
      "comment": "Data Drome - Projeto Secundário (Logs N8N e Monitoramento)",
      "command": "npx",
      "args": [
        "-y",
        "@supabase/mcp-server-supabase@latest",
        "--project-ref=jeoegybltyqbdcjpuhbc"
      ],
      "env": {
        "SUPABASE_ACCESS_TOKEN": "sbp_20bce69e6fb711a5d2e61f54714fb1693c8b0c56"
      }
    }
  }
}
```

### **Usando MCP no Código TypeScript**

```typescript
// services/integration/crossDatabase.service.ts

import { supabaseClient } from '../supabaseClient';

// Função para buscar atendimento com logs via FDW
export async function fetchAtendimentoWithLogs(atendimentoId: string) {
  const { data, error } = await supabaseClient
    .from('atendimentos_with_logs')
    .select('*')
    .eq('ATENDIMENTO_ID', atendimentoId);
  
  if (error) throw error;
  return data;
}

// Função para estatísticas de unidade
export async function fetchUnitLogStats(unitCode: string, days: number = 30) {
  const { data, error } = await supabaseClient
    .rpc('get_unit_log_stats', {
      p_unit_code: unitCode,
      p_days: days
    });
  
  if (error) throw error;
  return data;
}

// Função para relatório de workflows
export async function fetchWorkflowReport(unitCode: string, days: number = 7) {
  const { data, error } = await supabaseClient
    .rpc('get_workflow_report_by_unit', {
      p_unit_code: unitCode,
      p_days: days
    });
  
  if (error) throw error;
  return data;
}
```

---

## 📊 Views Pré-Configuradas

### **No DromeFlow:**

| View | Descrição | Uso |
|------|-----------|-----|
| `atendimentos_with_logs` | Atendimentos + logs de monitoramento | Dashboards, análises |
| `workflow_errors` | Erros de workflows N8N | Debugging, alertas |
| `available_actions` | Catálogo de ações do sistema | Referência |

### **No Data Drome:**

| View | Descrição | Uso |
|------|-----------|-----|
| `logs_with_atendimento_details` | Logs + dados de atendimento | Relatórios detalhados |
| `error_stats_by_unit` | Taxa de erro por unidade | Monitoramento |
| `professional_activity_logs` | Atividade de profissionais | Analytics |

---

## 🔒 Segurança

### **Recomendações:**

1. **Usuário Read-Only para FDW:**
   ```sql
   -- Criar usuário específico com acesso limitado
   CREATE USER fdw_reader WITH PASSWORD 'senha_segura';
   GRANT CONNECT ON DATABASE postgres TO fdw_reader;
   GRANT USAGE ON SCHEMA public TO fdw_reader;
   GRANT SELECT ON ALL TABLES IN SCHEMA public TO fdw_reader;
   ```

2. **Usar Secrets no Supabase Vault:**
   ```sql
   -- Armazenar senha de forma segura
   SELECT vault.create_secret('fdw_password', 'sua_senha_aqui');
   ```

3. **Monitorar Conexões:**
   ```sql
   -- Ver conexões ativas do FDW
   SELECT * FROM pg_stat_activity WHERE application_name LIKE '%fdw%';
   ```

---

## 🐛 Troubleshooting

### **Erro: "server does not exist"**
```sql
-- Verificar se o servidor foi criado
SELECT * FROM pg_foreign_server;
```

### **Erro: "permission denied"**
```sql
-- Verificar permissões do usuário FDW
\du fdw_reader
```

### **Performance Lenta**
```sql
-- Adicionar índices nas tabelas remotas
-- Executar no projeto remoto:
CREATE INDEX idx_monitoramento_atend_id ON monitoramento_dromeboard(atend_id);
```

### **Timeout de Conexão**
```sql
-- Aumentar timeout do FDW
ALTER SERVER data_drome_server OPTIONS (ADD connect_timeout '30');
```

---

## 📈 Performance

### **Otimizações Recomendadas:**

1. **Fetch Size:** Já configurado em `10000` registros por vez
2. **Índices:** Criar índices nas colunas de JOIN
3. **Materialized Views:** Para queries pesadas e frequentes
4. **Caching:** Implementar cache em nível de aplicação

### **Exemplo de Materialized View:**

```sql
-- Criar view materializada para dashboard
CREATE MATERIALIZED VIEW public.dashboard_unit_stats AS
SELECT 
  u.unit_name,
  COUNT(DISTINCT pd."ATENDIMENTO_ID") as total_atendimentos,
  COUNT(m.id) as total_logs,
  COUNT(*) FILTER (WHERE m.status ILIKE '%erro%') as total_errors
FROM public.units u
LEFT JOIN public.processed_data pd ON u.id = pd.unit_id
LEFT JOIN data_drome.monitoramento_dromeboard m ON u.unit_code = m.unit
WHERE pd."DATA" >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY u.id, u.unit_name;

-- Criar índice na materialized view
CREATE INDEX idx_dashboard_unit_stats_unit ON dashboard_unit_stats(unit_name);

-- Atualizar dados (executar via cron)
REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_unit_stats;
```

---

## 🎯 Próximos Passos

1. ✅ Configurar FDW em ambos os projetos
2. ✅ Criar views e funções auxiliares
3. ⏳ Implementar serviços TypeScript
4. ⏳ Adicionar testes de integração
5. ⏳ Configurar monitoring de performance
6. ⏳ Documentar queries comuns para a equipe

---

## 📚 Referências

- [PostgreSQL Foreign Data Wrapper Documentation](https://www.postgresql.org/docs/current/postgres-fdw.html)
- [Supabase Database Connections](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [MCP Supabase Server](https://github.com/supabase/mcp-server-supabase)
