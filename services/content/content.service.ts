/**
 * content.service.ts
 * Serviço para conteúdo de módulos (webhooks, etc.).
 */

export const fetchWebhookContent = async (url: string | null | undefined, unitCode: string): Promise<string> => {
	if (!url) {
		return `<div class="text-gray-500 p-4">Nenhuma URL de conteúdo configurada para este módulo.</div>`;
	}

	if (url.startsWith('internal://')) {
		return `<p>Conteúdo interno para ${url.replace('internal://', '')} e unidade ${unitCode}.</p>`;
	}
	try {
		const response = await fetch(url);
		if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
		return await response.text();
	} catch (error) {
		console.error('Failed to fetch webhook content:', error);
		return `<div class="text-danger">Falha ao carregar conteúdo de ${url}.</div>`;
	}
};

