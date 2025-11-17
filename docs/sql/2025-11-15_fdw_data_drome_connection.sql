-- =====================================================
-- Foreign Data Wrapper: DromeFlow → Data Drome
-- Data: 2025-11-15
-- Descrição: Configura conexão do projeto principal com o Data Drome
-- =====================================================
-- EXECUTAR NO PROJETO: DromeFlow (uframhbsgtxckdxttofo)
-- =====================================================

-- =====================================================
-- 1. HABILITAR EXTENSÃO POSTGRES_FDW
-- =====================================================
CREATE EXTENSION IF NOT EXISTS postgres_fdw;

-- =====================================================
-- 2. CRIAR SERVIDOR REMOTO (Data Drome)
-- =====================================================
-- IMPORTANTE: Substitua 'SUA_SENHA_DB_DATA_DROME' pela senha real do banco
CREATE SERVER IF NOT EXISTS data_drome_server
  FOREIGN DATA WRAPPER postgres_fdw
  OPTIONS (
    host 'db.jeoegybltyqbdcjpuhbc.supabase.co',
    dbname 'postgres',
    port '6543',
    fetch_size '10000'
  );

-- =====================================================
-- 3. CRIAR USER MAPPING (Credenciais)
-- =====================================================
-- IMPORTANTE: Usar usuário com permissões de leitura no Data Drome
-- Recomendado: Criar um usuário específico para FDW com acesso read-only
CREATE USER MAPPING IF NOT EXISTS FOR CURRENT_USER
  SERVER data_drome_server
  OPTIONS (
    user 'postgres',
    password 'SUA_SENHA_DB_DATA_DROME'
  );

-- =====================================================
-- 4. CRIAR SCHEMA PARA TABELAS ESTRANGEIRAS
-- =====================================================
CREATE SCHEMA IF NOT EXISTS data_drome;

COMMENT ON SCHEMA data_drome IS 'Schema contendo tabelas estrangeiras do projeto Data Drome (logs e monitoramento)';

-- =====================================================
-- 5. IMPORTAR TABELAS DO DATA DROME
-- =====================================================
-- Importa apenas as tabelas necessárias do schema public
IMPORT FOREIGN SCHEMA public
  LIMIT TO (
    monitoramento_dromeboard,
    error_dromeboard,
    actions
  )
  FROM SERVER data_drome_server
  INTO data_drome;

-- =====================================================
-- 6. CRIAR VIEWS PARA FACILITAR QUERIES CROSS-DATABASE
-- =====================================================

-- View: Logs de atendimentos com dados enriquecidos
CREATE OR REPLACE VIEW public.atendimentos_with_logs AS
SELECT 
  pd.id,
  pd."ATENDIMENTO_ID",
  pd."CLIENTE",
  pd."PROFISSIONAL",
  pd."DATA",
  pd."VALOR",
  pd."STATUS",
  pd.unidade,
  -- Dados do monitoramento
  m.status as log_status,
  m.horario as log_horario,
  m.action as log_action,
  m.workflow as log_workflow,
  m.created_at as log_created_at
FROM public.processed_data pd
LEFT JOIN data_drome.monitoramento_dromeboard m 
  ON pd."ATENDIMENTO_ID" = m.atend_id
  AND pd.unidade = m.unit;

COMMENT ON VIEW public.atendimentos_with_logs IS 'Atendimentos enriquecidos com logs de monitoramento do Data Drome';

-- View: Erros por workflow
CREATE OR REPLACE VIEW public.workflow_errors AS
SELECT 
  e.id,
  e.workflow,
  e.url_workflow,
  e.erro_message,
  e.created_at,
  -- Contar ocorrências por workflow
  COUNT(*) OVER (PARTITION BY e.workflow) as error_count
FROM data_drome.error_dromeboard e
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
FROM data_drome.actions a
WHERE a.action_code IS NOT NULL
ORDER BY a.action_name;

COMMENT ON VIEW public.available_actions IS 'Catálogo de ações disponíveis do sistema';

