-- Fix: process_xlsx_upload - Tratar registros com orcamento NULL
-- Data: 2025-11-03
-- Problema: ON CONFLICT falhava quando orcamento era NULL porque UNIQUE constraints não lidam bem com NULL
-- Solução: Adicionar validação para ignorar registros sem orcamento antes do INSERT

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
    orcamento_val text;
BEGIN
    FOR rec IN SELECT * FROM jsonb_array_elements(records_arg)
    LOOP
        -- Pegar o valor do orcamento
        orcamento_val := rec->>'orcamento';
        
        -- Ignorar registros sem orcamento (NULL ou vazio)
        -- UNIQUE constraints não funcionam com NULL, causando erro no ON CONFLICT
        IF orcamento_val IS NULL OR orcamento_val = '' THEN
            ignored_count := ignored_count + 1;
            CONTINUE;
        END IF;
        
        INSERT INTO public.processed_data (
            unidade_code, orcamento, "DATA", "HORARIO", "VALOR", "SERVIÇO", "TIPO", "PERÍODO",
            "MOMENTO", "CLIENTE", "PROFISSIONAL", "ENDEREÇO", "DIA", "REPASSE", whatscliente, "CUPOM",
            "ORIGEM", "ATENDIMENTO_ID", "IS_DIVISAO", "CADASTRO", "NÚMERO", unidade
        ) VALUES (
            unit_code_arg, orcamento_val, (rec->>'DATA')::date, rec->>'HORARIO', (rec->>'VALOR')::numeric,
            rec->>'SERVIÇO', rec->>'TIPO', rec->>'PERÍODO', rec->>'MOMENTO', rec->>'CLIENTE', rec->>'PROFISSIONAL',
            rec->>'ENDEREÇO', rec->>'DIA', (rec->>'REPASSE')::numeric, rec->>'whatscliente', rec->>'CUPOM',
            rec->>'ORIGEM', rec->>'ATENDIMENTO_ID', rec->>'IS_DIVISAO', (rec->>'CADASTRO')::date,
            rec->>'NÚMERO', rec->>'unidade'
        )
        ON CONFLICT (unidade_code, orcamento) DO UPDATE SET
            "DATA" = EXCLUDED."DATA",
            "VALOR" = EXCLUDED."VALOR",
            "CLIENTE" = EXCLUDED."CLIENTE",
            "PROFISSIONAL" = EXCLUDED."PROFISSIONAL",
            "REPASSE" = EXCLUDED."REPASSE",
            "SERVIÇO" = EXCLUDED."SERVIÇO",
            "TIPO" = EXCLUDED."TIPO",
            "MOMENTO" = EXCLUDED."MOMENTO",
            "PERÍODO" = EXCLUDED."PERÍODO"
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

-- Resultado esperado:
-- ✅ Registros com orcamento válido: inseridos ou atualizados
-- ⚠️ Registros sem orcamento (NULL ou ''): ignorados e contabilizados
-- ✅ Não gera mais erro "no unique or exclusion constraint matching the ON CONFLICT specification"
