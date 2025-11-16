# Guia Rápido: Configurar Gerenciamento de Imagens

## Visão Geral
Sistema completo para upload, armazenamento e gerenciamento de imagens usando:
- **Cloudflare R2**: Armazenamento de arquivos (10 GB grátis)
- **Cloudflare D1**: Banco de metadados SQLite serverless (5 GB grátis)
- **UI Integrada**: Interface na aba "Dados" do Dashboard Sistema

## Passo 1: Criar Database no Cloudflare D1

### 1.1 Acessar Dashboard
```
https://dash.cloudflare.com/624e5c7de1b1fab5c5800582597443ea/workers-and-pages/d1
```

### 1.2 Criar Database
- Clique em **"Create Database"**
- Nome: `dromeflow-images`
- Clique em **"Create"**

### 1.3 Copiar Database ID
Após criar, você verá o **Database ID** (formato: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)
**COPIE ESTE ID!**

## Passo 2: Criar Tabela no D1

### 2.1 Abrir Console do D1
No dashboard do database criado, clique na aba **"Console"**

### 2.2 Executar SQL
Cole e execute o conteúdo do arquivo:
```
docs/sql/2025-11-15_cloudflare_d1_images_table.sql
```

Ou copie e execute este SQL:

```sql
CREATE TABLE IF NOT EXISTS images (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  bucket_name TEXT NOT NULL DEFAULT 'dromeflow-files',
  image_type TEXT NOT NULL CHECK (image_type IN ('profile', 'logo', 'banner', 'comercial', 'recrutadora', 'other')),
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
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE INDEX idx_images_storage_key ON images(storage_key);
CREATE INDEX idx_images_image_type ON images(image_type);
CREATE INDEX idx_images_created_at ON images(created_at DESC);
```

## Passo 3: Salvar Database ID no Supabase

### 3.1 Abrir SQL Editor do Supabase
Acesse o SQL Editor do seu projeto Supabase

### 3.2 Executar SQL de Inserção
Edite o arquivo `docs/sql/2025-11-15_insert_d1_credentials.sql`:
- Substitua `'SEU_DATABASE_ID_AQUI'` pelo Database ID copiado no Passo 1.3
- Execute o SQL no Supabase

```sql
INSERT INTO access_credentials (name, value, description)
VALUES (
  'cloudflare_d1_database_id',
  'SEU_DATABASE_ID_COPIADO',
  'Cloudflare D1 Database ID para armazenar metadados de imagens'
);
```

## Passo 4: Usar a Interface

### 4.1 Acessar UI
1. Faça login no DromeFlow
2. Vá em **Dashboard Sistema** → Aba **"Dados"**
3. Clique no card **"Cloudflare R2"** para expandir
4. Role até a seção **"Gerenciamento de Imagens"**

### 4.2 Upload de Imagem
1. Clique em **"Enviar Imagem"**
2. Selecione uma imagem (máx 5MB)
3. Aguarde o upload
4. A imagem aparecerá na lista

### 4.3 Copiar URL da Imagem
1. Localize a imagem na lista
2. Clique em **"Copiar URL"**
3. Use a URL nos cards de Comercial ou Recrutadora

### 4.4 Excluir Imagem
1. Clique no ícone de **lixeira** na imagem
2. Confirme a exclusão
3. A imagem será removida do R2 e D1

## Funcionalidades

✅ **Upload de Imagens**: Drag & drop ou seleção de arquivos
✅ **Armazenamento**: Cloudflare R2 (edge global)
✅ **Metadados**: Cloudflare D1 (SQLite serverless)
✅ **Filtros**: Por tipo (comercial, recrutadora, perfil, etc.)
✅ **Preview**: Visualização de thumbnails
✅ **URL Pública**: Copiar link para usar no sistema
✅ **Dimensões**: Exibe largura x altura
✅ **Tamanho**: Mostra KB/MB
✅ **Data**: Timestamp de upload
✅ **Exclusão**: Soft delete + remoção do R2

## Tipos de Imagem Suportados

- **comercial**: Imagens dos cards comerciais
- **recrutadora**: Imagens dos cards de recrutamento
- **profile**: Fotos de perfil
- **logo**: Logos de unidades/empresas
- **banner**: Banners e headers
- **other**: Outros usos gerais

## Limites (Plano Free)

### Cloudflare R2
- 10 GB de storage
- Transferência: gratuita

### Cloudflare D1
- 5 GB de storage
- 5 milhões de leituras/dia
- 100 mil escritas/dia

## Exemplo de Uso

### 1. Upload para Card Comercial
```typescript
// No ComercialCardModal, ao salvar a imagem:
1. Faça upload via UI de Gerenciamento de Imagens
2. Copie a URL gerada
3. Cole no campo de imagem do card comercial
```

### 2. URL da Imagem
```
Formato: https://pub-XXXXX.r2.dev/images/2025/11/15/uuid.jpg
```

## Troubleshooting

### Erro: "Credenciais do Cloudflare D1 não encontradas"
- Verifique se executou o Passo 3 corretamente
- Confirme que o Database ID está correto no Supabase

### Erro: "D1 Query Error: 401"
- Verifique se o API Token tem permissões de D1
- Confirme que o Account ID está correto

### Imagem não carrega
- Verifique se o bucket R2 está público
- Confirme que a URL pública foi gerada corretamente

### Upload falha
- Verifique o tamanho do arquivo (máx 5MB)
- Confirme que é uma imagem válida (JPG, PNG, GIF, WebP)

## Arquivos Criados

1. `docs/CLOUDFLARE_D1_SETUP.md` - Documentação completa
2. `docs/sql/2025-11-15_cloudflare_d1_images_table.sql` - SQL para criar tabela
3. `docs/sql/2025-11-15_insert_d1_credentials.sql` - SQL para inserir credenciais
4. `services/storage/d1Images.service.ts` - Serviço TypeScript
5. `components/pages/StorageManagementPage.tsx` - UI atualizada (seção de imagens)

## Próximos Passos

Após concluir esta configuração, você poderá:
1. ✅ Fazer upload de imagens via UI
2. ✅ Copiar URLs para usar nos cards
3. ✅ Gerenciar biblioteca de imagens
4. ✅ Filtrar por tipo de uso
5. ✅ Excluir imagens não utilizadas

---

**Status Atual**: ✅ Código implementado, aguardando configuração do D1
