-- Adaptação das Funções do Banco para a nova estrutura de colunas snake_case
-- As chaves JSON provenientes do sistema legado (ex: NEW."CLIENTE" em triggers) 
-- agora devem ser NEW.cliente, pois o Supabase passará o NEW row com os novos nomes das colunas.

CREATE OR REPLACE FUNCTION public.auto_earn_loyalty_points()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_unit_id UUID;
  v_client_id UUID;
  v_plan_client RECORD;
  v_points_earned DECIMAL(10,2);
  v_multiplier DECIMAL(5,2);
BEGIN
  -- 1. Buscar unit_id pela unidade_code
  SELECT id INTO v_unit_id
  FROM units
  WHERE unit_code = NEW.unidade_code
  LIMIT 1;

  IF v_unit_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- 2. Buscar client_id pelo nome do cliente
  SELECT id INTO v_client_id
  FROM unit_clients
  WHERE unit_id = v_unit_id
    AND nome = NEW.cliente
  LIMIT 1;

  IF v_client_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- 3. Buscar planos ativos do cliente
  FOR v_plan_client IN
    SELECT lpc.id as plan_client_id, lpc.is_vip, lp.type, lp.reward_percentage,
           lp.points_per_real, lp.min_purchase_value, lp.vip_multiplier
    FROM loyalty_plan_clients lpc
    JOIN loyalty_plans lp ON lp.id = lpc.plan_id
    WHERE lpc.client_id = v_client_id
      AND lpc.is_active = true
      AND lp.is_active = true
      AND lp.unit_id = v_unit_id
      AND (lp.start_date IS NULL OR lp.start_date <= CURRENT_DATE)
      AND (lp.end_date IS NULL OR lp.end_date >= CURRENT_DATE)
      AND NEW.valor >= COALESCE(lp.min_purchase_value, 0)
  LOOP
    -- 4. Definir multiplicador VIP
    v_multiplier := CASE WHEN v_plan_client.is_vip THEN COALESCE(v_plan_client.vip_multiplier, 1) ELSE 1 END;

    -- 5. Calcular pontos/cashback baseado no tipo de plano
    IF v_plan_client.type = 'cashback' THEN
      v_points_earned := (NEW.valor * (COALESCE(v_plan_client.reward_percentage, 0) / 100)) * v_multiplier;
    ELSIF v_plan_client.type = 'points' THEN
      v_points_earned := (NEW.valor * COALESCE(v_plan_client.points_per_real, 0)) * v_multiplier;
    ELSE
      v_points_earned := 0;
    END IF;

    IF v_points_earned > 0 THEN
      -- 6. Criar transação
      INSERT INTO loyalty_transactions (
        plan_client_id,
        type,
        points,
        atendimento_id,
        purchase_value,
        description
      ) VALUES (
        v_plan_client.plan_client_id,
        'earn',
        v_points_earned,
        NEW.atendimento_id,
        NEW.valor,
        'Acúmulo automático de atendimento'
      );

      -- 7. Atualizar saldo e totais no loyalty_plan_clients
      UPDATE loyalty_plan_clients
      SET
        current_balance = current_balance + v_points_earned,
        total_earned = total_earned + v_points_earned,
        last_transaction_at = now(),
        updated_at = now()
      WHERE id = v_plan_client.plan_client_id;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.auto_remove_loyalty_points()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_tx RECORD;
BEGIN
  -- Percorrer transações de acúmulo ligadas a este atendimento
  FOR v_tx IN 
    SELECT id, plan_client_id, points 
    FROM loyalty_transactions 
    WHERE atendimento_id = OLD.atendimento_id AND type = 'earn'
  LOOP
    -- Subtrair do saldo (operação reversa de earn)
    UPDATE public.loyalty_plan_clients
    SET 
      current_balance = current_balance - v_tx.points,
      total_earned = total_earned - v_tx.points,
      updated_at = now()
    WHERE id = v_tx.plan_client_id;
    
    -- Remover a transação
    DELETE FROM loyalty_transactions WHERE id = v_tx.id;
  END LOOP;
  
  RETURN OLD;
END;
$function$;

CREATE OR REPLACE FUNCTION public.processed_data_before_insert_status()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_month_start date := date_trunc('month', current_date)::date;
  v_momento text := normalize_momento(NEW.momento);
  v_has_manha boolean := false;
  v_tarde_count int := 0;
BEGIN
  IF (NEW.status IS NULL OR btrim(NEW.status) = '') AND NEW.data >= v_month_start THEN
    NEW.status := 'PENDENTE';
  END IF;

  IF v_momento = 'TARDE' THEN
    SELECT exists (
      SELECT 1 FROM processed_data
       WHERE data = NEW.data
         AND profissional = NEW.profissional
         AND normalize_momento(momento) = 'MANHA'
    ) INTO v_has_manha;

    IF v_has_manha THEN
      SELECT count(*) FROM processed_data
       WHERE data = NEW.data
         AND profissional = NEW.profissional
         AND normalize_momento(momento) = 'TARDE'
      INTO v_tarde_count;

      IF v_tarde_count >= 1 THEN
        NEW.status := 'ESPERAR';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_processed_data_to_pos_vendas()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_unit_id uuid;
