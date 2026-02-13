-- Migração para permitir leads públicos no Comercial Admin
-- 1. Tornar unit_id opcional
ALTER TABLE public.comercial_admin ALTER COLUMN unit_id DROP NOT NULL;

-- 2. Permitir inserção pública (anon) sem login
-- Nota: Apenas inserção é permitida para anon. Select/Update continuam restritos ao super_admin pela política existente.
CREATE POLICY comercial_admin_insert_public ON public.comercial_admin
FOR INSERT
TO anon
WITH CHECK (true);

-- 3. Atualizar função de sincronização para ignorar registros sem unit_id
CREATE OR REPLACE FUNCTION public.comercial_admin_sync_unit_clients()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se não houver unidade associada, não podemos sincronizar com unit_clients (que exige unit_id)
  IF NEW.unit_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND COALESCE(OLD.status, '') = COALESCE(NEW.status, '') THEN
    RETURN NEW;
  END IF;

  IF NEW.status <> 'ganhos' THEN
    RETURN NEW;
  END IF;

  -- Insert into unit_clients
  INSERT INTO public.unit_clients (unit_id, nome, endereco, contato, tipo)
  VALUES (NEW.unit_id, NEW.nome, NEW.endereco, NEW.contato, 'B2B')
  ON CONFLICT (unit_id, LOWER(TRIM(nome))) DO UPDATE
    SET endereco = EXCLUDED.endereco,
        contato = EXCLUDED.contato,
        updated_at = NOW();

  RETURN NEW;
END;
$$;
