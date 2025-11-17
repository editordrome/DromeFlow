-- =====================================================
-- FDW Setup: Data Drome → DromeFlow
-- Data: 2025-11-15
-- Descrição: Configura conexão reversa para views analíticas
-- =====================================================
-- EXECUTAR NO PROJETO: Data Drome (jeoegybltyqbdcjpuhbc)
-- =====================================================

-- =====================================================
-- 1. HABILITAR EXTENSÃO POSTGRES_FDW
-- =====================================================
CREATE EXTENSION IF NOT EXISTS postgres_fdw;

-- =====================================================
-- 2. CRIAR SERVIDOR REMOTO (DromeFlow)
-- =====================================================
DROP SERVER IF EXISTS dromeflow_server CASCADE;

CREATE SERVER dromeflow_server
  FOREIGN DATA WRAPPER postgres_fdw
  OPTIONS (
    host 'db.uframhbsgtxckdxttofo.supabase.co',
    dbname 'postgres',
    port '6543',
    fetch_size '10000'
  );

-- =====================================================
-- 3. CRIAR USER MAPPING (SUBSTITUA A SENHA!)
-- =====================================================
CREATE USER MAPPING FOR CURRENT_USER
  SERVER dromeflow_server
  OPTIONS (
    user 'postgres',
    password 'DRom@29011725'  -- ← SENHA DO DROMEFLOW
  );

-- =====================================================
-- 4. CRIAR SCHEMA PARA TABELAS ESTRANGEIRAS
-- =====================================================
CREATE SCHEMA IF NOT EXISTS dromeflow;

COMMENT ON SCHEMA dromeflow IS 'Schema contendo tabelas estrangeiras do projeto DromeFlow (dados de negócio)';

-- =====================================================
-- 5. IMPORTAR TABELAS DO DROMEFLOW
-- =====================================================
-- Importando APENAS recruta_metrica para análises de recrutamento
IMPORT FOREIGN SCHEMA public
  LIMIT TO (
    recruta_metrica
  )
  FROM SERVER dromeflow_server
  INTO dromeflow;

-- Testar conexão
SELECT COUNT(*) as total_metricas FROM dromeflow.recruta_metrica;

-- =====================================================
-- 6. CRIAR VIEWS ANALÍTICAS (Cross-Database)
-- =====================================================

-- View: Erros por workflow
CREATE OR REPLACE VIEW public.workflow_errors AS
SELECT 
  e.id,
  e.workflow,
  e.url_workflow,
  e.erro_message,
  e.created_at,
  COUNT(*) OVER (PARTITION BY e.workflow) as error_count
FROM public.error_dromeboard e
ORDER BY e.created_at DESC;

COMMENT ON VIEW public.workflow_errors IS 'Erros de workflows N8N do Data Drome';

-- View: Ações disponíveis
CREATE OR REPLACE VIEW public.available_actions AS
SELECT 
  a.id,
  a.action_code,
  a.action_name,
  a.description,
  a.created_at
FROM public.actions a
WHERE a.action_code IS NOT NULL
ORDER BY a.action_name;

COMMENT ON VIEW public.available_actions IS 'Catálogo de ações disponíveis do sistema';

-- View: Métricas de recrutamento (acessando DromeFlow)
CREATE OR REPLACE VIEW public.recruta_metrics_view AS
SELECT 
  rm.*
FROM dromeflow.recruta_metrica rm
ORDER BY rm.created_at DESC;

COMMENT ON VIEW public.recruta_metrics_view IS 'Métricas de recrutamento do DromeFlow acessadas via FDW';

-- =====================================================
-- 7. CRIAR FUNÇÕES ANALÍTICAS
-- =====================================================

