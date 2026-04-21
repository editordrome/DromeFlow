-- =====================================================
-- Arquivo: Create n8n_logs Table
-- Data: 2025-11-17
-- Descrição: Cria tabela n8n_logs para receber logs de workflows N8N
--            Estrutura idêntica a activity_logs, mas sem triggers/automações
--            Será alimentada exclusivamente por webhooks externos do N8N
-- =====================================================

-- =====================================================
-- 1. Criar tabela n8n_logs
-- =====================================================

CREATE TABLE IF NOT EXISTS n8n_logs (
  id BIGSERIAL PRIMARY KEY,
  unit_code TEXT,
  workflow TEXT,
  action_code TEXT,
  atend_id TEXT,
  user_identifier TEXT,
  status TEXT,
  horario TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 2. Criar índices para performance
-- =====================================================

-- Índice para buscar por unidade
CREATE INDEX IF NOT EXISTS idx_n8n_logs_unit_code 
ON n8n_logs(unit_code);

-- Índice para buscar por workflow
CREATE INDEX IF NOT EXISTS idx_n8n_logs_workflow 
ON n8n_logs(workflow);

-- Índice para buscar por action_code
CREATE INDEX IF NOT EXISTS idx_n8n_logs_action_code 
ON n8n_logs(action_code);

-- Índice para buscar por status
CREATE INDEX IF NOT EXISTS idx_n8n_logs_status 
ON n8n_logs(status);

-- Índice para buscar por data/hora (mais recentes primeiro)
CREATE INDEX IF NOT EXISTS idx_n8n_logs_created_at 
ON n8n_logs(created_at DESC);

-- Índice para buscar por horário do evento
CREATE INDEX IF NOT EXISTS idx_n8n_logs_horario 
ON n8n_logs(horario DESC);

-- Índice composto para filtros comuns (unidade + status + data)
CREATE INDEX IF NOT EXISTS idx_n8n_logs_unit_status_date 
ON n8n_logs(unit_code, status, created_at DESC);

-- =====================================================
-- 3. Adicionar comentários
-- =====================================================

COMMENT ON TABLE n8n_logs IS 
'Tabela para armazenar logs de workflows N8N. Alimentada exclusivamente por webhooks externos.';

COMMENT ON COLUMN n8n_logs.id IS 
'ID sequencial auto-incrementado';

COMMENT ON COLUMN n8n_logs.unit_code IS 
'Código da unidade onde ocorreu a ação';

COMMENT ON COLUMN n8n_logs.workflow IS 
'Nome/identificador do workflow N8N que gerou o log';

COMMENT ON COLUMN n8n_logs.action_code IS 
'Código da ação executada (referência à tabela actions)';

COMMENT ON COLUMN n8n_logs.atend_id IS 
'ID do atendimento relacionado (quando aplicável)';

COMMENT ON COLUMN n8n_logs.user_identifier IS 
'Identificador do usuário (email ou nome)';

COMMENT ON COLUMN n8n_logs.status IS 
'Status da execução (success, error, etc.)';

COMMENT ON COLUMN n8n_logs.horario IS 
'Timestamp do evento registrado pelo workflow';

COMMENT ON COLUMN n8n_logs.metadata IS 
'Dados adicionais em formato JSON (flexível para diferentes workflows)';

COMMENT ON COLUMN n8n_logs.created_at IS 
'Timestamp de quando o registro foi inserido no banco';

-- =====================================================
-- 4. Configurar RLS (Row Level Security)
-- =====================================================

-- Habilitar RLS
ALTER TABLE n8n_logs ENABLE ROW LEVEL SECURITY;

-- Policy para leitura (apenas authenticated users)
CREATE POLICY "n8n_logs_select_authenticated" 
ON n8n_logs 
FOR SELECT 
TO authenticated 
USING (true);

-- Policy para inserção (service_role e anon para webhooks)
CREATE POLICY "n8n_logs_insert_service" 
ON n8n_logs 
FOR INSERT 
TO service_role, anon
WITH CHECK (true);

-- =====================================================
-- 5. Verificar estrutura criada
-- =====================================================

SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'n8n_logs'
ORDER BY ordinal_position;
