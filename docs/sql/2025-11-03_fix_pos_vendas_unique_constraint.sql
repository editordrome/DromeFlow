-- ============================================================================
-- Fix: Adicionar constraint UNIQUE em pos_vendas.ATENDIMENTO_ID
-- Data: 2025-11-03
-- Problema: Trigger usa ON CONFLICT ("ATENDIMENTO_ID") mas constraint não existe
-- ============================================================================

-- PROBLEMA IDENTIFICADO:
-- O trigger sync_processed_data_to_pos_vendas usa:
--   ON CONFLICT ("ATENDIMENTO_ID") DO NOTHING
-- 
-- Mas a tabela pos_vendas NÃO tem constraint UNIQUE em ATENDIMENTO_ID
-- Isso causa erro: "there is no unique or exclusion constraint matching the ON CONFLICT"

-- ============================================================================
-- SOLUÇÃO: Adicionar constraint UNIQUE
-- ============================================================================

-- 1. Remover registros duplicados (se houver)
DELETE FROM pos_vendas a
USING pos_vendas b
WHERE a.id > b.id
  AND a."ATENDIMENTO_ID" = b."ATENDIMENTO_ID"
  AND a."ATENDIMENTO_ID" IS NOT NULL;

-- 2. Criar constraint UNIQUE em ATENDIMENTO_ID
ALTER TABLE pos_vendas
ADD CONSTRAINT pos_vendas_atendimento_id_unique 
UNIQUE ("ATENDIMENTO_ID");

-- ============================================================================
-- VERIFICAÇÃO
-- ============================================================================

-- Verificar que a constraint foi criada
SELECT
    con.conname AS constraint_name,
    pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'pos_vendas'
  AND con.contype = 'u';

-- Resultado esperado:
-- constraint_name                    | constraint_definition
-- -----------------------------------|--------------------------------
-- pos_vendas_atendimento_id_unique   | UNIQUE ("ATENDIMENTO_ID")

-- ============================================================================
-- TESTE DO TRIGGER
-- ============================================================================

-- Após aplicar a constraint, testar insert em processed_data
-- O trigger deve funcionar sem erro ao usar ON CONFLICT
