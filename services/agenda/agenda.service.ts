import { supabase } from '../supabaseClient';
import type { AgendaSettings, AgendaDisponibilidade } from '../../types';

// Mapeamento de períodos — fiel ao app externo
const PERIODOS_MANHA = ['8 horas', '6 horas', '4 horas manhã'];
const PERIODOS_TARDE = ['8 horas', '6 horas', '4 horas tarde'];
const PERIODOS_NAO = ['NÃO DISPONIVEL'];

// ============================================================================
// Configurações da Unidade (Gestão)
// ============================================================================

/**
 * Busca as configurações da agenda para uma unidade.
 * Se não existir, retorna a configuração "default" não salva.
 */
export const getAgendaSettings = async (unitId: string): Promise<AgendaSettings | null> => {
  const { data, error } = await supabase
    .from('agenda_settings')
    .select('*')
    .eq('unit_id', unitId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Erro ao buscar configurações da agenda:', error);
    throw error;
  }

  return data || null;
};

/**
 * Salva (cria ou atualiza) as configurações da agenda para uma unidade.
 */
export const saveAgendaSettings = async (
  unitId: string,
  settingsData: Partial<AgendaSettings>
): Promise<AgendaSettings> => {
  // Dados limpos para salvar, pegando apenas o que interessa
  const payload = {
    unit_id: unitId,
    dias_liberados: settingsData.dias_liberados || [],
    periodos_cadastrados: settingsData.periodos_cadastrados || ['8 horas', '6 horas', '4 horas manhã', '4 horas tarde'],
    is_link_active: settingsData.is_link_active ?? true,
    updated_at: new Date().toISOString()
  };

  // Desativa versões anteriores da mesma unidade (não-sistema) antes de criar a nova
  await supabase
    .from('agenda_settings')
    .update({ is_link_active: false })
    .eq('unit_id', unitId)
    .eq('is_system', false);

  const { data, error } = await supabase
    .from('agenda_settings')
    .insert([{ ...payload, is_link_active: true }])
    .select()
    .single();

  if (error) {
    console.error('Erro ao salvar agenda_settings:', error);
    throw new Error("Não foi possível salvar as configurações da agenda.");
  }

  return data;
};


// ============================================================================
// Operações do Public/Link (Profissionais)
// ============================================================================

/**
 * Valida o telefone da profissional verificando se pertence à unidade acessada.
 */
