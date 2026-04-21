-- Fix: process_xlsx_upload - Popula unit_id baseado em unidade_code
-- Data: 2026-01-21
-- Problema: Campo unit_id não está sendo populado durante upload XLSX
-- Solução: Buscar unit_id da tabela units baseado em unidade_code e inserir/atualizar

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
    unit_id_val uuid;
BEGIN
    -- Buscar unit_id baseado no unit_code_arg (CORRIGIDO: usar unit_code)
    SELECT id INTO unit_id_val
    FROM units
    WHERE unit_code = unit_code_arg
    LIMIT 1;
    
    -- Se não encontrar a unidade, registrar erro e retornar
    IF unit_id_val IS NULL THEN
        RAISE WARNING 'Unidade não encontrada para code: %', unit_code_arg;
        RETURN json_build_object(
            'total', jsonb_array_length(records_arg),
            'inserted', 0,
            'updated', 0,
            'ignored', jsonb_array_length(records_arg),
            'error', 'Unidade não encontrada'
        );
    END IF;
    
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
            unit_id, unidade_code, "ATENDIMENTO_ID", "DATA", "HORARIO", "VALOR", "SERVIÇO", "TIPO", "PERÍODO",
            "MOMENTO", "CLIENTE", "PROFISSIONAL", "ENDEREÇO", "DIA", "REPASSE", whatscliente, "CUPOM",
            "ORIGEM", "IS_DIVISAO", "CADASTRO", unidade, "STATUS"
        ) VALUES (
            unit_id_val, unit_code_arg, atendimento_id_val, (rec->>'DATA')::date, rec->>'HORARIO', (rec->>'VALOR')::numeric,
            rec->>'SERVIÇO', rec->>'TIPO', rec->>'PERÍODO', rec->>'MOMENTO', rec->>'CLIENTE', rec->>'profissional',
            rec->>'ENDEREÇO', rec->>'DIA', (rec->>'REPASSE')::numeric, rec->>'whatscliente', rec->>'CUPOM',
            rec->>'ORIGEM', rec->>'IS_DIVISAO', (rec->>'CADASTRO')::date, rec->>'unidade', rec->>'STATUS'
        )
        ON CONFLICT (unidade_code, "ATENDIMENTO_ID") DO UPDATE SET
            unit_id = EXCLUDED.unit_id,  -- NOVO: Atualiza unit_id
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
-- ATUALIZAR REGISTROS EXISTENTES SEM unit_id
-- ============================================================================

-- Atualiza registros existentes que não têm unit_id populado (CORRIGIDO: usar unit_code)
UPDATE processed_data pd
SET unit_id = u.id
FROM units u
WHERE pd.unidade_code = u.unit_code
  AND pd.unit_id IS NULL;

-- ============================================================================
-- VERIFICAÇÕES
-- ============================================================================

-- 1. Verificar se todos os registros agora têm unit_id
SELECT 
  COUNT(*) as total_records,
  COUNT(unit_id) as records_with_unit_id,
  COUNT(*) - COUNT(unit_id) as records_without_unit_id
FROM processed_data;

-- 2. Verificar registros sem unit_id (deve retornar 0)
SELECT 
  unidade_code,
  COUNT(*) as count
FROM processed_data
WHERE unit_id IS NULL
GROUP BY unidade_code
ORDER BY count DESC;

-- 3. Verificar se unit_id corresponde ao unidade_code
SELECT 
  pd.unidade_code,
  pd.unit_id,
  u.code as unit_code_from_units,
  u.name as unit_name,
  COUNT(*) as count
FROM processed_data pd
LEFT JOIN units u ON pd.unit_id = u.id
WHERE pd.unit_id IS NOT NULL
GROUP BY pd.unidade_code, pd.unit_id, u.code, u.name
ORDER BY pd.unidade_code;

-- ============================================================================
-- COMPORTAMENTO ESPERADO APÓS MIGRAÇÃO
-- ============================================================================

-- ✅ INSERT (registro novo):
--    unit_id é populado automaticamente baseado em unidade_code
--
-- ✅ UPDATE (registro existente):
--    unit_id é atualizado se mudou (normalmente não muda)
--
-- ✅ Registros existentes sem unit_id:
--    São atualizados pelo UPDATE acima
--
-- ✅ Validação:
--    Todos os registros devem ter unit_id correspondente ao unidade_code

-- ============================================================================
-- ROLLBACK (se necessário)
-- ============================================================================

-- Para reverter para a versão anterior (sem unit_id):
/*
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
        atendimento_id_val := rec->>'ATENDIMENTO_ID';
        
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
*/
