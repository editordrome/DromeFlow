# 🚀 Guia de Deploy - DromeFlow na Hostinger

## 📦 Pré-requisitos
- ✅ Build de produção gerado (`npm run build`)
- ✅ Acesso FTP à Hostinger (credenciais disponíveis no cPanel)
- ✅ Pasta `dist/` com todos os arquivos otimizados

---

## 🔧 Passo 1: Preparar os Arquivos

### 1.1 Execute o Build
```bash
npm run build
```

**O que foi gerado:**
- ✅ Service Worker (`sw.js`) - cache offline
- ✅ PWA Manifest (`manifest.webmanifest`)
- ✅ Assets comprimidos (.br e .gz)
- ✅ Chunks otimizados (lazy loading)
- ✅ HTML, CSS, JS minificados

### 1.2 Adicione o .htaccess
Copie o arquivo `.htaccess` da pasta `public/` para dentro da pasta `dist/`:

```bash
cp public/.htaccess dist/.htaccess
```

### 1.3 Adicione os Ícones PWA (Opcional mas Recomendado)
Antes do build, adicione na pasta `public/`:
- `pwa-192x192.png` (ícone 192x192px)
- `pwa-512x512.png` (ícone 512x512px)
- `favicon.ico` (ícone do navegador)

**Como criar:** Use https://realfavicongenerator.net/ com o logo DromeFlow

---

## 📤 Passo 2: Upload via FTP

### 2.1 Conectar ao FTP
Use as credenciais da Hostinger:
- **Host FTP:** `ftp://212.85.6.238` ou `ftp://dromeboard.com.br`
- **Usuário:** `u854441981.dromeboard.com.br`
- **Senha:** (a mesma do cPanel)
- **Porta:** 21 (ou 22 para SFTP)

**Clientes FTP recomendados:**
- **FileZilla** (Windows/Mac/Linux) - https://filezilla-project.org/
- **Cyberduck** (Mac) - https://cyberduck.io/
- **WinSCP** (Windows) - https://winscp.net/

### 2.2 Navegar até a Pasta Correta
Após conectar, vá para:
```
/public_html
```

### 2.3 Limpar Arquivos Antigos (Importante!)
**⚠️ ATENÇÃO:** Faça backup antes de deletar!

Selecione e delete **TODOS** os arquivos antigos dentro de `public_html/`:
- Arquivos `.html`, `.js`, `.css` antigos
- Pasta `assets/` antiga
- Qualquer arquivo `.htaccess` antigo

**Mantenha apenas:**
- Pastas de subdomínios (se houver)
- `.well-known/` (SSL)
- `cgi-bin/` (se existir)

### 2.4 Upload dos Novos Arquivos
Arraste **TODO O CONTEÚDO** da pasta `dist/` local para `/public_html/`:

```
dist/
├── .htaccess               → /public_html/.htaccess
├── index.html              → /public_html/index.html
├── manifest.webmanifest    → /public_html/manifest.webmanifest
├── registerSW.js           → /public_html/registerSW.js
├── sw.js                   → /public_html/sw.js
├── workbox-*.js (.br/.gz)  → /public_html/workbox-*.js
├── PWA Icons:
│   ├── android-chrome-192x192.png
│   ├── android-chrome-512x512.png
│   ├── apple-touch-icon.png
│   ├── favicon-16x16.png
│   ├── favicon-32x32.png
│   └── favicon.ico
└── assets/                 → /public_html/assets/
    ├── index-*.js (.br/.gz)
    ├── vendor-react-*.js (.br/.gz)
    ├── vendor-supabase-*.js (.br/.gz)
    ├── [Page]-*.js (.br/.gz) - lazy loaded pages
    └── [Lib]-*.js (.br/.gz) - libraries (dnd, jspdf, purify, etc.)
```

**Importante:**
- Mantenha a estrutura de pastas
- Todos os arquivos .br e .gz são compressões (servidos automaticamente pelo servidor)
- Cada página tem seu próprio chunk JS (code splitting)
- Todos os arquivos `.br` e `.gz` também devem ser enviados
- O `.htaccess` **DEVE** estar na raiz de `public_html/`

---

## 🧪 Passo 3: Verificar o Deploy

### 3.1 Teste Básico
Acesse: https://dromeboard.com.br

**Verificações:**
- ✅ Site carrega sem erros 404
- ✅ Login funciona
- ✅ Navegação entre módulos funciona
- ✅ Sem erros no Console do navegador (F12)

