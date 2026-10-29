-- =====================================================
-- Migração: Adiciona campo slug na tabela units
-- Data: 2025-11-15
-- Descrição: Suporte a subdomínios por unidade (ex: mb-joinville.dromeflow.com)
-- =====================================================

BEGIN;

-- ========================================
-- 1. ADICIONA COLUNA SLUG (se não existir)
-- ========================================
ALTER TABLE public.units 
ADD COLUMN IF NOT EXISTS slug text;

-- ========================================
-- 2. GERA SLUGS AUTOMATICAMENTE
-- ========================================
-- Converte unit_name para kebab-case
UPDATE public.units 
SET slug = lower(
  trim(both '-' from
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(unit_name, '[áàâãäÁÀÂÃÄ]', 'a', 'g'),
              '[éèêëÉÈÊË]', 'e', 'g'
            ),
            '[íìîïÍÌÎÏ]', 'i', 'g'
          ),
          '[óòôõöÓÒÔÕÖ]', 'o', 'g'
        ),
        '[úùûüÚÙÛÜ]', 'u', 'g'
      ),
      '[çÇ]', 'c', 'g'
    )
  )
)
WHERE slug IS NULL;

-- Remove caracteres especiais e múltiplos hífens
UPDATE public.units 
SET slug = regexp_replace(
  lower(slug), 
  '[^a-z0-9-]+', 
  '-', 
  'g'
);

UPDATE public.units 
SET slug = regexp_replace(slug, '-+', '-', 'g');

UPDATE public.units 
SET slug = trim(both '-' from slug);

-- ========================================
-- 3. VALIDAÇÕES ANTES DE CONSTRAINTS
-- ========================================

-- Valida se há slugs vazios/nulos (CRÍTICO)
DO $$
DECLARE
  empty_slugs INT;
BEGIN
  SELECT COUNT(*) INTO empty_slugs 
  FROM public.units 
  WHERE slug IS NULL OR trim(slug) = '';
  
  IF empty_slugs > 0 THEN
    RAISE EXCEPTION 'ERRO: % unidades têm slug vazio/nulo. Execute UPDATE manual primeiro.', empty_slugs;
  END IF;
END $$;

-- Valida se há slugs duplicados (CRÍTICO)
DO $$
DECLARE
  duplicate_slugs INT;
  duplicate_list TEXT;
BEGIN
  SELECT COUNT(*) INTO duplicate_slugs 
  FROM (
    SELECT slug, COUNT(*) 
    FROM public.units 
    GROUP BY slug 
    HAVING COUNT(*) > 1
  ) dups;
  
  IF duplicate_slugs > 0 THEN
    SELECT string_agg(slug, ', ') INTO duplicate_list
    FROM (
      SELECT slug 
      FROM public.units 
      GROUP BY slug 
      HAVING COUNT(*) > 1
    ) dups;
    
    RAISE EXCEPTION 'ERRO: % slugs duplicados encontrados: %. Renomeie manualmente antes de continuar.', duplicate_slugs, duplicate_list;
  END IF;
END $$;

-- ========================================
-- 4. TORNA OBRIGATÓRIO E ÚNICO (após validação)
-- ========================================

-- Torna slug obrigatório apenas se ainda não for
DO $$ 
BEGIN
  -- Verifica se coluna já é NOT NULL
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'units' 
      AND column_name = 'slug'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE public.units ALTER COLUMN slug SET NOT NULL;
    RAISE NOTICE 'Coluna slug definida como NOT NULL.';
  ELSE
    RAISE NOTICE 'Coluna slug já é NOT NULL, pulando.';
  END IF;
END $$;

-- Remove constraints antigas e adiciona única apenas se não existir
DO $$ 
BEGIN
  -- Remove constraint antiga "units_slug_key" se existir
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'units_slug_key'
  ) THEN
    ALTER TABLE public.units DROP CONSTRAINT units_slug_key;
    RAISE NOTICE 'Constraint antiga units_slug_key removida.';
  END IF;
  
  -- Adiciona constraint única apenas se não existir
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'units_slug_unique'
  ) THEN
    ALTER TABLE public.units ADD CONSTRAINT units_slug_unique UNIQUE (slug);
    RAISE NOTICE 'Constraint units_slug_unique criada com sucesso.';
  ELSE
    RAISE NOTICE 'Constraint units_slug_unique já existe, pulando.';
  END IF;
END $$;

-- ========================================
-- 5. CRIA ÍNDICE PARA PERFORMANCE
-- ========================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
      AND tablename = 'units' 
      AND indexname = 'idx_units_slug'
  ) THEN
    CREATE INDEX idx_units_slug ON public.units(slug);
    RAISE NOTICE 'Índice idx_units_slug criado com sucesso.';
  ELSE
    RAISE NOTICE 'Índice idx_units_slug já existe, pulando.';
  END IF;
END $$;

-- ========================================
-- 6. ADICIONA COMENTÁRIO
-- ========================================
COMMENT ON COLUMN public.units.slug IS 'Slug único para subdomínio (kebab-case, ex: mb-joinville)';

-- ========================================
-- 7. VALIDA CONSTRAINT UNIQUE NO MÓDULO CODE (SE A COLUNA EXISTIR)
-- ========================================

