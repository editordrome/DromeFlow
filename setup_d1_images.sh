#!/bin/bash

# Cloudflare Credentials
ACCOUNT_ID="624e5c7de1b1fab5c5800582597443ea"
DATABASE_ID="476f8189-5d28-4041-9a2d-d6a46f65fe9b"
API_TOKEN="RKqKMjbapBxZDMr6Mq84yhnrsev4qRrxf0MlEhB_"

API_URL="https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query"

echo "🔍 Verificando se tabela images existe..."

# Verificar se tabela existe
RESPONSE=$(curl -s -X POST "$API_URL" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sql":"SELECT name FROM sqlite_master WHERE type='"'"'table'"'"' AND name='"'"'images'"'"';"}')

echo "$RESPONSE" | jq .

if echo "$RESPONSE" | jq -e '.result[0].results[0]' > /dev/null 2>&1; then
  echo "✅ Tabela images já existe!"
else
  echo ""
  echo "📝 Criando tabela images..."
  
  CREATE_SQL='CREATE TABLE IF NOT EXISTS images (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    storage_key TEXT NOT NULL,
    bucket_name TEXT NOT NULL,
    image_type TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    width INTEGER,
    height INTEGER,
    public_url TEXT NOT NULL,
    thumbnail_url TEXT,
    unit_id TEXT,
    uploaded_by TEXT,
    usage_context TEXT,
    reference_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('"'"'now'"'"')),
    updated_at TEXT NOT NULL DEFAULT (datetime('"'"'now'"'"')),
    deleted_at TEXT
  );'
  
  CREATE_RESPONSE=$(curl -s -X POST "$API_URL" \
    -H "Authorization: Bearer $API_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"sql\":\"$CREATE_SQL\"}")
  
  echo "$CREATE_RESPONSE" | jq .
  
  if echo "$CREATE_RESPONSE" | jq -e '.success' | grep -q 'true'; then
    echo "✅ Tabela images criada com sucesso!"
    
    echo ""
    echo "📝 Criando índices..."
    
    # Índice por tipo de imagem
    curl -s -X POST "$API_URL" \
      -H "Authorization: Bearer $API_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"sql":"CREATE INDEX IF NOT EXISTS idx_images_type ON images(image_type);"}' | jq .
    
    # Índice por unidade
    curl -s -X POST "$API_URL" \
      -H "Authorization: Bearer $API_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"sql":"CREATE INDEX IF NOT EXISTS idx_images_unit ON images(unit_id);"}' | jq .
    
    # Índice por data de criação
    curl -s -X POST "$API_URL" \
      -H "Authorization: Bearer $API_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"sql":"CREATE INDEX IF NOT EXISTS idx_images_created ON images(created_at);"}' | jq .
    
    echo "✅ Índices criados com sucesso!"
  else
    echo "❌ Erro ao criar tabela!"
  fi
fi

echo ""
echo "🎉 Configuração do D1 concluída!"
