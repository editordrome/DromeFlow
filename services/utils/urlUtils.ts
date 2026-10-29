/**
 * Utilitários para gerenciar subdomínios e URLs de módulos
 */

// Domínio base da aplicação
export const BASE_DOMAIN = 'dromeflow.com';

/**
 * Interface para resultado do parse de URL
 */
export interface ParsedUrl {
    unitSlug: string | null;
    moduleCode: string | null;
    isLocal: boolean;
}

/**
 * Detecta a unidade (slug) e o módulo (code) da URL atual
 */
export function parseUnitAndModule(): ParsedUrl {
    const hostname = window.location.hostname;
    const pathname = window.location.pathname;

    let unitSlug: string | null = null;
    let moduleCode: string | null = null;
    let isLocal = false;

    // Ambiente local (localhost ou IPs de rede local)
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.')) {
        isLocal = true;

        // Pattern local sugerido: /u/:unitSlug/:moduleCode
        // Ex: /u/londrina/atendimentos
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
        if (subdomain && subdomain !== 'www') {
            unitSlug = subdomain;
        }

        // Extrai moduleCode do path (primeiro segmento)
        const pathParts = pathname.replace(/^\/+/, '').split('/');
        if (pathParts[0]) {
            moduleCode = pathParts[0];
        }
    }

    return { unitSlug, moduleCode, isLocal };
}

/**
 * Constrói URL completa para unidade e módulo
 */
export function buildUnitModuleUrl(
    unitSlug: string,
    moduleCode: string | null = null,
    forceLocal: boolean = false
): string {
    const hostname = window.location.hostname;
    const isLocal = forceLocal || hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.');

    if (isLocal) {
        const base = `${window.location.protocol}//${window.location.host}`;
        const path = moduleCode ? `/u/${unitSlug}/${moduleCode}` : `/u/${unitSlug}`;
        return `${base}${path}`;
    }

    const base = `https://${unitSlug}.${BASE_DOMAIN}`;
    return moduleCode ? `${base}/${moduleCode}` : base;
}

/**
 * Atualiza a URL sem recarregar a página (apenas se o host não mudar)
 */
export function updateBrowserPath(moduleCode: string | null) {
    const currentPath = window.location.pathname;
    const { unitSlug, isLocal } = parseUnitAndModule();

    let newPath = '/';
    if (isLocal && unitSlug) {
        newPath = moduleCode ? `/u/${unitSlug}/${moduleCode}` : `/u/${unitSlug}`;
    } else {
        newPath = moduleCode ? `/${moduleCode}` : '/';
    }

    if (newPath !== currentPath) {
        window.history.pushState({ moduleCode }, '', newPath);
    }
}
