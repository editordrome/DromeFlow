#!/bin/bash

# Script para sincronizar clientes e depois pagamentos do Asaas
echo "🔄 Sincronização Completa: Clientes + Pagamentos"
echo "================================================"
echo ""

# Obter chave anon do .env.local
SUPABASE_ANON_KEY=$(grep VITE_SUPABASE_ANON_KEY .env.local | cut -d '=' -f2 | tr -d '"' | tr -d "'")

if [ -z "$SUPABASE_ANON_KEY" ]; then
    echo "❌ Erro: VITE_SUPABASE_ANON_KEY não encontrada em .env.local"
    exit 1
fi

UNIT_ID="6b9769ab-9088-469b-b31a-d174ed766682"
BASE_URL="https://uframhbsgtxckdxttofo.supabase.co/functions/v1"

# Passo 1: Sincronizar Clientes
echo "📋 Passo 1: Sincronizando clientes do Asaas..."
CUSTOMER_RESPONSE=$(curl -s -X POST \
  "$BASE_URL/sync-asaas-customers" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -d "{\"unit_id\": \"$UNIT_ID\"}")

echo "$CUSTOMER_RESPONSE" | jq '.' 2>/dev/null || echo "$CUSTOMER_RESPONSE"
echo ""

# Verificar se teve sucesso
CUSTOMER_SUCCESS=$(echo "$CUSTOMER_RESPONSE" | jq -r '.success' 2>/dev/null)
if [ "$CUSTOMER_SUCCESS" != "true" ]; then
    echo "❌ Erro ao sincronizar clientes. Abortando..."
    exit 1
fi

echo "✅ Clientes sincronizados!"
echo ""

# Aguardar um pouco
sleep 2

# Passo 2: Sincronizar Pagamentos
echo "💰 Passo 2: Sincronizando pagamentos do Asaas..."
PAYMENT_RESPONSE=$(curl -s -X POST \
  "$BASE_URL/sync-asaas-payments" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -d "{\"unit_id\": \"$UNIT_ID\"}")

echo "$PAYMENT_RESPONSE" | jq '.' 2>/dev/null || echo "$PAYMENT_RESPONSE"
echo ""

# Verificar se teve sucesso
PAYMENT_SUCCESS=$(echo "$PAYMENT_RESPONSE" | jq -r '.success' 2>/dev/null)
if [ "$PAYMENT_SUCCESS" != "true" ]; then
    echo "❌ Erro ao sincronizar pagamentos"
    exit 1
fi

echo "✅ Pagamentos sincronizados!"
echo ""
echo "================================================"
echo "🎉 Sincronização completa!"