-- =====================================================
-- 7. CRIAR FUNÇÃO PARA CONSULTAR LOGS POR ATENDIMENTO
-- =====================================================
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
  FROM data_drome.monitoramento_dromeboard m
  WHERE m.atend_id = p_atendimento_id
  ORDER BY m.created_at DESC;
$$;

COMMENT ON FUNCTION public.get_atendimento_logs IS 'Busca todos os logs de monitoramento de um atendimento específico';

-- =====================================================
-- 8. CRIAR FUNÇÃO PARA ESTATÍSTICAS DE LOGS POR UNIDADE
-- =====================================================
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
  FROM data_drome.monitoramento_dromeboard m
  WHERE m.unit = p_unit_code
    AND m.created_at >= NOW() - (p_days || ' days')::INTERVAL;
$$;

COMMENT ON FUNCTION public.get_unit_log_stats IS 'Estatísticas de logs de uma unidade nos últimos N dias';

-- =====================================================
-- 9. POLÍTICAS RLS PARA VIEWS (OPCIONAL)
-- =====================================================
-- Se necessário, habilitar RLS nas views criadas
-- ALTER VIEW public.atendimentos_with_logs ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 10. ÍNDICES RECOMENDADOS NO DATA DROME (EXECUTAR LÁ)
-- =====================================================
-- NOTA: Os índices abaixo devem ser criados no projeto Data Drome
-- para melhorar performance de queries cross-database

-- CREATE INDEX IF NOT EXISTS idx_monitoramento_atend_id ON monitoramento_dromeboard(atend_id);
-- CREATE INDEX IF NOT EXISTS idx_monitoramento_unit ON monitoramento_dromeboard(unit);
-- CREATE INDEX IF NOT EXISTS idx_monitoramento_created_at ON monitoramento_dromeboard(created_at DESC);
-- CREATE INDEX IF NOT EXISTS idx_error_workflow ON error_dromeboard(workflow);

-- =====================================================
-- 11. TESTES DE CONEXÃO
-- =====================================================
-- Testar se a conexão está funcionando
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM data_drome.monitoramento_dromeboard LIMIT 1;
  RAISE NOTICE 'Conexão FDW estabelecida com sucesso! Registros encontrados: %', v_count;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Erro ao conectar com Data Drome: %', SQLERRM;
END $$;

-- =====================================================
-- 12. EXEMPLO DE QUERY CROSS-DATABASE
-- =====================================================
-- Query exemplo: Atendimentos com problemas nos últimos 7 dias
/*
SELECT 
  pd."ATENDIMENTO_ID",
  pd."CLIENTE",
  pd."DATA",
  pd.unidade,
  m.status as log_status,
  m.workflow,
  e.erro_message
FROM public.processed_data pd
INNER JOIN data_drome.monitoramento_dromeboard m 
  ON pd."ATENDIMENTO_ID" = m.atend_id
LEFT JOIN data_drome.error_dromeboard e
  ON m.workflow = e.workflow
  AND e.created_at::DATE = m.created_at::DATE
WHERE m.status ILIKE '%erro%'
  AND m.created_at >= NOW() - INTERVAL '7 days'
ORDER BY m.created_at DESC
LIMIT 100;
*/

-- =====================================================
-- MANUTENÇÃO E MONITORAMENTO
-- =====================================================

-- Ver servidores FDW configurados
-- SELECT * FROM pg_foreign_server;

-- Ver mapeamentos de usuário
-- SELECT * FROM pg_user_mappings;

-- Ver tabelas estrangeiras
-- SELECT * FROM information_schema.foreign_tables WHERE foreign_table_schema = 'data_drome';

-- Remover conexão (se necessário)
-- DROP USER MAPPING IF EXISTS FOR CURRENT_USER SERVER data_drome_server;
-- DROP SERVER IF EXISTS data_drome_server CASCADE;
-- DROP SCHEMA IF EXISTS data_drome CASCADE;
