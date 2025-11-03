-- ============================================================================
-- Alteração: Coluna data em pos_vendas para tipo DATE
-- Data: 2025-11-03
-- Objetivo: Alinhar com processed_data.DATA (tipo DATE)
-- ============================================================================

-- Alterar coluna data de TIMESTAMP WITH TIME ZONE para DATE
ALTER TABLE pos_vendas
ALTER COLUMN data TYPE DATE USING data::DATE;

-- ============================================================================
-- Comentários:
-- - Antes: timestamp with time zone
-- - Depois: date
-- - USING data::DATE converte automaticamente os valores existentes
-- - Alinha com processed_data.DATA (tipo DATE)
-- - Remove informação de hora/timezone (mantém apenas a data)
-- - Trigger auto-sync já insere corretamente: NEW."DATA" → pos_vendas.data
-- ============================================================================
