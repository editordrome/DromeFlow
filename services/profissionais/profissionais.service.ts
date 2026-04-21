import { supabase } from '../supabaseClient';

export type Profissional = {
  id: string;
  recrutadora_id: number;
  unit_id: string | null;
  unidade: string | null;
  nome: string | null;
  cpf: string | null;
  rg: string | null;
  tipo: string | null;
  primeiro_atendimento: string | null; // ISO date
  habilidade: string | null;
  preferencia: string | null;
  status: string | null;
  whatsapp: string | null;
  estado_civil: string | null;
  filhos: string | null;
  qto_filhos: string | null;
  rotina_filhos: string | null;
  endereco: string | null;
  data_nasc: string | null; // ISO date
  nome_recado: string | null;
  tel_recado: string | null;
  data_cadastro: string | null; // ISO date
  data_ativo: string | null; // ISO date
  medo_pet: string | null;
  motivo_inativar: string | null;
  observacao: string | null;
  dias_livres: string | null;
  dias_semana: string | null;
  fumante: string | null;
  assinatura: string | null; // ISO date
  created_at: string;
  updated_at: string;
};

export const fetchProfissionais = async (unitId?: string): Promise<Profissional[]> => {
  let q = supabase.from('profissionais').select('*').order('updated_at', { ascending: false });
  if (unitId && unitId !== 'ALL') {
    q = q.eq('unit_id', unitId);
  }
  const { data, error } = await q;
  if (error) throw error;

  console.log('[fetchProfissionais] Dados retornados do Supabase:', data);
  if (data && data.length > 0) {
    console.log('[fetchProfissionais] Primeiro profissional:', data[0]);
    console.log('[fetchProfissionais] Campo assinatura do primeiro:', data[0].assinatura);
  }

  return (data as Profissional[]) || [];
};

/**
 * Converte horário (HH:MM ou HH:MM:SS) para minutos desde meia-noite
 */
function timeToMinutes(time: string): number {
  const parts = time.split(':');
  const hours = parseInt(parts[0] || '0', 10);
  const minutes = parseInt(parts[1] || '0', 10);
  return hours * 60 + minutes;
}

/**
 * Verifica se dois períodos de tempo se sobrepõem
 */
function checkTimeConflict(
  time1: string,
  duration1: number,
  time2: string,
  duration2: number
): boolean {
  const start1 = timeToMinutes(time1);
  const end1 = start1 + (duration1 * 60);
  const start2 = timeToMinutes(time2);
  const end2 = start2 + (duration2 * 60);
  return start1 < end2 && start2 < end1;
}

/**
 * Obtém o unit_code a partir do unit_id
 */
async function getUnitCodeById(unitId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('units')
    .select('unit_code')
    .eq('id', unitId)
    .single();
  if (error || !data) {
    console.error('[getUnitCodeById] Erro:', error);
    return null;
  }
  return data.unit_code;
}

/**
 * Busca profissionais por nome com filtro de conflito de horário
 * @param unitId - ID da unidade
 * @param searchTerm - Termo de busca (mínimo 2 caracteres)
 * @param currentAppointment - Atendimento atual para verificar conflitos
 * @param limit - Limite de resultados (padrão: 10)
 * @returns Lista de profissionais disponíveis (sem conflitos)
 */
