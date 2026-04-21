-- =====================================================
-- Script: Remoção completa do Data Drome (FDW)
-- Data: 2025-11-17
-- Descrição: Remove schema estrangeiro data_drome e foreign server
--            Todas as tabelas necessárias (actions, activity_logs, error_logs)
--            foram consolidadas no banco DromeFlow.
-- =====================================================

-- CONTEXTO:
-- Anteriormente, o projeto usava FDW (Foreign Data Wrapper) para conectar
-- o DromeFlow a um banco separado "Data Drome" que armazenava logs de N8N.
-- 
-- As tabelas foram migradas para o DromeFlow:
-- - data_drome.actions          → public.actions (23 registros)
-- - data_drome.monitoramento_*  → public.activity_logs (54 registros)
-- - data_drome.error_dromeboard → public.error_logs (0 registros)

-- =====================================================
-- PASSO 1: Remover schema estrangeiro
-- =====================================================

DROP SCHEMA IF EXISTS data_drome CASCADE;

-- Remove:
-- - data_drome.actions (FOREIGN TABLE)
-- - data_drome.error_dromeboard (FOREIGN TABLE)
-- - data_drome.monitoramento_dromeboard (FOREIGN TABLE)

-- =====================================================
-- PASSO 2: Remover user mappings
-- =====================================================

DO $$
BEGIN
    -- Remove mapeamentos de usuários para o servidor estrangeiro
    DROP USER MAPPING IF EXISTS FOR postgres SERVER data_drome_server;
    DROP USER MAPPING IF EXISTS FOR authenticated SERVER data_drome_server;
    DROP USER MAPPING IF EXISTS FOR anon SERVER data_drome_server;
EXCEPTION
    WHEN undefined_object THEN 
        -- Ignora erro se o servidor já foi removido
        NULL;
END $$;

-- =====================================================
-- PASSO 3: Remover foreign server
-- =====================================================

DROP SERVER IF EXISTS data_drome_server CASCADE;

-- Remove o servidor estrangeiro que conectava ao Data Drome:
-- Host: db.jeoegybltyqbdcjpuhbc.supabase.co
-- Database: postgres
-- Port: 6543

-- =====================================================
-- PASSO 4: Verificar remoção completa
-- =====================================================

-- Confirma que não há mais vestígios do Data Drome
SELECT 
    'Remoção concluída' as status,
    NOT EXISTS (
        SELECT 1 FROM information_schema.schemata 
        WHERE schema_name = 'data_drome'
    ) as schema_removido,
    NOT EXISTS (
        SELECT 1 FROM pg_foreign_server 
        WHERE srvname = 'data_drome_server'
    ) as server_removido;

-- Resultado esperado:
-- | status             | schema_removido | server_removido |
-- |--------------------|-----------------|-----------------|
-- | Remoção concluída  | true            | true            |

-- =====================================================
-- TABELAS LOCAIS MANTIDAS (DromeFlow)
-- =====================================================

-- Confirma que as tabelas locais estão intactas:

SELECT 
    'actions' as tabela,
    COUNT(*) as registros,
    'Dicionário de ações do sistema' as descricao
FROM public.actions

UNION ALL

SELECT 
    'activity_logs' as tabela,
    COUNT(*) as registros,
    'Logs de atividades de workflows N8N' as descricao
FROM public.activity_logs

UNION ALL

SELECT 
    'error_logs' as tabela,
    COUNT(*) as registros,
    'Logs de erros de workflows N8N' as descricao
FROM public.error_logs;

-- Resultado esperado:
-- | tabela         | registros | descricao                          |
-- |----------------|-----------|-------------------------------------|
-- | actions        | 23        | Dicionário de ações do sistema     |
-- | activity_logs  | 54+       | Logs de atividades de workflows N8N|
-- | error_logs     | 0+        | Logs de erros de workflows N8N     |

-- =====================================================
-- COMENTÁRIOS FINAIS
-- =====================================================

COMMENT ON TABLE public.actions IS 
'Dicionário de ações do sistema (N8N workflows, integrações, eventos). 
Consolidado do Data Drome em 2025-11-17.';

COMMENT ON TABLE public.activity_logs IS 
'Logs de atividades de workflows N8N e eventos do sistema. 
Consolidado do Data Drome em 2025-11-17.';

COMMENT ON TABLE public.error_logs IS 
'Logs de erros de workflows N8N e exceções do sistema. 
Consolidado do Data Drome em 2025-11-17.';

-- =====================================================
-- FIM DA MIGRAÇÃO
-- =====================================================
-- Executado em: 2025-11-17
-- Status: ✅ Completo
-- Impacto: Remoção de dependência externa (FDW)
-- =====================================================
