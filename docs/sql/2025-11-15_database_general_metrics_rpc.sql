-- =====================================================
-- RPC para métricas gerais do banco de dados PostgreSQL
-- Data: 2025-11-15
-- Descrição: Retorna métricas em tempo real do PostgreSQL
-- =====================================================

CREATE OR REPLACE FUNCTION get_database_metrics()
RETURNS TABLE (
  active_connections BIGINT,
  max_connections INTEGER,
  cache_hit_ratio NUMERIC,
  transactions_committed BIGINT,
  transactions_rolled_back BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    -- Conexões ativas
    (SELECT count(*)::BIGINT FROM pg_stat_activity WHERE state = 'active') as active_connections,
    -- Máximo de conexões permitidas
    (SELECT setting::INTEGER FROM pg_settings WHERE name = 'max_connections') as max_connections,
    -- Cache Hit Ratio (% de leituras que vieram do cache vs disco)
    ROUND(
      100.0 * sum(blks_hit) / NULLIF(sum(blks_hit) + sum(blks_read), 0),
      2
    ) as cache_hit_ratio,
    -- Transações confirmadas
    sum(xact_commit)::BIGINT as transactions_committed,
    -- Transações revertidas
    sum(xact_rollback)::BIGINT as transactions_rolled_back
  FROM pg_stat_database
  WHERE datname = current_database();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentário
COMMENT ON FUNCTION get_database_metrics() IS 'Retorna métricas em tempo real do banco de dados PostgreSQL';

-- Permissões
GRANT EXECUTE ON FUNCTION get_database_metrics() TO authenticated;
GRANT EXECUTE ON FUNCTION get_database_metrics() TO service_role;

-- =====================================================
-- EXEMPLO DE USO
-- =====================================================

-- SELECT * FROM get_database_metrics();

-- Resultado esperado:
-- active_connections | max_connections | cache_hit_ratio | transactions_committed | transactions_rolled_back
-- -------------------|-----------------|-----------------|------------------------|-------------------------
-- 1                  | 60              | 100.00          | 5522010                | 120730
