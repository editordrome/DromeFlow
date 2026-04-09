# Configuração de Subdomínios e URLs por Módulo - Guia Completo

## Índice
1. [Visão Geral](#visão-geral)
2. [Arquitetura do Sistema](#arquitetura-do-sistema)
3. [Pré-requisitos](#pré-requisitos)
4. [Configuração do Cloudflare](#1-configuração-do-cloudflare)
5. [Configuração do Hostinger](#2-configuração-do-hostinger)
6. [Configuração do Banco de Dados](#3-configuração-do-banco-de-dados)
7. [Configuração da Aplicação](#4-configuração-da-aplicação)
8. [Deploy e Build](#5-deploy-e-build)
9. [Testes e Validação](#6-testes-e-validação)
10. [Troubleshooting](#7-troubleshooting)

---

## Visão Geral

Este guia detalha como configurar o sistema DromeFlow para funcionar com:

- **Subdomínios por Unidade**: Cada unidade possui seu próprio subdomínio
  - Exemplo: `mb-joinville.dromeflow.com`
  - Exemplo: `mb-blumenau.dromeflow.com`

- **Paths por Módulo**: Cada módulo é acessível via path na URL
  - Exemplo: `https://mb-joinville.dromeflow.com/dashboard`
  - Exemplo: `https://mb-joinville.dromeflow.com/atendimentos`
  - Exemplo: `https://mb-joinville.dromeflow.com/profissionais`

### Benefícios
- URLs amigáveis e memoráveis
- SEO otimizado para cada unidade
- Isolamento lógico de dados por unidade
- Fácil compartilhamento de links específicos
- Histórico de navegação funcional (voltar/avançar)
- Deep linking para módulos específicos

---

## Arquitetura do Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                      Usuário Final                          │
│  https://mb-joinville.dromeflow.com/atendimentos       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare (DNS + CDN)                   │
│  - Wildcard DNS: *.dromeflow.com                       │
│  - SSL/TLS Universal                                        │
│  - DDoS Protection                                          │
│  - Cache + Performance                                      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                Hostinger (Web Hosting)                      │
│  - Apache + mod_rewrite                                     │
│  - .htaccess (SPA fallback)                                 │
│  - public_html/index.html                                   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│               React SPA (DromeFlow)                         │
│  - Detecta subdomínio → Identifica unidade                 │
│  - Detecta path → Carrega módulo                           │
│  - AppContext gerencia estado                               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  Supabase (Backend)                         │
│  - Tabela units: unit_code, unit_name, slug                │
│  - Tabela modules: code, name, view_id                     │
│  - RLS + Custom Auth (via profiles table)                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Pré-requisitos

### Ferramentas Necessárias
- [ ] Conta Cloudflare (gratuita ou paga)
- [ ] Domínio registrado (ex: dromeflow.com)
- [ ] Hospedagem web (Hostinger ou similar com suporte a .htaccess)
- [ ] Acesso SSH ou FTP ao servidor
- [ ] Acesso ao painel DNS do registrador
- [ ] Node.js 18+ instalado localmente
- [ ] Acesso administrativo ao Supabase

### Conhecimentos Recomendados
- DNS e subdomínios
- Apache .htaccess
- React SPA routing
- Supabase queries
- Git e deploy

---

## 1. Configuração do Cloudflare

### 1.1 Adicionar Site ao Cloudflare

1. **Acesse o Dashboard do Cloudflare**
   - URL: https://dash.cloudflare.com
   - Login com sua conta

2. **Adicione seu domínio**
   - Clique em "Add a Site"
   - Digite: `dromeflow.com`
   - Escolha o plano (Free é suficiente)
   - Clique em "Add Site"

3. **Aguarde o scan DNS**
   - Cloudflare irá escanear seus registros DNS existentes
   - Revise e confirme os registros importados

### 1.2 Configurar Nameservers

1. **Copie os Nameservers do Cloudflare**
   - Exemplo:
     ```
     NS1: chloe.ns.cloudflare.com
     NS2: doug.ns.cloudflare.com
     ```

2. **Acesse o Painel do Registrador (Hostinger)**
   - Login em https://hpanel.hostinger.com
   - Navegue: Domínios → Selecione seu domínio
   - Clique em "Nameservers"

3. **Altere para Nameservers Personalizados**
   - Selecione "Usar nameservers personalizados"
   - Cole os nameservers do Cloudflare
   - Salve as alterações

4. **Aguarde Propagação**
   - Tempo: 2 a 24 horas (geralmente < 4 horas)
   - Verifique status no Cloudflare (será exibido "Active")

### 1.3 Configurar Registros DNS

1. **Acesse DNS no Cloudflare**
   - Dashboard → Seu domínio → DNS → Records

2. **Adicione o Registro Raiz (@)**
   ```
   Tipo: A
   Name: @
   IPv4: [IP do servidor Hostinger]
   Proxy status: Proxied (ícone laranja)
   TTL: Auto
   ```
   
   **Como obter o IP do Hostinger:**
   - hPanel → Hospedagem → Gerenciar
   - Procure por "IP Address" ou "Server IP"
   - Copie o endereço IPv4

3. **Adicione o Wildcard para Subdomínios**
   
   **Opção A: CNAME (Recomendado)**
   ```
   Tipo: CNAME
   Name: *
   Target: dromeflow.com
   Proxy status: Proxied (ícone laranja)
   TTL: Auto
   ```
   
   **Opção B: A Record**
   ```
   Tipo: A
   Name: *
   IPv4: [mesmo IP do registro @]
   Proxy status: Proxied (ícone laranja)
   TTL: Auto
   ```

4. **Adicione WWW (Opcional)**
   ```
   Tipo: CNAME
   Name: www
   Target: dromeflow.com
   Proxy status: Proxied (ícone laranja)
   TTL: Auto
   ```

### 1.4 Configurar SSL/TLS

1. **Acesse SSL/TLS Settings**
   - Dashboard → Seu domínio → SSL/TLS

2. **Configure o Modo de Criptografia**
   - Selecione: **Full (strict)** (recomendado) ou **Full**
   - Full (strict): Requer certificado válido no servidor
   - Full: Aceita certificado auto-assinado

3. **Ative o SSL Universal**
   - Navegue para: SSL/TLS → Edge Certificates
   - Verifique se "Universal SSL" está ativo
   - Status deve ser "Active Certificate"

4. **Configure Always Use HTTPS (Opcional)**
   - SSL/TLS → Edge Certificates
   - Ative "Always Use HTTPS"
   - Redireciona automaticamente HTTP → HTTPS

### 1.5 Gerar Certificado de Origem (Opcional)

Este passo é necessário apenas se você escolheu **Full (strict)** no modo SSL.

1. **Gere o Certificado**
   - SSL/TLS → Origin Server
   - Clique em "Create Certificate"
   - Hostnames: `dromeflow.com` e `*.dromeflow.com`
   - Validade: 15 anos
   - Clique em "Create"

2. **Copie as Chaves**
   - **Origin Certificate**: Copie todo o conteúdo (PEM)
   - **Private Key**: Copie todo o conteúdo

3. **Instale no Hostinger**
   - hPanel → SSL → Manage SSL certificates
   - Selecione seu domínio
   - Clique em "Upload Custom SSL"
   - Certificate (CRT): Cole o Origin Certificate
   - Private Key (KEY): Cole a Private Key
   - Deixe CA Bundle vazio
   - Clique em "Upload"

### 1.6 Otimizações de Performance (Opcional)

1. **Cache**
   - Caching → Configuration
   - Caching Level: Standard

2. **Auto Minify**
   - Speed → Optimization
   - Auto Minify: Ative JavaScript, CSS, HTML

3. **Brotli**
   - Speed → Optimization
   - Brotli: On

---

## 2. Configuração do Hostinger

### 2.1 Preparar Estrutura de Diretórios

1. **Acesse o hPanel**
   - Login em https://hpanel.hostinger.com
   - Selecione sua hospedagem

2. **Acesse o Gerenciador de Arquivos**
   - Navegue para: Arquivos → Gerenciador de arquivos
   - Ou use FTP/SFTP com cliente como FileZilla

3. **Estrutura Esperada**
   ```
   /
   ├── public_html/           ← Raiz do site
   │   ├── index.html         ← Arquivo principal do React
   │   ├── .htaccess          ← Rewrite rules
   │   ├── assets/            ← JS, CSS, imagens
   │   │   ├── index-abc123.js
   │   │   ├── index-def456.css
   │   │   └── ...
   │   └── favicon.ico
   └── ...
   ```

### 2.2 Criar/Editar .htaccess

1. **Navegue para public_html**

2. **Crie ou edite .htaccess**
   - Se não existir, clique em "Novo Arquivo" → `.htaccess`
   - Se existir, clique para editar

3. **Adicione as Regras de Rewrite**
   ```apache
   # Ativa o módulo de rewrite
   RewriteEngine On
   
   # Redireciona HTTP para HTTPS (apenas se não usar Always Use HTTPS no Cloudflare)
   # RewriteCond %{HTTPS} !=on
   # RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
   
   # Remove trailing slash (opcional, para URLs mais limpas)
   RewriteCond %{REQUEST_FILENAME} !-d
   RewriteCond %{REQUEST_URI} (.+)/$
   RewriteRule ^ %1 [L,R=301]
   
   # Arquivos e diretórios reais passam direto (assets, favicon, etc)
   RewriteCond %{REQUEST_FILENAME} -f [OR]
   RewriteCond %{REQUEST_FILENAME} -d
   RewriteRule ^ - [L]
   
   # SPA Fallback: Todas as outras requisições vão para index.html
   RewriteRule ^ /index.html [L]
   ```

4. **Salve o arquivo**

### 2.3 Configurar Subdomínios no hPanel (Opcional)

**Nota**: Com o wildcard DNS no Cloudflare, não é estritamente necessário, mas pode ajudar em alguns casos.

1. **Acesse Subdomínios**
   - hPanel → Domínios → Subdomínios

2. **Adicione um Wildcard (se suportado)**
   - Subdomínio: `*`
   - Document Root: `/public_html`
   - Clique em "Criar"

3. **Ou Adicione Subdomínios Específicos**
   - Para cada unidade:
     ```
     Subdomínio: mb-joinville
     Document Root: /public_html
     ```
   - Repita para outras unidades

### 2.4 Verificar Permissões

1. **Permissões do .htaccess**
   - Clique com botão direito → Permissões
   - Defina como: `644` (rw-r--r--)

2. **Permissões do index.html**
   - Defina como: `644` (rw-r--r--)

3. **Permissões da pasta public_html**
   - Defina como: `755` (rwxr-xr-x)

---

## 3. Configuração do Banco de Dados

### 3.1 Adicionar Coluna Slug na Tabela Units

1. **Acesse o Supabase SQL Editor**
   - Dashboard → SQL Editor

2. **Execute o Script de Migração**
   ```sql
   -- ========================================
   -- Adiciona coluna slug na tabela units
   -- ========================================
   
   -- 1. Adiciona a coluna slug (nullable inicialmente)
   ALTER TABLE public.units 
   ADD COLUMN IF NOT EXISTS slug text;
   
   -- 2. Gera slugs automaticamente a partir do unit_name
   -- Converte para lowercase e substitui caracteres não-alfanuméricos por hífen
   UPDATE public.units 
   SET slug = lower(
     regexp_replace(
       regexp_replace(unit_name, '[áàâãä]', 'a', 'gi'),
       '[^a-z0-9]+', '-', 'gi'
     )
   )
   WHERE slug IS NULL;
   
   -- Remove hífens do início e fim
   UPDATE public.units 
   SET slug = trim(both '-' from slug);
   
   -- 3. Torna a coluna obrigatória
   ALTER TABLE public.units 
   ALTER COLUMN slug SET NOT NULL;
   
   -- 4. Adiciona constraint de unicidade
   ALTER TABLE public.units 
   ADD CONSTRAINT units_slug_unique UNIQUE (slug);
   
   -- 5. Cria índice para performance
   CREATE INDEX IF NOT EXISTS idx_units_slug 
   ON public.units(slug);
   
   -- 6. Adiciona comentário
   COMMENT ON COLUMN public.units.slug IS 'Slug único para URL (kebab-case)';
   ```

3. **Verifique os Slugs Gerados**
   ```sql
   SELECT id, unit_name, slug, unit_code 
   FROM public.units 
   ORDER BY unit_name;
   ```
   
   **Exemplo de resultado esperado:**
   ```
   | id | unit_name        | slug              | unit_code |
   |----|------------------|-------------------|-----------|
   | 1  | MB Joinville     | mb-joinville      | MB        |
   | 2  | MB Blumenau      | mb-blumenau       | MBBLUM    |
   | 3  | MB Florianópolis | mb-florianopolis  | MBFLORIPA |
   ```

4. **Ajuste Slugs Manualmente (se necessário)**
   ```sql
   -- Exemplo: Encurtar ou personalizar slugs
   UPDATE public.units 
   SET slug = 'mb-joinville' 
   WHERE unit_code = 'MB';
   
   UPDATE public.units 
   SET slug = 'mb-blumenau' 
   WHERE unit_code = 'MBBLUM';
   ```

### 3.2 Verificar Coluna Code na Tabela Modules

1. **Verifique se já existe constraint unique**
   ```sql
   SELECT constraint_name, constraint_type
   FROM information_schema.table_constraints
   WHERE table_name = 'modules' 
     AND constraint_type = 'UNIQUE'
     AND constraint_name LIKE '%code%';
   ```

2. **Se não existir, adicione:**
   ```sql
   -- Adiciona constraint unique no code
   ALTER TABLE public.modules 
   ADD CONSTRAINT modules_code_unique UNIQUE (code);
   
   -- Cria índice para performance
   CREATE INDEX IF NOT EXISTS idx_modules_code 
   ON public.modules(code);
   
   -- Adiciona comentário
   COMMENT ON COLUMN public.modules.code IS 'Código único do módulo usado na URL';
   ```

3. **Verifique os Códigos dos Módulos**
   ```sql
   SELECT id, name, code, view_id, is_active 
   FROM public.modules 
   WHERE is_active = true
   ORDER BY position;
   ```
   
   **Exemplo de resultado esperado:**
   ```
   | id | name              | code          | view_id           | is_active |
   |----|-------------------|---------------|-------------------|-----------|
   | 1  | Dashboard         | dashboard     | dashboard         | true      |
   | 2  | Atendimentos      | atendimentos  | atendimentos      | true      |
   | 3  | Profissionais     | profissionais | profissionais     | true      |
   | 4  | Clientes          | clientes      | clientes          | true      |
   | 5  | Dashboard Sistema | admin         | dashboard_admin   | true      |
   ```

4. **Padronize Códigos (se necessário)**
   ```sql
   -- Garante que todos os codes estão em kebab-case
   UPDATE public.modules 
   SET code = lower(
     regexp_replace(code, '[^a-z0-9]+', '-', 'gi')
   )
   WHERE code ~ '[^a-z0-9-]';
   ```

### 3.3 Script Completo de Migração

Salve este arquivo como: `docs/sql/2025-11-15_subdomain_url_structure.sql`

```sql
-- =====================================================
-- Migração: Estrutura de Subdomínios e URLs por Módulo
-- Data: 2025-11-15
-- Descrição: Adiciona slug nas units e valida code nos modules
-- =====================================================

BEGIN;

-- ========================================
-- 1. TABELA UNITS: Adiciona slug
-- ========================================

-- Adiciona coluna slug
ALTER TABLE public.units 
ADD COLUMN IF NOT EXISTS slug text;

-- Gera slugs automaticamente
UPDATE public.units 
SET slug = lower(
  trim(both '-' from
    regexp_replace(
      regexp_replace(
        regexp_replace(unit_name, '[áàâãäÁÀÂÃÄ]', 'a', 'g'),
        '[éèêëÉÈÊË]', 'e', 'g'
      ),
      '[íìîïÍÌÎÏ]', 'i', 'g'
    )
  )
)
WHERE slug IS NULL;

-- Normaliza: remove caracteres especiais e múltiplos hífens
UPDATE public.units 
SET slug = regexp_replace(
  lower(slug), 
  '[^a-z0-9-]+', 
  '-', 
  'g'
);

UPDATE public.units 
SET slug = regexp_replace(slug, '-+', '-', 'g');

UPDATE public.units 
SET slug = trim(both '-' from slug);

-- Torna obrigatório e único
ALTER TABLE public.units 
ALTER COLUMN slug SET NOT NULL;

ALTER TABLE public.units 
ADD CONSTRAINT units_slug_unique UNIQUE (slug);

-- Índice para performance
CREATE INDEX IF NOT EXISTS idx_units_slug 
ON public.units(slug);

-- Comentário
COMMENT ON COLUMN public.units.slug IS 'Slug único para subdomínio (kebab-case, ex: mb-joinville)';

-- ========================================
-- 2. TABELA MODULES: Valida code
-- ========================================

-- Normaliza codes existentes
UPDATE public.modules 
SET code = lower(
  trim(both '-' from
    regexp_replace(
      regexp_replace(code, '[^a-z0-9-]+', '-', 'gi'),
      '-+', '-', 'g'
    )
  )
)
WHERE code ~ '[^a-z0-9-]';

-- Adiciona constraint unique (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'modules_code_unique'
  ) THEN
    ALTER TABLE public.modules 
    ADD CONSTRAINT modules_code_unique UNIQUE (code);
  END IF;
END $$;

-- Índice para performance
CREATE INDEX IF NOT EXISTS idx_modules_code 
ON public.modules(code);

-- Comentário
COMMENT ON COLUMN public.modules.code IS 'Código único do módulo usado na URL path (kebab-case, ex: atendimentos)';

COMMIT;

-- ========================================
-- 3. VERIFICAÇÃO
-- ========================================

-- Verifica slugs das unidades
SELECT 
  id, 
  unit_name, 
  slug, 
  unit_code,
  'https://' || slug || '.dromeflow.com' as url_example
FROM public.units 
ORDER BY unit_name;

-- Verifica codes dos módulos
SELECT 
  id, 
  name, 
  code, 
  view_id,
  is_active,
  'https://[unit-slug].dromeflow.com/' || code as url_example
FROM public.modules 
WHERE is_active = true
ORDER BY position;
```

---

## 4. Configuração da Aplicação

### 4.1 Criar Utilitários de URL

Crie o arquivo: `services/utils/urlUtils.ts`

```typescript
/**
 * Utilitários para gerenciar subdomínios e URLs de módulos
 */

// Domínio base da aplicação (sem subdomínio)
export const BASE_DOMAIN = 'dromeflow.com';

// Regex para validar slugs (kebab-case)
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Interface para resultado do parse de URL
 */
export interface ParsedUrl {
  unitSlug: string | null;
  moduleCode: string | null;
  isLocal: boolean;
  fullUrl: string;
}

/**
 * Detecta a unidade (slug) e o módulo (code) da URL atual
 * 
 * Produção: https://mb-joinville.dromeflow.com/atendimentos
 * - unitSlug: 'mb-joinville'
 * - moduleCode: 'atendimentos'
 * 
 * Local: http://localhost:5173/u/mb-joinville/atendimentos
 * - unitSlug: 'mb-joinville'
 * - moduleCode: 'atendimentos'
 */
export function parseUnitAndModule(): ParsedUrl {
  const hostname = window.location.hostname;
  const pathname = window.location.pathname;
  const fullUrl = window.location.href;
  
  let unitSlug: string | null = null;
  let moduleCode: string | null = null;
  let isLocal = false;

  // Ambiente local (localhost ou 127.0.0.1)
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.')) {
    isLocal = true;
    
    // Pattern: /u/:unitSlug/:moduleCode
    const localMatch = pathname.match(/^\/u\/([a-z0-9-]+)(?:\/([a-z0-9-]+))?/);
    if (localMatch) {
      unitSlug = localMatch[1] || null;
      moduleCode = localMatch[2] || null;
    }
  } 
  // Ambiente de produção (subdomínio)
  else if (hostname.endsWith(BASE_DOMAIN)) {
    const subdomain = hostname.slice(0, -(BASE_DOMAIN.length + 1)); // Remove '.dromeflow.com'
    
    // Valida subdomain (ignora 'www' e vazios)
    if (subdomain && subdomain !== 'www' && SLUG_REGEX.test(subdomain)) {
      unitSlug = subdomain;
    }
    
    // Extrai moduleCode do path
    const pathParts = pathname.replace(/^\/+/, '').split('/');
    if (pathParts[0] && SLUG_REGEX.test(pathParts[0])) {
      moduleCode = pathParts[0];
    }
  }

  return {
    unitSlug,
    moduleCode,
    isLocal,
    fullUrl
  };
}

/**
 * Constrói URL completa para unidade e módulo
 * 
 * Produção: buildUnitModuleUrl('mb-joinville', 'atendimentos')
 * → 'https://mb-joinville.dromeflow.com/atendimentos'
 * 
 * Local: buildUnitModuleUrl('mb-joinville', 'atendimentos', true)
 * → 'http://localhost:5173/u/mb-joinville/atendimentos'
 */
export function buildUnitModuleUrl(
  unitSlug: string, 
  moduleCode: string | null = null,
  forceLocal: boolean = false
): string {
  const isLocal = forceLocal || 
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.startsWith('192.168.');

  if (isLocal) {
    const base = `${window.location.protocol}//${window.location.host}`;
    const path = moduleCode ? `/u/${unitSlug}/${moduleCode}` : `/u/${unitSlug}`;
    return `${base}${path}`;
  }

  const base = `https://${unitSlug}.${BASE_DOMAIN}`;
  return moduleCode ? `${base}/${moduleCode}` : base;
}

/**
 * Atualiza a URL do navegador sem recarregar a página
 */
export function updateBrowserUrl(unitSlug: string, moduleCode: string | null) {
  const newUrl = buildUnitModuleUrl(unitSlug, moduleCode);
  const currentUrl = window.location.href;
  
  if (newUrl !== currentUrl) {
    window.history.pushState({ unitSlug, moduleCode }, '', newUrl);
  }
}

/**
 * Valida se um slug está no formato correto (kebab-case)
 */
export function isValidSlug(slug: string): boolean {
  return SLUG_REGEX.test(slug);
}

/**
 * Converte texto para slug (kebab-case)
 */
export function textToSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD') // Decompor caracteres acentuados
    .replace(/[\u0300-\u036f]/g, '') // Remover acentos
    .replace(/[^a-z0-9]+/g, '-') // Substituir não-alfanuméricos por hífen
    .replace(/^-+|-+$/g, '') // Remover hífens do início/fim
    .replace(/-+/g, '-'); // Remover hífens duplicados
}
```

### 4.2 Atualizar AppContext

Edite `contexts/AppContext.tsx` para integrar a detecção de URL:

```typescript
import { parseUnitAndModule, updateBrowserUrl } from '../services/utils/urlUtils';

// ... código existente ...

export const AppContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // ... estados existentes ...
  
  const [hasInitialized, setHasInitialized] = useState(false);

  // Inicialização: detecta unidade e módulo da URL
  useEffect(() => {
    if (!profile || hasInitialized) return;

    const initializeFromUrl = async () => {
      const { unitSlug, moduleCode } = parseUnitAndModule();
      
      console.log('[AppContext] Initializing from URL:', { unitSlug, moduleCode });

      // 1. Detecta unidade pelo slug
      if (unitSlug && userUnits.length > 0) {
        const unitFromSlug = userUnits.find(u => u.slug === unitSlug);
        
        if (unitFromSlug) {
          console.log('[AppContext] Unit found by slug:', unitFromSlug);
          setSelectedUnit(unitFromSlug);
          
          // 2. Carrega módulos da unidade
          const modules = getModulesForUnit(unitFromSlug.id);
          
          // 3. Detecta módulo pelo code
          if (moduleCode) {
            const moduleFromCode = modules.find(m => m.code === moduleCode);
            
            if (moduleFromCode) {
              console.log('[AppContext] Module found by code:', moduleFromCode);
              
              // Define view baseado em view_id ou code
              const viewToSet = moduleFromCode.view_id || moduleFromCode.code;
              setActiveView(viewToSet);
              setHasInitialized(true);
              return;
            } else {
              console.warn('[AppContext] Module code not found:', moduleCode);
            }
          }
          
          // 4. Fallback: primeiro módulo ativo da unidade
          const firstModule = modules.find(m => m.is_active);
          if (firstModule) {
            console.log('[AppContext] Loading first active module:', firstModule);
            const viewToSet = firstModule.view_id || firstModule.code;
            setActiveView(viewToSet);
            updateBrowserUrl(unitFromSlug.slug, firstModule.code);
          }
        } else {
          console.warn('[AppContext] Unit slug not found:', unitSlug);
          // Fallback: primeira unidade do usuário
          if (userUnits[0]) {
            setSelectedUnit(userUnits[0]);
            const modules = getModulesForUnit(userUnits[0].id);
            const firstModule = modules.find(m => m.is_active);
            if (firstModule) {
              const viewToSet = firstModule.view_id || firstModule.code;
              setActiveView(viewToSet);
              updateBrowserUrl(userUnits[0].slug, firstModule.code);
            }
          }
        }
      } else {
        // Sem slug na URL: usa primeira unidade
        if (userUnits[0]) {
          setSelectedUnit(userUnits[0]);
          const modules = getModulesForUnit(userUnits[0].id);
          const firstModule = modules.find(m => m.is_active);
          if (firstModule) {
            const viewToSet = firstModule.view_id || firstModule.code;
            setActiveView(viewToSet);
            updateBrowserUrl(userUnits[0].slug, firstModule.code);
          }
        }
      }
      
      setHasInitialized(true);
    };

    initializeFromUrl();
  }, [profile, userUnits, hasInitialized]);

  // Listener para botão voltar/avançar do navegador
  useEffect(() => {
    const handlePopState = () => {
      const { unitSlug, moduleCode } = parseUnitAndModule();
      
      console.log('[AppContext] PopState:', { unitSlug, moduleCode });
      
      // Atualiza unidade se mudou
      if (unitSlug && selectedUnit?.slug !== unitSlug) {
        const newUnit = userUnits.find(u => u.slug === unitSlug);
        if (newUnit) {
          setSelectedUnit(newUnit);
        }
      }
      
      // Atualiza módulo se mudou
      if (moduleCode && selectedUnit) {
        const modules = getModulesForUnit(selectedUnit.id);
        const module = modules.find(m => m.code === moduleCode);
        
        if (module) {
          const viewToSet = module.view_id || module.code;
          setActiveView(viewToSet);
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [selectedUnit, userUnits]);

  // Atualiza URL quando view muda
  const setView = useCallback((view: string) => {
    if (!selectedUnit) return;
    
    console.log('[AppContext] Setting view:', view);
    
    // Encontra módulo pelo view_id ou code
    const modules = getModulesForUnit(selectedUnit.id);
    const module = modules.find(m => m.view_id === view || m.code === view);
    
    if (module) {
      setActiveView(view);
      updateBrowserUrl(selectedUnit.slug, module.code);
    } else {
      console.warn('[AppContext] Module not found for view:', view);
      setActiveView(view);
    }
  }, [selectedUnit]);

  // Atualiza URL quando unidade muda
  useEffect(() => {
    if (!selectedUnit || !hasInitialized) return;
    
    const modules = getModulesForUnit(selectedUnit.id);
    const currentModule = modules.find(m => m.view_id === activeView || m.code === activeView);
    
    if (currentModule) {
      updateBrowserUrl(selectedUnit.slug, currentModule.code);
    }
  }, [selectedUnit, hasInitialized]);

  // ... resto do código ...
};
```

### 4.3 Atualizar types.ts

Adicione o campo `slug` na interface `Unit`:

```typescript
export interface Unit {
  id: string;
  unit_name: string;
  unit_code: string;
  slug: string; // ← NOVO CAMPO
  address?: string | null;
  is_active: boolean;
  created_at: string;
}
```

### 4.4 Atualizar Queries do Supabase

Em todos os lugares que fazem query na tabela `units`, adicione `slug`:

**Exemplo em `AuthContext.tsx`:**

```typescript
const { data: unitsData, error: unitsError } = await supabase
  .from('units')
  .select('id, unit_name, unit_code, slug, address, is_active, created_at')
  .in('id', unitIds);
```

**Exemplo em `services/units/units.service.ts`:**

```typescript
export async function fetchAllUnits(): Promise<Unit[]> {
  const { data, error } = await supabase
    .from('units')
    .select('id, unit_name, unit_code, slug, address, is_active, created_at')
    .order('unit_name');
    
  if (error) throw error;
  return data || [];
}
```

### 4.5 Atualizar Navegação na Sidebar

Edite `components/layout/Sidebar.tsx`:

```typescript
import { updateBrowserUrl } from '../../services/utils/urlUtils';

// ... código existente ...

const handleModuleClick = (module: Module) => {
  if (!selectedUnit) return;
  
  const viewToSet = module.view_id || module.code;
  setView(viewToSet);
  
  // URL será atualizada automaticamente pelo AppContext
  // mas podemos garantir aqui também
  updateBrowserUrl(selectedUnit.slug, module.code);
};

// ... no JSX ...
<button
  key={module.id}
  onClick={() => handleModuleClick(module)}
  className={/* ... estilos ... */}
>
  {/* ... conteúdo do botão ... */}
</button>
```

---

## 5. Deploy e Build

### 5.1 Build da Aplicação

1. **Limpe a build anterior**
   ```bash
   rm -rf dist/
   ```

2. **Execute o build**
   ```bash
   npm run build
   ```

3. **Verifique a saída**
   ```bash
   ls -la dist/
   ```
   
   Deve conter:
   ```
   dist/
   ├── index.html
   ├── assets/
   │   ├── index-[hash].js
   │   ├── index-[hash].css
   │   └── ...
   └── favicon.ico
   ```

### 5.2 Testar Build Localmente

1. **Instale servidor estático**
   ```bash
   npm install -g serve
   ```

2. **Sirva a pasta dist**
   ```bash
   serve -s dist -l 3000
   ```

3. **Teste no navegador**
   - http://localhost:3000/u/mb-joinville/dashboard
   - http://localhost:3000/u/mb-joinville/atendimentos

### 5.3 Upload para Hostinger

**Opção A: Via hPanel File Manager**

1. Acesse: Arquivos → Gerenciador de arquivos
2. Navegue para `public_html`
3. **Backup do .htaccess atual**
   - Clique com botão direito → Download
   - Salve como `.htaccess.backup`
4. **Delete arquivos antigos** (exceto .htaccess)
5. **Upload da pasta dist**
   - Selecione todos os arquivos de `dist/`
   - Arraste para `public_html/`
   - Aguarde o upload
6. **Restaure/Atualize .htaccess**
   - Cole as regras da seção 2.2

**Opção B: Via FTP/SFTP**

1. **Conecte via FileZilla**
   - Host: `ftp.dromeflow.com`
   - Usuário: (do hPanel)
   - Senha: (do hPanel)
   - Porta: 21 (FTP) ou 22 (SFTP)

2. **Navegue para /public_html**

3. **Backup**
   - Download do .htaccess
   - Delete arquivos antigos

4. **Upload**
   - Arraste conteúdo de `dist/` para `public_html/`
   - Sobrescreva quando perguntado

5. **Verifique .htaccess**

**Opção C: Via Git Deploy (Avançado)**

Configure git hooks no servidor para deploy automático em push.

### 5.4 Verificar Permissões Pós-Upload

1. **Via hPanel File Manager:**
   - Selecione todos os arquivos
   - Clique com botão direito → Permissões
   - Arquivos: `644`
   - Pastas: `755`

2. **Via FTP:**
   - Clique com botão direito → File Permissions
   - Arquivos: `644` (rw-r--r--)
   - Pastas: `755` (rwxr-xr-x)

---

## 6. Testes e Validação

### 6.1 Testes de DNS

1. **Teste o registro raiz**
   ```bash
   dig +short dromeflow.com
   ```
   Deve retornar o IP do servidor.

2. **Teste um subdomínio específico**
   ```bash
   dig +short mb-joinville.dromeflow.com
   ```
   Deve retornar o mesmo IP ou o IP do Cloudflare (se proxied).

3. **Teste o wildcard**
   ```bash
   dig +short qualquer-coisa.dromeflow.com
   ```
   Deve retornar o IP (se wildcard configurado).

4. **Verifique propagação**
   - https://www.whatsmydns.net/
   - Digite: `mb-joinville.dromeflow.com`
   - Tipo: A
   - Verifique em diferentes locais

### 6.2 Testes de SSL

1. **Teste HTTPS**
   ```bash
   curl -I https://mb-joinville.dromeflow.com
   ```
   Deve retornar `200` ou `301`/`302`.

2. **Verifique certificado**
   ```bash
   openssl s_client -connect mb-joinville.dromeflow.com:443 -servername mb-joinville.dromeflow.com < /dev/null
   ```
   Deve mostrar certificado válido do Cloudflare.

3. **Teste em múltiplos navegadores**
   - Chrome/Edge
   - Firefox
   - Safari
   - Mobile (iOS/Android)

### 6.3 Testes de Roteamento

1. **Acesso raiz do subdomínio**
   - https://mb-joinville.dromeflow.com
   - Deve carregar app e redirecionar para primeiro módulo

2. **Acesso direto a módulo**
   - https://mb-joinville.dromeflow.com/dashboard
   - https://mb-joinville.dromeflow.com/atendimentos
   - https://mb-joinville.dromeflow.com/profissionais
   - Cada URL deve carregar o módulo correto

3. **Navegação interna**
   - Clique nos módulos na sidebar
   - URL deve atualizar sem reload
   - Conteúdo deve mudar

4. **Botão voltar/avançar**
   - Navegue por vários módulos
   - Use botão voltar do navegador
   - Módulo anterior deve carregar
   - Use botão avançar
   - Módulo seguinte deve carregar

5. **Compartilhamento de link**
   - Copie URL de um módulo
   - Cole em nova aba anônima
   - Deve abrir diretamente no módulo correto

6. **Deep linking**
   - Envie link https://mb-joinville.dromeflow.com/profissionais via WhatsApp
   - Abra no mobile
   - Deve abrir app no módulo Profissionais

### 6.4 Testes de Unidades Múltiplas

1. **Crie URLs para diferentes unidades**
   - https://mb-joinville.dromeflow.com/dashboard
   - https://mb-blumenau.dromeflow.com/dashboard

2. **Verifique isolamento de dados**
   - Cada subdomínio deve mostrar dados da unidade correta
   - Filtros devem estar aplicados automaticamente

3. **Teste troca de unidade**
   - Login como usuário com múltiplas unidades
   - Troque de unidade no seletor
   - URL deve mudar para novo subdomínio
   - Dados devem atualizar

### 6.5 Testes de Erros

1. **Slug inválido**
   - https://unidade-inexistente.dromeflow.com
   - Deve redirecionar para primeira unidade do usuário ou página de erro

2. **Module code inválido**
   - https://mb-joinville.dromeflow.com/modulo-inexistente
   - Deve redirecionar para primeiro módulo da unidade

3. **Usuário sem permissão**
   - Login como user sem acesso ao módulo
   - Tente acessar URL direta
   - Deve redirecionar para módulo permitido

4. **Sem autenticação**
   - Logout
   - Tente acessar qualquer URL
   - Deve redirecionar para login
   - Após login, deve voltar para URL original

### 6.6 Checklist de Validação Final

- [ ] DNS propagado globalmente (whatsmydns.net)
- [ ] SSL válido em todos os subdomínios
- [ ] Wildcard funciona para qualquer subdomínio
- [ ] .htaccess aplicado corretamente
- [ ] Build mais recente no servidor
- [ ] Slugs das unidades corretos no banco
- [ ] Codes dos módulos corretos no banco
- [ ] AppContext detecta unidade da URL
- [ ] AppContext detecta módulo da URL
- [ ] Navegação atualiza URL sem reload
- [ ] Botão voltar/avançar funciona
- [ ] Deep links abrem módulo correto
- [ ] Compartilhamento de link funciona
- [ ] Mobile funciona corretamente
- [ ] Console sem erros JavaScript
- [ ] Network sem erros 404
- [ ] Performance aceitável (< 3s load)

---

## 7. Troubleshooting

### Problema: Subdomínio não resolve (DNS)

**Sintoma:** `nslookup mb-joinville.dromeflow.com` retorna erro ou IP errado.

**Causas Possíveis:**
1. Nameservers não atualizados no registrador
2. Wildcard DNS não configurado no Cloudflare
3. Propagação ainda em andamento

**Soluções:**
1. **Verifique nameservers:**
   ```bash
   dig NS dromeflow.com
   ```
   Deve mostrar nameservers do Cloudflare (ex: `*.ns.cloudflare.com`)

2. **Verifique wildcard no Cloudflare:**
   - Dashboard → DNS → Deve ter registro `*` (CNAME ou A)

3. **Aguarde propagação:**
   - Pode levar até 24h
   - Use https://www.whatsmydns.net/ para monitorar

4. **Force refresh DNS local:**
   ```bash
   # macOS
   sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder
   
   # Windows
   ipconfig /flushdns
   
   # Linux
   sudo systemd-resolve --flush-caches
   ```

### Problema: SSL/HTTPS não funciona

**Sintoma:** "Sua conexão não é particular" ou certificado inválido.

**Causas Possíveis:**
1. SSL/TLS não configurado no Cloudflare
2. Modo de criptografia incompatível
3. Certificado de origem ausente no servidor

**Soluções:**
1. **Verifique modo SSL no Cloudflare:**
   - Dashboard → SSL/TLS → deve ser **Full** ou **Full (strict)**

2. **Aguarde emissão do Universal SSL:**
   - SSL/TLS → Edge Certificates
   - Status deve ser "Active Certificate"
   - Pode levar até 24h após adicionar domínio

3. **Se Full (strict), instale certificado de origem:**
   - Gere em SSL/TLS → Origin Server
   - Instale no hPanel → SSL

4. **Force HTTPS:**
   - SSL/TLS → Edge Certificates → Always Use HTTPS: ON

### Problema: .htaccess não funciona

**Sintoma:** URLs diretas dão 404, apenas `/` funciona.

**Causas Possíveis:**
1. mod_rewrite não habilitado
2. .htaccess com sintaxe incorreta
3. Permissões do arquivo erradas

**Soluções:**
1. **Verifique se .htaccess está na raiz:**
   - Deve estar em `/public_html/.htaccess`

2. **Verifique permissões:**
   - Deve ser `644` (rw-r--r--)

3. **Teste sintaxe:**
   - Adicione linha por linha
   - Recarregue após cada mudança
   - Se quebrar, volte uma linha

4. **Entre em contato com suporte:**
   - Alguns hosts desabilitam .htaccess
   - Peça para habilitar mod_rewrite

### Problema: Página em branco ou erro JavaScript

**Sintoma:** Página carrega mas fica em branco, console mostra erros.

**Causas Possíveis:**
1. Build desatualizado
2. Paths de assets incorretos
3. Variáveis de ambiente faltando
4. CORS bloqueando requisições

**Soluções:**
1. **Limpe cache e rebuild:**
   ```bash
   rm -rf dist/ node_modules/.vite
   npm run build
   ```

2. **Verifique base no vite.config.ts:**
   ```typescript
   export default defineConfig({
     base: '/', // Deve ser '/' para subdomínios
     // ...
   });
   ```

3. **Verifique .env:**
   - Variáveis `VITE_*` devem existir
   - Rebuild após alterar .env

4. **Verifique Console:**
   - F12 → Console
   - Leia erros específicos
   - Procure erros de CORS, 404, etc.

### Problema: URL não atualiza ao navegar

**Sintoma:** Clique nos módulos funciona, mas URL permanece a mesma.

**Causas Possíveis:**
1. `updateBrowserUrl` não sendo chamado
2. `history.pushState` falhando
3. Slug da unidade não encontrado

**Soluções:**
1. **Verifique logs do console:**
   ```javascript
   console.log('[AppContext] Setting view:', view);
   ```

2. **Verifique se slug existe:**
   ```sql
   SELECT id, unit_name, slug FROM units;
   ```

3. **Debug urlUtils:**
   ```typescript
   const parsed = parseUnitAndModule();
   console.log('Parsed URL:', parsed);
   ```

### Problema: Botão voltar não funciona

**Sintoma:** Botão voltar recarrega página ou não muda módulo.

**Causas Possíveis:**
1. Listener `popstate` não registrado
2. Estado não sincronizando com URL

**Soluções:**
1. **Verifique listener no AppContext:**
   ```typescript
   useEffect(() => {
     const handlePopState = () => {
       console.log('PopState triggered');
       // ...
     };
     window.addEventListener('popstate', handlePopState);
     return () => window.removeEventListener('popstate', handlePopState);
   }, []);
   ```

2. **Verifique se pushState está sendo usado:**
   - Não deve ter `window.location.href =` (recarrega página)
   - Use `history.pushState` (mantém SPA)

### Problema: Dados da unidade errada

**Sintoma:** Acessa subdomínio de uma unidade mas vê dados de outra.

**Causas Possíveis:**
1. `selectedUnit` não atualizando
2. Filtro de unidade não aplicado nas queries
3. Cache de dados antigos

**Soluções:**
1. **Verifique detecção de unidade:**
   ```typescript
   const { unitSlug } = parseUnitAndModule();
   console.log('Detected unit slug:', unitSlug);
   console.log('Selected unit:', selectedUnit);
   ```

2. **Verifique queries Supabase:**
   - Devem incluir `.eq('unit_id', selectedUnit.id)` ou similar

3. **Force reload de dados:**
   ```typescript
   useEffect(() => {
     if (selectedUnit) {
       loadData(); // Recarrega ao mudar unidade
     }
   }, [selectedUnit]);
   ```

### Problema: Performance lenta

**Sintoma:** App carrega devagar, transições lentas.

**Causas Possíveis:**
1. Assets não comprimidos
2. Cache não configurado
3. Queries ineficientes
4. Imagens não otimizadas

**Soluções:**
1. **Ative compressão no Cloudflare:**
   - Speed → Optimization → Brotli: ON
   - Speed → Optimization → Auto Minify: JS, CSS, HTML

2. **Verifique bundle size:**
   ```bash
   npm run build
   # Olhe tamanho dos chunks em dist/assets/
   ```

3. **Otimize queries:**
   - Use `.select()` específico (não `*`)
   - Adicione índices no banco
   - Use paginação

4. **Otimize imagens:**
   - Use WebP quando possível
   - Comprima antes do upload
   - Use lazy loading

### Problema: Links externos não funcionam

**Sintoma:** Links de módulos externos (`internal://...`) dão erro.

**Causas Possíveis:**
1. Webhook não configurado
2. URL do webhook incorreta
3. CORS bloqueando

**Soluções:**
1. **Verifique campo external_url no módulo:**
   ```sql
   SELECT id, name, code, external_url 
   FROM modules 
   WHERE external_url IS NOT NULL;
   ```

2. **Verifique ContentArea.tsx:**
   - Deve buscar HTML quando `external_url` começa com `internal://`

3. **Configure CORS no webhook:**
   - N8N: Settings → Security → CORS
   - Adicione origem: `https://*.dromeflow.com`

---

## Recursos Adicionais

### Links Úteis

- **Cloudflare Docs:** https://developers.cloudflare.com/
- **Hostinger Help:** https://support.hostinger.com/
- **Apache mod_rewrite:** https://httpd.apache.org/docs/current/mod/mod_rewrite.html
- **React Router (referência):** https://reactrouter.com/
- **Supabase Docs:** https://supabase.com/docs

### Ferramentas de Debug

- **DNS Checker:** https://dnschecker.org/
- **What's My DNS:** https://www.whatsmydns.net/
- **SSL Checker:** https://www.sslshopper.com/ssl-checker.html
- **GTmetrix (Performance):** https://gtmetrix.com/
- **Chrome DevTools:** F12 → Network, Console, Application

### Comandos Úteis

```bash
# Limpar cache do build
rm -rf dist/ node_modules/.vite

# Rebuild completo
npm ci && npm run build

# Servir build localmente
npx serve -s dist -l 3000

# Verificar DNS
dig +short mb-joinville.dromeflow.com

# Testar HTTPS
curl -I https://mb-joinville.dromeflow.com

# Ver logs do servidor (se tiver SSH)
tail -f /var/log/apache2/error.log
```

### Contatos de Suporte

- **Cloudflare Support:** https://support.cloudflare.com/
- **Hostinger Support:** https://www.hostinger.com.br/contato
- **Supabase Support:** https://supabase.com/support

---

## Conclusão

Após seguir todos os passos deste guia, você terá:

✅ Subdomínios funcionando para cada unidade
✅ URLs amigáveis para cada módulo
✅ SSL/HTTPS configurado automaticamente
✅ Navegação sem reload de página
✅ Deep linking funcional
✅ Histórico do navegador sincronizado
✅ Performance otimizada via Cloudflare
✅ Sistema escalável para novas unidades

**Próximos passos sugeridos:**
- Configure monitoramento de uptime (ex: UptimeRobot)
- Implemente analytics (Google Analytics, Plausible)
- Configure backups automáticos
- Adicione testes E2E (Cypress, Playwright)
- Configure CI/CD para deploy automático

---

**Documento criado em:** 15 de novembro de 2025
**Última atualização:** 15 de novembro de 2025
**Versão:** 1.0
**Autor:** GitHub Copilot
