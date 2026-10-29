-- Insert Plans module into modules table
-- Run this in Supabase SQL Editor AFTER creating the plans table

INSERT INTO modules (
  name,
  code,
  icon,
  view_id,
  is_active,
  allowed_profiles,
  position,
  description
) VALUES (
  'Planos',
  'planos',
  'CreditCard',
  'manage_plans',
  true,
  ARRAY['super_admin'],
  6,
  'Gerenciamento de planos de assinatura'
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  view_id = EXCLUDED.view_id,
  is_active = EXCLUDED.is_active,
  allowed_profiles = EXCLUDED.allowed_profiles,
  position = EXCLUDED.position,
  description = EXCLUDED.description;
