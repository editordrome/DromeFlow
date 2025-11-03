-- ============================================================================
-- Fix: Correção do campo CONTATO no trigger auto_sync
-- Data: 2025-11-03
-- Problema: Trigger estava usando NEW."CONTATO" mas o campo correto é whatscliente
-- ============================================================================

-- Recria a função com o campo correto
CREATE OR REPLACE FUNCTION sync_processed_data_to_pos_vendas()
RETURNS TRIGGER AS $$
DECLARE
  v_unit_id uuid;
BEGIN
  -- Busca o unit_id correspondente ao unit_code da unidade
  SELECT id INTO v_unit_id
  FROM units
  WHERE unit_code = NEW.unidade_code
  LIMIT 1;
  
  -- Se não encontrar a unidade, usa NULL (ou pode lançar erro se preferir)
  IF v_unit_id IS NULL THEN
    RAISE WARNING 'Unidade não encontrada para unit_code: %', NEW.unidade_code;
  END IF;
  
  -- Insere em pos_vendas apenas se o ATENDIMENTO_ID ainda não existir
  INSERT INTO pos_vendas (
    "ATENDIMENTO_ID",
    unit_id,
    nome,
    contato,
    data,
    status,
    nota,
    reagendou,
    feedback,
    created_at,
    updated_at
  )
  VALUES (
    NEW."ATENDIMENTO_ID",
    v_unit_id,
    NEW."CLIENTE",
    NEW.whatscliente, -- CORRIGIDO: campo correto é whatscliente
    NEW."DATA",
    COALESCE(NEW."pos vendas", 'pendente')::text,
    NULL,
    FALSE,
    NULL,
    NOW(),
    NOW()
  )
  ON CONFLICT ("ATENDIMENTO_ID") DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- O trigger já existe, não precisa recriar
-- Basta atualizar a função acima
