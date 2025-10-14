-- Subdomínios por unidade e rotas por módulo
-- Executar no schema public (ajuste se necessário)

BEGIN;

-- Unidades: slug único (kebab-case)
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS slug text;
UPDATE public.units
SET slug = lower(regexp_replace(unit_name, '[^a-z0-9]+', '-', 'g'))
WHERE slug IS NULL;
ALTER TABLE public.units ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS units_slug_key ON public.units(slug);

-- Módulos: code único para a rota (kebab-case)
-- Caso a constraint/índice ainda não exista, crie:
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'modules_code_key'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX modules_code_key ON public.modules(code)';
  END IF;
END $$;

COMMIT;
