export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  USER = 'user',
}

export interface User {
  id: string;
  email: string;
}

export interface Profile {
  id: string; // id do usuário (profiles.id)
  email?: string | null;
  full_name: string;
  role: UserRole;
}

export interface Unit {
  id: string;
  unit_name: string;
  unit_code: string;
}

export interface UnitKey {
  id: string;
  created_at: string;
  updated_at?: string;
  unit_id: string;
  // Campos de configuração por unidade (Option A)
  umbler: string | null;
  whats_profi: string | null;
  whats_client: string | null;
  botID: string | null;
  organizationID: string | null;
  trigger: string | null;
  description: string | null;
  is_active: boolean;
}

export interface Module {
  id: string;
  name: string;
  icon: string;
  webhook_url: string | null; // Permitir nulo
  view_id: string | null; // Adicionar view_id
  is_active: boolean;
  allowed_profiles: string[];
  position: number;
  parent_id?: string | null; // Hierarquia: módulo pai (nulo = topo)
  // Campo somente de UI (não persistido): filhos já resolvidos
  children?: Module[];
}

export type PageView = 'welcome' | 'module' | 'manage_users' | 'manage_modules' | 'manage_units' | 'manage_access' | 'data' | 'dashboard' | 'appointments' | 'agenda' | 'clients';

export type AccessCredentialType = 'LINK' | 'API_KEY' | 'TOKEN';

export interface AccessCredential {
  id: string;
  created_at: string;
  name: string;
  type: AccessCredentialType;
  value: string;
  description: string | null;
}

export interface DataRecord {
  id?: number;
  created_at?: string;
  orcamento: string;
  DATA: string | null;
  HORARIO: string;
  VALOR: number;
  // Fix: Added missing 'SERVIÇO' property to fix type error during data upload.
  SERVIÇO: string;
  TIPO: string;
  // Campo renomeado: agora apenas MOMENTO (antes PERÍODO)
  MOMENTO?: string;
  // Novo campo com acento 'PERÍODO' para armazenar coluna Horas (coluna H do XLSX)
  'PERÍODO'?: string | null;
  CLIENTE: string;
  PROFISSIONAL: string;
  ENDEREÇO: string;
  DIA: string;
  REPASSE: number;
  whatscliente: string;
  CUPOM: string;
  ORIGEM: string;
  ATENDIMENTO_ID: string;
  IS_DIVISAO: string;
  CADASTRO: string | null;
  ACAO: string | null;
  // Fix: Added missing NÚMERO property to DataRecord to fix type error on assignment.
  NÚMERO: string;
  // Novas colunas
  confirmacao: boolean | null;
  status: string | null;
  unidade: string | null;
  observacao: string | null;
  'pos vendas': string | null;
  comentario: string | null;
}

export interface DashboardMetrics {
  totalRevenue: number;
  totalServices: number;
  uniqueClients: number;
  averageTicket: number;
  totalRepasse: number;
}

export interface UploadMetrics {
    total: number;
    inserted: number;
    updated: number;
    ignored: number;
    deleted: number;
}

export interface ServiceAnalysisRecord {
  CADASTRO: string | null;
  DATA: string | null;
  DIA: string;
  ATENDIMENTO_ID: string;
}

export interface ClientAnalysisData {
  currentMonthClients: Set<string>;
  allPreviousClients: Set<string>;
  clientDetails: { CLIENTE: string, TIPO: string }[];
}

export interface RepasseAnalysisRecord {
  PROFISSIONAL: string;
  REPASSE: number;
}

// Recrutadora (Kanban)
export interface RecrutadoraColumn {
  id: string;
  unit_id: string; // chave de unidade atual
  unidade?: string;  // textual opcional
  code: string;   // usado no campo status dos cards
  name: string;   // rótulo da coluna
  color?: string | null;
  image_url?: string | null; // imagem do cabeçalho da coluna
  position: number;
  is_active: boolean;
}

export interface RecrutadoraCard {
  id: number;
  created_at: string;
  unit_id: string; // chave de unidade atual
  unidade?: string;  // textual opcional
  status: string;
  position: number;
  nome: string | null;
  whatsapp: string | null;
  color_card: string | null;
  // Campos adicionais (pessoais)
  data_nascimento?: string | null; // ISO date (legado UI)
  data_nasc?: string | null; // ISO date (coluna DB)
  fumante?: boolean | null;
  estado_civil?: string | null;
  filhos?: boolean | null;
  qtos_filhos?: number | null; // legado UI
  qto_filhos?: number | null; // coluna DB
  rotina_filhos?: string | null;
  endereco?: string | null; // legado UI
  'endereço'?: string | null; // coluna DB com acento
  rg?: string | null;
  cpf?: string | null;

  // Campos profissionais
  dias_livres?: string | null;
  dias_semana?: string | null;
  exp_residencial?: string | null;
  ref_residencial?: string | null; // legado UI
  ref_redidencial?: string | null; // coluna DB (grafia fornecida)
  exp_comercial?: string | null;
  ref_comercial?: string | null;
  sit_atual?: string | null; // situação atual
  motivo_cadastro?: string | null; // legado UI
  motivo_cadstro?: string | null; // coluna DB (grafia fornecida)
  transporte?: string | null;

  // Observação
  observacao?: string | null;
}
