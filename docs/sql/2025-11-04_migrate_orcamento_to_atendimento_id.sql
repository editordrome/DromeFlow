-- Migração: orcamento → ATENDIMENTO_ID como chave única
-- Data: 2025-11-04
-- Objetivo: Usar ATENDIMENTO_ID (com sufixos _1, _2...) como chave de identificação única

-- ============================================================================
-- CONTEXTO
-- ============================================================================
-- ANTES: 
--   - Campo "orcamento" era a chave única (com sufixos _1, _2 para derivados)
--   - ATENDIMENTO_ID era sempre o valor original (sem sufixos)
--   - Constraint: UNIQUE (unidade_code, orcamento)
--
-- DEPOIS:
--   - Campo "ATENDIMENTO_ID" é a chave única (com sufixos _1, _2 para derivados)
--   - Campo "orcamento" não é mais necessário (pode ser removido futuramente)
--   - Constraint: UNIQUE (unidade_code, ATENDIMENTO_ID)
--
-- EXEMPLO:
--   Arquivo XLSX tem Número = "12345" com 2 profissionais (Maria; João)
--   
--   Registro 1 (original):
--     ATENDIMENTO_ID = "12345"
--     IS_DIVISAO = "NAO"
--     VALOR = 100
--     REPASSE = 50
--   
--   Registro 2 (derivado):
--     ATENDIMENTO_ID = "12345_1"
--     IS_DIVISAO = "SIM"
--     VALOR = 0
--     REPASSE = 50

-- ============================================================================
-- PASSO 1: Remover constraint antigo (unidade_code, orcamento)
-- ============================================================================

ALTER TABLE processed_data 
DROP CONSTRAINT IF EXISTS processed_data_unidade_code_orcamento_key;

-- ============================================================================
-- PASSO 2: Criar novo constraint (unidade_code, ATENDIMENTO_ID)
-- ============================================================================

ALTER TABLE processed_data 
ADD CONSTRAINT processed_data_unidade_code_atendimento_id_key 
UNIQUE (unidade_code, "ATENDIMENTO_ID");

-- ============================================================================
-- PASSO 3: Atualizar função RPC process_xlsx_upload
-- ============================================================================

CREATE OR REPLACE FUNCTION public.process_xlsx_upload(unit_code_arg text, records_arg jsonb)
RETURNS json
LANGUAGE plpgsql
AS $function$
DECLARE
    rec jsonb; 
    inserted_count integer := 0; 
    updated_count integer := 0;
    ignored_count integer := 0; 
    result_code integer;
    atendimento_id_val text;
BEGIN
    FOR rec IN SELECT * FROM jsonb_array_elements(records_arg)
    LOOP
        -- Pegar o valor do ATENDIMENTO_ID
        atendimento_id_val := rec->>'ATENDIMENTO_ID';
        
        -- Ignorar registros sem ATENDIMENTO_ID (NULL ou vazio)
        -- UNIQUE constraints não funcionam com NULL, causando erro no ON CONFLICT
        IF atendimento_id_val IS NULL OR atendimento_id_val = '' THEN
            ignored_count := ignored_count + 1;
            CONTINUE;
        END IF;
        
        INSERT INTO public.processed_data (
            unidade_code, "ATENDIMENTO_ID", "DATA", "HORARIO", "VALOR", "SERVIÇO", "TIPO", "PERÍODO",
            "MOMENTO", "CLIENTE", "PROFISSIONAL", "ENDEREÇO", "DIA", "REPASSE", whatscliente, "CUPOM",
            "ORIGEM", "IS_DIVISAO", "CADASTRO", unidade, "STATUS"
        ) VALUES (
            unit_code_arg, atendimento_id_val, (rec->>'DATA')::date, rec->>'HORARIO', (rec->>'VALOR')::numeric,
            rec->>'SERVIÇO', rec->>'TIPO', rec->>'PERÍODO', rec->>'MOMENTO', rec->>'CLIENTE', rec->>'profissional',
            rec->>'ENDEREÇO', rec->>'DIA', (rec->>'REPASSE')::numeric, rec->>'whatscliente', rec->>'CUPOM',
            rec->>'ORIGEM', rec->>'IS_DIVISAO', (rec->>'CADASTRO')::date, rec->>'unidade', rec->>'STATUS'
        )
        ON CONFLICT (unidade_code, "ATENDIMENTO_ID") DO UPDATE SET
            "DATA" = EXCLUDED."DATA",
            "HORARIO" = EXCLUDED."HORARIO",
            "VALOR" = EXCLUDED."VALOR",
            "SERVIÇO" = EXCLUDED."SERVIÇO",
            "TIPO" = EXCLUDED."TIPO",
            "PERÍODO" = EXCLUDED."PERÍODO",
            "MOMENTO" = EXCLUDED."MOMENTO",
            "CLIENTE" = EXCLUDED."CLIENTE",
            "PROFISSIONAL" = EXCLUDED."PROFISSIONAL",
            "ENDEREÇO" = EXCLUDED."ENDEREÇO",
            "DIA" = EXCLUDED."DIA",
            "REPASSE" = EXCLUDED."REPASSE",
            whatscliente = EXCLUDED.whatscliente,
            "CUPOM" = EXCLUDED."CUPOM",
            "ORIGEM" = EXCLUDED."ORIGEM",
            "IS_DIVISAO" = EXCLUDED."IS_DIVISAO",
            "CADASTRO" = EXCLUDED."CADASTRO",
            unidade = EXCLUDED.unidade,
            "STATUS" = EXCLUDED."STATUS"
        RETURNING (CASE xmax WHEN 0 THEN 1 ELSE 2 END) INTO result_code;

