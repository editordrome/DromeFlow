-- =====================================================
-- Credenciais: Cloudflare R2
-- Data: 2025-11-15
-- Descrição: Armazenar credenciais R2 no access_credentials
-- =====================================================
-- EXECUTAR NO PROJETO: DromeFlow (uframhbsgtxckdxttofo)
-- =====================================================

-- Inserir credenciais Cloudflare R2
INSERT INTO public.access_credentials (
  service_name,
  credential_type,
  credentials,
  metadata,
  is_active,
  created_by
) VALUES (
  'cloudflare_r2',
  'storage',
  jsonb_build_object(
    'account_id', '624e5c7de1b1fab5c5800582597443ea',
    'api_token', '1l1lIjsay-IdZzT7d95eaDZeE5ypRz--eCTCGIMR',
    'bucket_name', 'dromeflow-files',
    'endpoint', 'https://624e5c7de1b1fab5c5800582597443ea.r2.cloudflarestorage.com',
    'public_endpoint', 'https://dromeflow-files.624e5c7de1b1fab5c5800582597443ea.r2.cloudflarestorage.com'
  ),
  jsonb_build_object(
    'provider', 'cloudflare',
    'region', 'auto',
    'free_tier_limit_gb', 10,
    'description', 'Cloudflare R2 Storage para arquivos XLSX, backups e exports'
  ),
  true,
  (SELECT id FROM profiles WHERE role = 'super_admin' LIMIT 1)
)
ON CONFLICT (service_name) 
DO UPDATE SET
  credentials = EXCLUDED.credentials,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

-- Verificar inserção
SELECT 
  id,
  service_name,
  credential_type,
  credentials->>'bucket_name' as bucket,
  is_active,
  created_at
FROM public.access_credentials
WHERE service_name = 'cloudflare_r2';
