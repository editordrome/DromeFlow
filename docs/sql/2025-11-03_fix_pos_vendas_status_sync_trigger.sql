-- ============================================================================
-- Script: Corrigir Trigger de Sincronização de Status pos_vendas
-- Data: 2025-11-03
-- Descrição: Atualizar o trigger para disparar em INSERT OR UPDATE, não apenas INSERT
--            Isso garante que mudanças no status de pos_vendas sejam refletidas
--            automaticamente na coluna "pos vendas" de processed_data
-- ============================================================================

-- PROBLEMA IDENTIFICADO:
-- O trigger trigger_sync_pos_vendas_status está configurado apenas para AFTER INSERT
-- mas deveria disparar também em UPDATE para sincronizar mudanças de status

-- SOLUÇÃO:
-- Recriar o trigger para disparar em AFTER INSERT OR UPDATE

-- ============================================================================
-- CORREÇÃO DO TRIGGER
-- ============================================================================

-- 1. Remover o trigger existente
DROP TRIGGER IF EXISTS trigger_sync_pos_vendas_status ON pos_vendas;

-- 2. Recriar o trigger com INSERT OR UPDATE
CREATE TRIGGER trigger_sync_pos_vendas_status
  AFTER INSERT OR UPDATE ON pos_vendas
  FOR EACH ROW
  EXECUTE FUNCTION sync_pos_vendas_status();

-- ============================================================================
-- VERIFICAÇÃO
-- ============================================================================

-- Listar o trigger recriado
SELECT 
    t.tgname AS trigger_name,
    p.proname AS function_name,
    CASE 
        WHEN t.tgtype::integer & 2 = 2 THEN 'BEFORE'
        ELSE 'AFTER'
    END AS timing,
    CASE 
        WHEN t.tgtype::integer & 4 = 4 THEN 'INSERT'
        WHEN t.tgtype::integer & 8 = 8 THEN 'DELETE'  
        WHEN t.tgtype::integer & 16 = 16 THEN 'UPDATE'
        WHEN t.tgtype::integer & 20 = 20 THEN 'INSERT OR UPDATE'
    END AS event,
    t.tgenabled AS enabled
FROM pg_trigger t
JOIN pg_proc p ON p.oid = t.tgfoid
JOIN pg_class c ON c.oid = t.tgrelid
WHERE c.relname = 'pos_vendas'
  AND p.proname = 'sync_pos_vendas_status';

-- Resultado esperado:
-- trigger_name: trigger_sync_pos_vendas_status
-- timing: AFTER
-- event: INSERT OR UPDATE
-- enabled: O (origin = ativo)

-- ============================================================================
-- TESTE DE FUNCIONAMENTO
-- ============================================================================

-- Para testar manualmente (NÃO executar neste script):
-- 
-- 1. Atualizar um status em pos_vendas:
-- UPDATE pos_vendas 
-- SET status = 'contatado' 
-- WHERE "ATENDIMENTO_ID" = 'ALGUM_ID';
--
-- 2. Verificar se processado_data foi atualizado:
-- SELECT "ATENDIMENTO_ID", "pos vendas" 
-- FROM processed_data 
-- WHERE "ATENDIMENTO_ID" = 'ALGUM_ID';
--
-- O campo "pos vendas" deve mostrar 'contatado'

-- ============================================================================
-- OBSERVAÇÕES
-- ============================================================================

-- ✅ Sincronização bidirecional completa:
--    - processed_data (INSERT) → pos_vendas (via trigger_sync_processed_to_pos_vendas)
--    - pos_vendas (INSERT/UPDATE) → processed_data (via trigger_sync_pos_vendas_status)
--
-- ✅ Mudanças de status em pos_vendas agora refletem automaticamente em processed_data
-- ✅ A função sync_pos_vendas_status() já estava preparada para UPDATE, apenas o trigger estava incompleto
