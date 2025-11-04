/**
 * Evolution API Service
 * 
 * Serviço para comunicação direta com a Evolution API v2.
 * Documentação: https://doc.evolution-api.com/v2/api-reference
 * 
 * Este serviço NÃO acessa o Supabase diretamente - apenas faz requisições HTTP
 * para a Evolution API externa.
 */

import type {
  EvolutionApiInstanceResponse,
  EvolutionApiConnectionState,
  EvolutionApiQRCode,
} from '../../types';

/**
 * Cria uma nova instância na Evolution API
 * POST /instance/create
 */
export async function createEvolutionApiInstance(
  apiUrl: string,
  apiKey: string,
  instanceName: string,
  webhookUrl?: string,
  webhookEvents?: string[]
): Promise<EvolutionApiInstanceResponse> {
  const url = `${apiUrl}/instance/create`;
  
  const payload: any = {
    instanceName,
    token: apiKey,
    qrcode: true, // Gerar QR Code automaticamente
  };

  if (webhookUrl) {
    payload.webhook = webhookUrl;
    payload.webhook_by_events = true;
    payload.events = webhookEvents || [
      'QRCODE_UPDATED',
      'MESSAGES_UPSERT',
      'MESSAGES_UPDATE',
      'MESSAGES_DELETE',
      'SEND_MESSAGE',
      'CONNECTION_UPDATE',
    ];
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Evolution API Error (${response.status}): ${errorText}`);
  }

  return response.json();
}

/**
 * Obtém o QR Code para conexão de uma instância
 * GET /instance/connect/{instanceName}
 */
export async function getEvolutionQRCode(
  apiUrl: string,
  apiKey: string,
  instanceName: string
): Promise<EvolutionApiQRCode> {
  const url = `${apiUrl}/instance/connect/${instanceName}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'apikey': apiKey,
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Evolution API Error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  
  // A API pode retornar diferentes formatos
  if (data.qrcode) {
    return {
      code: data.qrcode.code || data.qrcode.base64,
      base64: data.qrcode.base64 || data.qrcode.code,
    };
  }
  
  if (data.code || data.base64) {
    return {
      code: data.code || data.base64,
      base64: data.base64 || data.code,
    };
  }

  throw new Error('QR Code não encontrado na resposta da API');
}

/**
 * Verifica o estado da conexão de uma instância
 * GET /instance/connectionState/{instanceName}
 */
export async function checkEvolutionConnectionState(
  apiUrl: string,
  apiKey: string,
  instanceName: string
): Promise<EvolutionApiConnectionState> {
  const url = `${apiUrl}/instance/connectionState/${instanceName}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'apikey': apiKey,
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Evolution API Error (${response.status}): ${errorText}`);
  }

  return response.json();
}

/**
 * Desconecta (logout) de uma instância
 * DELETE /instance/logout/{instanceName}
 */
export async function logoutEvolutionInstance(
  apiUrl: string,
  apiKey: string,
  instanceName: string
): Promise<void> {
  const url = `${apiUrl}/instance/logout/${instanceName}`;

  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'apikey': apiKey,
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Evolution API Error (${response.status}): ${errorText}`);
  }
}

/**
 * Exclui uma instância permanentemente da Evolution API
 * DELETE /instance/delete/{instanceName}
 */
export async function deleteEvolutionApiInstance(
  apiUrl: string,
  apiKey: string,
  instanceName: string
): Promise<void> {
  const url = `${apiUrl}/instance/delete/${instanceName}`;

  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'apikey': apiKey,
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Evolution API Error (${response.status}): ${errorText}`);
  }
}

/**
 * Lista todas as instâncias cadastradas na Evolution API
 * GET /instance/fetchInstances
 */
export async function fetchEvolutionApiInstances(
  apiUrl: string,
  apiKey: string
): Promise<any[]> {
  const url = `${apiUrl}/instance/fetchInstances`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'apikey': apiKey,
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Evolution API Error (${response.status}): ${errorText}`);
  }

  return response.json();
}

/**
 * Envia uma mensagem de texto para testar a conexão
 * POST /message/sendText/{instanceName}
 */
export async function sendEvolutionTestMessage(
  apiUrl: string,
  apiKey: string,
  instanceName: string,
  to: string, // Número no formato: 5511999999999
  message: string
): Promise<any> {
  const url = `${apiUrl}/message/sendText/${instanceName}`;

  const payload = {
    number: to,
    text: message,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Evolution API Error (${response.status}): ${errorText}`);
  }

  return response.json();
}

/**
 * Valida se a API Key e URL são válidas
 * Tenta buscar as instâncias para verificar a conexão
 */
export async function validateEvolutionApiCredentials(
  apiUrl: string,
  apiKey: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    await fetchEvolutionApiInstances(apiUrl, apiKey);
    return { valid: true };
  } catch (error: any) {
    return {
      valid: false,
      error: error?.message || 'Erro ao validar credenciais',
    };
  }
}
