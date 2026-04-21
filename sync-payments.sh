#!/bin/bash

# Script para executar sincronização de pagamentos Asaas
echo "🔄 Sincronizando pagamentos do Asaas..."
echo ""

# Obter chave anon do .env.local
SUPABASE_ANON_KEY=$(grep VITE_SUPABASE_ANON_KEY .env.local | cut -d '=' -f2 | tr -d '"' | tr -d "'")

if [ -z "$SUPABASE_ANON_KEY" ]; then
    echo "❌ Erro: VITE_SUPABASE_ANON_KEY não encontrada em .env.local"
    exit 1
fi

# Executar sincronização
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  "https://uframhbsgtxckdxttofo.supabase.co/functions/v1/sync-asaas-payments" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -d '{"unit_id": "6b9769ab-9088-469b-b31a-d174ed766682"}')

# Separar corpo e status code
HTTP_BODY=$(echo "$RESPONSE" | sed '$d')
HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)

echo "📥 Resposta:"
echo "Status: $HTTP_CODE"
echo "$HTTP_BODY" | jq '.' 2>/dev/null || echo "$HTTP_BODY"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Sincronização concluída com sucesso!"
else
    echo "❌ Erro na sincronização (HTTP $HTTP_CODE)"
fi
