-- ============================================================================
-- MIGRAÇÃO: Normalização da estrutura da tabela processed_data
-- Data: 2025-11-03
-- Descrição: 
--   1. Adiciona coluna unit_id (FK para units)
--   2. Remove colunas redundantes NÚMERO e orcamento
--   3. Usa ATENDIMENTO_ID como identificador único
--   4. Mantém unidade_code temporariamente para compatibilidade
-- ============================================================================

-- PASSO 1: Adicionar coluna unit_id (se não existir)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'processed_data' AND column_name = 'unit_id'
    ) THEN
        ALTER TABLE processed_data ADD COLUMN unit_id uuid;
        COMMENT ON COLUMN processed_data.unit_id IS 'Foreign key para units.id';
    END IF;
END $$;

-- PASSO 2: Preencher unit_id baseado no unidade_code existente
UPDATE processed_data pd
SET unit_id = u.id
FROM units u
WHERE pd.unidade_code = u.unit_code
AND pd.unit_id IS NULL;

-- PASSO 3: Verificar se há registros sem unit_id (dados órfãos)
DO $$
DECLARE
    orphan_count integer;
BEGIN
    SELECT COUNT(*) INTO orphan_count
    FROM processed_data
    WHERE unit_id IS NULL;
    
    IF orphan_count > 0 THEN
        RAISE WARNING 'Existem % registros sem unit_id correspondente. Verifique os dados antes de prosseguir.', orphan_count;
    END IF;
END $$;

-- PASSO 4: Remover constraint UNIQUE antigo (unidade_code, orcamento)
ALTER TABLE processed_data 
DROP CONSTRAINT IF EXISTS processed_data_unidade_code_orcamento_key;

-- PASSO 5: Criar novo constraint UNIQUE em (unit_id, ATENDIMENTO_ID, IS_DIVISAO)
-- Isso permite múltiplos profissionais no mesmo atendimento (registros derivados)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'processed_data_unit_atendimento_divisao_key'
    ) THEN
        ALTER TABLE processed_data 
        ADD CONSTRAINT processed_data_unit_atendimento_divisao_key 
        UNIQUE (unit_id, "ATENDIMENTO_ID", "IS_DIVISAO", "PROFISSIONAL");
    END IF;
END $$;

-- PASSO 6: Adicionar foreign key para units
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'processed_data_unit_id_fkey'
    ) THEN
        ALTER TABLE processed_data 
        ADD CONSTRAINT processed_data_unit_id_fkey 
        FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE;
    END IF;
END $$;

-- PASSO 7: Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_processed_data_unit_id 
ON processed_data(unit_id);

CREATE INDEX IF NOT EXISTS idx_processed_data_atendimento_id 
ON processed_data("ATENDIMENTO_ID");

CREATE INDEX IF NOT EXISTS idx_processed_data_unit_atendimento 
ON processed_data(unit_id, "ATENDIMENTO_ID");

-- PASSO 8: Remover colunas redundantes NÚMERO e orcamento
-- IMPORTANTE: Só execute depois de confirmar que todos os dados foram migrados
-- e que a aplicação foi atualizada para não usar mais essas colunas

-- ALTER TABLE processed_data DROP COLUMN IF EXISTS "NÚMERO";
-- ALTER TABLE processed_data DROP COLUMN IF EXISTS orcamento;

-- NOTA: Descomente as linhas acima após validar que:
-- 1. Todos os registros têm unit_id preenchido
-- 2. A aplicação foi atualizada para usar unit_id e ATENDIMENTO_ID
-- 3. Não há queries ou triggers usando NÚMERO ou orcamento

-- ============================================================================
-- VERIFICAÇÕES PÓS-MIGRAÇÃO
-- ============================================================================

-- Verificar registros sem unit_id
SELECT COUNT(*) as registros_sem_unit_id
FROM processed_data
WHERE unit_id IS NULL;

-- Verificar distribuição por unidade
SELECT 
    u.unit_name,
    u.unit_code,
    COUNT(pd.id) as total_registros
FROM units u
LEFT JOIN processed_data pd ON u.id = pd.unit_id
GROUP BY u.id, u.unit_name, u.unit_code
ORDER BY u.unit_name;

-- Verificar registros duplicados (se houver)
SELECT 
    unit_id,
    "ATENDIMENTO_ID",
    "IS_DIVISAO",
    "PROFISSIONAL",
    COUNT(*) as duplicados
FROM processed_data
WHERE "ATENDIMENTO_ID" IS NOT NULL
GROUP BY unit_id, "ATENDIMENTO_ID", "IS_DIVISAO", "PROFISSIONAL"
HAVING COUNT(*) > 1;
