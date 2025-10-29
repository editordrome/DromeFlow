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
  return (data as Profissional[]) || [];
};

// Histórico de atendimentos por profissional (em processed_data)
export const fetchProfessionalHistory = async (
  unitCode: string,
  profissionalNome: string,
  limit: number = 200,
  period?: string // YYYY-MM
): Promise<Array<{ id?: number; DATA: string | null; DIA: string; CLIENTE: string; 'pos vendas': string | null }>> => {
  if (!unitCode || !profissionalNome) return [];
  let query = supabase
    .from('processed_data')
    .select('id, DATA, DIA, CLIENTE, "pos vendas"')
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

  const parseScore = (v: any): number | null => {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') {
      const n = Math.max(0, Math.min(5, v));
      return Number.isFinite(n) ? n : null;
    }
    const s = String(v).trim();
    if (!s) return null;
    // tenta pegar primeiro número 0-5
    const m = s.match(/[0-5](?:[.,][0-9])?/);
    if (m) {
      const n = parseFloat(m[0].replace(',', '.'));
      if (!Number.isNaN(n)) return Math.max(0, Math.min(5, n));
    }
    const n2 = parseFloat(s.replace(',', '.'));
    if (!Number.isNaN(n2)) return Math.max(0, Math.min(5, n2));
    return null;
  };

  const avg = (arr: any[]): number | null => {
    const vals = arr.map((x) => parseScore((x as any)["pos vendas"]))
      .filter((n): n is number => typeof n === 'number');
    if (!vals.length) return null;
    const sum = vals.reduce((a, b) => a + b, 0);
    return +(sum / vals.length).toFixed(1);
  };

  const base = supabase
    .from('processed_data')
    .select('"pos vendas", TIPO')
    .eq('unidade_code', unitCode)
    .ilike('PROFISSIONAL', `%${profissionalNome}%`)
    .order('DATA', { ascending: false });

  const baseFiltered = base.clone().not('"pos vendas"', 'is', null).neq('"pos vendas"', '');

  const [allRes, comercialRes, residencialRes] = await Promise.all([
    baseFiltered.clone(),
    baseFiltered.clone().ilike('TIPO', '%comercial%'),
    baseFiltered.clone().ilike('TIPO', '%residencial%'),
  ]);

  const geral = allRes.error ? null : avg((allRes.data as any[]) || []);
  const comercial = comercialRes.error ? null : avg((comercialRes.data as any[]) || []);
  const residencial = residencialRes.error ? null : avg((residencialRes.data as any[]) || []);

  return { geral, comercial, residencial };
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