BEGIN
  -- 1. Ignora registros derivados (ATENDIMENTO_ID com sufixo _1, _2, _3...)
  IF NEW.atendimento_id ~ '_\d+$' THEN
    RETURN NEW;
  END IF;
  
  -- 2. Busca o unit_id correspondente
  SELECT id INTO v_unit_id
  FROM units
  WHERE unit_code = NEW.unidade_code
  LIMIT 1;
  
  IF v_unit_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- 3. Insere ou atualiza em pos_vendas (ID único é unit_id + ATENDIMENTO_ID)
  INSERT INTO public.pos_vendas (
    "ATENDIMENTO_ID",
    unit_id,
    nome,
    contato,
    data,
    status,
    tipo,
    profissional,
    created_at,
    updated_at
  )
  VALUES (
    NEW.atendimento_id,
    v_unit_id,
    NEW.cliente,
    NEW.whatscliente,
    NEW.data,
    COALESCE(NEW.pos_vendas, 'pendente')::text,
    COALESCE(NEW.tipo, 'Residencial'),
    NEW.profissional,
    NOW(),
    NOW()
  )
  ON CONFLICT (unit_id, "ATENDIMENTO_ID") 
  DO UPDATE SET
    nome = EXCLUDED.nome,
    contato = EXCLUDED.contato,
    data = EXCLUDED.data,
    tipo = EXCLUDED.tipo,
    profissional = EXCLUDED.profissional,
    updated_at = NOW();
  
  RETURN NEW;
END;
$function$;

-- A RPC process_xlsx_upload continua recebendo o JSON da UI com UPPERCASE (rec->>'DATA')
-- Mas insere nas colunas do banco que agora são snake_case.
CREATE OR REPLACE FUNCTION public.process_xlsx_upload(unit_code_arg text, records_arg jsonb)
 RETURNS jsonb
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
    SELECT id INTO unit_id_val
    FROM units
    WHERE unit_code = unit_code_arg
    LIMIT 1;
    
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

        SELECT contato INTO v_contato_cadastrado
        FROM public.unit_clients
        WHERE unit_id = unit_id_val
          AND lower(trim(nome)) = lower(trim(rec->>'CLIENTE'))
        LIMIT 1;
        
        INSERT INTO public.processed_data (
            unit_id, unidade_code, atendimento_id, data, horario, valor, servico, tipo, periodo,
            momento, cliente, profissional, endereco, dia, repasse, whatscliente, cupom,
            origem, is_divisao, cadastro, unidade, status
        )
        VALUES (
            unit_id_val, unit_code_arg, atendimento_id_val, (rec->>'DATA')::date, rec->>'HORARIO', 
            (rec->>'VALOR')::numeric, rec->>'SERVIÇO', rec->>'TIPO', rec->>'PERÍODO',
            rec->>'MOMENTO', rec->>'CLIENTE', rec->>'PROFISSIONAL', rec->>'ENDEREÇO', rec->>'DIA',
            (rec->>'REPASSE')::numeric, 
            COALESCE(v_contato_cadastrado, rec->>'whatscliente'),
            rec->>'CUPOM', rec->>'ORIGEM', rec->>'IS_DIVISAO', (rec->>'CADASTRO')::date, 
            rec->>'unidade', rec->>'STATUS'
        )
        ON CONFLICT ON CONSTRAINT processed_data_unidade_atend_id_unique DO UPDATE SET
            data = EXCLUDED.data,
            horario = EXCLUDED.horario,
            valor = EXCLUDED.valor,
            servico = EXCLUDED.servico,
            tipo = EXCLUDED.tipo,
            periodo = EXCLUDED.periodo,
            momento = EXCLUDED.momento,
            cliente = EXCLUDED.cliente,
            profissional = EXCLUDED.profissional,
            endereco = EXCLUDED.endereco,
            dia = EXCLUDED.dia,
            repasse = EXCLUDED.repasse,
            whatscliente = COALESCE(v_contato_cadastrado, EXCLUDED.whatscliente),
            cupom = EXCLUDED.cupom,
            origem = EXCLUDED.origem,
            is_divisao = EXCLUDED.is_divisao,
            cadastro = EXCLUDED.cadastro,
            unidade = EXCLUDED.unidade,
            status = CASE 
                WHEN processed_data.profissional IS DISTINCT FROM EXCLUDED.profissional 
                THEN EXCLUDED.status
                ELSE processed_data.status
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
