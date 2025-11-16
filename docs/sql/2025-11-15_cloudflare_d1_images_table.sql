-- =====================================================
-- Cloudflare D1 - Tabela de Imagens
-- Data: 2025-11-15
-- Descrição: Armazena metadados de imagens hospedadas no R2
-- =====================================================

-- ATENÇÃO: Execute este SQL no Console do Cloudflare D1
-- Dashboard: https://dash.cloudflare.com → Workers & Pages → D1

-- Tabela de imagens
CREATE TABLE IF NOT EXISTS images (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  
  -- Storage
  bucket_name TEXT NOT NULL DEFAULT 'dromeflow-files',
  
  -- Tipo e categorização
  image_type TEXT NOT NULL CHECK (image_type IN ('profile', 'logo', 'banner', 'comercial', 'recrutadora', 'other')),
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  
  -- Dimensões
  width INTEGER,
  height INTEGER,
  
  -- URLs
  public_url TEXT NOT NULL,
  thumbnail_url TEXT,
  
  -- Relacionamentos
  unit_id TEXT,
  uploaded_by TEXT,
  
  -- Uso e referência
  usage_context TEXT,
  reference_id TEXT,
  
  -- Timestamps (ISO 8601 format)
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_images_storage_key ON images(storage_key);
CREATE INDEX IF NOT EXISTS idx_images_unit_id ON images(unit_id);
CREATE INDEX IF NOT EXISTS idx_images_image_type ON images(image_type);
CREATE INDEX IF NOT EXISTS idx_images_usage_context ON images(usage_context);
CREATE INDEX IF NOT EXISTS idx_images_created_at ON images(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_images_deleted_at ON images(deleted_at);
CREATE INDEX IF NOT EXISTS idx_images_reference_id ON images(reference_id);

-- =====================================================
-- Queries de Exemplo
-- =====================================================

-- Listar todas as imagens ativas
-- SELECT * FROM images WHERE deleted_at IS NULL ORDER BY created_at DESC;

-- Contar imagens por tipo
-- SELECT image_type, COUNT(*) as count FROM images WHERE deleted_at IS NULL GROUP BY image_type;

-- Buscar imagens de uma unidade específica
-- SELECT * FROM images WHERE unit_id = 'UUID_AQUI' AND deleted_at IS NULL;

-- Buscar imagens do tipo comercial
-- SELECT * FROM images WHERE image_type = 'comercial' AND deleted_at IS NULL;

-- Calcular tamanho total de armazenamento
-- SELECT SUM(file_size) / 1024.0 / 1024.0 as total_mb FROM images WHERE deleted_at IS NULL;

-- =====================================================
-- Notas
-- =====================================================

-- 1. Este é um banco SQLite (não PostgreSQL)
-- 2. Não há suporte para UUID type, usar TEXT
-- 3. Timestamps são TEXT no formato ISO 8601
-- 4. Soft delete via deleted_at (não deleta fisicamente)
-- 5. Limites do plano free:
--    - 5 GB de storage
--    - 5 milhões de leituras/dia
--    - 100 mil escritas/dia
