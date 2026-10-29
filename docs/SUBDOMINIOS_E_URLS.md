# Subdomínios por Unidade e URLs por Módulo

Este guia descreve como publicar a aplicação com subdomínios por unidade e paths por módulo:

- Acesso por unidade: https://<unit-slug>.dromeflow.com
- Módulo na URL: https://<unit-slug>.dromeflow.com/<module-code>

## 1) Cloudflare + Hostinger (DNS e SSL)

1. Ative o Cloudflare para o domínio (Add a Site) e troque os nameservers no registrador (Hostinger → Domínios → Nameservers) pelos NS fornecidos pelo Cloudflare.
2. Cloudflare → DNS:
   - A (raiz): Name @ → IP da hospedagem (Hostinger). Proxy: Proxied (laranja).
   - Wildcard:
     - Preferencial: CNAME Name * → @ (Proxied laranja)
     - Alternativa: A Name * → mesmo IP do @ (Proxied laranja)
3. Cloudflare → SSL/TLS:
   - Modo: Full (strict) se instalar o certificado de origem no servidor; caso contrário, Full.
   - Edge Certificates: Universal SSL ON; opcional Always Use HTTPS.
4. (Opcional) Origin Certificate: gere no Cloudflare e instale no hPanel (SSL → Instalar SSL personalizado) para manter Full (strict).

## 2) Hostinger (docroot e SPA fallback)

1. Publique o build (dist) em `public_html`.
2. (Opcional) hPanel → Subdomínios: se suportar “*”, aponte para `public_html`.
3. No mesmo diretório do `index.html`, crie/edite `.htaccess` com:

```
RewriteEngine On
# Redirect para HTTPS (se não usar Always Use HTTPS no Cloudflare)
RewriteCond %{HTTPS} !=on
RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

# Arquivos reais passam direto
RewriteCond %{REQUEST_FILENAME} -f [OR]
RewriteCond %{REQUEST_FILENAME} -d
RewriteRule ^ - [L]

# SPA fallback
RewriteRule . /index.html [L]
```

## 3) Banco de Dados (Slugs de Unidades e Código de Módulos)

Crie os campos/índices necessários (ajuste schema/nomes conforme seu projeto):

```
-- Units: slug único (kebab-case)
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS slug text;
UPDATE public.units SET slug = lower(regexp_replace(unit_name, '[^a-z0-9]+', '-', 'g'))
WHERE slug IS NULL;
ALTER TABLE public.units ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS units_slug_key ON public.units(slug);

-- Modules: code único (rota). Se ainda não existir constraint/índice, crie:
CREATE UNIQUE INDEX IF NOT EXISTS modules_code_key ON public.modules(code);
```

Boas práticas:
- slugs em kebab-case, apenas [a–z0–9-]
- code dos módulos idem; evite renomear para não quebrar URLs

## 4) App (detectar subdomínio e path)

Implemente utilitários para ler a unidade pelo subdomínio e o módulo pelo path:

```ts
export const BASE_DOMAIN = 'dromeflow.com';

export function parseUnitAndModule() {
  const host = window.location.hostname;
  const path = window.location.pathname.replace(/^\/+/, '');
  let unitSlug: string | null = null;
  let moduleCode: string | null = null;
  if (host.endsWith(BASE_DOMAIN)) {
    const sub = host.slice(0, -(BASE_DOMAIN.length + 1));
    if (sub && sub !== 'www') unitSlug = sub;
  }
  if (path) moduleCode = path.split('/')[0] || null;
  return { unitSlug, moduleCode };
}

export function buildUnitModuleUrl(unitSlug: string, moduleCode: string) {
  return `https://${unitSlug}.${BASE_DOMAIN}/${moduleCode}`;
}
```

Integração com o AppContext:
- Na inicialização, use `parseUnitAndModule()` para setar `selectedUnit` e `activeView`.
- Em `setView`, faça `window.history.pushState({}, '', buildUnitModuleUrl(selectedUnit.slug, viewCode))`.
- Adicione listener `popstate` para re-sincronizar o módulo ao usar voltar/avançar.

## 5) Testes

- DNS: `dig +short unidade-teste.dromeflow.com` deve resolver para o IP do host.
- HTTPS: `curl -I https://unidade-teste.dromeflow.com` deve responder 200/301/302.
- Navegador: acessar `https://unidade-teste.dromeflow.com/dashboard` deve carregar o app e manter o módulo no path.

## 6) Observações

- Para ambientes locais, mantenha um fallback por path (ex.: `/u/:slug/:module`).
- Se usar Supabase Auth, adicione `https://*.dromeflow.com` nas URLs permitidas (Auth > URL config).
- Para cache eficiente: bypass do index.html no Cloudflare e cache agressivo dos assets estáticos.