-- Função: Buscar logs de um atendimento específico
CREATE OR REPLACE FUNCTION public.get_atendimento_logs(p_atendimento_id TEXT)
RETURNS TABLE (
  log_id BIGINT,
  status TEXT,
  horario TEXT,
  action TEXT,
  workflow TEXT,
  created_at TIMESTAMPTZ
) 
LANGUAGE SQL
STABLE
AS $$
  SELECT 
    m.id,
    m.status,
    m.horario,
    m.action,
    m.workflow,
    m.created_at
  FROM public.monitoramento_dromeboard m
  WHERE m.atend_id = p_atendimento_id
  ORDER BY m.created_at DESC;
$$;

COMMENT ON FUNCTION public.get_atendimento_logs IS 'Busca todos os logs de monitoramento de um atendimento específico';

-- Função: Estatísticas de logs por unidade
CREATE OR REPLACE FUNCTION public.get_unit_log_stats(p_unit_code TEXT, p_days INTEGER DEFAULT 30)
RETURNS TABLE (
  total_logs BIGINT,
  total_errors BIGINT,
  distinct_workflows BIGINT,
  last_log_date TIMESTAMPTZ
)
LANGUAGE SQL
STABLE
AS $$
  SELECT 
    COUNT(*) as total_logs,
    COUNT(*) FILTER (WHERE m.status ILIKE '%erro%' OR m.status ILIKE '%error%') as total_errors,
    COUNT(DISTINCT m.workflow) as distinct_workflows,
    MAX(m.created_at) as last_log_date
  FROM public.monitoramento_dromeboard m
  WHERE m.unit = p_unit_code
    AND m.created_at >= NOW() - (p_days || ' days')::INTERVAL;
$$;

COMMENT ON FUNCTION public.get_unit_log_stats IS 'Estatísticas de logs de uma unidade nos últimos N dias';

-- Função: Relatório de workflows por unidade
CREATE OR REPLACE FUNCTION public.get_workflow_report_by_unit(p_unit_code TEXT, p_days INTEGER DEFAULT 7)
RETURNS TABLE (
  workflow TEXT,
  total_executions BIGINT,
  successful BIGINT,
  errors BIGINT,
  success_rate NUMERIC
)
LANGUAGE SQL
STABLE
AS $$
  SELECT 
    m.workflow,
    COUNT(*) as total_executions,
    COUNT(*) FILTER (WHERE m.status NOT ILIKE '%erro%') as successful,
    COUNT(*) FILTER (WHERE m.status ILIKE '%erro%') as errors,
    ROUND(
      100.0 * COUNT(*) FILTER (WHERE m.status NOT ILIKE '%erro%') / NULLIF(COUNT(*), 0),
      2
    ) as success_rate
  FROM public.monitoramento_dromeboard m
  WHERE m.unit = p_unit_code
    AND m.created_at >= NOW() - (p_days || ' days')::INTERVAL
  GROUP BY m.workflow
  ORDER BY total_executions DESC;
$$;

COMMENT ON FUNCTION public.get_workflow_report_by_unit IS 'Relatório de performance de workflows por unidade';

-- View: Saúde por unidade (últimas 24h)
CREATE OR REPLACE VIEW public.unit_health_status AS
SELECT 
  m.unit as unit_code,
  COUNT(m.id) as total_logs,
  COUNT(*) FILTER (WHERE m.status ILIKE '%erro%') as error_count,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE m.status ILIKE '%erro%') / NULLIF(COUNT(*), 0),
    1
  ) as error_rate,
  MAX(m.created_at) as last_activity,
  CASE 
    WHEN COUNT(*) FILTER (WHERE m.status ILIKE '%erro%') * 100.0 / NULLIF(COUNT(*), 0) > 10 THEN 'critical'
    WHEN COUNT(*) FILTER (WHERE m.status ILIKE '%erro%') * 100.0 / NULLIF(COUNT(*), 0) > 5 THEN 'warning'
    ELSE 'healthy'
  END as health_status
FROM public.monitoramento_dromeboard m
WHERE m.created_at >= NOW() - INTERVAL '24 hours'
GROUP BY m.unit
ORDER BY error_rate DESC NULLS LAST;

