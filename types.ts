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

  address?: string | null;
  is_active: boolean;
  created_at: string;

  // Company information fields
  razao_social?: string | null;
  cnpj?: string | null;
  endereco?: string | null;
  responsavel?: string | null;
  contato?: string | null;
  email?: string | null;
}

export interface UnitKey {
  id: string | number;
  created_at: string;
  updated_at?: string;
  unit_id: string;
  is_active: boolean;
  // Campos de configuração por unidade
  codigo: string | null;
  istancia: string | null;
  recrutadora: string | null;
  botID: string | null;
  triggerName: string | null;
  organizationID: string | null;
  contato_profissionais: string | null;
  umbler: string | null;
  contato_atend: string | null;
  pos_vendas: string | null;
  conexao: string | null;
  id_recruta: string | null;
}

export interface Plan {
  id: string;
  name: string;
  description: string | null;
  value: number;
  cycle: 'monthly' | 'annual';
  status: boolean;
  payment_link: string | null;
  created_at: string;
  updated_at: string;
}

export interface Module {
  id: string;
  code?: string; // Código único do módulo
  name: string;
  icon?: string; // Legacy field (pode ser removido após migração completa)
  icon_name?: string; // Nome do ícone Lucide
  description?: string | null; // Descrição do módulo
  webhook_url: string | null; // Permitir nulo
  view_id: string | null; // Adicionar view_id
  is_active: boolean;
  allowed_profiles: string[];
  position: number;
  parent_id?: string | null; // Hierarquia: módulo pai (nulo = topo)
  // Campo somente de UI (não persistido): filhos já resolvidos
  children?: Module[];
}

export interface UnitModule {
  id: string;
  unit_id: string;
  module_id: string;
  created_at: string;
  updated_at: string;
}

export interface UnitModuleSummary {
  unit_id: string;
  unit_name: string;
  unit_code: string;
  total_modules: number;
  module_names: string[];
}

export type PageView =
  | 'welcome'
  | 'module'
  | 'manage_users'
  | 'manage_modules'
  | 'manage_units'
  | 'manage_access'
  | 'data'
  | 'dashboard'
  | 'appointments'
  | 'agenda'
  | 'clients'
  | 'clients_base'
  | 'recrutadora'
  | 'prestadoras'
  | 'profissionais'
  | 'comercial'
  | 'comercial_admin'
  | 'pos_vendas'
  | 'unit_keys'
  | 'dashboard_admin'
  | 'manage_plans'
  | 'financial';

export type AccessCredentialType = 'LINK' | 'API_KEY' | 'TOKEN';

export interface AccessCredential {
  id: string;
  created_at: string;
  name: string;
  type: AccessCredentialType;
  value: string;
  description: string | null;
}

// ============================================================================
// Batch Operations Types
// ============================================================================

/**
 * Interface para atualização de position em lote
 * Usado em drag & drop de Kanban (Recrutadora, Comercial, Módulos)
 */
export interface BatchPositionUpdate {
  id: string;
  position: number;
}

/**
 * Resultado de operação batch
 */
export interface BatchUpdateResult {
  success: boolean;
  updated_count: number;
  failed_count: number;
  total: number;
  error?: string;
}

export interface DataRecord {
  id?: number;
  created_at?: string;
  // Removido: orcamento e NÚMERO (agora usa apenas ATENDIMENTO_ID)
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
  PROFISSIONAL: string | null; // Aceita null quando não há profissional atribuído
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
  // Novas colunas
  confirmacao: boolean | null;
  status: string | null;
  unidade: string | null;
  observacao: string | null;
  'pos vendas': string | null;
  comentario: string | null;
  is_verified?: boolean;
  payment_status?: string | null;
  pagto?: string | null;
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
  clientDetails: { CLIENTE: string, PERÍODO: string, TIPO: string }[];
}

export interface RepasseAnalysisRecord {
  PROFISSIONAL: string | null; // Aceita null quando não há profissional
  REPASSE: number;
}

// Diretório de Clientes por Unidade
export interface UnitClient {
  id: string;
  unit_id: string;
  nome: string;
  tipo: string | null;
  endereco: string | null;
  contato: string | null;
  responsavel?: string | null;
  is_verified?: boolean;
  asaas_id?: string | null;
  created_at?: string;
  updated_at?: string;
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

// Comercial (Kanban)
export interface ComercialColumn {
  id: string;
  unit_id: string | null;
  code: string;
  name: string;
  color?: string | null;
  image_url?: string | null;
  position: number;
  is_active: boolean;
}

export interface ComercialCard {
  id: string;
  unit_id: string;
  nome: string;
  tipo: string | null; // Campo texto livre (não mais enum)
  endereco: string | null;
  contato: string | null;
  origem: string | null; // Nova coluna para rastreamento de origem
  status: string;
  observacao: string | null;
  created_at: string;
  updated_at: string;
  position: number;
}

// Comercial Admin (Kanban para Super Admin)
export interface ComercialAdminColumn {
  id: string;
  unit_id: string | null;
  code: string;
  name: string;
  color?: string | null;
  image_url?: string | null;
  position: number;
  is_active: boolean;
}

export interface ComercialAdminCard {
  id: string;
  unit_id: string;
  nome: string;
  endereco: string | null;
  contato: string | null;
  origem: string | null;
  status: string;
  observacao: string | null;
  plano_id: string | null;
  data_inicio_teste: string | null; // ISO date (YYYY-MM-DD)
  data_fim_teste: string | null; // ISO date (YYYY-MM-DD)
  position: number;
  created_at: string;
  updated_at: string;

