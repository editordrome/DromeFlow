-- Fix Upload Configuration - Restauração da Configuração Original
-- Data: 2025-11-03
-- Objetivo: Remover alterações incorretas e restaurar configuração que funcionava

-- ============================================================================
-- PROBLEMA IDENTIFICADO
-- ============================================================================
-- Havia duas versões da função process_xlsx_upload no banco
-- Uma usando (unidade_code, orcamento) - ORIGINAL QUE FUNCIONAVA
-- Outra usando (unidade_code, ATENDIMENTO_ID, IS_DIVISAO) - CRIADA INCORRETAMENTE

-- ============================================================================
-- SOLUÇÃO APLICADA
-- ============================================================================

-- 1. Remover função incorreta (assinatura com jsonb[])
DROP FUNCTION IF EXISTS process_xlsx_upload(text, jsonb[]);

-- 2. Remover constraint duplicado
ALTER TABLE processed_data 
DROP CONSTRAINT IF EXISTS processed_data_orcamento_unidade_code_key;

-- 3. Remover constraint incorreto criado
ALTER TABLE processed_data 
DROP CONSTRAINT IF EXISTS unique_atendimento_per_unit;

-- ============================================================================
-- CONFIGURAÇÃO FINAL (CORRETA)
-- ============================================================================

-- Função RPC: process_xlsx_upload(unit_code_arg text, records_arg jsonb)
-- Constraint: UNIQUE (unidade_code, orcamento)
-- ON CONFLICT: (unidade_code, orcamento)

-- Mapeamento no UploadModal.tsx (CORRETO):
-- - Coluna "Número" do XLSX → campo "orcamento" (com sufixos _1, _2 para derivados)
-- - Coluna "Número" do XLSX → campo "ATENDIMENTO_ID" (sempre original, sem sufixos)
-- 
-- Exemplo:
-- Se XLSX tem Número = "12345" e 2 profissionais:
--   Registro 1: orcamento = "12345",   ATENDIMENTO_ID = "12345", IS_DIVISAO = "NAO"
--   Registro 2: orcamento = "12345_1", ATENDIMENTO_ID = "12345", IS_DIVISAO = "SIM"

-- ============================================================================
-- VERIFICAÇÃO
-- ============================================================================

-- Verificar que existe apenas uma versão da função
SELECT 
  p.proname,
  pg_get_function_arguments(p.oid) as args
FROM pg_proc p
WHERE p.proname = 'process_xlsx_upload';

-- Resultado esperado:
-- proname              | args
-- ---------------------|--------------------------------
-- process_xlsx_upload  | unit_code_arg text, records_arg jsonb

-- Verificar constraints UNIQUE
SELECT
    con.conname AS constraint_name,
    pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'processed_data'
  AND con.contype = 'u';

-- Resultado esperado:
-- constraint_name                           | constraint_definition
-- ------------------------------------------|--------------------------------
-- processed_data_unidade_code_orcamento_key | UNIQUE (unidade_code, orcamento)

-- ============================================================================
-- NOTAS IMPORTANTES
-- ============================================================================
-- 1. O campo "orcamento" é usado como chave única junto com "unidade_code"
-- 2. O campo "ATENDIMENTO_ID" é usado pelo trigger para criar registros em pos_vendas
-- 3. Registros derivados (IS_DIVISAO = 'SIM') têm orcamento com sufixo (_1, _2, etc)
-- 4. Todos os registros (originais e derivados) compartilham o mesmo ATENDIMENTO_ID
-- 5. A RPC ignora registros com orcamento NULL ou vazio automaticamente
