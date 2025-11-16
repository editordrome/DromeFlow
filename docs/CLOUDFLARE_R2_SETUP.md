# 🔧 Configuração do Cloudflare R2 via MCP

## ✅ MCP Cloudflare Adicionado com Sucesso!

O arquivo `~/.cursor/mcp.json` foi atualizado com a configuração do servidor MCP Cloudflare.

---

## 📋 **Próximos Passos**

### **1. Obter Credenciais do Cloudflare**

#### **1.1 Account ID**
1. Acesse: https://dash.cloudflare.com/
2. Menu: **R2 Object Storage**
3. Na URL, copie o Account ID:
   ```
   https://dash.cloudflare.com/<ACCOUNT_ID>/r2/overview
                               ^^^^^^^^^^^^
   ```

#### **1.2 API Token**
1. No painel R2, clique em **Manage R2 API Tokens**
2. Clique em **Create API token**
3. Configure:
   - **Token name**: `dromeflow-mcp-access`
   - **Permissions**: 
     - ✅ Object Read & Write
     - ✅ Admin Read & Write
4. Copie:
   - **Access Key ID** (ex: `a1b2c3d4e5f6`)
   - **Secret Access Key** (ex: `aBcDeF1234...`)

#### **1.3 Criar Bucket**
1. Clique em **Create bucket**
2. Nome: `dromeflow-files`
3. Localização: **Automatic**

---

### **2. Atualizar Configuração MCP**

Edite o arquivo: `~/.cursor/mcp.json`

Substitua as linhas:
```json
"CLOUDFLARE_ACCOUNT_ID": "COLE_SEU_ACCOUNT_ID_AQUI",
"CLOUDFLARE_API_TOKEN": "COLE_SEU_API_TOKEN_AQUI"
```

Por:
```json
"CLOUDFLARE_ACCOUNT_ID": "seu_account_id_real",
"CLOUDFLARE_API_TOKEN": "seu_api_token_real"
```

**Exemplo:**
```json
"env": {
  "CLOUDFLARE_ACCOUNT_ID": "abc123def456",
  "CLOUDFLARE_API_TOKEN": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
}
```

---

### **3. Reiniciar VS Code/Cursor**

Após salvar o arquivo, **reinicie o Cursor** para que o MCP Cloudflare seja carregado.

---

## 🎯 **O que o MCP Cloudflare permite fazer?**

Após configurado, eu (Copilot) poderei:

- 📦 **Listar buckets** R2 disponíveis
- 📄 **Listar objetos** dentro de um bucket
- ⬆️ **Upload de arquivos** para R2
- ⬇️ **Download de arquivos** do R2
- 🗑️ **Deletar objetos** do R2
- 📊 **Obter estatísticas** de uso e storage
- 🔐 **Gerenciar permissões** de acesso

---

## 📝 **Checklist de Configuração**

- [ ] **Account ID obtido** do dashboard Cloudflare
- [ ] **API Token criado** com permissões R2
- [ ] **Bucket `dromeflow-files` criado**
- [ ] **Credenciais substituídas** no `~/.cursor/mcp.json`
- [ ] **Cursor reiniciado**
- [ ] **Testar conexão** (eu faço isso depois)

---

## 🔒 **Segurança**

### **Arquivo `~/.cursor/mcp.json`**
- ✅ Fica **apenas no seu computador**
- ✅ Não é versionado no Git
- ✅ Não é compartilhado com ninguém
- ⚠️ **Nunca** commite este arquivo!

### **API Token no Cloudflare**
- ✅ Use permissões mínimas necessárias
- ✅ Configure expiração (opcional, mas recomendado)
- ✅ Rotacione periodicamente (a cada 3-6 meses)

---

## ❓ **Após Configurar**

Me avise quando terminar e eu vou:

1. ✅ **Testar conexão** MCP com Cloudflare
2. ✅ **Listar buckets** para confirmar acesso
3. ✅ **Criar serviço R2** no TypeScript
4. ✅ **Criar tabela `file_metadata`** no Supabase
5. ✅ **Integrar upload XLSX** com backup R2

---

**Aguardando você configurar as credenciais! 🚀**
