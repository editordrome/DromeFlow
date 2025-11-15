-- =====================================================
-- Script: Criação de tabela de ações para data_drome
-- Data: 2025-11-14
-- Descrição: Mapeia códigos de ação para nomes legíveis
-- =====================================================

-- Criar tabela de ações
CREATE TABLE IF NOT EXISTS public.actions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  action_code text NOT NULL UNIQUE,
  action_name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Comentários da tabela
COMMENT ON TABLE public.actions IS 'Mapeia códigos de ação para nomes descritivos legíveis';
COMMENT ON COLUMN public.actions.action_code IS 'Código único da ação (ex: resp_atend_prof, envio_atend_client)';
COMMENT ON COLUMN public.actions.action_name IS 'Nome legível da ação';
COMMENT ON COLUMN public.actions.description IS 'Descrição detalhada da ação';

-- Índice para buscas rápidas por código
CREATE INDEX IF NOT EXISTS idx_actions_action_code ON public.actions(action_code);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_actions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_actions_updated_at
  BEFORE UPDATE ON public.actions
  FOR EACH ROW
  EXECUTE FUNCTION update_actions_updated_at();

-- =====================================================
-- Inserir ações comuns (ajuste conforme necessário)
-- =====================================================

INSERT INTO public.actions (action_code, action_name, description) VALUES
  ('resp_atend_prof', 'Resposta Atendimento Profissional', 'Envio de resposta de agendamento para a profissional'),
  ('envio_atend_client', 'Envio Atendimento Cliente', 'Envio de confirmação de agendamento para o cliente'),
  ('create_atend', 'Criar Atendimento', 'Criação de novo atendimento no sistema'),
  ('update_atend', 'Atualizar Atendimento', 'Atualização de dados do atendimento'),
  ('cancel_atend', 'Cancelar Atendimento', 'Cancelamento de atendimento'),
  ('confirm_atend', 'Confirmar Atendimento', 'Confirmação de atendimento'),
  ('reschedule_atend', 'Reagendar Atendimento', 'Reagendamento de atendimento'),
  ('notify_prof', 'Notificar Profissional', 'Envio de notificação para profissional'),
  ('notify_client', 'Notificar Cliente', 'Envio de notificação para cliente'),
  ('sync_data', 'Sincronizar Dados', 'Sincronização de dados entre sistemas')
ON CONFLICT (action_code) DO NOTHING;

-- =====================================================
-- RLS Policies (ajuste conforme necessário)
-- =====================================================

-- Habilitar RLS
ALTER TABLE public.actions ENABLE ROW LEVEL SECURITY;

-- Policy para leitura (todos autenticados podem ler)
CREATE POLICY "Permitir leitura de ações para usuários autenticados"
  ON public.actions
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy para inserção/atualização (apenas service_role)
CREATE POLICY "Apenas service_role pode modificar ações"
  ON public.actions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- Query de verificação
-- =====================================================

-- SELECT * FROM public.actions ORDER BY action_name;
