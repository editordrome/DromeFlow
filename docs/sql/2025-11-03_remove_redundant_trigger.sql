-- ============================================================================
-- Script: Remoção de Trigger Redundante
-- Data: 2025-11-03
-- Descrição: Remove o trigger auto_create_pos_vendas_from_processed que é
--            redundante com trigger_sync_processed_to_pos_vendas
-- ============================================================================

-- CONTEXTO:
-- Foram identificados 2 triggers que executam a mesma operação:
-- 1. auto_create_pos_vendas_from_processed (AFTER INSERT em processed_data)
-- 2. trigger_sync_processed_to_pos_vendas (AFTER INSERT em processed_data)
--
-- Ambos criam registros em pos_vendas quando há INSERT em processed_data.
--
-- DECISÃO: Remover auto_create_pos_vendas_from_processed porque:
-- - trigger_sync_processed_to_pos_vendas é mais robusto
-- - Respeita o campo "pos vendas" se já vier preenchido
-- - Tem tratamento de erro (RAISE WARNING)
-- - Foi corrigido na sessão anterior (campo whatscliente)

-- ============================================================================
-- REMOÇÃO DO TRIGGER E FUNÇÃO
-- ============================================================================

-- 1. Remover o trigger
DROP TRIGGER IF EXISTS auto_create_pos_vendas_from_processed ON processed_data;

-- 2. Remover a função
DROP FUNCTION IF EXISTS auto_create_pos_vendas_from_processed();

-- ============================================================================
-- VERIFICAÇÃO
-- ============================================================================

-- Listar triggers restantes em processed_data
SELECT 
    t.tgname AS trigger_name,
    p.proname AS function_name
FROM pg_trigger t
JOIN pg_proc p ON p.oid = t.tgfoid
JOIN pg_class c ON c.oid = t.tgrelid
WHERE c.relname = 'processed_data'
  AND t.tgname NOT LIKE 'RI_%'  -- Excluir triggers de FK
ORDER BY t.tgname;

-- Resultado esperado:
-- Deve mostrar apenas trigger_sync_processed_to_pos_vendas
-- (e outros triggers não relacionados ao pos_vendas)

-- ============================================================================
-- OBSERVAÇÕES
-- ============================================================================

-- ✅ O trigger trigger_sync_processed_to_pos_vendas permanece ativo
-- ✅ A sincronização processed_data → pos_vendas continua funcionando
-- ✅ A redundância foi eliminada
-- ⚠️  Backups automáticos do Supabase preservam a função caso precise restaurar
