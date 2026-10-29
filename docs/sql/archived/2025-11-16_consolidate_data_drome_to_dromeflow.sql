-- =====================================================
-- Migration: Consolidar Data Drome → DromeFlow
-- Data: 2025-11-16
-- Objetivo: Mover tabelas de logs/monitoramento do Data Drome para DromeFlow
-- Benefício: Economia de $180/ano + simplificação de arquitetura
-- =====================================================

-- ============================================================================
-- TABELA 1: actions (Dicionário de Ações)
-- ============================================================================
-- Mapeia códigos de ação para nomes descritivos legíveis

CREATE TABLE IF NOT EXISTS public.actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_code TEXT UNIQUE NOT NULL,
  action_name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.actions IS 'Dicionário de ações do sistema (N8N workflows, integrações, eventos)';
COMMENT ON COLUMN public.actions.action_code IS 'Código único da ação (ex: resp_atend_prof, envio_atend_client)';
COMMENT ON COLUMN public.actions.action_name IS 'Nome legível da ação';

-- Índice para lookup rápido por código
CREATE INDEX IF NOT EXISTS idx_actions_action_code ON public.actions(action_code);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_actions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_actions_updated_at
  BEFORE UPDATE ON public.actions
  FOR EACH ROW
  EXECUTE FUNCTION update_actions_updated_at();

-- ============================================================================
-- TABELA 2: activity_logs (Logs de Atividades N8N)
-- ============================================================================
-- Registra execuções de workflows N8N e eventos do sistema
-- Substitui: monitoramento_dromeboard

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Contexto da atividade
  unit_code TEXT REFERENCES units(unit_code) ON DELETE SET NULL,
  workflow TEXT, -- Nome do workflow N8N
  action_code TEXT REFERENCES actions(action_code) ON DELETE SET NULL,
  
  -- Dados da execução
  atend_id TEXT, -- Referência ao ATENDIMENTO_ID (não FK pois pode não existir ainda)
  user_identifier TEXT, -- Email, telefone ou ID do usuário que disparou
  status TEXT, -- 'success', 'error', 'pending'
  horario TIMESTAMPTZ, -- Timestamp da execução original (pode diferir de created_at)
  
  -- Metadados adicionais (JSON flexível)
  metadata JSONB,
  
  CONSTRAINT activity_logs_status_check 
    CHECK (status IN ('success', 'error', 'pending', 'cancelled'))
);

COMMENT ON TABLE public.activity_logs IS 'Logs de atividades de workflows N8N e eventos do sistema';
COMMENT ON COLUMN public.activity_logs.unit_code IS 'Código da unidade relacionada';
COMMENT ON COLUMN public.activity_logs.workflow IS 'Nome do workflow N8N que executou a ação';
COMMENT ON COLUMN public.activity_logs.action_code IS 'Código da ação executada (FK para actions)';
COMMENT ON COLUMN public.activity_logs.atend_id IS 'ID do atendimento relacionado (se aplicável)';
COMMENT ON COLUMN public.activity_logs.user_identifier IS 'Email, telefone ou ID do usuário';
COMMENT ON COLUMN public.activity_logs.metadata IS 'Dados adicionais em formato JSON (flexível para expansão)';

-- Índices para queries comuns
CREATE INDEX IF NOT EXISTS idx_activity_logs_unit_date 
  ON public.activity_logs(unit_code, created_at DESC);
  
CREATE INDEX IF NOT EXISTS idx_activity_logs_atend_id 
  ON public.activity_logs(atend_id) 
  WHERE atend_id IS NOT NULL;
  
CREATE INDEX IF NOT EXISTS idx_activity_logs_action 
  ON public.activity_logs(action_code, created_at DESC);
  