export const searchProfissionaisByName = async (
  unitId: string,
  searchTerm: string,
  currentAppointment: {
    data: string | null;
    horario: string;
    periodo: string | null;
    atendimentoId?: string;
  },
  limit: number = 10
): Promise<Profissional[]> => {
  const trimmedSearch = (searchTerm || '').trim();

  // 1. Buscar profissionais ativas
  let query = supabase
    .from('profissionais')
    .select('id, nome, status, unit_id')
    .in('status', ['Ativa', 'Ativo', 'ativo', 'TRUE'])
    .order('nome', { ascending: true })
    .limit(limit || 50);

  if (trimmedSearch.length > 0) {
    query = query.ilike('nome', `%${trimmedSearch}%`);
  }

  if (unitId && unitId !== 'ALL') {
    query = query.eq('unit_id', unitId);
  }

  const { data: profissionais, error } = await query;

  if (error || !profissionais) {
    console.error('[searchProfissionaisByName] Erro:', error);
    return [];
  }

  // 2. Se não há data/horário/período, retornar todas (sem filtro de conflito)
  if (!currentAppointment.data || !currentAppointment.horario || !currentAppointment.periodo) {
    return (profissionais as Profissional[]).slice(0, limit);
  }

  // 3. Buscar atendimentos do mesmo dia na unidade
  const unitCode = await getUnitCodeById(unitId);
  if (!unitCode) {
    return (profissionais as Profissional[]).slice(0, limit);
  }

  const { data: appointments, error: apptError } = await supabase
    .from('processed_data')
    .select('PROFISSIONAL, HORARIO, "PERÍODO", ATENDIMENTO_ID')
    .eq('unidade_code', unitCode)
    .eq('DATA', currentAppointment.data)
    .not('PROFISSIONAL', 'is', null);

  if (apptError || !appointments) {
    console.error('[searchProfissionaisByName] Erro ao buscar atendimentos:', apptError);
    return (profissionais as Profissional[]).slice(0, limit);
  }

  // 4. Filtrar profissionais com conflito
  const unavailableProfessionals = new Set<string>();

  for (const appt of appointments) {
    // Ignorar o atendimento atual
    if (currentAppointment.atendimentoId && appt.ATENDIMENTO_ID === currentAppointment.atendimentoId) {
      continue;
    }

    const profName = appt.PROFISSIONAL?.trim();
    if (!profName) continue;

    const periodo = (appt as any)['PERÍODO']?.trim();

    // Regra 1: Período de 8h = dia inteiro ocupado
    if (periodo === '8') {
      unavailableProfessionals.add(profName);
      continue;
    }

    // Regra 2: Verificar sobreposição de horários (4h ou 6h)
    if (periodo === '4' || periodo === '6') {
      const hasConflict = checkTimeConflict(
        currentAppointment.horario,
        parseInt(currentAppointment.periodo || '0'),
        appt.HORARIO,
        parseInt(periodo)
      );

      if (hasConflict) {
        unavailableProfessionals.add(profName);
      }
    }
  }

  // 5. Filtrar profissionais disponíveis
  const availableProfessionals = profissionais.filter(
    prof => !unavailableProfessionals.has(prof.nome?.trim() || '')
  );

  return (availableProfessionals as Profissional[]).slice(0, limit);
};

// Histórico de atendimentos por profissional (em processed_data)
export const fetchProfessionalHistory = async (
  unitCode: string,
  profissionalNome: string,
  limit: number = 200,
  period?: string // YYYY-MM
): Promise<Array<{ id?: number; ATENDIMENTO_ID?: string; DATA: string | null; DIA: string; CLIENTE: string; PERÍODO?: string; 'pos vendas': string | null }>> => {
  if (!unitCode || !profissionalNome) return [];
  let query = supabase
    .from('processed_data')
    .select('id, ATENDIMENTO_ID, DATA, DIA, CLIENTE, PERÍODO, "pos vendas"')
    .eq('unidade_code', unitCode)
    .ilike('PROFISSIONAL', `%${profissionalNome}%`);

  if (period && /^\d{4}-\d{2}$/.test(period)) {
    const [yearStr, monthStr] = period.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(Date.UTC(year, month, 0)).toISOString().split('T')[0];
    query = query.gte('DATA', startDate).lte('DATA', endDate);
  }

  const { data, error } = await query.order('DATA', { ascending: false }).limit(limit);
  if (error) return [];
  return (data as any[]) || [];
};

