import { supabase } from '../supabaseClient';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface UmblerTag {
  id: string;
  name: string;
  color?: string | null;
  icon?: string | null;
}

export interface UmblerCustomField {
  id: string;
  name: string;
  description?: string | null;
}

export interface UmblerBot {
  id: string;
  title: string;
  description?: string | null;
  isActive?: boolean;
}

export interface UmblerChannel {
  phoneNumber?: string | null;
}

export interface UmblerQuickAnswer {
  id: string;
  name: string;
  content: string;
  visibility: 'All' | 'Mine';
  groupIds: string[];
}

export type UmblerScheduledMessageStatus = 'Pending' | 'Error' | 'Sent' | 'Canceled';

export interface UmblerScheduledMessage {
  id: string;
  organizationId: string;
  contactId: string;
  scheduledAt: string;
  status: UmblerScheduledMessageStatus;
  content: string;
  channelId?: string;
  organizationMemberId?: string;
  isPrivate?: boolean;
}

export interface UmblerOrganization {
  id: string;
  name: string;
  socialReason?: string | null;
  cnpj?: string | null;
  financeEmail?: string | null;
  financeWhatsapp?: string | null;
  phone?: string | null;
  cep?: string | null;
  road?: string | null;
  number?: string | null;
  complement?: string | null;
  neighbourhood?: string | null;
  city?: string | null;
  state?: string | null;
  iconUrl?: string | null;
  logoUrl?: string | null; // legado
  timezone?: string | null;
  language?: string | null;
}

export interface UmblerUnitKey {
  unit_id: string;
  unit_name: string;
  organizationID: string;
}

export interface UmblerPreset {
  id?: string;
  preset_type: 'bot' | 'tag' | 'variable' | 'tag_template' | 'quick_answer';
  name: string;
  description?: string;
  config: Record<string, any>;
  created_at?: string;
}

// ─── Token global (system_settings) ────────────────────────────────────────
// Não usa FK de usuário — é uma configuração global super_admin.

const TOKEN_KEY = 'umbler_bearer_token';

export async function getApiToken(): Promise<string | null> {
  const { data, error } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', TOKEN_KEY)
    .maybeSingle();

  if (error) throw new Error(`Erro ao buscar token: ${error.message}`);
  return (data?.value && data.value.trim().length > 0) ? data.value.trim() : null;
}

export async function saveApiToken(token: string): Promise<void> {
  // Usa UPDATE direto — a row 'umbler_bearer_token' já existe no banco.
  // Evita o problema de INSERT+RLS com upsert em tabelas com RLS desabilitada.
  const { error } = await supabase
    .from('system_settings')
    .update({ value: token.trim(), updated_at: new Date().toISOString() })
    .eq('key', TOKEN_KEY);

  if (error) throw new Error(`Erro ao salvar token: ${error.message}`);
}

// ─── Unidades com organizationID ────────────────────────────────────────────

export async function listUnitsWithOrgId(): Promise<UmblerUnitKey[]> {
  const { data, error } = await supabase
    .from('unit_keys')
    .select(`unit_id, organizationID, units ( unit_name )`)
    .eq('is_active', true)
    .not('organizationID', 'is', null);

  if (error) throw new Error(`Erro ao buscar unidades: ${error.message}`);

  return (data || []).map((row: any) => ({
    unit_id: row.unit_id,
    unit_name: Array.isArray(row.units)
      ? (row.units[0]?.unit_name ?? row.unit_id)
      : (row.units?.unit_name ?? row.unit_id),
    organizationID: row.organizationID,
  })).filter(u => !!u.organizationID);
}

// ID da unidade MB Dromedário (template source)
export const MB_DROME_ORG_ID = 'Zvd396wFtPefqFmN';

export async function getUnitDetails(unitId: string): Promise<any> {
  const { data, error } = await supabase
    .from('units')
    .select('*')
    .eq('id', unitId)
    .single();

  if (error) throw new Error(`Erro ao buscar detalhes da unidade: ${error.message}`);
  return data;
}

// ─── Proxy caller ──────────────────────────────────────────────────────────

export async function callProxy<T = any>(
  endpoint: string,
  method: string,
  token: string,
  body?: Record<string, any>
): Promise<T> {
  const { data, error } = await supabase.functions.invoke('umbler-proxy', {
    body: { endpoint, method, token, body }
  });

  if (error) throw new Error(`Proxy error: ${error.message}`);
  if (data?.error) throw new Error(String(data.error));
  return data as T;
}

// ── QUICK ANSWERS (Respostas Rápidas) ─────────────────────────────────────────

