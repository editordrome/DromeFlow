#!/bin/bash

# Script de teste do webhook Asaas
# Este script simula um evento PAYMENT_RECEIVED do Asaas

echo "🧪 Testando webhook Asaas..."
echo ""

# Configurações
WEBHOOK_URL="https://uframhbsgtxckdxttofo.supabase.co/functions/v1/asaas-webhook?unit_id=6b9769ab-9088-469b-b31a-d174ed766682"
WEBHOOK_TOKEN="3ada3424-f5dd-4205-a779-5c8053e08b28"

# Pegar um ID de pagamento real do banco
PAYMENT_ID="pay_7zc3dghkl6x90waj"  # Substitua por um ID real se necessário

# Payload de teste (formato Asaas)
PAYLOAD='{
  "event": "PAYMENT_RECEIVED",
  "payment": {
    "id": "'$PAYMENT_ID'",
    "customer": "cus_000151862170",
    "value": 170.00,
    "netValue": 165.00,
    "dueDate": "2025-12-12",
    "paymentDate": "2025-12-15T21:57:00.000Z",
    "billingType": "PIX",
    "status": "RECEIVED"
  }
}'

echo "📤 Enviando evento de teste..."
echo "URL: $WEBHOOK_URL"
echo "Event: PAYMENT_RECEIVED"
echo ""

# Fazer requisição
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "asaas-access-token: $WEBHOOK_TOKEN" \
  -d "$PAYLOAD")

# Separar corpo e status code
HTTP_BODY=$(echo "$RESPONSE" | head -n -1)
HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)

echo "📥 Resposta:"
echo "Status: $HTTP_CODE"
echo "Body: $HTTP_BODY"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Webhook respondeu com sucesso!"
    echo ""
    echo "Agora verifique:"
    echo "1. Acesse Financeiro > Resumo"
    echo "2. Verifique se o card 'Recebidas' atualizou"
    echo "3. Ou vá em Faturamento e procure o pagamento $PAYMENT_ID"
else
    echo "❌ Webhook retornou erro $HTTP_CODE"
    echo ""
    echo "Possíveis causas:"
    echo "- Token incorreto"
    echo "- unit_id inválido"
    echo "- Função não deployada"
    echo "- Validação de IP ainda ativa"
fi