COMMENT ON VIEW public.unit_health_status IS 'Status de saúde de cada unidade baseado em logs das últimas 24h';

-- View: Timeline de atividade (últimas 24h por hora)
CREATE OR REPLACE VIEW public.activity_timeline_24h AS
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  TO_CHAR(DATE_TRUNC('hour', created_at), 'HH24:MI') as hour_label,
  COUNT(*) as total_logs,
  COUNT(*) FILTER (WHERE status NOT ILIKE '%erro%') as success_count,
  COUNT(*) FILTER (WHERE status ILIKE '%erro%') as error_count,
  COUNT(DISTINCT unit) as active_units,
  COUNT(DISTINCT workflow) as active_workflows
FROM public.monitoramento_dromeboard
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour DESC;

COMMENT ON VIEW public.activity_timeline_24h IS 'Timeline de atividade de logs nas últimas 24 horas agrupado por hora';

-- View: Top workflows problemáticos
CREATE OR REPLACE VIEW public.top_problematic_workflows AS
SELECT 
  m.workflow,
  COUNT(*) FILTER (WHERE m.status ILIKE '%erro%') as error_count,
  COUNT(*) as total_executions,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE m.status ILIKE '%erro%') / COUNT(*),
    1
  ) as error_rate,
  MAX(m.created_at) as last_error,
  COUNT(DISTINCT m.unit) as affected_units,
  COUNT(DISTINCT m.atend_id) as affected_atendimentos
FROM public.monitoramento_dromeboard m
WHERE m.created_at >= NOW() - INTERVAL '7 days'
GROUP BY m.workflow
HAVING COUNT(*) FILTER (WHERE m.status ILIKE '%erro%') > 0
ORDER BY error_count DESC
LIMIT 10;

COMMENT ON VIEW public.top_problematic_workflows IS 'Top 10 workflows com mais erros nos últimos 7 dias';

-- =====================================================
-- 8. CRIAR ÍNDICES (se necessário)
-- =====================================================
-- Índices nas tabelas locais do Data Drome para melhorar performance

CREATE INDEX IF NOT EXISTS idx_monitoramento_atend_id 
  ON public.monitoramento_dromeboard(atend_id);

CREATE INDEX IF NOT EXISTS idx_monitoramento_unit 
  ON public.monitoramento_dromeboard(unit);

CREATE INDEX IF NOT EXISTS idx_monitoramento_created_at 
  ON public.monitoramento_dromeboard(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_monitoramento_status 
  ON public.monitoramento_dromeboard(status);

CREATE INDEX IF NOT EXISTS idx_monitoramento_workflow 
  ON public.monitoramento_dromeboard(workflow);

CREATE INDEX IF NOT EXISTS idx_error_workflow 
  ON public.error_dromeboard(workflow);

CREATE INDEX IF NOT EXISTS idx_error_created_at 
  ON public.error_dromeboard(created_at DESC);

-- =====================================================
-- 9. TESTAR VIEWS E FUNÇÕES
-- =====================================================

-- Teste 1: View recruta_metrics_view
SELECT COUNT(*) as total FROM public.recruta_metrics_view;

-- Teste 2: View unit_health_status
SELECT * FROM public.unit_health_status LIMIT 5;

-- Teste 3: View activity_timeline_24h
SELECT * FROM public.activity_timeline_24h LIMIT 5;

-- Teste 4: Função get_atendimento_logs
-- SELECT * FROM public.get_atendimento_logs('43066');

-- Teste 5: Função get_unit_log_stats
-- SELECT * FROM public.get_unit_log_stats('MB Londrina', 30);

-- =====================================================
-- CONCLUÍDO!
-- =====================================================
-- As views analíticas agora estão no Data Drome
-- Apenas recruta_metrica é importada do DromeFlow via FDW
-- Nenhuma tabela foi removida do projeto DromeFlow
-- =====================================================
