-- Fix: process_xlsx_upload - Preservar STATUS existente durante upload
-- Data: 2025-11-06
-- Problema: Upload sobrescreve STATUS de registros existentes (Confirmado -> PENDENTE)
-- Solução: Remover STATUS do ON CONFLICT DO UPDATE SET para preservar valor existente

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
            -- STATUS: Atualiza apenas se PROFISSIONAL mudou, senão preserva
            "STATUS" = CASE 
                WHEN processed_data."PROFISSIONAL" IS DISTINCT FROM EXCLUDED."PROFISSIONAL" 
                THEN EXCLUDED."STATUS"
                ELSE processed_data."STATUS"
            END
        RETURNING (CASE xmax WHEN 0 THEN 1 ELSE 2 END) INTO result_code;

        IF result_code = 1 THEN 
            inserted_count := inserted_count + 1;
        ELSIF result_code = 2 THEN 
            updated_count := updated_count + 1;
        ELSE 
            ignored_count := ignored_count + 1;
        END IF;
    END LOOP;
    
    RETURN json_build_object(
        'total', jsonb_array_length(records_arg),
        'inserted', inserted_count,
        'updated', updated_count,
        'ignored', ignored_count
    );
END;
$function$;

-- ============================================================================
-- VERIFICAÇÕES
-- ============================================================================

-- 1. Testar com registro existente que tem STATUS = 'Confirmado'
-- Após upload com mesmo ATENDIMENTO_ID, STATUS deve permanecer 'Confirmado'

-- 2. Registros novos (INSERT) receberão STATUS do arquivo
-- Registros existentes (UPDATE) manterão STATUS do banco

-- ============================================================================
-- COMPORTAMENTO ESPERADO
-- ============================================================================

-- ✅ INSERT (registro novo):
--    STATUS vem do arquivo XLSX (pode ser NULL, 'PENDENTE', etc.)
--
-- ✅ UPDATE (registro existente):
--    STATUS é atualizado APENAS se PROFISSIONAL mudou
--    Exemplo 1: Banco tem 'CONFIRMADO' + PROFISSIONAL igual → STATUS permanece 'CONFIRMADO'
--    Exemplo 2: Banco tem 'CONFIRMADO' + PROFISSIONAL diferente → STATUS atualiza para valor do arquivo
--
-- ✅ Campos sempre atualizados no UPDATE:
--    DATA, HORARIO, VALOR, SERVIÇO, TIPO, PERÍODO, MOMENTO, CLIENTE,
--    PROFISSIONAL, ENDEREÇO, DIA, REPASSE, whatscliente, CUPOM, 
--    ORIGEM, IS_DIVISAO, CADASTRO, unidade
--
-- ✅ Campo condicional no UPDATE:
--    STATUS: preservado se PROFISSIONAL não mudou, atualizado se PROFISSIONAL mudou
--
-- ✅ Campos sempre preservados no UPDATE:
--    id, created_at

