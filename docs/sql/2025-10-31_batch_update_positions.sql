-- Migration: Batch Update Positions RPC
-- Criado em: 2025-10-31
-- Objetivo: Otimizar atualizações de position em drag & drop (Kanban)
-- Reduz N requisições HTTP para 1 única chamada

-- ============================================================================
-- FUNÇÃO: batch_update_positions
-- ============================================================================
-- Atualiza múltiplos registros (position) em uma única transação
-- Parâmetros:
--   p_table_name: Nome da tabela ('recrutadora', 'comercial', 'comercial_columns', 'modules')
--   p_updates: Array JSON com [{id: uuid, position: int}, ...]
-- Exemplo:
--   SELECT batch_update_positions('recrutadora', '[
--     {"id": "123e4567-e89b-12d3-a456-426614174000", "position": 1},
--     {"id": "223e4567-e89b-12d3-a456-426614174000", "position": 2}
--   ]'::jsonb);
-- ============================================================================

CREATE OR REPLACE FUNCTION batch_update_positions(
  p_table_name text,
  p_updates jsonb
) RETURNS jsonb AS $$
DECLARE
  v_update jsonb;
  v_updated_count integer := 0;
  v_failed_count integer := 0;
  v_allowed_tables text[] := ARRAY['recrutadora', 'comercial', 'comercial_columns', 'modules'];
  v_has_updated_at boolean;
BEGIN
  -- Validação: apenas tabelas permitidas
  IF NOT (p_table_name = ANY(v_allowed_tables)) THEN
    RAISE EXCEPTION 'Tabela não permitida: %. Permitidas: %', 
      p_table_name, array_to_string(v_allowed_tables, ', ');
  END IF;

  -- Validação: p_updates deve ser um array
  IF jsonb_typeof(p_updates) != 'array' THEN
    RAISE EXCEPTION 'p_updates deve ser um array JSON';
  END IF;

  -- Verifica se a tabela tem coluna updated_at (compatibilidade)
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = p_table_name 
      AND column_name = 'updated_at'
  ) INTO v_has_updated_at;

  -- Loop pelos updates
  FOR v_update IN SELECT * FROM jsonb_array_elements(p_updates)
  LOOP
    BEGIN
      -- Validação: cada item deve ter id e position
      IF NOT (v_update ? 'id' AND v_update ? 'position') THEN
        RAISE EXCEPTION 'Cada update deve ter "id" e "position"';
      END IF;

      -- Executa o UPDATE de forma segura (identificador escapado, parâmetros parametrizados)
      -- Atualiza updated_at apenas se a coluna existir
      IF v_has_updated_at THEN
        EXECUTE format(
          'UPDATE %I SET position = $1, updated_at = NOW() WHERE id = $2',
          p_table_name
        ) USING 
          (v_update->>'position')::integer,
          (v_update->>'id')::uuid;
      ELSE
        EXECUTE format(
          'UPDATE %I SET position = $1 WHERE id = $2',
          p_table_name
        ) USING 
          (v_update->>'position')::integer,
          (v_update->>'id')::uuid;
      END IF;

      -- Incrementa contador de sucesso
      v_updated_count := v_updated_count + 1;

    EXCEPTION WHEN OTHERS THEN
      -- Se falhar em um item específico, registra mas continua
      v_failed_count := v_failed_count + 1;
      RAISE NOTICE 'Falha ao atualizar id %: %', v_update->>'id', SQLERRM;
    END;
  END LOOP;

  -- Retorna resumo da operação
  RETURN jsonb_build_object(
    'success', true,
    'updated_count', v_updated_count,
    'failed_count', v_failed_count,
    'total', jsonb_array_length(p_updates)
  );

EXCEPTION WHEN OTHERS THEN
  -- Se falhar a operação inteira, retorna erro
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'updated_count', v_updated_count,
    'failed_count', v_failed_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PERMISSÕES
-- ============================================================================
-- Permite que usuários autenticados executem a função
GRANT EXECUTE ON FUNCTION batch_update_positions(text, jsonb) TO authenticated;

-- ============================================================================
-- COMENTÁRIOS
-- ============================================================================
COMMENT ON FUNCTION batch_update_positions(text, jsonb) IS 
'Atualiza position de múltiplos registros em uma única transação. Uso: drag & drop otimizado.';

-- ============================================================================
-- TESTES (Executar manualmente no SQL Editor do Supabase)
-- ============================================================================
/*
-- Teste 1: Validação de tabela inválida
SELECT batch_update_positions('invalid_table', '[]'::jsonb);
-- Esperado: ERROR: Tabela não permitida

-- Teste 2: Validação de JSON inválido
SELECT batch_update_positions('modules', '{"id": "123"}'::jsonb);
-- Esperado: ERROR: p_updates deve ser um array JSON

-- Teste 3: Update real em modules
SELECT batch_update_positions('modules', '[
  {"id": "seu-uuid-aqui", "position": 1},
  {"id": "outro-uuid-aqui", "position": 2}
]'::jsonb);
-- Esperado: {"success": true, "updated_count": 2, "failed_count": 0, "total": 2}

-- Teste 4: Verificar se positions foram atualizadas
SELECT id, name, position FROM modules ORDER BY position;
*/
