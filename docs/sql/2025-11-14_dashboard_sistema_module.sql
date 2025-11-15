-- Módulo: Dashboard Sistema
-- Data: 2025-11-14
-- Descrição: Módulo de gestão exclusivo para super_admin com monitoramento de workflows N8N e métricas do sistema

-- Inserir módulo Dashboard Sistema
INSERT INTO modules (
  code,
  name,
  description,
  icon_name,
  webhook_url,
  view_id,
  allowed_profiles,
  position,
  is_active,
  created_at,
  updated_at
) VALUES (
  'dashboard-sistema',
  'Dashboard Sistema',
  'Monitoramento de workflows N8N, logs de erro e métricas do sistema. Acesso exclusivo para Super Administradores.',
  'settings',
  NULL, -- Não usa webhook
  'dashboard_admin', -- view_id existente
  ARRAY['super_admin']::text[], -- APENAS super_admin
  999, -- Posição alta para aparecer no final
  true,
  NOW(),
  NOW()
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon_name = EXCLUDED.icon_name,
  view_id = EXCLUDED.view_id,
  allowed_profiles = EXCLUDED.allowed_profiles,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- Verificar inserção
SELECT 
  id,
  code,
  name,
  icon_name,
  view_id,
  allowed_profiles,
  is_active
FROM modules
WHERE code = 'dashboard-sistema';