-- Adiciona coluna code se não existir
ALTER TABLE public.modules 
ADD COLUMN IF NOT EXISTS code text;

-- Popula code a partir do name (kebab-case) se estiver NULL
UPDATE public.modules 
SET code = lower(
  trim(both '-' from
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(name, '[áàâãäÁÀÂÃÄ]', 'a', 'g'),
              '[éèêëÉÈÊË]', 'e', 'g'
            ),
            '[íìîïÍÌÎÏ]', 'i', 'g'
          ),
          '[óòôõöÓÒÔÕÖ]', 'o', 'g'
        ),
        '[úùûüÚÙÛÜ]', 'u', 'g'
      ),
      '[çÇ]', 'c', 'g'
    )
  )
)
WHERE code IS NULL;

-- Remove caracteres especiais
UPDATE public.modules 
SET code = regexp_replace(
  lower(code), 
  '[^a-z0-9-]+', 
  '-', 
  'g'
);

UPDATE public.modules 
SET code = regexp_replace(code, '-+', '-', 'g');

UPDATE public.modules 
SET code = trim(both '-' from code);

-- Verifica se há codes duplicados antes de criar constraint
DO $$
DECLARE
  duplicate_codes INT;
  duplicate_list TEXT;
BEGIN
  SELECT COUNT(*) INTO duplicate_codes 
  FROM (
    SELECT code, COUNT(*) 
    FROM public.modules 
    WHERE code IS NOT NULL
    GROUP BY code 
    HAVING COUNT(*) > 1
  ) dups;
  
  IF duplicate_codes > 0 THEN
    SELECT string_agg(code, ', ') INTO duplicate_list
    FROM (
      SELECT code 
      FROM public.modules 
      WHERE code IS NOT NULL
      GROUP BY code 
      HAVING COUNT(*) > 1
    ) dups;
    
    RAISE WARNING 'ATENÇÃO: % códigos de módulo duplicados: %. Renomeie antes de criar constraint.', duplicate_codes, duplicate_list;
  END IF;
END $$;

-- Torna obrigatório apenas se ainda não for
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'modules' 
      AND column_name = 'code'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE public.modules ALTER COLUMN code SET NOT NULL;
    RAISE NOTICE 'Coluna code definida como NOT NULL.';
  ELSE
    RAISE NOTICE 'Coluna code já é NOT NULL, pulando.';
  END IF;
END $$;

-- Adiciona constraint apenas se não houver duplicatas
DO $$
BEGIN
  -- Verifica se constraint já existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'modules' 
      AND constraint_name = 'modules_code_unique'
  ) THEN
    -- Remove constraint antiga se tiver outro nome
    IF EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE schemaname = 'public' 
        AND indexname = 'modules_code_key'
    ) THEN
      DROP INDEX IF EXISTS public.modules_code_key;
    END IF;
    
    -- Verifica novamente se há duplicatas
    IF NOT EXISTS (
      SELECT 1 FROM public.modules 
      WHERE code IS NOT NULL
      GROUP BY code 
      HAVING COUNT(*) > 1
    ) THEN
      -- Adiciona constraint única
      ALTER TABLE public.modules 
      ADD CONSTRAINT modules_code_unique UNIQUE (code);
    ELSE
      RAISE WARNING 'CONSTRAINT modules_code_unique NÃO CRIADA devido a códigos duplicados. Corrija manualmente.';
    END IF;
  END IF;
END $$;

-- Índice para performance no code
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
      AND tablename = 'modules' 
      AND indexname = 'idx_modules_code'
  ) THEN
    CREATE INDEX idx_modules_code ON public.modules(code);
    RAISE NOTICE 'Índice idx_modules_code criado com sucesso.';
  ELSE
    RAISE NOTICE 'Índice idx_modules_code já existe, pulando.';
  END IF;
END $$;

COMMENT ON COLUMN public.modules.code IS 'Código único do módulo usado na URL path (kebab-case, ex: atendimentos)';

COMMIT;

-- ========================================
-- 8. VERIFICAÇÃO DOS RESULTADOS
-- ========================================

-- Lista todas as unidades com seus slugs gerados
SELECT 
  id, 
  unit_name, 
  unit_code,
  slug,
  'https://' || slug || '.dromeflow.com' as url_exemplo
FROM public.units 
ORDER BY unit_name;

-- Lista todos os módulos com seus codes
SELECT 
  id, 
  name, 
  code,
  view_id,
  is_active,
  'https://[unit-slug].dromeflow.com/' || code as url_exemplo
FROM public.modules 
WHERE is_active = true
ORDER BY position;

-- ========================================
-- 9. AJUSTES MANUAIS (se necessário)
-- ========================================

-- Exemplo: Se quiser personalizar algum slug específico
-- UPDATE public.units SET slug = 'mb-joinville' WHERE unit_code = 'MB';
-- UPDATE public.units SET slug = 'mb-blumenau' WHERE unit_code = 'MBBLUM';
-- UPDATE public.units SET slug = 'mb-drome' WHERE unit_name = 'Drome';

-- ========================================
-- FIM DA MIGRAÇÃO
-- ========================================
