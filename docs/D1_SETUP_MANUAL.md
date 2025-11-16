# Configuração Manual do Cloudflare D1

O token de API atual não tem permissões para criar databases D1. Siga este guia para configurar manualmente:

## ✅ Passo 1: Criar Database D1

1. Acesse: https://dash.cloudflare.com/624e5c7de1b1fab5c5800582597443ea
2. No menu lateral esquerdo, clique em **"Workers & Pages"**
3. Clique na aba **"D1 SQL Database"**
4. Clique no botão **"Create database"**
5. Preencha:
   - **Database name**: `dromeflow-images`
   - **Location**: Automatic (recomendado)
6. Clique em **"Create"**

## ✅ Passo 2: Copiar Database ID

Após criar, você verá os detalhes do database:

```
Database name: dromeflow-images
Database ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

**⚠️ COPIE O DATABASE ID COMPLETO!**

## ✅ Passo 3: Executar SQL no Console D1

1. Na página do database `dromeflow-images`, clique na aba **"Console"**
2. Cole e execute este SQL (pode colar tudo de uma vez):

```sql
-- Criar tabela de imagens
CREATE TABLE IF NOT EXISTS images (
  id TEXT PRIMARY KEY,
  image_type TEXT NOT NULL CHECK(image_type IN ('profile', 'logo', 'banner', 'content', 'attachment', 'other')),
  filename TEXT NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  public_url TEXT NOT NULL,
  unit_id TEXT,
  uploaded_by TEXT NOT NULL,
  usage_context TEXT,
  reference_id TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_images_type ON images(image_type);
CREATE INDEX IF NOT EXISTS idx_images_unit ON images(unit_id);
CREATE INDEX IF NOT EXISTS idx_images_uploaded_by ON images(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_images_reference ON images(reference_id);
CREATE INDEX IF NOT EXISTS idx_images_active ON images(is_active, deleted_at);
CREATE INDEX IF NOT EXISTS idx_images_created ON images(created_at);
```

3. Clique em **"Execute"**
4. Você deve ver uma mensagem de sucesso

## ✅ Passo 4: Salvar Database ID no Supabase

Agora execute este comando no terminal (substitua `SEU_DATABASE_ID_AQUI` pelo ID que você copiou):

```bash
psql "$DATABASE_URL" << 'EOF'
INSERT INTO access_credentials (name, value, description, is_active)
VALUES 
  ('cloudflare_d1_database_id', 'SEU_DATABASE_ID_AQUI', 'Database ID do Cloudflare D1 para armazenar metadata de imagens', true)
ON CONFLICT (name) DO UPDATE 
  SET value = EXCLUDED.value,
      updated_at = NOW();
EOF
```

**Exemplo com Database ID fictício:**
```bash
psql "$DATABASE_URL" << 'EOF'
INSERT INTO access_credentials (name, value, description, is_active)
VALUES 
  ('cloudflare_d1_database_id', 'abc12345-def6-7890-ghij-klmnopqrstuv', 'Database ID do Cloudflare D1 para armazenar metadata de imagens', true)
ON CONFLICT (name) DO UPDATE 
  SET value = EXCLUDED.value,
      updated_at = NOW();
EOF
```

## ✅ Passo 5: Verificar Configuração

Execute este comando para verificar se foi salvo corretamente:

```bash
psql "$DATABASE_URL" -c "SELECT name, value FROM access_credentials WHERE name = 'cloudflare_d1_database_id';"
```

Deve retornar:
```
           name            |               value                
---------------------------+------------------------------------
 cloudflare_d1_database_id | abc12345-def6-7890-ghij-klmnopqrstuv
```

## 🚀 Passo 6: Testar Upload

1. Recarregue a página do sistema (F5)
2. Vá para **Dashboard Sistema** → **Dados**
3. Na seção **Gerenciar Imagens**, clique em **"Escolher Imagem"**
4. Selecione uma imagem e faça upload
5. Deve funcionar! ✅

## 🔍 Troubleshooting

### Erro: "Authentication error" na API
- **Solução**: Use o dashboard manual (passos acima). O token precisa de permissões D1 específicas.

### Erro: "Credenciais do Cloudflare D1 não encontradas"
- **Solução**: Execute o Passo 4 novamente, verificando que o Database ID está correto.

### Erro: "Failed to load resource: 404"
- **Solução**: Verifique se a tabela `images` foi criada no console D1 (Passo 3).

---

**📞 Precisa de ajuda?**
- Verifique o arquivo: `docs/IMAGES_SETUP_GUIDE.md`
- Consulte a documentação: https://developers.cloudflare.com/d1/