export const listQuickAnswers = async (orgId: string, token: string): Promise<UmblerQuickAnswer[]> => {
  const res = await callProxy<any>(`/v1/quick-answers/?organizationId=${orgId}`, 'GET', token);
  return (res?.items ?? res?.results ?? (Array.isArray(res) ? res : [])) as UmblerQuickAnswer[];
};

export const createQuickAnswer = async (orgId: string, token: string, payload: Partial<UmblerQuickAnswer>) => {
  return callProxy<UmblerQuickAnswer>('/v1/quick-answers/', 'POST', token, { 
    organizationId: orgId,
    name: payload.name,
    content: payload.content,
    visibility: payload.visibility || 'All',
    groupIds: payload.groupIds || []
  });
};

export const updateQuickAnswer = async (orgId: string, token: string, id: string, payload: Partial<UmblerQuickAnswer>) => {
  return callProxy<UmblerQuickAnswer>(`/v1/quick-answers/${id}/?organizationId=${orgId}`, 'PUT', token, {
    name: payload.name,
    content: payload.content,
    visibility: payload.visibility || 'All'
  });
};

export const deleteQuickAnswer = async (orgId: string, token: string, id: string) => {
  return callProxy(`/v1/quick-answers/${id}/?organizationId=${orgId}`, 'DELETE', token);
};

// ─── Tags ──────────────────────────────────────────────────────────────────

export async function listTags(orgId: string, token: string): Promise<UmblerTag[]> {
  const res = await callProxy<any>(`/v1/tags/?organizationId=${orgId}`, 'GET', token);
  return (res?.items ?? res?.results ?? (Array.isArray(res) ? res : [])) as UmblerTag[];
}

export async function createTag(orgId: string, token: string, payload: { name: string; color?: string; icon?: string }): Promise<UmblerTag> {
  return callProxy<UmblerTag>('/v1/tags/', 'POST', token, { organizationId: orgId, ...payload });
}

export async function updateTag(orgId: string, token: string, id: string, payload: { name: string; color?: string; icon?: string }): Promise<UmblerTag> {
  return callProxy<UmblerTag>(`/v1/tags/${id}/?organizationId=${orgId}`, 'PUT', token, payload);
}

export async function deleteTag(orgId: string, token: string, id: string): Promise<void> {
  await callProxy(`/v1/tags/${id}/?organizationId=${orgId}`, 'DELETE', token);
}

// ─── Custom Fields ────────────────────────────────────────────────────────

export async function listCustomFields(orgId: string, token: string): Promise<UmblerCustomField[]> {
  const res = await callProxy<any>(`/v1/custom-field-definitions/?organizationId=${orgId}`, 'GET', token);
  return (res?.items ?? res?.results ?? (Array.isArray(res) ? res : [])) as UmblerCustomField[];
}

export async function createCustomField(orgId: string, token: string, payload: { name: string; description?: string }): Promise<UmblerCustomField> {
  // Custom fields exigem o _t (type discriminator)
  return callProxy<UmblerCustomField>('/v1/custom-field-definitions/', 'POST', token, {
    organizationId: orgId,
    _t: 'TextCustomFieldDefinitionModel',
    ...payload
  });
}

export async function updateCustomField(orgId: string, token: string, id: string, payload: { name?: string; description?: string }): Promise<UmblerCustomField> {
  return callProxy<UmblerCustomField>(`/v1/custom-field-definitions/${id}/?organizationId=${orgId}`, 'PUT', token, payload);
}

export async function deleteCustomField(orgId: string, token: string, id: string): Promise<void> {
  await callProxy(`/v1/custom-field-definitions/${id}/?organizationId=${orgId}`, 'DELETE', token);
}

// ─── ChatBots (Flowchart) ─────────────────────────────────────────────────

export async function listBots(orgId: string, token: string): Promise<UmblerBot[]> {
  const res = await callProxy<any>(`/v1/bots/flowchart/?organizationId=${orgId}`, 'GET', token);
  return (res?.items ?? res?.results ?? (Array.isArray(res) ? res : [])) as UmblerBot[];
}

export async function createBot(orgId: string, token: string, payload: { title: string; description?: string }): Promise<UmblerBot> {
  // ChatBots exigem manualTriggers, steps e triggers na criação
  return callProxy<UmblerBot>('/v1/bots/flowchart/', 'POST', token, {
    organizationId: orgId,
    ...payload,
    manualTriggers: [],
    steps: [],
    triggers: [],
    channels: []
  });
}

export async function updateBot(orgId: string, token: string, id: string, payload: { title?: string; description?: string }): Promise<UmblerBot> {
  return callProxy<UmblerBot>(`/v1/bots/flowchart/${id}/?organizationId=${orgId}`, 'PUT', token, payload);
}

