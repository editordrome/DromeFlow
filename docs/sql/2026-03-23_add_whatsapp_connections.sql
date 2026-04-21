-- ==============================================================================================
-- Migração: Criação da Tabela whatsapp_connections (Integração WhatsApp Cloud API - Meta)
-- Data: 2026-03-23
-- Descrição: Permite a coexistência do WhatsApp salvando os tokens e WABA IDs por unidade,
--            divididos entre 'comercial' e 'profissionais'.
-- ==============================================================================================

CREATE TABLE public.whatsapp_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid REFERENCES public.units(id) ON DELETE CASCADE NOT NULL,
  connection_type text NOT NULL CHECK (connection_type IN ('comercial', 'profissionais')),
  user_id uuid REFERENCES public.profiles(id), -- Quem vinculou
  waba_id text NOT NULL,
  phone_number_id text NOT NULL,
  phone_number text,
  access_token text NOT NULL,
  status text DEFAULT 'connected' CHECK (status IN ('connected', 'disconnected', 'error')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(unit_id, connection_type) -- Evita duplicidade do mesmo tipo na mesma unidade
);

-- Habilitando RLS
ALTER TABLE public.whatsapp_connections ENABLE ROW LEVEL SECURITY;

-- Política de RLS: Super Admins e Admins da unidade podem ver/editar
CREATE POLICY "Unidade e Super Admin gerenciam integrações"
ON public.whatsapp_connections
FOR ALL
USING (
  -- Super Admin tem acesso irrestrito
  (EXISTS (SELECT 1 FROM public.profiles WHERE auth_user_id = auth.uid() AND role = 'super_admin'))
  OR
  -- Ou se for um administrador/usuário daquela Unidade
  (
    EXISTS (
      SELECT 1 FROM public.user_units uu
      JOIN public.profiles p ON p.id = uu.user_id
      WHERE p.auth_user_id = auth.uid()
        AND uu.unit_id = whatsapp_connections.unit_id
    )
  )
);

-- Trigger para automatizar o updated_at
CREATE OR REPLACE FUNCTION update_whatsapp_connections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_whatsapp_connections_updated_at
BEFORE UPDATE ON public.whatsapp_connections
FOR EACH ROW
EXECUTE FUNCTION update_whatsapp_connections_updated_at();

-- Comentários da tabela
COMMENT ON TABLE public.whatsapp_connections IS 'Guarda os tokens e referências do WhatsApp Cloud API para o padrão de coexistência DromeFlow.';
