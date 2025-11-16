# Configurar R2 Bucket Público

## 🎯 Objetivo
Tornar as imagens do bucket R2 acessíveis publicamente via URL.

## 📋 Passos

### 1. Acessar Dashboard Cloudflare
```
https://dash.cloudflare.com/
```

### 2. Navegar para R2
- Clicar em **"R2"** no menu lateral
- Selecionar o bucket: **dromeflow-files**

### 3. Configurar Acesso Público

**Opção A - Domínio Público do R2:**
1. Na página do bucket, clicar em **"Settings"**
2. Procurar por **"Public Access"** ou **"R2.dev subdomain"**
3. Clicar em **"Allow Access"**
4. Cloudflare vai gerar uma URL pública: `https://pub-<hash>.r2.dev`
5. Copiar essa URL

**Opção B - Custom Domain (Recomendado):**
1. Na página do bucket, clicar em **"Settings"** → **"Custom Domains"**
2. Adicionar domínio: `files.dromeboard.com.br` (ou similar)
3. Cloudflare vai criar um CNAME automaticamente
4. URL será: `https://files.dromeboard.com.br/<filename>`

### 4. Testar Acesso
```bash
# Fazer upload de teste
curl -X POST https://uframhbsgtxckdxttofo.supabase.co/functions/v1/upload-image-r2 \
  -F 'file=@sua-imagem.jpg'

# Testar URL pública retornada
curl -I <url_retornada>
```

## 🔧 Atualizar Edge Function

Após ativar o acesso público, atualizar a linha da URL na Edge Function:

```typescript
// Se usou R2.dev subdomain
const publicUrl = `https://pub-<SEU_HASH>.r2.dev/${filename}`;

// Se usou custom domain
const publicUrl = `https://files.dromeboard.com.br/${filename}`;
```

Depois fazer redeploy:
```bash
bash deploy_edge_function.sh
```

## ✅ URLs Esperadas

- **Upload endpoint**: `https://uframhbsgtxckdxttofo.supabase.co/functions/v1/upload-image-r2`
- **Public URL (R2.dev)**: `https://pub-<hash>.r2.dev/<filename>`
- **Public URL (Custom)**: `https://files.dromeboard.com.br/<filename>`

## 📝 Notas

- R2 não cobra por tráfego de saída (egress) mesmo com acesso público
- Custom domain requer que o domínio esteja no Cloudflare
- Acesso público significa que qualquer pessoa com a URL pode ver a imagem
- Para controle de acesso, implemente signed URLs ou autenticação na Edge Function