### 3.2 Teste PWA
**No Chrome/Edge:**
1. Abra: https://dromeboard.com.br
2. Pressione `F12` → Aba **Application**
3. Verifique:
   - **Service Workers** → Deve aparecer `sw.js` ativo
   - **Manifest** → Deve mostrar "DromeFlow" com ícones
   - **Cache Storage** → Deve ter caches criados

### 3.3 Teste de Compressão
**No Chrome:**
1. Abra: https://dromeboard.com.br
2. Pressione `F12` → Aba **Network**
3. Recarregue a página (`Ctrl+Shift+R`)
4. Clique em qualquer arquivo `.js` grande
5. Verifique no header: `Content-Encoding: br` ou `gzip`

### 3.4 Teste de Performance
Execute PageSpeed Insights novamente:
https://pagespeed.web.dev/

**Métricas esperadas:**
- ⚡ **TTI (Time to Interactive):** < 5s (antes: 19s)
- 📊 **Performance Score:** > 90 (antes: ~60)
- 📦 **Bundle Size:** ~162 KB Brotli (antes: 2.87 MB)

---

## 🔍 Passo 4: Troubleshooting

### Problema: Site não carrega (404)
**Causa:** `.htaccess` não está funcionando
**Solução:**
1. Verifique se `.htaccess` está em `/public_html/`
2. Verifique permissões do arquivo (deve ser 644)
3. No cPanel → "MultiPHP INI Editor" → habilite `AllowOverride All`

### Problema: Service Worker não ativa
**Causa:** HTTPS não configurado
**Solução:**
1. Acesse cPanel → SSL/TLS Status
2. Ative SSL gratuito (Let's Encrypt)
3. Force HTTPS no `.htaccess` (já incluído)

### Problema: Assets não comprimidos
**Causa:** Servidor não reconhece `.br` ou `.gz`
**Solução:**
1. Verifique se arquivos `.br` e `.gz` foram enviados
2. Verifique MIME types no `.htaccess`
3. Se ainda não funcionar, contate suporte Hostinger

### Problema: Erro "Mixed Content"
**Causa:** Site em HTTPS carregando recursos HTTP
**Solução:**
1. Verifique se todas as URLs do Supabase são `https://`
2. Force HTTPS no `.htaccess` (já incluído)
3. Limpe cache do navegador

---

## 📊 Comparativo de Performance

| Métrica | Antes | Depois Fase 3 | Melhoria |
|---------|-------|---------------|----------|
| **Bundle Principal** | 2.87 MB | 162 KB (Brotli) | ↓ 94% |
| **Time to Interactive** | 19s | < 5s (estimado) | ↓ 74% |
| **Total de Requests** | ~10 | ~34 (lazy load) | Otimizado |
| **Cache Offline** | ❌ | ✅ Service Worker | - |
| **PWA Instalável** | ❌ | ✅ Manifest | - |
| **Score PageSpeed** | ~60 | > 90 (esperado) | ↑ 50% |

---

## 🎯 Checklist Final

Antes de considerar o deploy concluído:

- [ ] Build gerado sem erros (`npm run build`)
- [ ] `.htaccess` copiado para `dist/`
- [ ] Ícones PWA adicionados (ou placeholder)
- [ ] Todos os arquivos da `dist/` enviados via FTP
- [ ] `.htaccess` está em `/public_html/.htaccess`
- [ ] Site acessível em https://dromeboard.com.br
- [ ] Login funciona corretamente
- [ ] Service Worker ativo (F12 → Application)
- [ ] Compressão Brotli/Gzip funcionando (F12 → Network)
- [ ] PageSpeed Insights executado
- [ ] Cache headers configurados (verificar headers HTTP)

---

## 🆘 Suporte

**Problemas técnicos:**
- Logs do servidor: cPanel → "Error Log"
- Console do navegador: F12 → Console
- Network: F12 → Network

**Contato Hostinger:**
- Suporte 24/7 via chat no cPanel
- Documentação: https://support.hostinger.com/

---

## 📝 Notas Finais

1. **Cache do Navegador:** Após deploy, peça aos usuários para limpar cache (`Ctrl+Shift+Del`)
2. **Updates Futuros:** Sempre execute `npm run build` antes de novo upload
3. **Backup:** A Hostinger faz backups automáticos, mas mantenha backup local da `dist/`
4. **Monitoramento:** Use Google Analytics ou similar para monitorar performance real

**Deploy automatizado (futuro):**
- Configure GitHub Actions para deploy automático via FTP
- Use `wlixcc/SFTP-Deploy-Action` para CI/CD

---

✅ **Parabéns! Seu DromeFlow está otimizado e pronto para produção!** 🎉
