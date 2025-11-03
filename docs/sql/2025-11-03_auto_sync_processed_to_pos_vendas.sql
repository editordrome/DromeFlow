-- ============================================================================
-- Trigger: Auto-sync de processed_data para pos_vendas
-- Data: 2025-11-03
-- Objetivo: Inserir automaticamente em pos_vendas quando inserir em processed_data
-- ============================================================================

-- Função que será executada pelo trigger
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
    NEW.whatscliente, -- Corrigido: campo correto é whatscliente, não CONTATO
    NEW."DATA",
    COALESCE(NEW."pos vendas", 'pendente')::text, -- Se "pos vendas" for NULL, usa 'pendente'
    NULL, -- nota inicial NULL
    FALSE, -- reagendou inicial FALSE
    NULL, -- feedback inicial NULL
    NOW(),
    NOW()
  )
  ON CONFLICT ("ATENDIMENTO_ID") DO NOTHING; -- Evita duplicatas
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop do trigger se já existir
DROP TRIGGER IF EXISTS trigger_sync_processed_to_pos_vendas ON processed_data;

-- Cria o trigger para INSERT em processed_data
CREATE TRIGGER trigger_sync_processed_to_pos_vendas
  AFTER INSERT ON processed_data
  FOR EACH ROW
  EXECUTE FUNCTION sync_processed_data_to_pos_vendas();

-- ============================================================================
-- Comentários:
-- - Este trigger sincroniza APENAS novos INSERTs (não UPDATEs)
-- - O trigger reverso (pos_vendas → processed_data) já existe para UPDATEs
-- - Usa ON CONFLICT DO NOTHING para evitar erros de duplicação
-- - Se unit_code não for encontrado, insere com unit_id NULL (aviso no log)
-- - Status inicial: pega de "pos vendas" ou usa 'pendente' como padrão
-- ============================================================================
