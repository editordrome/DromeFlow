-- DESCRIÇÃO: Modifica a RPC process_xlsx_upload para priorizar o telefone cadastrado no diretório de clientes (unit_clients)
-- DATA: 2026-01-22
-- AUTOR: Antigravity AI

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
    v_contato_cadastrado text;
BEGIN
    -- Buscar unit_id baseado no unit_code_arg
    SELECT id INTO unit_id_val
    FROM units
    WHERE unit_code = unit_code_arg
    LIMIT 1;
    
    -- Se não encontrar a unidade, registrar erro e retornar
    IF unit_id_val IS NULL THEN
        RAISE WARNING 'Unidade não encontrada para unit_code: %', unit_code_arg;
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
        atendimento_id_val := rec->>'ATENDIMENTO_ID';
        
        IF atendimento_id_val IS NULL OR atendimento_id_val = '' THEN
            ignored_count := ignored_count + 1;
            CONTINUE;
        END IF;

        -- Tenta buscar o telefone já cadastrado para este cliente no diretório
        SELECT contato INTO v_contato_cadastrado
        FROM public.unit_clients
        WHERE unit_id = unit_id_val
          AND lower(trim(nome)) = lower(trim(rec->>'CLIENTE'))
         LIMIT 1;
        
        INSERT INTO public.processed_data (
            unit_id, unidade_code, "ATENDIMENTO_ID", "DATA", "HORARIO", "VALOR", "SERVIÇO", "TIPO", "PERÍODO",
            "MOMENTO", "CLIENTE", "PROFISSIONAL", "ENDEREÇO", "DIA", "REPASSE", whatscliente, "CUPOM",
            "ORIGEM", "IS_DIVISAO", "CADASTRO", unidade, "STATUS"
        )
        VALUES (
            unit_id_val, unit_code_arg, atendimento_id_val, (rec->>'DATA')::date, rec->>'HORARIO', 
            (rec->>'VALOR')::numeric, rec->>'SERVIÇO', rec->>'TIPO', rec->>'PERÍODO',
            rec->>'MOMENTO', rec->>'CLIENTE', rec->>'PROFISSIONAL', rec->>'ENDEREÇO', rec->>'DIA',
            (rec->>'REPASSE')::numeric, 
            COALESCE(v_contato_cadastrado, rec->>'whatscliente'), -- PRIORIZA CADASTRO
            rec->>'CUPOM', rec->>'ORIGEM', rec->>'IS_DIVISAO', (rec->>'CADASTRO')::date, 
            rec->>'unidade', rec->>'STATUS'
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
            whatscliente = COALESCE(v_contato_cadastrado, EXCLUDED.whatscliente), -- PRIORIZA CADASTRO
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
