export interface InfinitePayCheckoutPayload {
    amount: number; // Em centavos (ex: 100 = R$ 1,00)
    description: string;
    expires_in?: number;
    payment_methods?: ('credit' | 'pix' | 'billet')[];
}

/**
 * Criação da intenção de cobrança / Link de Pagamento via API da InfinitePay
 * Documentação: https://app.infinitepay.io/external-checkout
 */
export const createInfiniteCheckoutLink = async (
    payload: InfinitePayCheckoutPayload,
    clientId: string,
    clientSecret: string
): Promise<{ url: string; id: string }> => {
    
    // TODO: Recuperar token OAuth com o client_id e client_secret
    // const token = await fetch('https://api.infinitepay.io/v2/oauth/token', ...)

    console.info('[InfinitePay API] Creating link for:', payload.description, 'Amount:', payload.amount);

    // TODO: Realizar chamada concreta para gerar o link (Substituir Mock)
    /*
    const response = await fetch('https://api.infinitepay.io/v2/payment-links', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
    });
    */

    // Retorno mockado simulando estrutura da API InfinitePay
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({
                url: `https://pay.infinitepay.io/mock-link-${Math.random().toString(36).substring(7)}`,
                id: 'inv_abcd1234'
            });
        }, 800);
    });
};
