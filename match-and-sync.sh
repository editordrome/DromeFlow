#!/bin/bash

# Script para vincular clientes existentes ao Asaas e sincronizar pagamentos
echo "🔗 Vinculação de Clientes + Sincronização de Pagamentos"
echo "========================================================"
echo ""

# Obter chave anon do .env.local
SUPABASE_ANON_KEY=$(grep VITE_SUPABASE_ANON_KEY .env.local | cut -d '=' -f2 | tr -d '"' | tr -d "'")

if [ -z "$SUPABASE_ANON_KEY" ]; then
    echo "❌ Erro: VITE_SUPABASE_ANON_KEY não encontrada em .env.local"
    exit 1
fi

UNIT_ID="6b9769ab-9088-469b-b31a-d174ed766682"
BASE_URL="https://uframhbsgtxckdxttofo.supabase.co/functions/v1"

# Passo 1: Vincular clientes existentes aos IDs Asaas
echo "🔗 Passo 1: Vinculando clientes existentes ao Asaas..."
MATCH_RESPONSE=$(curl -s -X POST \
  "$BASE_URL/match-asaas-customers" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -d "{\"unit_id\": \"$UNIT_ID\"}")

echo "$MATCH_RESPONSE" | jq '.' 2>/dev/null || echo "$MATCH_RESPONSE"
echo ""

# Verificar se teve sucesso
MATCH_SUCCESS=$(echo "$MATCH_RESPONSE" | jq -r '.success' 2>/dev/null)
if [ "$MATCH_SUCCESS" != "true" ]; then
    echo "❌ Erro ao vincular clientes. Abortando..."
    exit 1
fi

MATCHED=$(echo "$MATCH_RESPONSE" | jq -r '.matched' 2>/dev/null)
echo "✅ $MATCHED clientes vinculados!"
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

INSERTED=$(echo "$PAYMENT_RESPONSE" | jq -r '.inserted' 2>/dev/null)
UPDATED=$(echo "$PAYMENT_RESPONSE" | jq -r '.updated' 2>/dev/null)

echo "✅ Pagamentos: $INSERTED novos, $UPDATED atualizados"
echo ""
echo "========================================================"
echo "🎉 Sincronização completa!"
echo ""
echo "Agora acesse o dashboard Financeiro para ver os dados atualizados."
