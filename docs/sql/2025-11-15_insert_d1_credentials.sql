-- =====================================================
-- Salvar credenciais do Cloudflare D1 no Supabase
-- Data: 2025-11-15
-- Descrição: Insere o Database ID do D1 no access_credentials
-- =====================================================

-- ATENÇÃO: Execute este SQL no Supabase após criar o database no Cloudflare D1
-- Substitua 'SEU_DATABASE_ID_AQUI' pelo ID real do seu database D1

-- Inserir Database ID do Cloudflare D1
INSERT INTO access_credentials (name, value, description)
VALUES (
  'cloudflare_d1_database_id',
  'SEU_DATABASE_ID_AQUI',
  'Cloudflare D1 Database ID para armazenar metadados de imagens'
)
ON CONFLICT (name) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = NOW();

-- Verificar se foi inserido corretamente
SELECT name, value, description, created_at
FROM access_credentials
WHERE name = 'cloudflare_d1_database_id';

-- =====================================================
-- NOTAS
-- =====================================================

-- Como obter o Database ID:
-- 1. Acesse: https://dash.cloudflare.com/624e5c7de1b1fab5c5800582597443ea/workers-and-pages/d1
-- 2. Clique no database "dromeflow-images" (ou crie se não existir)
-- 3. O Database ID está no topo da página (formato UUID)
-- 4. Copie e substitua 'SEU_DATABASE_ID_AQUI' acima
-- 5. Execute este SQL no Supabase

-- Verificar todas as credenciais Cloudflare:
-- SELECT name, value FROM access_credentials WHERE name LIKE 'cloudflare%';
