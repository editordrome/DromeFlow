-- Ajuste: Trigger pos_vendas - Ignorar registros derivados
-- Data: 2025-11-04
-- Objetivo: Evitar que registros com ATENDIMENTO_ID com sufixo (_1, _2...) criem entradas em pos_vendas

-- ============================================================================
-- CONTEXTO
-- ============================================================================
-- Com a mudança para usar ATENDIMENTO_ID como chave única (com sufixos para derivados),
-- o trigger deve ignorar registros derivados para evitar:
--   1. Tentar inserir múltiplas vezes o mesmo atendimento em pos_vendas
--   2. Criar entradas de pós-venda para registros que são apenas divisões de repasse
--
-- Exemplo:
--   ATENDIMENTO_ID = "12345"    → Insere em pos_vendas ✅
--   ATENDIMENTO_ID = "12345_1"  → Ignora (derivado) ❌
--   ATENDIMENTO_ID = "12345_2"  → Ignora (derivado) ❌

-- ============================================================================
-- SOLUÇÃO
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_processed_data_to_pos_vendas()
RETURNS TRIGGER AS $$
DECLARE
  v_unit_id uuid;
BEGIN
  -- Ignora registros derivados (ATENDIMENTO_ID com sufixo _1, _2, _3...)
  -- Verifica se o ATENDIMENTO_ID termina com _<número>
  IF NEW."ATENDIMENTO_ID" ~ '_\d+$' THEN
    RETURN NEW; -- Sai sem inserir em pos_vendas
  END IF;
  
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
    NEW.whatscliente,
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

-- ============================================================================
-- VERIFICAÇÃO
-- ============================================================================

-- Testar o padrão regex
SELECT 
  '12345' ~ '_\d+$' as original,      -- FALSE (insere)
  '12345_1' ~ '_\d+$' as derivado_1,  -- TRUE (ignora)
  '12345_2' ~ '_\d+$' as derivado_2,  -- TRUE (ignora)
  '12345_10' ~ '_\d+$' as derivado_10; -- TRUE (ignora)

-- Resultado esperado:
-- original | derivado_1 | derivado_2 | derivado_10
-- ---------|------------|------------|-------------
-- f        | t          | t          | t

-- ============================================================================
-- COMPORTAMENTO ESPERADO
-- ============================================================================

-- Inserir em processed_data:
--   ATENDIMENTO_ID = "12345", IS_DIVISAO = "NAO"
--   → Cria entrada em pos_vendas ✅
--
-- Inserir em processed_data:
--   ATENDIMENTO_ID = "12345_1", IS_DIVISAO = "SIM"
--   → Não cria entrada em pos_vendas (ignorado pelo trigger) ❌
--
-- Inserir em processed_data:
--   ATENDIMENTO_ID = "12345_2", IS_DIVISAO = "SIM"
--   → Não cria entrada em pos_vendas (ignorado pelo trigger) ❌

-- ============================================================================
-- NOTAS IMPORTANTES
-- ============================================================================

-- 1. O padrão regex '_\d+$' detecta sufixos numéricos no final do ATENDIMENTO_ID
--    Exemplos que batem: 12345_1, 12345_2, ABC123_10
--    Exemplos que não batem: 12345, ABC123, 12345_ABC
--
-- 2. Alternativamente, pode-se usar o campo IS_DIVISAO:
--    IF NEW."IS_DIVISAO" = 'SIM' THEN RETURN NEW; END IF;
--    (Ambas abordagens funcionam, mas regex é mais robusto)
--
-- 3. O trigger reverso (pos_vendas → processed_data) não precisa de ajuste
--    pois sempre atualiza pelo ATENDIMENTO_ID base (sem sufixo)
--
-- 4. Population scripts retroativos devem filtrar IS_DIVISAO = 'NAO'
--    para evitar criar entradas duplicadas

