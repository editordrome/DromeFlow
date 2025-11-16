#!/bin/bash

# Deploy Supabase Edge Function para Upload de Imagens no R2

echo "🚀 Deploying Edge Function: upload-image-r2"
echo ""

# Verificar se Supabase CLI está instalado
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI não encontrado"
    echo "Instale com: npm install -g supabase"
    exit 1
fi

# Link do projeto (se ainda não estiver linkado)
echo "🔗 Linking Supabase project..."
supabase link --project-ref uframhbsgtxckdxttofo

# Setar secrets (credenciais Cloudflare)
echo ""
echo "🔐 Setting secrets..."

supabase secrets set \
  CLOUDFLARE_ACCOUNT_ID="624e5c7de1b1fab5c5800582597443ea" \
  CLOUDFLARE_R2_ACCESS_KEY_ID="627a67b32b025359f5aec433dbaa2d8e" \
  CLOUDFLARE_R2_SECRET_ACCESS_KEY="44f53aacecbcba2211e84f01da55aafcef727ee2d3c327dbd02e9e74152d1f9b" \
  CLOUDFLARE_R2_ENDPOINT="https://624e5c7de1b1fab5c5800582597443ea.r2.cloudflarestorage.com" \
  CLOUDFLARE_R2_BUCKET_NAME="dromeflow-files"

# Deploy da função
echo ""
echo "📦 Deploying function..."
supabase functions deploy upload-image-r2 --no-verify-jwt

echo ""
echo "✅ Deploy concluído!"
echo ""
echo "🌐 URL da função:"
echo "https://uframhbsgtxckdxttofo.supabase.co/functions/v1/upload-image-r2"
echo ""
echo "🧪 Teste com curl:"
echo "curl -X POST https://uframhbsgtxckdxttofo.supabase.co/functions/v1/upload-image-r2 \\"
echo "  -F 'file=@caminho/para/imagem.jpg'"
