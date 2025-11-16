# Configuração do Cloudflare D1 (Database)

## Visão Geral

Este documento descreve a configuração do Cloudflare D1 para armazenar metadados de imagens do sistema DromeFlow.

## O que é Cloudflare D1?

- **Banco SQLite serverless** rodando no edge da Cloudflare
- **Gratuito**: 5 GB de storage, 5 milhões de leituras/dia
- **Global**: Replicação automática em múltiplas regiões
- **API REST**: Acesso via Cloudflare Workers API

## Arquitetura

```
┌─────────────────┐
│   React App     │
│  (DromeFlow)    │
└────────┬────────┘
         │
         ├─── Upload Imagem ───► Cloudflare R2 (Storage)
         │                        └─► URL pública
         │
         └─── Metadados ───────► Cloudflare D1 (Database)
                                  └─► id, filename, url, size, etc.
```

## Passo 1: Criar Database no Dashboard

1. Acesse: https://dash.cloudflare.com/{ACCOUNT_ID}/workers-and-pages/d1
2. Clique em **"Create Database"**
3. Nome: `dromeflow-images`
4. Clique em **"Create"**

## Passo 2: Copiar Database ID

Após criar, copie o **Database ID** (formato: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

## Passo 3: Executar SQL de Criação

No dashboard do D1, vá em **"Console"** e execute o SQL abaixo:

```sql
-- Tabela de imagens
CREATE TABLE IF NOT EXISTS images (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  
  -- Storage
  bucket_name TEXT NOT NULL DEFAULT 'dromeflow-files',
  
  -- Tipo e categorização
  image_type TEXT NOT NULL CHECK (image_type IN ('profile', 'logo', 'banner', 'comercial', 'recrutadora', 'other')),
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  
  -- Dimensões
  width INTEGER,
  height INTEGER,
  
  -- URLs
  public_url TEXT NOT NULL,
  thumbnail_url TEXT,
  
  -- Relacionamentos
  unit_id TEXT,
  uploaded_by TEXT,
  
  -- Uso e referência
  usage_context TEXT,
  reference_id TEXT,
  
  -- Timestamps
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);

-- Índices para performance
CREATE INDEX idx_images_storage_key ON images(storage_key);
CREATE INDEX idx_images_unit_id ON images(unit_id);
CREATE INDEX idx_images_image_type ON images(image_type);
CREATE INDEX idx_images_usage_context ON images(usage_context);
CREATE INDEX idx_images_created_at ON images(created_at DESC);
CREATE INDEX idx_images_deleted_at ON images(deleted_at);
```

## Passo 4: Salvar Credenciais no Supabase

Execute no Supabase:

```sql
-- Inserir Database ID do D1
INSERT INTO access_credentials (name, value, description)
VALUES (
  'cloudflare_d1_database_id',
  'SEU_DATABASE_ID_AQUI',
  'Cloudflare D1 Database ID para armazenar metadados de imagens'
);

-- Inserir API Token (se não tiver)
-- Usar o mesmo token do R2 que já está configurado
```

## Passo 5: API Endpoints

### Criar Imagem
```bash
POST https://api.cloudflare.com/client/v4/accounts/{account_id}/d1/database/{database_id}/query

{
  "sql": "INSERT INTO images (...) VALUES (...)"
}
```

### Listar Imagens
```bash
POST https://api.cloudflare.com/client/v4/accounts/{account_id}/d1/database/{database_id}/query

{
  "sql": "SELECT * FROM images WHERE deleted_at IS NULL ORDER BY created_at DESC"
}
```

### Deletar Imagem (Soft Delete)
```bash
POST https://api.cloudflare.com/client/v4/accounts/{account_id}/d1/database/{database_id}/query

{
  "sql": "UPDATE images SET deleted_at = datetime('now') WHERE id = ?"
}
```

## Estrutura de Dados

### Tabela: `images`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | TEXT | UUID da imagem |
| filename | TEXT | Nome do arquivo no R2 |
| original_filename | TEXT | Nome original do upload |
| storage_key | TEXT | Chave no bucket (ex: images/2025/11/uuid.jpg) |
| bucket_name | TEXT | Nome do bucket R2 |
| image_type | TEXT | Tipo: profile, logo, banner, comercial, recrutadora, other |
| mime_type | TEXT | MIME type (image/jpeg, image/png, etc.) |
| file_size | INTEGER | Tamanho em bytes |
| width | INTEGER | Largura em pixels |
| height | INTEGER | Altura em pixels |
| public_url | TEXT | URL pública da imagem |
| thumbnail_url | TEXT | URL da thumbnail (opcional) |
| unit_id | TEXT | ID da unidade (se aplicável) |
| uploaded_by | TEXT | ID do usuário que fez upload |
| usage_context | TEXT | Contexto de uso (ex: comercial_card) |
| reference_id | TEXT | ID da entidade que usa a imagem |
| created_at | TEXT | Data de criação (ISO 8601) |
| updated_at | TEXT | Data de atualização |
| deleted_at | TEXT | Data de exclusão (soft delete) |

## Limites do Plano Free

- **Storage**: 5 GB
- **Leituras**: 5 milhões/dia (~60 reads/segundo)
- **Escritas**: 100 mil/dia (~1 write/segundo)
- **Latência**: ~10-50ms (edge computing)

## Próximos Passos

1. ✅ Criar database `dromeflow-images` no dashboard
2. ✅ Executar SQL de criação da tabela
3. ✅ Salvar Database ID no Supabase
4. 🔄 Implementar serviço TypeScript para D1
5. 🔄 Criar UI de gerenciamento de imagens
6. 🔄 Integrar com R2 para upload completo

## Referências

- [Cloudflare D1 Docs](https://developers.cloudflare.com/d1/)
- [D1 REST API](https://developers.cloudflare.com/api/operations/cloudflare-d1-query-database)
- [SQLite Syntax](https://www.sqlite.org/lang.html)
