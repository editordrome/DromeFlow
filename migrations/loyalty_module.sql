-- ============================================================================
-- 1. LOYALTY PLANS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.loyalty_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL CHECK (type IN ('cashback', 'points')),

  -- Regras de acúmulo
  reward_percentage DECIMAL(5,2), -- % de cashback (ex: 5.00 = 5%)
  points_per_real DECIMAL(10,2), -- pontos por R$ gasto (ex: 1.00 = 1 ponto por real)
  min_purchase_value DECIMAL(10,2) DEFAULT 0, -- valor mínimo para acumular
  vip_multiplier DECIMAL(5,2) DEFAULT 1.00, -- multiplicador para clientes VIP
  validity_days INTEGER, -- validade dos pontos em dias

  -- Regras de resgate
  min_redemption_points INTEGER DEFAULT 0, -- mínimo de pontos para resgatar
  points_to_real_ratio DECIMAL(10,2), -- conversão pontos -> reais (ex: 100 pontos = R$ 10)

  -- Status e datas
  is_active BOOLEAN DEFAULT true,
  start_date DATE,
  end_date DATE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Assegurar que colunas novas existam se a tabela já existia
ALTER TABLE public.loyalty_plans ADD COLUMN IF NOT EXISTS vip_multiplier DECIMAL(5,2) DEFAULT 1.00;
ALTER TABLE public.loyalty_plans ADD COLUMN IF NOT EXISTS validity_days INTEGER;
ALTER TABLE public.loyalty_plans ADD COLUMN IF NOT EXISTS min_purchase_value DECIMAL(10,2) DEFAULT 0;

