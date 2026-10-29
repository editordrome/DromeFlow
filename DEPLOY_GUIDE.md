# 🚀 Guia de Deploy — DromeFlow (Hostinger via SFTP)

## 📦 Pré-requisitos

- ✅ Node.js disponível em `/opt/homebrew/bin/node`
- ✅ Arquivo `.env.local` configurado com as credenciais SFTP
- ✅ Dependências instaladas (`npm install`)

---

## ⚙️ Configuração do `.env.local`

Crie o arquivo `.env.local` na raiz do projeto com base no `.env.example`:

```env
# Supabase
VITE_SUPABASE_URL=https://uframhbsgtxckdxttofo.supabase.co
VITE_SUPABASE_ANON_KEY=<sua-chave-anon>

# SFTP — Hostinger SSH (porta 65002)
SFTP_HOST=72.61.220.147
SFTP_PORT=65002
SFTP_USER=u854441981
SFTP_DEST=domains/dromeflow.com/public_html
SFTP_PASSWORD=<sua-senha>
```

> ⚠️ **Nunca commite o `.env.local`.** Ele já está no `.gitignore`.

---

## 🚀 Deploy em 2 Comandos

```bash
# 1. Gera os assets de produção
PATH="/opt/homebrew/bin:$PATH" npm run build

# 2. Envia para o servidor via SFTP
PATH="/opt/homebrew/bin:$PATH" node scripts/deploy.js
```

O script `deploy.js`:
1. Lê automaticamente as variáveis do `.env.local`
2. Conecta via SSH à Hostinger na porta `65002`
3. Sincroniza recursivamente `dist/` → `domains/dromeflow.com/public_html/`

---

## 📂 Estrutura do Destino no Servidor

```
domains/dromeflow.com/public_html/
├── .htaccess
├── index.html
├── manifest.webmanifest
├── sw.js
├── registerSW.js
├── workbox-*.js (.br / .gz)
└── assets/
    ├── index-*.js (.br / .gz)
    ├── vendor-react-*.js
    ├── vendor-supabase-*.js
    └── [Página]-*.js (lazy chunks)
```

---

## 🧪 Verificação Pós-Deploy

Acesse: **https://dromeflow.com**

- ✅ Site carrega sem erros 404
- ✅ Login funciona
- ✅ Navegação entre módulos sem erros no Console (F12)
- ✅ `Content-Encoding: br` nos assets (F12 → Network)
- ✅ Service Worker ativo (F12 → Application → Service Workers)

---

## 🔍 Troubleshooting

| Problema | Causa provável | Solução |
|---|---|---|
| `Authentication failure` | Senha SFTP incorreta | Verifique `SFTP_PASSWORD` no `.env.local` |
| `npm: command not found` | PATH do sistema incompleto | Use o prefixo `PATH="/opt/homebrew/bin:$PATH"` |
| `node not found` | Vite não encontra o Node | Mesmo prefixo do PATH acima |
| Site retorna 404 nas rotas | `.htaccess` ausente | Confirme que `public/.htaccess` está na pasta `dist/` após o build |
| Assets sem compressão Brotli | Servidor não configurado | Verifique as regras `AddType` no `.htaccess` |

---

## 📝 Notas

- O `scripts/deploy.js` carrega o `.env.local` **sem dependência do pacote `dotenv`** — leitura manual via `fs.readFileSync`.
- O fallback do `SFTP_DEST`, caso a variável não exista, já é `domains/dromeflow.com/public_html`.
- Após o deploy, peça aos usuários para forçar reload (`Ctrl+Shift+R`) para limpar o Service Worker antigo.
