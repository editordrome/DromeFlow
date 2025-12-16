#!/bin/bash

# Script para sincronizar clientes do Asaas
echo "🔄 Sincronizando clientes do Asaas..."
echo ""

# Obter chave anon do .env.local
SUPABASE_ANON_KEY=$(grep VITE_SUPABASE_ANON_KEY .env.local | cut -d '=' -f2 | tr -d '"' | tr -d "'")

if [ -z "$SUPABASE_ANON_KEY" ]; then
    echo "❌ Erro: VITE_SUPABASE_ANON_KEY não encontrada em .env.local"
    exit 1
fi

UNIT_ID="6b9769ab-9088-469b-b31a-d174ed766682"
BASE_URL="https://uframhbsgtxckdxttofo.supabase.co/functions/v1"

RESPONSE=$(curl -s -X POST \
  "$BASE_URL/sync-asaas-customers" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -d "{\"unit_id\": \"$UNIT_ID\"}")

echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo ""
echo "✅ Sincronização de clientes concluída!"