-- Índices para loyalty_plans
CREATE INDEX IF NOT EXISTS idx_loyalty_plans_unit ON loyalty_plans(unit_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_plans_active ON loyalty_plans(is_active) WHERE is_active = true;

-- ============================================================================
-- 2. LOYALTY PLAN CLIENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.loyalty_plan_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.loyalty_plans(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.unit_clients(id) ON DELETE CASCADE,

  -- Saldo atual
  current_balance DECIMAL(10,2) DEFAULT 0, -- pontos ou valor em cashback
  total_earned DECIMAL(10,2) DEFAULT 0, -- total acumulado histórico
  total_redeemed DECIMAL(10,2) DEFAULT 0, -- total resgatado histórico

  -- Status
  is_active BOOLEAN DEFAULT true,
  is_vip BOOLEAN DEFAULT false, -- status VIP do cliente
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_transaction_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  UNIQUE(plan_id, client_id)
);

-- Assegurar que colunas novas existam se a tabela já existia
ALTER TABLE public.loyalty_plan_clients ADD COLUMN IF NOT EXISTS is_vip BOOLEAN DEFAULT false;
ALTER TABLE public.loyalty_plan_clients ADD COLUMN IF NOT EXISTS validity_start_date DATE;
ALTER TABLE public.loyalty_plan_clients ADD COLUMN IF NOT EXISTS validity_end_date DATE;
ALTER TABLE public.loyalty_plan_clients ADD COLUMN IF NOT EXISTS current_balance DECIMAL(10,2) DEFAULT 0;
ALTER TABLE public.loyalty_plan_clients ADD COLUMN IF NOT EXISTS total_earned DECIMAL(10,2) DEFAULT 0;
ALTER TABLE public.loyalty_plan_clients ADD COLUMN IF NOT EXISTS total_redeemed DECIMAL(10,2) DEFAULT 0;

-- Índices para loyalty_plan_clients
CREATE INDEX IF NOT EXISTS idx_loyalty_plan_clients_plan ON loyalty_plan_clients(plan_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_plan_clients_client ON loyalty_plan_clients(client_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_plan_clients_active ON loyalty_plan_clients(is_active) WHERE is_active = true;

-- ============================================================================
-- 3. LOYALTY TRANSACTIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_client_id UUID NOT NULL REFERENCES public.loyalty_plan_clients(id) ON DELETE CASCADE,

  type VARCHAR(50) NOT NULL CHECK (type IN ('earn', 'redeem')),
  amount DECIMAL(10,2) NOT NULL, -- quantidade de pontos/valor

  -- Referência ao atendimento (se aplicável)
  atendimento_id VARCHAR(255),
  purchase_value DECIMAL(10,2), -- valor da compra que gerou os pontos

  -- Metadados
  description TEXT,
  metadata JSONB, -- dados adicionais flexíveis

  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID -- Referência opcional a auth.users
);

-- Índices para loyalty_transactions
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_plan_client ON loyalty_transactions(plan_client_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_type ON loyalty_transactions(type);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_atendimento ON loyalty_transactions(atendimento_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_created ON loyalty_transactions(created_at DESC);

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Habilitar RLS
ALTER TABLE loyalty_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_plan_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;

-- Policies permissivas para MVP (ajustar conforme necessário)
DROP POLICY IF EXISTS "Enable all for authenticated users" ON loyalty_plans;
CREATE POLICY "Enable all for authenticated users" ON loyalty_plans FOR ALL USING (true);

DROP POLICY IF EXISTS "Enable all for authenticated users" ON loyalty_plan_clients;
CREATE POLICY "Enable all for authenticated users" ON loyalty_plan_clients FOR ALL USING (true);

DROP POLICY IF EXISTS "Enable all for authenticated users" ON loyalty_transactions;
CREATE POLICY "Enable all for authenticated users" ON loyalty_transactions FOR ALL USING (true);

-- ============================================================================
-- 5. TRIGGER PARA ACÚMULO AUTOMÁTICO DE PONTOS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.auto_earn_loyalty_points()
RETURNS TRIGGER AS $$
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
    AND nome = NEW."CLIENTE"
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
      AND NEW.VALOR >= COALESCE(lp.min_purchase_value, 0)
  LOOP
    -- 4. Definir multiplicador VIP
    v_multiplier := CASE WHEN v_plan_client.is_vip THEN COALESCE(v_plan_client.vip_multiplier, 1) ELSE 1 END;

    -- 5. Calcular pontos/cashback baseado no tipo de plano
    IF v_plan_client.type = 'cashback' THEN
      v_points_earned := (NEW."VALOR" * (COALESCE(v_plan_client.reward_percentage, 0) / 100)) * v_multiplier;
    ELSIF v_plan_client.type = 'points' THEN
      v_points_earned := (NEW."VALOR" * COALESCE(v_plan_client.points_per_real, 0)) * v_multiplier;
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
        NEW."ATENDIMENTO_ID",
        NEW."VALOR",
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger (apenas se não existir)
DROP TRIGGER IF EXISTS trigger_auto_earn_loyalty_points ON processed_data;
CREATE TRIGGER trigger_auto_earn_loyalty_points
AFTER INSERT ON processed_data
FOR EACH ROW
EXECUTE FUNCTION auto_earn_loyalty_points();

-- ============================================================================
-- 6. FUNÇÃO PARA SINCRONIZAÇÃO RETROATIVA
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_loyalty_points(p_plan_client_id UUID)
RETURNS JSON AS $$
DECLARE
  v_joined_at TIMESTAMP WITH TIME ZONE;
  v_client_id UUID;
  v_unit_id UUID;
  v_unit_code VARCHAR;
  v_client_name VARCHAR;
  v_row RECORD;
  v_points_earned DECIMAL(10,2);
  v_multiplier DECIMAL(5,2);
  v_plan_client RECORD;
  v_sync_count INTEGER := 0;
  v_total_points DECIMAL(10,2) := 0;
BEGIN
  -- 1. Buscar dados básicos do vínculo
  SELECT joined_at, client_id, plan_id INTO v_joined_at, v_client_id, v_unit_id
  FROM loyalty_plan_clients
  WHERE id = p_plan_client_id;

  -- 2. Buscar nome do cliente e código da unidade
  SELECT nome, unit_id INTO v_client_name, v_unit_id FROM unit_clients WHERE id = v_client_id;
  SELECT unit_code INTO v_unit_code FROM units WHERE id = v_unit_id;

  -- 3. Buscar dados do plano
  SELECT lpc.is_vip, lp.type, lp.reward_percentage,
         lp.points_per_real, lp.min_purchase_value, lp.vip_multiplier, lp.id as plan_id
  INTO v_plan_client
  FROM loyalty_plan_clients lpc
  JOIN loyalty_plans lp ON lp.id = lpc.plan_id
  WHERE lpc.id = p_plan_client_id;

  -- 4. Loop pelos atendimentos existentes na processed_data
  FOR v_row IN
    SELECT "DATA", "VALOR", "ATENDIMENTO_ID"
    FROM public.processed_data
    WHERE unidade_code = v_unit_code
      AND "CLIENTE" = v_client_name
      AND "DATA" >= v_joined_at::DATE
      AND "VALOR" >= COALESCE(v_plan_client.min_purchase_value, 0)
      AND "ATENDIMENTO_ID" IS NOT NULL
  LOOP
    -- Verificar se já existe transação para este atendimento
    IF NOT EXISTS (
      SELECT 1 FROM loyalty_transactions
      WHERE plan_client_id = p_plan_client_id
        AND atendimento_id = v_row."ATENDIMENTO_ID"
        AND type = 'earn'
    ) THEN
      -- Definir multiplicador VIP
      v_multiplier := CASE WHEN v_plan_client.is_vip THEN COALESCE(v_plan_client.vip_multiplier, 1) ELSE 1 END;

      -- Calcular pontos/cashback
      IF v_plan_client.type = 'cashback' THEN
        v_points_earned := (v_row."VALOR" * (COALESCE(v_plan_client.reward_percentage, 0) / 100)) * v_multiplier;
      ELSIF v_plan_client.type = 'points' THEN
        v_points_earned := (v_row."VALOR" * COALESCE(v_plan_client.points_per_real, 0)) * v_multiplier;
      ELSE
        v_points_earned := 0;
      END IF;

      IF v_points_earned > 0 THEN
        -- Criar transação
        INSERT INTO loyalty_transactions (
          plan_client_id,
          type,
          points,
          atendimento_id,
          purchase_value,
          description
        ) VALUES (
          p_plan_client_id,
          'earn',
          v_points_earned,
          v_row."ATENDIMENTO_ID",
          v_row."VALOR",
          'Sincronização retroativa de atendimento'
        );

        v_sync_count := v_sync_count + 1;
        v_total_points := v_total_points + v_points_earned;
      END IF;
    END IF;
  END LOOP;

  -- 5. Atualizar saldo se houve novos pontos
  IF v_sync_count > 0 THEN
    UPDATE loyalty_plan_clients
    SET
      current_balance = current_balance + v_total_points,
      total_earned = total_earned + v_total_points,
      last_transaction_at = now()
    WHERE id = p_plan_client_id;
  END IF;

  RETURN json_build_object(
    'success', true,
    'synced_count', v_sync_count,
    'points_added', v_total_points
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função wrapper para o trigger automatizado
CREATE OR REPLACE FUNCTION public.trigger_sync_loyalty_points()
RETURNS TRIGGER AS $$
BEGIN
  -- Chama a função de sincronização para o cliente atual
  PERFORM public.sync_loyalty_points(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para disparar sincronização automática
DROP TRIGGER IF EXISTS trigger_auto_sync_loyalty_points ON loyalty_plan_clients;
CREATE TRIGGER trigger_auto_sync_loyalty_points
AFTER INSERT OR UPDATE OF joined_at ON loyalty_plan_clients
FOR EACH ROW
EXECUTE FUNCTION trigger_sync_loyalty_points();

-- ============================================================================
-- 6. COMENTÁRIOS PARA DOCUMENTAÇÃO
-- ============================================================================

COMMENT ON TABLE loyalty_plans IS 'Planos de fidelidade (cashback/pontos) por unidade';
COMMENT ON TABLE loyalty_plan_clients IS 'Relacionamento entre clientes e planos de fidelidade';
COMMENT ON TABLE loyalty_transactions IS 'Histórico de transações de pontos (acúmulo e resgate)';

COMMENT ON COLUMN loyalty_plans.type IS 'Tipo do plano: cashback (%) ou points (pontos fixos)';
COMMENT ON COLUMN loyalty_plans.reward_percentage IS 'Percentual de cashback (ex: 5.00 = 5%)';
COMMENT ON COLUMN loyalty_plans.points_per_real IS 'Pontos acumulados por R$ 1,00 gasto';
COMMENT ON COLUMN loyalty_plan_clients.current_balance IS 'Saldo atual de pontos/cashback do cliente';
COMMENT ON COLUMN loyalty_transactions.type IS 'Tipo de transação: earn (acúmulo) ou redeem (resgate)';

-- ============================================================================
-- FIM DA MIGRATION
-- ============================================================================
