-- =====================================================
-- Foreign Data Wrapper: Data Drome → DromeFlow
-- Data: 2025-11-15
-- Descrição: Configura conexão do Data Drome com o projeto principal
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
-- IMPORTANTE: Substitua 'SUA_SENHA_DB_DROMEFLOW' pela senha real do banco
CREATE SERVER IF NOT EXISTS dromeflow_server
  FOREIGN DATA WRAPPER postgres_fdw
  OPTIONS (
    host 'db.uframhbsgtxckdxttofo.supabase.co',
    dbname 'postgres',
    port '6543',
    fetch_size '10000'
  );

-- =====================================================
-- 3. CRIAR USER MAPPING (Credenciais)
-- =====================================================
-- IMPORTANTE: Usar usuário com permissões de leitura no DromeFlow
CREATE USER MAPPING IF NOT EXISTS FOR CURRENT_USER
  SERVER dromeflow_server
  OPTIONS (
    user 'postgres',
    password 'SUA_SENHA_DB_DROMEFLOW'
  );

-- =====================================================
-- 4. CRIAR SCHEMA PARA TABELAS ESTRANGEIRAS
-- =====================================================
CREATE SCHEMA IF NOT EXISTS dromeflow;

COMMENT ON SCHEMA dromeflow IS 'Schema contendo tabelas estrangeiras do projeto DromeFlow (dados de negócio)';

-- =====================================================
-- 5. IMPORTAR TABELAS SELECIONADAS DO DROMEFLOW
-- =====================================================
-- Importa apenas tabelas necessárias para análises e relatórios
IMPORT FOREIGN SCHEMA public
  LIMIT TO (
    processed_data,
    units,
    profiles,
    pos_vendas,
    comercial,
    profissionais,
    recrutadora
  )
  FROM SERVER dromeflow_server
  INTO dromeflow;

-- =====================================================
-- 6. CRIAR VIEWS PARA ANÁLISES
-- =====================================================

-- View: Logs enriquecidos com dados de atendimento
CREATE OR REPLACE VIEW public.logs_with_atendimento_details AS
SELECT 
  m.id,
  m.created_at,
  m.unit,
  m.status,
  m.horario,
  m.user,
  m.atend_id,
  m.action,
  m.workflow,
  -- Dados do atendimento
  pd."CLIENTE",
  pd."PROFISSIONAL",
  pd."DATA",
  pd."VALOR",
  pd."SERVIÇO",
  pd."TIPO"
FROM public.monitoramento_dromeboard m
LEFT JOIN dromeflow.processed_data pd
  ON m.atend_id = pd."ATENDIMENTO_ID"
  AND m.unit = pd.unidade;

COMMENT ON VIEW public.logs_with_atendimento_details IS 'Logs de monitoramento enriquecidos com detalhes dos atendimentos';

-- View: Estatísticas de erros por unidade
CREATE OR REPLACE VIEW public.error_stats_by_unit AS
SELECT 
  u.unit_name,
  u.unit_code,
  COUNT(m.id) FILTER (WHERE m.status ILIKE '%erro%') as total_errors,
  COUNT(m.id) as total_logs,
  ROUND(
    100.0 * COUNT(m.id) FILTER (WHERE m.status ILIKE '%erro%') / NULLIF(COUNT(m.id), 0),
    2
  ) as error_rate_percent
FROM dromeflow.units u
LEFT JOIN public.monitoramento_dromeboard m ON u.unit_code = m.unit
WHERE m.created_at >= NOW() - INTERVAL '30 days'
GROUP BY u.id, u.unit_name, u.unit_code
ORDER BY error_rate_percent DESC NULLS LAST;

COMMENT ON VIEW public.error_stats_by_unit IS 'Estatísticas de erros por unidade nos últimos 30 dias';

-- View: Atividade de profissionais com logs
CREATE OR REPLACE VIEW public.professional_activity_logs AS
SELECT 
  p.nome,
  p.whatsapp,
  p.unidade,
  COUNT(DISTINCT m.atend_id) as atendimentos_logados,
  MAX(m.created_at) as ultimo_log,
  COUNT(*) FILTER (WHERE m.action ILIKE '%envio%') as envios_realizados
FROM dromeflow.profissionais p
LEFT JOIN public.monitoramento_dromeboard m 
  ON p.nome = m.user
  AND m.created_at >= NOW() - INTERVAL '30 days'
GROUP BY p.id, p.nome, p.whatsapp, p.unidade
ORDER BY atendimentos_logados DESC NULLS LAST;