CREATE INDEX IF NOT EXISTS idx_activity_logs_workflow 
  ON public.activity_logs(workflow, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_logs_status 
  ON public.activity_logs(status, created_at DESC);

-- Índice GIN para busca em metadata JSON
CREATE INDEX IF NOT EXISTS idx_activity_logs_metadata_gin 
  ON public.activity_logs USING GIN(metadata);

-- ============================================================================
-- TABELA 3: error_logs (Logs de Erros)
-- ============================================================================
-- Registra erros de workflows N8N e exceções do sistema
-- Substitui: error_dromeboard

CREATE TABLE IF NOT EXISTS public.error_logs (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Contexto do erro
  workflow TEXT, -- Workflow N8N que gerou o erro
  url_workflow TEXT, -- URL do webhook/endpoint que falhou
  error_message TEXT, -- Mensagem de erro detalhada
  error_type TEXT, -- Tipo do erro (network, validation, database, etc)
  severity TEXT DEFAULT 'error', -- 'info', 'warning', 'error', 'critical'
  
  -- Contexto adicional
  stack_trace TEXT, -- Stack trace completo (se disponível)
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  unit_code TEXT REFERENCES units(unit_code) ON DELETE SET NULL,
  
  -- Metadados (request headers, payload, etc)
  context JSONB,
  
  -- Resolução
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  resolution_notes TEXT,
  
  CONSTRAINT error_logs_severity_check 
    CHECK (severity IN ('info', 'warning', 'error', 'critical'))
);

COMMENT ON TABLE public.error_logs IS 'Logs de erros de workflows N8N e exceções do sistema';
COMMENT ON COLUMN public.error_logs.workflow IS 'Nome do workflow que gerou o erro';
COMMENT ON COLUMN public.error_logs.url_workflow IS 'URL do webhook/endpoint que falhou';
COMMENT ON COLUMN public.error_logs.severity IS 'Severidade: info, warning, error, critical';
COMMENT ON COLUMN public.error_logs.context IS 'Metadados do erro (headers, payload, environment)';

-- Índices para análise de erros
CREATE INDEX IF NOT EXISTS idx_error_logs_workflow 
  ON public.error_logs(workflow, created_at DESC);
  
CREATE INDEX IF NOT EXISTS idx_error_logs_severity 
  ON public.error_logs(severity, created_at DESC) 
  WHERE NOT resolved;
  
CREATE INDEX IF NOT EXISTS idx_error_logs_unit 
  ON public.error_logs(unit_code, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_error_logs_unresolved 
  ON public.error_logs(created_at DESC) 
  WHERE NOT resolved;

-- Índice GIN para busca em context JSON
CREATE INDEX IF NOT EXISTS idx_error_logs_context_gin 
  ON public.error_logs USING GIN(context);

-- ============================================================================
-- RLS POLICIES (Row Level Security)
-- ============================================================================

-- Habilitar RLS
ALTER TABLE public.actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

-- Policy: actions - Leitura pública, escrita apenas autenticados
CREATE POLICY "actions_select_all" ON public.actions
  FOR SELECT USING (true);

CREATE POLICY "actions_insert_authenticated" ON public.actions
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "actions_update_authenticated" ON public.actions
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Policy: activity_logs - Apenas autenticados
CREATE POLICY "activity_logs_select_authenticated" ON public.activity_logs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "activity_logs_insert_authenticated" ON public.activity_logs
  FOR INSERT TO authenticated WITH CHECK (true);

-- Policy: error_logs - Apenas autenticados
CREATE POLICY "error_logs_select_authenticated" ON public.error_logs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "error_logs_insert_authenticated" ON public.error_logs
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "error_logs_update_authenticated" ON public.error_logs
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- DADOS INICIAIS: Popular tabela actions
-- ============================================================================

INSERT INTO public.actions (id, action_code, action_name, description, created_at, updated_at) 
VALUES 
  ('1ed45245-4731-4e73-9c06-bceb5b63e9ca', 'resp_atend_prof', 'Resposta Atendimento Profissional', 'Envio de resposta de agendamento para a profissional', '2025-11-15 01:44:40.380926+00', '2025-11-15 01:44:40.380926+00'),
  ('9a90740e-f8fa-4d7a-89cc-4ee0e3ecdb97', 'envio_atend_client', 'Envio Atendimento Cliente', 'Envio de confirmação de agendamento para o cliente', '2025-11-15 01:44:40.380926+00', '2025-11-15 01:44:40.380926+00'),
  ('da5d04e0-99ed-42f5-a58e-66f384488e11', 'create_atend', 'Criar Atendimento', 'Criação de novo atendimento no sistema', '2025-11-15 01:44:40.380926+00', '2025-11-15 01:44:40.380926+00'),
  ('e8f2ecbf-2670-40db-bff3-6fdbb24499fa', 'update_atend', 'Atualizar Atendimento', 'Atualização de dados do atendimento', '2025-11-15 01:44:40.380926+00', '2025-11-15 01:44:40.380926+00'),
  ('4485abf2-46cc-4e4f-9aac-c1d655267c2b', 'cancel_atend', 'Cancelar Atendimento', 'Cancelamento de atendimento', '2025-11-15 01:44:40.380926+00', '2025-11-15 01:44:40.380926+00'),
  ('edf7a7e4-5dc7-43c7-ac01-f46b5ab78ec0', 'confirm_atend', 'Confirmar Atendimento', 'Confirmação de atendimento', '2025-11-15 01:44:40.380926+00', '2025-11-15 01:44:40.380926+00'),
  ('fb3cf0cd-aa3b-4c91-b87f-163ff0792f89', 'reschedule_atend', 'Reagendar Atendimento', 'Reagendamento de atendimento', '2025-11-15 01:44:40.380926+00', '2025-11-15 01:44:40.380926+00'),
  ('eb03d404-488b-4ef3-9af4-a3fddaa80cf1', 'notify_prof', 'Notificar Profissional', 'Envio de notificação para profissional', '2025-11-15 01:44:40.380926+00', '2025-11-15 01:44:40.380926+00'),
  ('bd71c5e5-cf5b-47ad-8ffa-2571fcbb9daa', 'notify_client', 'Notificar Cliente', 'Envio de notificação para cliente', '2025-11-15 01:44:40.380926+00', '2025-11-15 01:44:40.380926+00'),
  ('bfff9c53-ec0c-4d88-bbae-c87372070a8a', 'sync_data', 'Sincronizar Dados', 'Sincronização de dados entre sistemas', '2025-11-15 01:44:40.380926+00', '2025-11-15 01:44:40.380926+00')
ON CONFLICT (action_code) DO UPDATE SET
  action_name = EXCLUDED.action_name,
  description = EXCLUDED.description,
  updated_at = NOW();

-- ============================================================================
-- FUNÇÕES AUXILIARES
-- ============================================================================

-- Função: Buscar logs de atividade por unidade e período
CREATE OR REPLACE FUNCTION get_activity_logs_by_unit(
  p_unit_code TEXT,
  p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '7 days',
  p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  id BIGINT,
  created_at TIMESTAMPTZ,
  action_name TEXT,
  workflow TEXT,
  status TEXT,
  atend_id TEXT,
  user_identifier TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    al.id,
    al.created_at,
    a.action_name,
    al.workflow,
    al.status,
    al.atend_id,
    al.user_identifier
  FROM activity_logs al
  LEFT JOIN actions a ON al.action_code = a.action_code
  WHERE al.unit_code = p_unit_code
    AND al.created_at BETWEEN p_start_date AND p_end_date
  ORDER BY al.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_activity_logs_by_unit IS 
'Busca logs de atividade filtrados por unidade e período (padrão: últimos 7 dias)';

-- Função: Estatísticas de logs por ação
CREATE OR REPLACE FUNCTION get_activity_stats_by_action(
  p_unit_code TEXT DEFAULT NULL,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  action_code TEXT,
  action_name TEXT,
  total_executions BIGINT,
  success_count BIGINT,
  error_count BIGINT,
  success_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    al.action_code,
    a.action_name,
    COUNT(*) as total_executions,
    COUNT(*) FILTER (WHERE al.status = 'success') as success_count,
    COUNT(*) FILTER (WHERE al.status = 'error') as error_count,
    ROUND(
      (COUNT(*) FILTER (WHERE al.status = 'success')::NUMERIC / NULLIF(COUNT(*), 0)) * 100,
      2
    ) as success_rate
  FROM activity_logs al
  LEFT JOIN actions a ON al.action_code = a.action_code
  WHERE 
    (p_unit_code IS NULL OR al.unit_code = p_unit_code)
    AND al.created_at >= NOW() - (p_days || ' days')::INTERVAL
  GROUP BY al.action_code, a.action_name
  ORDER BY total_executions DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_activity_stats_by_action IS 
'Estatísticas de execuções por ação (total, sucesso, erro, taxa de sucesso)';

-- ============================================================================
-- LIMPEZA AUTOMÁTICA (Opcional - Retenção de Dados)
-- ============================================================================

-- Função para deletar logs antigos (executar manualmente ou via cron)
CREATE OR REPLACE FUNCTION cleanup_old_activity_logs(p_retention_days INTEGER DEFAULT 90)
RETURNS TABLE (
  deleted_count BIGINT
) AS $$
DECLARE
  v_deleted BIGINT;
BEGIN
  DELETE FROM activity_logs
  WHERE created_at < NOW() - (p_retention_days || ' days')::INTERVAL;
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  
  RETURN QUERY SELECT v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_old_activity_logs IS 
'Deleta logs de atividade com mais de N dias (padrão: 90). Executar manualmente ou via cron.';

-- ============================================================================
-- VERIFICAÇÃO PÓS-MIGRATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration concluída com sucesso!';
  RAISE NOTICE '📊 Tabelas criadas: actions, activity_logs, error_logs';
  RAISE NOTICE '🔐 RLS habilitado em todas as tabelas';
  RAISE NOTICE '📈 Ações populadas: % registros', (SELECT COUNT(*) FROM actions);
  RAISE NOTICE '';
  RAISE NOTICE '📝 Próximos passos:';
  RAISE NOTICE '1. Atualizar N8N webhooks para: https://uframhbsgtxckdxttofo.supabase.co/rest/v1/activity_logs';
  RAISE NOTICE '2. Criar serviço TypeScript: services/analytics/activityLogs.service.ts';
  RAISE NOTICE '3. Pausar projeto Data Drome no Supabase Dashboard';
  RAISE NOTICE '4. Economia anual: $180';
END $$;
