import { supabase } from '../supabaseClient';
import type { RecrutadoraCard, RecrutadoraColumn } from '../../types';
import { startOfTodayISO, startOfWeekISO, startOfMonthISO } from '../utils/dates';

export const DEFAULT_COLUMNS: Array<Pick<RecrutadoraColumn, 'code' | 'name' | 'color' | 'image_url'>> = [
  { code: 'qualificadas', name: 'QUALIFICADAS', color: null, image_url: 'https://amtrvspaizpodgvjxvwc.supabase.co/storage/v1/object/public/dromebanco/Imagens/QUALIFICADAS.png' },
  { code: 'contato', name: 'CONTATO', color: null, image_url: 'https://amtrvspaizpodgvjxvwc.supabase.co/storage/v1/object/public/dromebanco/Imagens/CONTATO.png' },
  { code: 'envio_doc', name: 'ENVIO DOS DOCUMENTOS', color: null, image_url: 'https://amtrvspaizpodgvjxvwc.supabase.co/storage/v1/object/public/dromebanco/Imagens/ENVDOCS.png' },
  { code: 'truora', name: 'TRUORA', color: null, image_url: 'https://amtrvspaizpodgvjxvwc.supabase.co/storage/v1/object/public/dromebanco/Imagens/TRUORA.png' },
  { code: 'treinamento', name: 'TREINAMENTO', color: null, image_url: 'https://amtrvspaizpodgvjxvwc.supabase.co/storage/v1/object/public/dromebanco/Imagens/TREINAMENTOS.png' },
  { code: 'finalizado', name: 'FINALIZADO', color: null, image_url: 'https://amtrvspaizpodgvjxvwc.supabase.co/storage/v1/object/public/dromebanco/Imagens/FINALIZADOS.png' },
  { code: 'nao_aprovadas', name: 'NÃO APROVADAS', color: null, image_url: 'https://amtrvspaizpodgvjxvwc.supabase.co/storage/v1/object/public/dromebanco/Imagens/NAOAPROV.png' },
  { code: 'desistentes', name: 'DESISTENTES', color: null, image_url: 'https://amtrvspaizpodgvjxvwc.supabase.co/storage/v1/object/public/dromebanco/Imagens/DESISTENTES.png' },
];

/**
 * Busca colunas para uma unidade específica.
 * Retorna colunas padrão + colunas customizadas da unidade (excluindo duplicatas).
 * Colunas customizadas aparecem apenas para a unidade vinculada.
 */
export const fetchColumns = async (unitId: string): Promise<RecrutadoraColumn[]> => {
  // 1. Buscar colunas customizadas da unidade no banco
  const { data: customColumns, error } = await supabase
    .from('recrutadora_columns')
    .select('*')
    .eq('unit_id', unitId)
    .eq('is_active', true)
    .order('position', { ascending: true });
  
  if (error) {
    console.error('Erro ao buscar colunas customizadas:', error);
    // Em caso de erro, retorna apenas as padrão
    return DEFAULT_COLUMNS.map((c, idx) => ({
      id: c.code,
      unit_id: 'default',
      unidade: null,
      code: c.code,
      name: c.name,
      color: c.color || null,
      image_url: c.image_url || null,
      position: idx + 1,
      is_active: true,
    }));
  }

  // 2. Criar mapa de colunas padrão
  const defaultColumnsMap = new Map(
    DEFAULT_COLUMNS.map((c, idx) => [
      c.code,
      {
        id: c.code,
        unit_id: 'default',
        unidade: null,
        code: c.code,
        name: c.name,
        color: c.color || null,
        image_url: c.image_url || null,
        position: idx + 1,
        is_active: true,
      } as RecrutadoraColumn
    ])
  );

  // 3. Processar colunas customizadas
  const customColumnsProcessed: RecrutadoraColumn[] = (customColumns || []).map(col => ({
    id: col.id,
    unit_id: col.unit_id,
    unidade: col.unidade || null,
    code: col.code,
    name: col.name,
    color: col.color || null,
    image_url: col.image_url || null,
    position: col.position,
    is_active: col.is_active,
  }));

  // 4. Remover colunas padrão que foram customizadas
  customColumnsProcessed.forEach(customCol => {
    if (defaultColumnsMap.has(customCol.code)) {
      defaultColumnsMap.delete(customCol.code);
    }
  });

  // 5. Combinar colunas padrão + customizadas e ordenar por position
  const allColumns = [
    ...Array.from(defaultColumnsMap.values()),
    ...customColumnsProcessed
  ].sort((a, b) => a.position - b.position);

  return allColumns;
};

export const ensureDefaultColumnsForUnit = async (_unitId: string, _unitName?: string): Promise<void> => {
  // Não é necessário quando usamos template global em memória
  return;
};

export const fetchCards = async (unitId: string): Promise<RecrutadoraCard[]> => {
  const selAll = 'id, created_at, unit_id, unidade, status, position, nome, whatsapp, color_card, data_nasc, fumante, estado_civil, filhos, qto_filhos, rotina_filhos, endereco:"endereço", rg, cpf, dias_livres, dias_semana, exp_residencial, ref_residencial, exp_comercial, ref_comercial, sit_atual, motivo_cadastro, transporte, observacao';
  let q = supabase.from('recrutadora').select(selAll).eq('unit_id', unitId)
    .order('status', { ascending: true })
    .order('position', { ascending: true })
    .order('created_at', { ascending: false });
  let { data, error } = await q;
  if (error && (error as any).code === '42703') {
    // Fallback para colunas básicas até migrar schema
    const res = await supabase
      .from('recrutadora')
      .select('id, created_at, unit_id, unidade, status, position, nome, whatsapp, color_card')
      .eq('unit_id', unitId)
      .order('status', { ascending: true })
      .order('position', { ascending: true })
      .order('created_at', { ascending: false });
    if (res.error) throw res.error;
    return (res.data as any) || [];
  }
  if (error) throw error;
  return (data as any) || [];
};

