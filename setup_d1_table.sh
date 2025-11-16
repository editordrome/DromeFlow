#!/bin/bash
# Script para criar tabela no Cloudflare D1

ACCOUNT_ID="624e5c7de1b1fab5c5800582597443ea"
DATABASE_ID="476f8189-5d28-4041-9a2d-d6a46f65fe9b"
API_TOKEN="1l1lIjsay-IdZzT7d95eaDZeE5ypRz--eCTCGIMR"

SQL=$(cat << 'EOSQL'
CREATE TABLE IF NOT EXISTS images (
  id TEXT PRIMARY KEY,
  image_type TEXT NOT NULL CHECK(image_type IN ('profile', 'logo', 'banner', 'content', 'attachment', 'other')),
  filename TEXT NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  public_url TEXT NOT NULL,
  unit_id TEXT,
  uploaded_by TEXT NOT NULL,
  usage_context TEXT,
  reference_id TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_images_type ON images(image_type);
CREATE INDEX IF NOT EXISTS idx_images_unit ON images(unit_id);
CREATE INDEX IF NOT EXISTS idx_images_uploaded_by ON images(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_images_reference ON images(reference_id);
CREATE INDEX IF NOT EXISTS idx_images_active ON images(is_active, deleted_at);
CREATE INDEX IF NOT EXISTS idx_images_created ON images(created_at);
EOSQL
)

echo "Executando SQL no D1..."
echo "$SQL" | npx wrangler d1 execute dromeflow-images --command="$(cat)"
