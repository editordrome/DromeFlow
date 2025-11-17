-- =====================================================
-- RPC para métricas do banco de dados PostgreSQL
-- Data: 2025-11-15
-- Descrição: Funções para obter estatísticas detalhadas do banco
-- =====================================================

-- Função para obter estatísticas de tabelas
CREATE OR REPLACE FUNCTION get_table_stats()
RETURNS TABLE (
  table_name TEXT,
  row_count BIGINT,
  table_size_mb NUMERIC,
  indexes_size_mb NUMERIC,
  total_size_mb NUMERIC,
  last_update TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.relname::TEXT as table_name,
    c.reltuples::BIGINT as row_count,
    ROUND((pg_total_relation_size(c.oid) - pg_indexes_size(c.oid))::NUMERIC / (1024 * 1024), 2) as table_size_mb,
    ROUND(pg_indexes_size(c.oid)::NUMERIC / (1024 * 1024), 2) as indexes_size_mb,
    ROUND(pg_total_relation_size(c.oid)::NUMERIC / (1024 * 1024), 2) as total_size_mb,
    GREATEST(
      (SELECT MAX(last_value) FROM pg_sequences WHERE schemaname = n.nspname),
      (SELECT stats_reset FROM pg_stat_database WHERE datname = current_database())
    ) as last_update
  FROM pg_class c
  LEFT JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE 
    c.relkind = 'r'
    AND n.nspname = 'public'
    AND c.relname NOT LIKE 'pg_%'
  ORDER BY pg_total_relation_size(c.oid) DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentário da função
COMMENT ON FUNCTION get_table_stats() IS 'Retorna estatísticas das 10 maiores tabelas do schema public';

-- =====================================================
-- Permissões
-- =====================================================

-- Permitir execução para usuários autenticados
GRANT EXECUTE ON FUNCTION get_table_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION get_table_stats() TO service_role;

-- =====================================================
-- Nota: Para acessar pg_stat_database, é necessário
-- fazer queries diretas via supabase client, não RPC
-- =====================================================