// Métricas de pós-venda (média de notas em estrelas 0..5) para os últimos 10 atendimentos
export const fetchProfessionalPosVendaMetrics = async (
  unitCode: string,
  profissionalNome: string
): Promise<{ geral: number | null; comercial: number | null; residencial: number | null }> => {
  if (!unitCode || !profissionalNome || unitCode === 'ALL') {
    return { geral: null, comercial: null, residencial: null };
  }

  try {
    // Buscar avaliações da tabela pos_vendas juntamente com dados de processed_data
    // usando ATENDIMENTO_ID como chave de ligação
    const { data: posVendasData, error: posVendasError } = await supabase
      .from('pos_vendas')
      .select('ATENDIMENTO_ID, nota, status')
      .eq('status', 'finalizado')
      .not('nota', 'is', null);

    if (posVendasError) {
      console.error('Erro ao buscar avaliações de pos_vendas:', posVendasError);
      return { geral: null, comercial: null, residencial: null };
    }

    if (!posVendasData || posVendasData.length === 0) {
      return { geral: null, comercial: null, residencial: null };
    }

    // Obter ATENDIMENTO_IDs das avaliações
    const atendimentoIds = posVendasData.map(pv => pv.ATENDIMENTO_ID).filter(Boolean);

    if (atendimentoIds.length === 0) {
      return { geral: null, comercial: null, residencial: null };
    }

    // Buscar dados de processed_data para obter TIPO e PROFISSIONAL
    const { data: processedData, error: processedError } = await supabase
      .from('processed_data')
      .select('ATENDIMENTO_ID, TIPO, PROFISSIONAL')
      .eq('unidade_code', unitCode)
      .ilike('PROFISSIONAL', `%${profissionalNome}%`)
      .in('ATENDIMENTO_ID', atendimentoIds);

    if (processedError) {
      console.error('Erro ao buscar processed_data:', processedError);
      return { geral: null, comercial: null, residencial: null };
    }

    if (!processedData || processedData.length === 0) {
      return { geral: null, comercial: null, residencial: null };
    }

    // Criar mapa de ATENDIMENTO_ID -> nota
    const notaMap = new Map<string, number>();
    posVendasData.forEach(pv => {
      if (pv.ATENDIMENTO_ID && pv.nota) {
        notaMap.set(pv.ATENDIMENTO_ID, pv.nota);
      }
    });

    // Calcular médias por tipo
    const comercialNotas: number[] = [];
    const residencialNotas: number[] = [];

    processedData.forEach(item => {
      if (item.ATENDIMENTO_ID && notaMap.has(item.ATENDIMENTO_ID)) {
        const nota = notaMap.get(item.ATENDIMENTO_ID)!;
        const tipo = (item.TIPO || '').toLowerCase();

        if (tipo.includes('comercial')) {
          comercialNotas.push(nota);
        } else if (tipo.includes('residencial')) {
          residencialNotas.push(nota);
        }
      }
    });

    // Calcular média geral (comercial + residencial)
    const todasNotas = [...comercialNotas, ...residencialNotas];

    const calcMedia = (notas: number[]): number | null => {
      if (notas.length === 0) return null;
      const soma = notas.reduce((acc, n) => acc + n, 0);
      return +(soma / notas.length).toFixed(1);
    };

    return {
      geral: calcMedia(todasNotas),
      comercial: calcMedia(comercialNotas),
      residencial: calcMedia(residencialNotas)
    };
  } catch (err) {
    console.error('Erro ao calcular métricas de pós-vendas:', err);
    return { geral: null, comercial: null, residencial: null };
  }
};

// Atualizar dados do profissional
export const updateProfissional = async (
  id: string,
  patch: Partial<Pick<Profissional,
    | 'nome'
    | 'whatsapp'
    | 'rg'
    | 'cpf'
    | 'data_nasc'
    | 'tipo'
    | 'preferencia'
    | 'habilidade'
    | 'estado_civil'
    | 'fumante'
    | 'filhos'
    | 'qto_filhos'
    | 'endereco'
    | 'nome_recado'
    | 'tel_recado'
    | 'observacao'
    | 'status'
    | 'assinatura'
  >>
): Promise<Profissional | null> => {
  if (!id) return null;
  console.log('profissionais.service: Tentando atualizar ID:', id, 'com patch:', patch);
  const { data, error } = await supabase
    .from('profissionais')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();

  console.log('profissionais.service: Resposta do Supabase:', { data, error });

  if (error) {
    console.error('profissionais.service: Erro do Supabase:', error);
    throw new Error(`Erro ao atualizar profissional: ${error.message} (Código: ${error.code})`);
  }
  return (data as Profissional) || null;
};

// Criar novo profissional
export const createProfissional = async (
  profissionalData: Partial<Omit<Profissional, 'id' | 'created_at' | 'updated_at'>>
): Promise<Profissional | null> => {
  console.log('profissionais.service: Criando profissional:', profissionalData);

  const { data, error } = await supabase
    .from('profissionais')
    .insert(profissionalData)
    .select('*')
    .single();

  console.log('profissionais.service: Resposta do INSERT:', { data, error });

  if (error) {
    console.error('profissionais.service: Erro ao criar profissional:', error);
    throw new Error(`Erro ao criar profissional: ${error.message} (Código: ${error.code})`);
  }

  return (data as Profissional) || null;
};

// Atualizar status da profissional (Ativa/Inativa)
export const updateProfissionalStatus = async (
  id: string,
  newStatus: 'Ativa' | 'Inativa'
): Promise<Profissional | null> => {
  if (!id) return null;
  const { data, error } = await supabase
    .from('profissionais')
    .update({ status: newStatus })
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return (data as Profissional) || null;
};
