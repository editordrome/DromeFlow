-- =====================================================
-- Migração: Módulo de Chat Umbler
-- Data: 2026-02-26
-- Descrição: Adiciona o módulo Chat e vincula usuários à Umbler
-- =====================================================

-- 1. ADICIONAR CAMPO NA TABELA user_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' 
    AND column_name = 'umbler_member_id'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN umbler_member_id TEXT;
    COMMENT ON COLUMN user_profiles.umbler_member_id IS 'ID do membro correspondente na Umbler Talk';
  END IF;
END $$;

-- 2. INSERIR O MÓDULO CHAT NA TABELA modules (SE NÃO EXISTIR)
INSERT INTO modules (code, name, description, icon_name, is_active, allowed_profiles, position)
VALUES (
  'chat', 
  'Chat', 
  'Atendimento em tempo real integrado via Umbler', 
  'MessageSquare', 
  true, 
  '{super_admin,admin,user}', 
  90
)
ON CONFLICT (code) DO UPDATE 
SET name = EXCLUDED.name, 
    description = EXCLUDED.description,
    icon_name = EXCLUDED.icon_name;

-- 3. GARANTIR QUE AS COLUNAS NA TIPO UnitKey SEJAM REFLETIDAS (Mapeado no frontend, mas bom ter comentário)
-- umbler e organizationID já existem em unit_keys conforme análise do types.ts e unitKeysColumns.service.ts
