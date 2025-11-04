-- =====================================================
-- Evolution API - Gerenciamento de Instâncias WhatsApp
-- Data: 2025-11-04
-- =====================================================

-- Tabela principal: evolution_instances
-- Armazena as instâncias da Evolution API vinculadas às unidades
CREATE TABLE IF NOT EXISTS evolution_instances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  
  -- Identificação da instância
  instance_name TEXT NOT NULL UNIQUE,
  display_name TEXT, -- Nome amigável para exibição
  
  -- Configurações de API
  api_url TEXT NOT NULL DEFAULT 'https://api.evolution-api.com',
  api_key TEXT NOT NULL, -- Chave de acesso à Evolution API
  
  -- Status e conexão
  status TEXT NOT NULL DEFAULT 'disconnected', -- disconnected, connecting, connected, error
  qr_code TEXT, -- Base64 do QR Code para conexão
  phone_number TEXT, -- Número do WhatsApp conectado (formato: +5511999999999)
  profile_name TEXT, -- Nome do perfil conectado
  profile_picture_url TEXT, -- URL da foto de perfil
  
  -- Timestamps
  connected_at TIMESTAMPTZ, -- Data/hora da última conexão bem-sucedida
  disconnected_at TIMESTAMPTZ, -- Data/hora da última desconexão
  last_sync TIMESTAMPTZ, -- Última sincronização de status
  
  -- Webhooks e configurações
  webhook_url TEXT, -- URL para receber eventos da Evolution API
  webhook_events TEXT[], -- Lista de eventos habilitados (messages, connection, etc)
  
  -- Metadados
  error_message TEXT, -- Mensagem de erro caso status = 'error'
  metadata JSONB DEFAULT '{}'::jsonb, -- Dados adicionais configuráveis
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para otimização de consultas
CREATE INDEX IF NOT EXISTS idx_evolution_instances_unit_id 
  ON evolution_instances(unit_id);
  
CREATE INDEX IF NOT EXISTS idx_evolution_instances_status 
  ON evolution_instances(status);
  
CREATE INDEX IF NOT EXISTS idx_evolution_instances_instance_name 
  ON evolution_instances(instance_name);
  
CREATE INDEX IF NOT EXISTS idx_evolution_instances_is_active 
  ON evolution_instances(is_active);

-- Índice composto para filtros comuns
CREATE INDEX IF NOT EXISTS idx_evolution_instances_unit_status 
  ON evolution_instances(unit_id, status) WHERE is_active = true;

-- =====================================================
-- Tabela de Logs de Webhook
-- Registra todos os eventos recebidos da Evolution API
-- =====================================================
CREATE TABLE IF NOT EXISTS evolution_webhook_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instance_id UUID REFERENCES evolution_instances(id) ON DELETE CASCADE,
  
  -- Dados do evento
  event_type TEXT NOT NULL, -- messages.upsert, connection.update, etc
  event_data JSONB NOT NULL, -- Payload completo do webhook
  
  -- Processamento
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  
  -- Auditoria
  received_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET -- IP de origem da requisição
);

CREATE INDEX IF NOT EXISTS idx_evolution_webhook_logs_instance_id 
  ON evolution_webhook_logs(instance_id);
  
CREATE INDEX IF NOT EXISTS idx_evolution_webhook_logs_event_type 
  ON evolution_webhook_logs(event_type);
  
CREATE INDEX IF NOT EXISTS idx_evolution_webhook_logs_processed 
  ON evolution_webhook_logs(processed) WHERE processed = false;

CREATE INDEX IF NOT EXISTS idx_evolution_webhook_logs_received_at 
  ON evolution_webhook_logs(received_at DESC);

-- =====================================================
-- Trigger para atualizar updated_at automaticamente
-- =====================================================
CREATE OR REPLACE FUNCTION update_evolution_instances_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER evolution_instances_updated_at
  BEFORE UPDATE ON evolution_instances
  FOR EACH ROW
  EXECUTE FUNCTION update_evolution_instances_updated_at();

