-- ============================================
-- Sistema de Gerenciamento de Atualizações
-- DromeFlow v2.0
-- Data: 2026-01-20
-- ============================================

-- 1. Tabela de Versões da Aplicação
-- ============================================
CREATE TABLE IF NOT EXISTS app_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version VARCHAR(20) NOT NULL UNIQUE,
  release_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  title VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  is_mandatory BOOLEAN DEFAULT false,
  changelog TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comentários
COMMENT ON TABLE app_versions IS 'Armazena informações sobre versões da aplicação';
COMMENT ON COLUMN app_versions.version IS 'Número da versão (ex: 2.1.0)';
COMMENT ON COLUMN app_versions.title IS 'Título da notificação de atualização';
COMMENT ON COLUMN app_versions.message IS 'Mensagem exibida no toast';
COMMENT ON COLUMN app_versions.is_active IS 'Se deve exibir notificação para esta versão';
COMMENT ON COLUMN app_versions.is_mandatory IS 'Se atualização é obrigatória (sem botão dispensar)';
COMMENT ON COLUMN app_versions.changelog IS 'Notas de versão em markdown';

-- Índices
CREATE INDEX IF NOT EXISTS idx_app_versions_active ON app_versions(is_active);
CREATE INDEX IF NOT EXISTS idx_app_versions_version ON app_versions(version);
CREATE INDEX IF NOT EXISTS idx_app_versions_release_date ON app_versions(release_date DESC);

-- RLS
ALTER TABLE app_versions ENABLE ROW LEVEL SECURITY;

-- Policy: Super Admin tem acesso total
DROP POLICY IF EXISTS "super_admin_all_versions" ON app_versions;
CREATE POLICY "super_admin_all_versions" ON app_versions
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'super_admin'
    )
  );

-- Policy: Todos podem ler versões ativas
DROP POLICY IF EXISTS "public_read_active_versions" ON app_versions;
CREATE POLICY "public_read_active_versions" ON app_versions
  FOR SELECT 
  USING (is_active = true);


-- 2. Tabela de Atualizações de Usuários
-- ============================================
CREATE TABLE IF NOT EXISTS user_version_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  version_id UUID NOT NULL REFERENCES app_versions(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_agent TEXT,
  dismissed BOOLEAN DEFAULT false,
  
  CONSTRAINT unique_user_version UNIQUE(user_id, version_id)
);

-- Comentários
COMMENT ON TABLE user_version_updates IS 'Rastreia quando cada usuário atualizou para cada versão';
COMMENT ON COLUMN user_version_updates.user_agent IS 'Navegador/dispositivo usado na atualização';
COMMENT ON COLUMN user_version_updates.dismissed IS 'Se usuário dispensou a notificação sem atualizar';

-- Índices
CREATE INDEX IF NOT EXISTS idx_user_version_updates_user ON user_version_updates(user_id);
CREATE INDEX IF NOT EXISTS idx_user_version_updates_version ON user_version_updates(version_id);
CREATE INDEX IF NOT EXISTS idx_user_version_updates_dismissed ON user_version_updates(dismissed);
CREATE INDEX IF NOT EXISTS idx_user_version_updates_updated_at ON user_version_updates(updated_at DESC);

-- RLS
ALTER TABLE user_version_updates ENABLE ROW LEVEL SECURITY;

-- Policy: Super Admin tem acesso total
DROP POLICY IF EXISTS "super_admin_all_updates" ON user_version_updates;
CREATE POLICY "super_admin_all_updates" ON user_version_updates
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'super_admin'
    )
  );

-- Policy: Usuários podem gerenciar seus próprios registros
DROP POLICY IF EXISTS "users_own_updates" ON user_version_updates;
CREATE POLICY "users_own_updates" ON user_version_updates
  FOR ALL 
  USING (user_id = auth.uid());


-- 3. View de Estatísticas de Adoção
-- ============================================
CREATE OR REPLACE VIEW version_adoption_stats AS
SELECT 
  v.id,
  v.version,
  v.title,
  v.release_date,
  v.is_active,
  v.is_mandatory,
  COUNT(DISTINCT uvu.user_id) FILTER (WHERE uvu.dismissed = false) as updated_users,
  COUNT(DISTINCT uvu.user_id) FILTER (WHERE uvu.dismissed = true) as dismissed_users,
  COUNT(DISTINCT p.id) as total_users,
  ROUND(
    (COUNT(DISTINCT uvu.user_id) FILTER (WHERE uvu.dismissed = false)::NUMERIC / 
     NULLIF(COUNT(DISTINCT p.id), 0) * 100), 
    2
  ) as adoption_rate
FROM app_versions v
CROSS JOIN profiles p
LEFT JOIN user_version_updates uvu ON v.id = uvu.version_id AND p.id = uvu.user_id
WHERE p.role != 'super_admin'  -- Não conta super admins nas estatísticas
GROUP BY v.id, v.version, v.title, v.release_date, v.is_active, v.is_mandatory
ORDER BY v.release_date DESC;

COMMENT ON VIEW version_adoption_stats IS 'Estatísticas de adoção de versões por usuários';


-- 4. Função para Atualizar updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para app_versions
DROP TRIGGER IF EXISTS update_app_versions_updated_at ON app_versions;
CREATE TRIGGER update_app_versions_updated_at
  BEFORE UPDATE ON app_versions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- 5. Dados Iniciais (Versão Atual)
-- ============================================
INSERT INTO app_versions (version, title, message, is_active, is_mandatory, changelog)
VALUES (
  '2.0.0',
  'Nova versão disponível! 🎉',
  'Atualize agora para ter acesso ao novo sistema de gerenciamento de versões e muito mais!',
  true,
  false,
  '# DromeFlow v2.0.0

## 🎉 Novidades

- ✨ Sistema de gerenciamento de atualizações
- 📊 Analytics de adoção de versões
- 🔔 Notificações configuráveis
- 🎨 Interface aprimorada

## 🐛 Correções

- Melhorias de performance
- Correções de bugs diversos

## 📝 Notas

Esta é a primeira versão com o novo sistema de atualizações!'
)
ON CONFLICT (version) DO NOTHING;


-- ============================================
-- Verificações Finais
-- ============================================

-- Verificar se tabelas foram criadas
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'app_versions') THEN
    RAISE NOTICE '✅ Tabela app_versions criada com sucesso';
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_version_updates') THEN
    RAISE NOTICE '✅ Tabela user_version_updates criada com sucesso';
  END IF;
  
  IF EXISTS (SELECT FROM pg_views WHERE schemaname = 'public' AND viewname = 'version_adoption_stats') THEN
    RAISE NOTICE '✅ View version_adoption_stats criada com sucesso';
  END IF;
END $$;

-- Contar registros
SELECT 
  'app_versions' as tabela,
  COUNT(*) as registros
FROM app_versions
UNION ALL
SELECT 
  'user_version_updates' as tabela,
  COUNT(*) as registros
FROM user_version_updates;
