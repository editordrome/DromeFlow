-- =====================================================
-- Função: Popular tabela pos_vendas com dados de processed_data
-- Data: 2025-10-31
-- Descrição: Insere registros em pos_vendas para todos os atendimentos
--            da tabela processed_data que ainda não possuem registro.
--            Status inicial: 'pendente'
-- =====================================================

CREATE OR REPLACE FUNCTION populate_pos_vendas_from_processed_data()
RETURNS TABLE (
  total_inserted INTEGER,
  total_skipped INTEGER,
  total_processed INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inserted INTEGER := 0;
  v_skipped INTEGER := 0;
  v_processed INTEGER := 0;
BEGIN
  -- Inserir registros de processed_data que não existem em pos_vendas
  INSERT INTO pos_vendas (
    "ATENDIMENTO_ID",
    nome,
    contato,
    unit_id,
    data,
    status,
    reagendou
  )
  SELECT DISTINCT
    pd."ATENDIMENTO_ID",
    pd."CLIENTE" as nome,
    pd.whatscliente as contato,
    u.id as unit_id,
    pd."DATA"::timestamp with time zone as data,
    'pendente' as status,
    false as reagendou
  FROM processed_data pd
  LEFT JOIN units u ON u.unit_code = pd.unidade
  WHERE pd."ATENDIMENTO_ID" IS NOT NULL
    AND pd."ATENDIMENTO_ID" != ''
    AND NOT EXISTS (
      SELECT 1 
      FROM pos_vendas pv 
      WHERE pv."ATENDIMENTO_ID" = pd."ATENDIMENTO_ID"
    );
  
  -- Obter número de registros inseridos
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  
  -- Contar total de registros processados
  SELECT COUNT(DISTINCT pd."ATENDIMENTO_ID")
  INTO v_processed
  FROM processed_data pd
  WHERE pd."ATENDIMENTO_ID" IS NOT NULL
    AND pd."ATENDIMENTO_ID" != '';
  
  -- Calcular registros ignorados (já existiam)
  v_skipped := v_processed - v_inserted;
  
  -- Retornar estatísticas
  RETURN QUERY SELECT v_inserted, v_skipped, v_processed;
END;
$$;

COMMENT ON FUNCTION populate_pos_vendas_from_processed_data() IS 
'Popula a tabela pos_vendas com atendimentos da processed_data que ainda não possuem registro. Status inicial: pendente.';

-- =====================================================
-- Executar a função para popular os dados
-- =====================================================

SELECT * FROM populate_pos_vendas_from_processed_data();

-- =====================================================
-- Verificar resultado
-- =====================================================

SELECT 
  COUNT(*) as total_registros,
  COUNT(DISTINCT "ATENDIMENTO_ID") as atendimentos_unicos,
  status,
  COUNT(*) as count_por_status
FROM pos_vendas
GROUP BY status;