export const fetchCardsForUnits = async (unitIds: string[]): Promise<RecrutadoraCard[]> => {
  if (!unitIds || unitIds.length === 0) return [];
  const selAll = 'id, created_at, unit_id, unidade, status, position, nome, whatsapp, color_card, data_nasc, fumante, estado_civil, filhos, qto_filhos, rotina_filhos, endereco:"endereço", rg, cpf, dias_livres, dias_semana, exp_residencial, ref_residencial, exp_comercial, ref_comercial, sit_atual, motivo_cadastro, transporte, observacao';
  let q = supabase
    .from('recrutadora')
    .select(selAll)
    .in('unit_id', unitIds)
    .order('status', { ascending: true })
    .order('position', { ascending: true })
    .order('created_at', { ascending: false });
  let { data, error } = await q;
  if (error && (error as any).code === '42703') {
    const res = await supabase
      .from('recrutadora')
      .select('id, created_at, unit_id, unidade, status, position, nome, whatsapp, color_card')
      .in('unit_id', unitIds)
      .order('status', { ascending: true })
      .order('position', { ascending: true })
      .order('created_at', { ascending: false });
    if (res.error) throw res.error;
    return (res.data as any) || [];
  }
  if (error) throw error;
  return (data as any) || [];
};

// Métricas de cadastros por período
export type RecrutadoraPeriodMetrics = { today: number; week: number; month: number };

export const fetchRecrutadoraMetrics = async (unitId: string): Promise<RecrutadoraPeriodMetrics> => {
  const [todayStart, weekStart, monthStart] = [startOfTodayISO(), startOfWeekISO(), startOfMonthISO()];
  const base = supabase.from('recrutadora').select('id, created_at', { count: 'exact', head: true }).eq('unit_id', unitId);

  const { count: todayCount, error: e1 } = await base.gte('created_at', todayStart);
  if (e1) throw e1;
  const { count: weekCount, error: e2 } = await supabase
    .from('recrutadora').select('id, created_at', { count: 'exact', head: true })
    .eq('unit_id', unitId).gte('created_at', weekStart);
  if (e2) throw e2;
  const { count: monthCount, error: e3 } = await supabase
    .from('recrutadora').select('id, created_at', { count: 'exact', head: true })
    .eq('unit_id', unitId).gte('created_at', monthStart);
  if (e3) throw e3;
  return { today: todayCount || 0, week: weekCount || 0, month: monthCount || 0 };
};

export const fetchRecrutadoraMetricsForUnits = async (unitIds: string[]): Promise<RecrutadoraPeriodMetrics> => {
  if (!unitIds || unitIds.length === 0) return { today: 0, week: 0, month: 0 };
  const [todayStart, weekStart, monthStart] = [startOfTodayISO(), startOfWeekISO(), startOfMonthISO()];
  const { count: todayCount, error: e1 } = await supabase
    .from('recrutadora').select('id, created_at', { count: 'exact', head: true })
    .in('unit_id', unitIds).gte('created_at', todayStart);
  if (e1) throw e1;
  const { count: weekCount, error: e2 } = await supabase
    .from('recrutadora').select('id, created_at', { count: 'exact', head: true })
    .in('unit_id', unitIds).gte('created_at', weekStart);
  if (e2) throw e2;
  const { count: monthCount, error: e3 } = await supabase
    .from('recrutadora').select('id, created_at', { count: 'exact', head: true })
    .in('unit_id', unitIds).gte('created_at', monthStart);
  if (e3) throw e3;
  return { today: todayCount || 0, week: weekCount || 0, month: monthCount || 0 };
};

export const createCard = async (payload: Partial<RecrutadoraCard>) => {
  let { error } = await supabase.from('recrutadora').insert(payload);
  if (error && (error as any).code === '42703') {
    const basic: any = {
      nome: (payload as any).nome ?? null,
      whatsapp: (payload as any).whatsapp ?? null,
      color_card: (payload as any).color_card ?? null,
      status: (payload as any).status,
      unit_id: (payload as any).unit_id,
      unidade: (payload as any).unidade,
      position: (payload as any).position ?? null,
    };
    const res = await supabase.from('recrutadora').insert(basic);
    if (res.error) throw res.error;
    return;
  }
  if (error) throw error;
};

export const updateCard = async (id: number, payload: Partial<RecrutadoraCard>) => {
  let { error } = await supabase.from('recrutadora').update(payload).eq('id', id);
  if (error && (error as any).code === '42703') {
    const basic: any = {
      nome: (payload as any).nome ?? null,
      whatsapp: (payload as any).whatsapp ?? null,
      color_card: (payload as any).color_card ?? null,
      status: (payload as any).status,
      position: (payload as any).position,
    };
    const res = await supabase.from('recrutadora').update(basic).eq('id', id);
    if (res.error) throw res.error;
    return;
  }
  if (error) throw error;
};

export const deleteCard = async (id: number) => {
  const { error } = await supabase.from('recrutadora').delete().eq('id', id);
  if (error) throw error;
};

export const moveCard = async (callerId: string, cardId: number, newStatus: string, newPosition: number) => {
  const { error } = await supabase.rpc('move_recrutadora_card', {
    caller_id: callerId,
    p_card_id: cardId,
    p_new_status: newStatus,
    p_new_position: newPosition,
  });
  if (error) throw error;
};

// Histórico simples (se existir tabela 'recrutadora_logs' com colunas: id, card_id, created_at, action, details)
// Histórico removido: sem funções de logs
