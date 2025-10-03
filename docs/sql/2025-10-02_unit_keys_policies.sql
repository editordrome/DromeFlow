-- RLS policies for unit_keys (permissive MVP)
alter table if exists public.unit_keys enable row level security;

-- SELECT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='unit_keys' AND policyname='unit_keys_read_all'
  ) THEN
    CREATE POLICY unit_keys_read_all ON public.unit_keys FOR SELECT USING (true);
  END IF;
END$$;

-- INSERT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='unit_keys' AND policyname='unit_keys_insert_all'
  ) THEN
    CREATE POLICY unit_keys_insert_all ON public.unit_keys FOR INSERT WITH CHECK (true);
  END IF;
END$$;

-- UPDATE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='unit_keys' AND policyname='unit_keys_update_all'
  ) THEN
    CREATE POLICY unit_keys_update_all ON public.unit_keys FOR UPDATE USING (true) WITH CHECK (true);
  END IF;
END$$;

-- DELETE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='unit_keys' AND policyname='unit_keys_delete_all'
  ) THEN
    CREATE POLICY unit_keys_delete_all ON public.unit_keys FOR DELETE USING (true);
  END IF;
END$$;