export const authenticateProfissional = async (
  telefone: string,
  unitSlug: string
): Promise<{
  profissional: any;
  configuracoes: AgendaSettings;
  unidade: any;
  jaEnviou: boolean;
  diasPendentes: string[];
  disponibilidadeEnviada: { data: string; periodos: string[]; status_manha: string | null; status_tarde: string | null }[];
} | null> => {
  // 1. Limpa e normaliza o telefone (Remove 55 se vier com DDI)
  let whatsLimpo = telefone.replace(/\D/g, '');
  if (whatsLimpo.startsWith('55') && whatsLimpo.length > 11) {
    whatsLimpo = whatsLimpo.substring(2);
  }

  // 2. Acha a unidade pelo slug (agora unit_code)
  const { data: unitData, error: unitError } = await supabase
    .from('units')
    .select('id, unit_name')
    .eq('unit_code', unitSlug)
    .single();

  if (unitError || !unitData) {
    throw new Error("Unidade não encontrada. Verifique o link.");
  }

  // 3. Busca profissionais da unidade e filtra localmente pelo telefone para ignorar máscaras (ex: () - ) no banco de dados.
  const { data: profsData, error: profsError } = await supabase
    .from('profissionais')
    .select('id, nome, whatsapp, unit_id')
    .eq('unit_id', unitData.id);

  if (profsError || !profsData) {
    throw new Error("Erro ao comunicar com o banco de dados.");
  }

  // Filtragem local a prova de falhas: limpa todos os espaços e símbolos tanto do input quanto do banco
  // Filtragem local a prova de falhas: compara apenas os dígitos finais para ignorar máscaras e DDI
  const profData = profsData.find(p => {
    if (!p.whatsapp) return false;
    const dbPhone = p.whatsapp.replace(/\D/g, ''); // Limpa banco
    
    // Normaliza banco tirando o 55 se houver
    const dbPhoneNoDDI = (dbPhone.startsWith('55') && dbPhone.length > 11) ? dbPhone.substring(2) : dbPhone;
    
    // Comparações:
    // 1. Exato (sem DDI em ambos)
    // 2. Banco termina com o input (ex: banco tem 9º digito, input não; ou vice-versa)
    return dbPhoneNoDDI === whatsLimpo || 
           dbPhoneNoDDI.endsWith(whatsLimpo) || 
           whatsLimpo.endsWith(dbPhoneNoDDI);
  });

  if (!profData) {
    throw new Error("O seu número de WhatsApp não foi encontrado ou não pertence a esta unidade.");
  }

  // 4. Acha a configuração ativa mais recente para esta unidade
  const { data: settingsData, error: settingsError } = await supabase
    .from('agenda_settings')
    .select('*')
    .eq('unit_id', unitData.id)
    .eq('is_link_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Em vez de retornar erro, permitimos o acesso mas com nenhum dia liberado.
  // Isso permite mostrar uma tela digna de "Nenhuma agenda aberta no momento"
  const safeSettingsData = settingsData || {
    id: null,
    unit_id: unitData.id,
    dias_liberados: [],
    periodos_cadastrados: [],
    is_link_active: false
  };

  // 5. Verifica se a profissional já enviou a disponibilidade para os dias ativos
  //    Busca completa para mostrar o resumo do que foi enviado no app
  const { data: respostas, error: respError } = await supabase
    .from('agenda_disponibilidade')
    .select('data, periodos, status_manha, status_tarde')
    .eq('unit_id', unitData.id)
    .eq('profissional_id', profData.id)
    .in('data', safeSettingsData.dias_liberados || [])
    .order('data');

  const disponibilidadeEnviada = (respostas ?? []) as { data: string; periodos: string[]; status_manha: string | null; status_tarde: string | null }[];

  // Identifica quais dias dos 'liberados' ainda não foram respondidos
  const respondidosSet = new Set(disponibilidadeEnviada.map(r => r.data));
  const diasPendentes = (safeSettingsData.dias_liberados || []).filter((d: string) => !respondidosSet.has(d));

  // Só consideramos "já enviou" (bloqueado) se não houverem dias pendentes
  // Mas, se os dias pendentes estiverem zerados porque NENHUM dia foi liberado na agenda pelo admin,
  // nós consideramos que a própria agenda está vazia (bloqueia o envio de formulário mantendo na tela de resumo vazia)
  const jaEnviou = diasPendentes.length === 0;

  return {
    profissional: profData,
    configuracoes: safeSettingsData,
    unidade: unitData,
    jaEnviou,
    diasPendentes,
    disponibilidadeEnviada
  };
};

/**
 * Envia as disponibilidades da profissional.
 * Valida colisões com processos já agendados.
 */
export const saveDisponibilidades = async (
  unitId: string,
  profissionalId: string,
  profissionalNome: string,
  settingsId: string,
  disponibilidades: { data: string; periodos: string[] }[]
): Promise<void> => {
  // Para cada item, inserimos e marcamos 'conflito' baseado numa query em processed_data

  const datas = disponibilidades.map(d => d.data);

  // Busca agendamentos nessa unidade/profissional nas datas selecionadas
  // Aqui assumimos que processed_data usa o NOME da profissional na coluna PROFISSIONAL
  const { data: atendimentosData } = await supabase
    .from('processed_data')
    .select('DATA, "SERVIÇO", HORARIO, "PERÍODO", STATUS')
    .eq('unit_id', unitId)
    .eq('PROFISSIONAL', profissionalNome)
    .in('DATA', datas);

  const atendimentosMap = new Map<string, any[]>();
  if (atendimentosData) {
    atendimentosData.forEach((atendimento: any) => {
      // Ajuste para formato YYYY-MM-DD caso não esteja
      // Se 'DATA' já for YYYY-MM-DD apenas coloca no MAP
      const dataIso = typeof atendimento.DATA === 'string' && atendimento.DATA.includes('T')
        ? atendimento.DATA.split('T')[0]
        : atendimento.DATA;

      const arr = atendimentosMap.get(dataIso) || [];
      arr.push(atendimento);
      atendimentosMap.set(dataIso, arr);
    });
  }

  // Prepara o array de UPSERT
  const upsertRows = disponibilidades.map(disp => {

    // Analisa se os atendimentos ocupam a manhã ou tarde
    const ats = atendimentosMap.get(disp.data) || [];
    let ocupaManha = false;
    let ocupaTarde = false;

    ats.forEach(at => {
      if (at.STATUS === 'CANCELADO' || at.STATUS === 'REAGENDADO') return; // Ignora cancelados
      if (at.HORARIO) {
        const [h, m] = at.HORARIO.split(':').map(Number);
        const duracao = parseFloat(at['PERÍODO']?.replace(',', '.') || '1');
        const start = h + ((m || 0) / 60);
        const end = start + duracao;

        if (start < 13) ocupaManha = true;
        if (end > 13) ocupaTarde = true;
      }
    });

    const isNao = disp.periodos.some(p => PERIODOS_NAO.includes(p));
    const hasManha = disp.periodos.some(p => PERIODOS_MANHA.includes(p));
    const hasTarde = disp.periodos.some(p => PERIODOS_TARDE.includes(p));

    let statusManha: string | null = null;
    let statusTarde: string | null = null;

    if (isNao) {
      statusManha = 'NÃO';
      statusTarde = 'NÃO';
    } else {
      if (hasManha) statusManha = ocupaManha ? 'CLIENTE' : 'LIVRE';
      if (hasTarde) statusTarde = ocupaTarde ? 'CLIENTE' : 'LIVRE';
    }

    return {
      unit_id: unitId,
      profissional_id: profissionalId,
      settings_id: settingsId, // Vínculo com a versão da agenda
      data: disp.data,
      periodos: disp.periodos,
      status_manha: statusManha,
      status_tarde: statusTarde,
      conflito: ats.length > 0, // Marca true caso exista registro em processed_data independente do status selecionado
      updated_at: new Date().toISOString()
    };
  });

  if (upsertRows.length > 0) {
    console.log('--- DEBUG AGENDA ---');
    console.log('SettingsId:', settingsId);
    console.log('Payload First Row:', upsertRows[0]);

    // Voltamos para a string de colunas para garantir total compatibilidade com a versão do supabase-js
    const { error } = await supabase
      .from('agenda_disponibilidade')
      .upsert(upsertRows, {
        onConflict: 'settings_id,profissional_id,data'
      });

    if (error) {
      console.error('Erro ao salvar disponibilidades:', error);
      throw new Error('Falha ao registrar disponibilidades.');
    }
  }
};

// ============================================================================
// Buscas e Painel (Dashboard Interno)
// ============================================================================

/**
 * Busca toda a disponibilidade de uma unidade num range de datas
 */
export const getDisponibilidades = async (
  unitId: string,
  startDate: string,
  endDate: string,
  settingsId?: string
): Promise<AgendaDisponibilidade[]> => {
  let query = supabase
    .from('agenda_disponibilidade')
    .select(`
      *,
      profissional:profissionais(id, nome, whatsapp)
    `)
    .eq('unit_id', unitId)
    .gte('data', startDate)
    .lte('data', endDate);

  if (settingsId) {
    query = query.eq('settings_id', settingsId);
  }

  const { data, error } = await query.order('data', { ascending: true });

  if (error) {
    console.error('Erro ao buscar disponibilidades:', error);
    throw error;
  }

  return data as any; // Cast tipado
};

/**
 * Busca profissionais livres numa data específica
 * (Aqueles que marcaram algum período e NÃO têm conflito)
 */
export const getProfissionaisLivres = async (
  unitId: string,
  dataStr: string,
  settingsId?: string
): Promise<AgendaDisponibilidade[]> => {
  let query = supabase
    .from('agenda_disponibilidade')
    .select(`
      *,
      profissional:profissionais(id, nome, whatsapp)
    `)
    .eq('unit_id', unitId)
    .eq('data', dataStr)
    .eq('conflito', false) // Só os que não tem conflito com agendamentos
    .or('status_manha.is.null,status_manha.eq.LIVRE,status_tarde.is.null,status_tarde.eq.LIVRE'); // Apenas status livres

  if (settingsId) {
    query = query.eq('settings_id', settingsId);
  }

  const { data, error } = await query;

  // Filtra garantindo que pelo menos um período é LIVRE pelo mapeamento do app
  return (data as any[]).filter(disp => {
    const isLivreManha = disp.status_manha === 'LIVRE' ||
      (disp.status_manha === null && disp.periodos?.some((p: string) => PERIODOS_MANHA.includes(p)));
    const isLivreTarde = disp.status_tarde === 'LIVRE' ||
      (disp.status_tarde === null && disp.periodos?.some((p: string) => PERIODOS_TARDE.includes(p)));
    return isLivreManha || isLivreTarde;
  }) as any;
};

/**
 * Sincroniza a disponibilidade e o campo conflito de uma profissional baseando-se no que está em processed_data.
 */
export const syncProfissionalAvailability = async (
  unitId: string,
  profissionalId: string,
  profissionalNome: string,
  dataStr: string
): Promise<void> => {
  try {
    // 1. Busca disponibilidades atuais para pegar os 'periodos' (sentimentos originais)
    const { data: currentDisp, error: fetchDispError } = await supabase
      .from('agenda_disponibilidade')
      .select('*')
      .eq('unit_id', unitId)
      .eq('profissional_id', profissionalId)
      .eq('data', dataStr)
      .maybeSingle();

    if (fetchDispError) throw fetchDispError;
    if (!currentDisp) return; // Se não tem registro de disponibilidade, não há o que sincronizar

    // 2. Busca atendimentos vigentes em processed_data
    const { data: ats, error: atsError } = await supabase
      .from('processed_data')
      .select('HORARIO, "PERÍODO", STATUS')
      .eq('unit_id', unitId)
      .eq('PROFISSIONAL', profissionalNome)
      .eq('DATA', dataStr);

    if (atsError) throw atsError;

    let ocupaManha = false;
    let ocupaTarde = false;
    const atendimentosAtivos = (ats || []).filter(at => at.STATUS !== 'CANCELADO' && at.STATUS !== 'REAGENDADO');

    atendimentosAtivos.forEach(at => {
      if (at.HORARIO) {
        const [h, m] = at.HORARIO.split(':').map(Number);
        const duracao = parseFloat(at['PERÍODO']?.toString().replace(',', '.') || '1');
        const start = h + ((m || 0) / 60);
        const end = start + duracao;

        if (start < 13) ocupaManha = true;
        if (end >= 13) ocupaTarde = true;
      }
    });

    // 3. Recalcula status baseados nos periodos originais e status atual
    const periodos: string[] = currentDisp.periodos || [];
    const isNaoOriginal = periodos.some((p: string) => PERIODOS_NAO.includes(p));
    const hasManhaOriginal = periodos.some((p: string) => PERIODOS_MANHA.includes(p));
    const hasTardeOriginal = periodos.some((p: string) => PERIODOS_TARDE.includes(p));

    let statusManha: string | null = currentDisp.status_manha;
    let statusTarde: string | null = currentDisp.status_tarde;

    // Prioridade: Atendimento (CLIENTE) sempre sobrescreve.
    // Se não houver atendimento, mantemos o status se ele for um "Manual" (NÃO, FALTOU, etc).
    // Se for LIVRE ou null, reavaliamos conforme os periodos originais.

    if (ocupaManha) {
      statusManha = 'CLIENTE';
    } else if (!statusManha || statusManha === 'LIVRE' || statusManha === 'CLIENTE') {
      if (isNaoOriginal) statusManha = 'NÃO';
      else if (hasManhaOriginal) statusManha = 'LIVRE';
      else statusManha = null;
    }

    if (ocupaTarde) {
      statusTarde = 'CLIENTE';
    } else if (!statusTarde || statusTarde === 'LIVRE' || statusTarde === 'CLIENTE') {
      if (isNaoOriginal) statusTarde = 'NÃO';
      else if (hasTardeOriginal) statusTarde = 'LIVRE';
      else statusTarde = null;
    }

    // 4. Update
    const { error: updateError } = await supabase
      .from('agenda_disponibilidade')
      .update({
        status_manha: statusManha,
        status_tarde: statusTarde,
        conflito: atendimentosAtivos.length > 0,
        updated_at: new Date().toISOString()
      })
      .eq('id', currentDisp.id);

    if (updateError) throw updateError;

  } catch (err) {
    console.error('Erro ao sincronizar disponibilidade da profissional:', err);
    throw err;
  }
};
/**
 * Inicializa as configurações de agenda para uma unidade caso não existam.
 * Marcado como is_system: true para identificação universal.
 */
export const initializeUnitAgenda = async (unitId: string): Promise<void> => {
  try {
    // 1. Verifica se já existe
    const { data: existing } = await supabase
      .from('agenda_settings')
      .select('id')
      .eq('unit_id', unitId)
      .maybeSingle();

    if (existing) return;

    // 2. Cria configuração padrão (Manual)
    // Não liberamos dias automaticamente para garantir controle total do administrador
    const { error: insErr } = await supabase
      .from('agenda_settings')
      .insert({
        unit_id: unitId,
        dias_liberados: [],
        periodos_cadastrados: ['8 horas', '6 horas', '4 horas manhã', '4 horas tarde', 'NÃO DISPONIVEL'],
        is_link_active: true,
        is_system: false,
        system_identifier: 'MANUAL_INITIALIZATION'
      });

    if (insErr) throw insErr;
    console.log(`Agenda inicializada para unidade ${unitId}`);

  } catch (err) {
    console.error('Erro ao inicializar agenda da unidade:', err);
  }
};
