-- Registrar módulo de Fidelidade no sistema
-- Execute este SQL no Supabase SQL Editor

INSERT INTO modules (code, name, icon, view_id, webhook_url, allowed_profiles, position, is_active)
VALUES (
  'loyalty',
  'Fidelidade',
  'Gift',
  'loyalty',
  NULL,
  ARRAY['admin', 'user']::text[],
  (SELECT COALESCE(MAX(position), 0) + 1 FROM modules),
  true
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  view_id = EXCLUDED.view_id,
  allowed_profiles = EXCLUDED.allowed_profiles,
  is_active = EXCLUDED.is_active
RETURNING *;
