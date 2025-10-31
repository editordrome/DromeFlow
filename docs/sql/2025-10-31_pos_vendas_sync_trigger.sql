-- Trigger para sincronizar status entre pos_vendas e processed_data
-- Quando o status em pos_vendas mudar, atualiza a coluna "pos vendas" em processed_data

-- Função que será executada pelo trigger
CREATE OR REPLACE FUNCTION sync_pos_vendas_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Atualiza o status em processed_data quando houver mudança em pos_vendas
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW."ATENDIMENTO_ID" IS NOT NULL THEN
    UPDATE processed_data
    SET "pos vendas" = NEW.status
    WHERE "ATENDIMENTO_ID" = NEW."ATENDIMENTO_ID";
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Remove trigger existente se houver
DROP TRIGGER IF EXISTS trigger_sync_pos_vendas_status ON pos_vendas;

-- Cria o trigger que dispara após INSERT ou UPDATE em pos_vendas
CREATE TRIGGER trigger_sync_pos_vendas_status
  AFTER INSERT OR UPDATE OF status
  ON pos_vendas
  FOR EACH ROW
  EXECUTE FUNCTION sync_pos_vendas_status();

-- Sincroniza dados existentes (atualiza processed_data com status atual de pos_vendas)
UPDATE processed_data pd
SET "pos vendas" = pv.status
FROM pos_vendas pv
WHERE pd."ATENDIMENTO_ID" = pv."ATENDIMENTO_ID"
  AND pv."ATENDIMENTO_ID" IS NOT NULL;

-- Verifica a sincronização
SELECT 
  pd."pos vendas" as status_processed,
  COUNT(*) as total
FROM processed_data pd
GROUP BY pd."pos vendas"
ORDER BY pd."pos vendas";
