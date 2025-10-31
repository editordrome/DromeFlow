-- =====================================================
-- Função: Atualizar unit_id em pos_vendas baseado em processed_data
-- Data: 2025-10-31
-- Descrição: Faz lookup do unit_code no processed_data e atualiza
--            o unit_id correspondente na tabela pos_vendas
-- =====================================================

CREATE OR REPLACE FUNCTION update_pos_vendas_unit_ids()
RETURNS TABLE (
  total_updated INTEGER,
  total_not_found INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated INTEGER := 0;
  v_not_found INTEGER := 0;
BEGIN
  -- Atualizar unit_id em pos_vendas baseado no processed_data
  UPDATE pos_vendas pv
  SET unit_id = lookup.unit_id
  FROM (
    SELECT DISTINCT 
      pd."ATENDIMENTO_ID",
      u.id as unit_id
    FROM processed_data pd
    INNER JOIN units u ON u.unit_code = pd.unidade_code
    WHERE pd."ATENDIMENTO_ID" IS NOT NULL
      AND pd."ATENDIMENTO_ID" != ''
      AND pd.unidade_code IS NOT NULL
  ) AS lookup
  WHERE pv."ATENDIMENTO_ID" = lookup."ATENDIMENTO_ID"
    AND pv.unit_id IS NULL;
  
  -- Obter número de registros atualizados
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  
  -- Contar registros que ainda não têm unit_id (não encontrados)
  SELECT COUNT(*)
  INTO v_not_found
  FROM pos_vendas
  WHERE unit_id IS NULL;
  
  -- Retornar estatísticas
  RETURN QUERY SELECT v_updated, v_not_found;
END;
$$;

COMMENT ON FUNCTION update_pos_vendas_unit_ids() IS 
'Atualiza o unit_id na tabela pos_vendas fazendo lookup do unit_code em processed_data via ATENDIMENTO_ID.';

-- =====================================================
-- Executar a função para atualizar os unit_ids
-- =====================================================

SELECT * FROM update_pos_vendas_unit_ids();

-- =====================================================
-- Verificar resultado
-- =====================================================

SELECT 
  COUNT(*) as total_registros,
  COUNT(unit_id) as com_unit_id,
  COUNT(*) - COUNT(unit_id) as sem_unit_id,
  COUNT(DISTINCT unit_id) as unidades_distintas
FROM pos_vendas;

-- Verificar distribuição por unidade
SELECT 
  u.unit_name,
  u.unit_code,
  COUNT(pv.id) as total_registros
FROM pos_vendas pv
LEFT JOIN units u ON u.id = pv.unit_id
GROUP BY u.unit_name, u.unit_code
ORDER BY total_registros DESC;