COMMENT ON VIEW public.professional_activity_logs IS 'Atividade de profissionais baseada em logs dos últimos 30 dias';

-- =====================================================
-- 7. FUNÇÕES PARA ANÁLISES CROSS-DATABASE
-- =====================================================

-- Função: Obter detalhes completos de um atendimento
CREATE OR REPLACE FUNCTION public.get_full_atendimento_details(p_atendimento_id TEXT)
RETURNS TABLE (
  -- Dados do atendimento
  atendimento_id TEXT,
  cliente TEXT,
  profissional TEXT,
  data DATE,
  valor NUMERIC,
  servico TEXT,
  status TEXT,
  unidade TEXT,
  -- Contagem de logs
  total_logs BIGINT,
  ultimo_log TIMESTAMPTZ,
  tem_erros BOOLEAN
)
LANGUAGE SQL
STABLE
AS $$
  SELECT 
    pd."ATENDIMENTO_ID",
    pd."CLIENTE",
    pd."PROFISSIONAL",
    pd."DATA",
    pd."VALOR",
    pd."SERVIÇO",
    pd."STATUS",
    pd.unidade,
    COUNT(m.id) as total_logs,
    MAX(m.created_at) as ultimo_log,
    COUNT(*) FILTER (WHERE m.status ILIKE '%erro%') > 0 as tem_erros
  FROM dromeflow.processed_data pd
  LEFT JOIN public.monitoramento_dromeboard m 
    ON pd."ATENDIMENTO_ID" = m.atend_id
  WHERE pd."ATENDIMENTO_ID" = p_atendimento_id
  GROUP BY 
    pd."ATENDIMENTO_ID",
    pd."CLIENTE",
    pd."PROFISSIONAL",
    pd."DATA",
    pd."VALOR",
    pd."SERVIÇO",
    pd."STATUS",
    pd.unidade;
$$;

COMMENT ON FUNCTION public.get_full_atendimento_details IS 'Busca detalhes completos de um atendimento com estatísticas de logs';

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

-- =====================================================
-- 8. ÍNDICES RECOMENDADOS (EXECUTAR NO DROMEFLOW)
-- =====================================================
-- NOTA: Estes índices devem ser criados no projeto DromeFlow
-- para melhorar performance de queries cross-database

-- CREATE INDEX IF NOT EXISTS idx_processed_data_atendimento_id ON processed_data("ATENDIMENTO_ID");
-- CREATE INDEX IF NOT EXISTS idx_processed_data_unidade ON processed_data(unidade);
-- CREATE INDEX IF NOT EXISTS idx_processed_data_data ON processed_data("DATA");

-- =====================================================
-- 9. TESTES DE CONEXÃO
-- =====================================================
-- Testar se a conexão está funcionando
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM dromeflow.units LIMIT 1;
  RAISE NOTICE 'Conexão FDW estabelecida com sucesso! Unidades encontradas: %', v_count;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Erro ao conectar com DromeFlow: %', SQLERRM;
END $$;

-- =====================================================
-- 10. EXEMPLO DE QUERY ANALÍTICA
-- =====================================================
-- Query exemplo: Taxa de erro por unidade e workflow
/*
SELECT 
  u.unit_name,
  m.workflow,
  COUNT(*) as total_logs,
  COUNT(*) FILTER (WHERE m.status ILIKE '%erro%') as total_errors,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE m.status ILIKE '%erro%') / COUNT(*),
    2
  ) as error_rate_percent
FROM public.monitoramento_dromeboard m
INNER JOIN dromeflow.units u ON m.unit = u.unit_code
WHERE m.created_at >= NOW() - INTERVAL '7 days'
GROUP BY u.unit_name, m.workflow
HAVING COUNT(*) >= 10
ORDER BY error_rate_percent DESC, total_logs DESC;
*/

-- =====================================================
-- MANUTENÇÃO E MONITORAMENTO
-- =====================================================

-- Ver servidores FDW configurados
-- SELECT * FROM pg_foreign_server;

-- Ver mapeamentos de usuário
-- SELECT * FROM pg_user_mappings;

-- Ver tabelas estrangeiras
-- SELECT * FROM information_schema.foreign_tables WHERE foreign_table_schema = 'dromeflow';

-- Remover conexão (se necessário)
-- DROP USER MAPPING IF EXISTS FOR CURRENT_USER SERVER dromeflow_server;
-- DROP SERVER IF EXISTS dromeflow_server CASCADE;
-- DROP SCHEMA IF EXISTS dromeflow CASCADE;