-- ============================================================================
-- VERIFICAÇÕES
-- ============================================================================

-- 1. Verificar constraint novo
SELECT
    con.conname AS constraint_name,
    pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'processed_data'
  AND con.contype = 'u';

-- Resultado esperado:
-- constraint_name                                  | constraint_definition
-- -------------------------------------------------|------------------------------------
-- processed_data_unidade_code_atendimento_id_key  | UNIQUE (unidade_code, "ATENDIMENTO_ID")

-- 2. Verificar função RPC
SELECT 
  p.proname,
  pg_get_function_arguments(p.oid) as args
FROM pg_proc p
WHERE p.proname = 'process_xlsx_upload';

-- Resultado esperado:
-- proname              | args
-- ---------------------|--------------------------------
-- process_xlsx_upload  | unit_code_arg text, records_arg jsonb

-- ============================================================================
-- COMPORTAMENTO ESPERADO
-- ============================================================================

-- Upload com registros novos:
--   ✅ INSERT com ATENDIMENTO_ID único por unidade
--
-- Upload com ATENDIMENTO_ID existente:
--   ✅ UPDATE dos campos do registro
--
-- Upload com múltiplos profissionais:
--   ✅ Original: ATENDIMENTO_ID = "12345", IS_DIVISAO = "NAO"
--   ✅ Derivado 1: ATENDIMENTO_ID = "12345_1", IS_DIVISAO = "SIM"
--   ✅ Derivado 2: ATENDIMENTO_ID = "12345_2", IS_DIVISAO = "SIM"
--
-- Sincronização automática com pos_vendas:
--   ⚠️ Trigger precisa ser verificado - atualmente usa ATENDIMENTO_ID (sem sufixos)
--   💡 Registros derivados (com _1, _2) não devem criar entradas em pos_vendas
--
-- Remoção de obsoletos:
--   ✅ Extrai base do ATENDIMENTO_ID (remove _1, _2...)
--   ✅ Remove todos (original + derivados) se base não está no arquivo

-- ============================================================================
-- NOTAS IMPORTANTES
-- ============================================================================

-- 1. Campo "orcamento" ainda existe na tabela para compatibilidade
--    Pode ser removido em migração futura após validação completa
--
-- 2. Trigger pos_vendas deve ignorar registros com sufixo (_1, _2...)
--    Verificar/ajustar se necessário
--
-- 3. Registros derivados sempre têm VALOR = 0, mas mantêm REPASSE proporcional
--
-- 4. Contagem de serviços deve usar apenas IS_DIVISAO = 'NAO' (originais)
--
-- 5. Soma de repasse deve incluir TODOS os registros (originais + derivados)

