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