export async function deleteBot(orgId: string, token: string, id: string): Promise<void> {
  await callProxy(`/v1/bots/flowchart/${id}/?organizationId=${orgId}`, 'DELETE', token);
}

// ─── Channels ──────────────────────────────────────────────────────────────

export async function listChannels(orgId: string, token: string): Promise<UmblerChannel[]> {
  const res = await callProxy<any>(`/v1/channels/?organizationId=${orgId}`, 'GET', token);
  return (res?.items ?? res?.results ?? (Array.isArray(res) ? res : [])) as UmblerChannel[];
}

// ─── Organization ──────────────────────────────────────────────────────────

export async function getOrganization(orgId: string, token: string): Promise<UmblerOrganization> {
  // Chamamos /details/ para pegar o perfil completo (CNPJ, Endereço, etc)
  return callProxy<UmblerOrganization>(`/v1/organizations/${orgId}/details/`, 'GET', token);
}

export async function updateOrganization(orgId: string, token: string, payload: Partial<UmblerOrganization>): Promise<UmblerOrganization> {
  // O PUT é feito no endpoint base / e aceita os campos de UpdateOrganizationModel
  return callProxy<UmblerOrganization>(`/v1/organizations/${orgId}/`, 'PUT', token, payload);
}

// ─── Presets (templates salvos localmente) ──────────────────────────────────

export async function listPresets(type?: UmblerPreset['preset_type']): Promise<UmblerPreset[]> {
  let query = supabase.from('umbler_presets').select('*').order('name');
  if (type) query = query.eq('preset_type', type);
  const { data, error } = await query;
  if (error) throw new Error(`Erro ao buscar presets: ${error.message}`);
  return (data ?? []) as UmblerPreset[];
}

export async function savePreset(preset: Omit<UmblerPreset, 'created_at'>): Promise<void> {
  const payload = { ...preset, updated_at: new Date().toISOString() };

  // Só faz UPDATE se o id for um UUID local (gerado pelo Supabase).
  // IDs vindos da Umbler (ex: 'Zvd396wFtPefqFmN') não são UUIDs e
  // não existem na tabela local — causariam UPDATE que não afeta nenhuma linha.
  const isLocalUUID = !!preset.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(preset.id);

  const { error } = isLocalUUID
    ? await supabase.from('umbler_presets').update(payload).eq('id', preset.id)
    : await supabase.from('umbler_presets').insert({ ...payload, id: undefined });

  if (error) throw new Error(`Erro ao salvar preset: ${error.message}`);
}

export async function deletePreset(id: string): Promise<void> {
  const { error } = await supabase.from('umbler_presets').delete().eq('id', id);
  if (error) throw new Error(`Erro ao excluir preset: ${error.message}`);
}

// ── SCHEDULED MESSAGES (Mensagens Agendadas) ──────────────────────────────────

export const listScheduledMessages = async (orgId: string, contactId: string, token: string): Promise<UmblerScheduledMessage[]> => {
  const { data } = await supabase.functions.invoke('umbler-proxy', {
    body: { 
      method: 'GET', 
      endpoint: `/v1/scheduled-messages/?organizationId=${orgId}&contactId=${contactId}`, 
      token 
    }
  });
  return data?.items || [];
};

export const createScheduledMessage = async (orgId: string, token: string, payload: Partial<UmblerScheduledMessage>) => {
  return supabase.functions.invoke('umbler-proxy', {
    body: {
      method: 'POST',
      endpoint: '/v1/scheduled-messages/',
      token,
      payload: {
        organizationId: orgId,
        ...payload
      }
    }
  });
};

export const getScheduledMessage = async (orgId: string, token: string, id: string): Promise<UmblerScheduledMessage> => {
  const { data } = await supabase.functions.invoke('umbler-proxy', {
    body: {
      method: 'GET',
      endpoint: `/v1/scheduled-messages/${id}/?organizationId=${orgId}`,
      token
    }
  });
  return data;
};

export const updateScheduledMessage = async (orgId: string, token: string, id: string, payload: Partial<UmblerScheduledMessage>) => {
  return supabase.functions.invoke('umbler-proxy', {
    body: {
      method: 'PUT',
      endpoint: `/v1/scheduled-messages/${id}/?organizationId=${orgId}`,
      token,
      payload
    }
  });
};

export const deleteScheduledMessage = async (orgId: string, token: string, id: string) => {
  return supabase.functions.invoke('umbler-proxy', {
    body: {
      method: 'DELETE',
      endpoint: `/v1/scheduled-messages/${id}/?organizationId=${orgId}`,
      token
    }
  });
};