-- =====================================================
-- RLS (Row Level Security)
-- =====================================================

-- Habilitar RLS nas tabelas
ALTER TABLE evolution_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE evolution_webhook_logs ENABLE ROW LEVEL SECURITY;

-- Política para super_admin: acesso total
CREATE POLICY evolution_instances_super_admin_all
  ON evolution_instances
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Política para admin: acesso apenas às instâncias de suas unidades
CREATE POLICY evolution_instances_admin_own_units
  ON evolution_instances
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.unit_id = evolution_instances.unit_id
    )
  );

-- Política para user: apenas leitura das instâncias de suas unidades
CREATE POLICY evolution_instances_user_read_own_units
  ON evolution_instances
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'user'
      AND profiles.unit_id = evolution_instances.unit_id
    )
  );

-- Políticas para webhook_logs (apenas super_admin e admin)
CREATE POLICY evolution_webhook_logs_super_admin_all
  ON evolution_webhook_logs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY evolution_webhook_logs_admin_own_instances
  ON evolution_webhook_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN evolution_instances ei ON ei.unit_id = p.unit_id
      WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND ei.id = evolution_webhook_logs.instance_id
    )
  );

-- =====================================================
-- Função RPC: Sincronizar status de todas as instâncias
-- =====================================================
CREATE OR REPLACE FUNCTION sync_all_evolution_instances()
RETURNS TABLE(
  instance_id UUID,
  instance_name TEXT,
  old_status TEXT,
  new_status TEXT,
  synced_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  UPDATE evolution_instances
  SET last_sync = NOW()
  WHERE is_active = true
  RETURNING id, instance_name, status, status, NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Função RPC: Estatísticas de instâncias por unidade
-- =====================================================
CREATE OR REPLACE FUNCTION get_evolution_stats_by_unit(p_unit_id UUID DEFAULT NULL)
RETURNS TABLE(
  unit_id UUID,
  unit_name TEXT,
  total_instances BIGINT,
  connected_count BIGINT,
  disconnected_count BIGINT,
  error_count BIGINT,
  last_connection TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id AS unit_id,
    u.name AS unit_name,
    COUNT(ei.id) AS total_instances,
    COUNT(ei.id) FILTER (WHERE ei.status = 'connected') AS connected_count,
    COUNT(ei.id) FILTER (WHERE ei.status = 'disconnected') AS disconnected_count,
    COUNT(ei.id) FILTER (WHERE ei.status = 'error') AS error_count,
    MAX(ei.connected_at) AS last_connection
  FROM units u
  LEFT JOIN evolution_instances ei ON ei.unit_id = u.id AND ei.is_active = true
  WHERE (p_unit_id IS NULL OR u.id = p_unit_id)
  GROUP BY u.id, u.name
  ORDER BY u.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Comentários para documentação
-- =====================================================
COMMENT ON TABLE evolution_instances IS 
  'Instâncias da Evolution API vinculadas às unidades para automação de WhatsApp';

COMMENT ON COLUMN evolution_instances.instance_name IS 
  'Nome único da instância na Evolution API (usado nas URLs da API)';

COMMENT ON COLUMN evolution_instances.status IS 
  'Status da conexão: disconnected, connecting, connected, error';

COMMENT ON COLUMN evolution_instances.qr_code IS 
  'QR Code em Base64 para autenticação do WhatsApp (válido por 60-90 segundos)';

COMMENT ON TABLE evolution_webhook_logs IS 
  'Log de eventos recebidos via webhook da Evolution API para auditoria e processamento';

-- =====================================================
-- Dados de exemplo (OPCIONAL - comentar em produção)
-- =====================================================
-- INSERT INTO evolution_instances (unit_id, instance_name, display_name, api_url, api_key, status)
-- SELECT 
--   id,
--   'whats-' || LOWER(REPLACE(unit_code, ' ', '-')),
--   'WhatsApp ' || name,
--   'https://api.evolution-api.com',
--   'demo-api-key-' || id,
--   'disconnected'
-- FROM units
-- WHERE is_active = true
-- LIMIT 3;