  // Campos populados via JOIN (não persistidos)
  plano?: {
    id: string;
    name: string;
    value: number;
    cycle: 'monthly' | 'annual';
  };
}

// Pós-Vendas
export interface PosVenda {
  id: string;
  ATENDIMENTO_ID: string | null;
  chat_id: string | null;
  nome: string | null;
  contato: string | null;
  unit_id: string | null;
  data: string | null; // ISO timestamp
  status: 'pendente' | 'agendado' | 'contatado' | 'finalizado' | null;
  nota: number | null; // 1-5
  reagendou: boolean;
  feedback: string | null;
  data_agendamento: string | null; // Data programada para envio (YYYY-MM-DD)
  horario_agendamento: string | null; // Horário programado para envio (HH:MM:SS)
  created_at: string;
  updated_at: string;
}

export interface PosVendaFormData {
  ATENDIMENTO_ID?: string | null;
  chat_id?: string | null;
  nome?: string | null;
  contato?: string | null;
  unit_id?: string | null;
  data?: string | null;
  status?: 'pendente' | 'agendado' | 'contatado' | 'finalizado' | null;
  nota?: number | null;
  reagendou?: boolean;
  feedback?: string | null;
  data_agendamento?: string | null; // Data programada para envio
  horario_agendamento?: string | null; // Horário programado para envio
}

// Unit Plans & Payments
export interface UnitPlan {
  id: string;
  unit_id: string;
  plan_id: string;
  start_date: string;
  end_date: string | null;
  status: 'active' | 'inactive' | 'cancelled';
  due_day?: number;
  payment_type?: 'pix' | 'credit_card';
  created_at: string;
  updated_at: string;
  parent_unit_id: string | null;
  // Joins
  plan?: Plan;
}

export interface UnitPayment {
  id: string;
  unit_plan_id: string;
  reference_date: string; // YYYY-MM-DD
  amount: number;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  payment_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface AtendimentoSearchResult {
  ATENDIMENTO_ID: string;
  CLIENTE: string;
  DATA: string;
  SERVICO: string;
  ENDERECO: string;
}

export interface PaymentRecord {
  id: string;
  cliente_asaas_id: string;
  atendimento_id?: string | null;
  id_pagamento_asaas: string;
  status_pagamento: string;
  valor: number;
  data_vencimento: string; // YYYY-MM-DD
  tipo_pagamento?: string | null;
  data_pagamento?: string | null; // ISO timestamp
  link?: string | null;
  grupo?: string | null;
  nome?: string | null; // Nome do cliente desnormalizado
  unit_id?: string | null; // ID da unidade (opcional se quiser filtrar direto sem join)
  created_at: string;
  updated_at: string;
  // Joins
  unit_clients?: {
    nome: string;
    // outros campos se necessário
  };
}

// ============================================================================
// Activity Logs & Monitoring (Consolidado do Data Drome → DromeFlow)
// ============================================================================

export interface Action {
  id: string;
  action_code: string;
  action_name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActivityLog {
  id: number;
  created_at: string;
  unit_code: string | null;
  workflow: string | null;
  action_code: string | null;
  atend_id: string | null;
  user_identifier: string | null;
  status: 'success' | 'error' | 'pending' | 'cancelled';
  horario: string | null;
  metadata: Record<string, unknown> | null;
}

export interface ErrorLog {
  id: number;
  created_at: string;
  workflow: string | null;
  url_workflow: string | null;
  error_message: string | null;
  error_type: string | null;
  severity: 'info' | 'warning' | 'error' | 'critical';
  stack_trace: string | null;
  user_id: string | null;
  unit_code: string | null;
  context: Record<string, unknown> | null;
  resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_notes: string | null;
}

export interface ActivityStats {
  action_code: string;
  action_name: string;
  total_executions: number;
  success_count: number;
  error_count: number;
  success_rate: number;
}

// ============================================================================
// Legacy Types (Data Drome - Deprecated após consolidação)
// ============================================================================
// @deprecated Use ActivityLog ao invés disso
export interface N8NMonitoringLog {
  id: number;
  created_at: string;
  unit: string | null;
  status: string | null;
  horario: string | null;
  user: string | null;
  atend_id: string | null;
  action: string | null;
  workflow: string | null;
}

// @deprecated Use ErrorLog ao invés disso
export interface N8NErrorLog {
  id: number;
  created_at: string;
  workflow: string | null;
  url_workflow: string | null;
  erro_message: string | null;
}
