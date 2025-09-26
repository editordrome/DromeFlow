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

export interface Module {
  id: string;
  name: string;
  icon: string;
  webhook_url: string | null; // Permitir nulo
  view_id: string | null; // Adicionar view_id
  is_active: boolean;
  allowed_profiles: string[];
  position: number;
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
