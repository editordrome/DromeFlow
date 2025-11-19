-- =====================================================
-- Script: Habilitar Realtime para sincronização de permissões
-- Data: 2025-11-18
-- Descrição: Habilita Realtime nas tabelas profiles, user_units e user_modules
--            para permitir atualização automática de permissões quando
--            um super_admin altera o role de um usuário logado.
-- =====================================================

-- Habilitar publicação Realtime na tabela profiles
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;

-- Habilitar publicação Realtime na tabela user_units
ALTER PUBLICATION supabase_realtime ADD TABLE user_units;

-- Habilitar publicação Realtime na tabela user_modules
ALTER PUBLICATION supabase_realtime ADD TABLE user_modules;

-- =====================================================
-- Verificar quais tabelas estão habilitadas para Realtime
-- =====================================================

SELECT 
  schemaname,
  tablename
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
ORDER BY schemaname, tablename;

-- =====================================================
-- COMENTÁRIOS
-- =====================================================

COMMENT ON PUBLICATION supabase_realtime IS 
'Publicação Realtime do Supabase. Tabelas adicionadas: profiles, user_units, user_modules para sincronização automática de permissões.';

-- =====================================================
-- OBSERVAÇÕES DE SEGURANÇA
-- =====================================================

-- 1. As RLS policies já existentes em profiles, user_units e user_modules
--    garantem que cada usuário só receberá notificações de mudanças
--    em seus próprios registros.
--
-- 2. Subscription pattern no AuthContext:
--    - profiles: filter=`id=eq.${profile.id}` (apenas próprio perfil)
--    - user_units: filter=`user_id=eq.${profile.id}` (apenas próprias unidades)
--    - user_modules: filter=`user_id=eq.${profile.id}` (apenas próprios módulos)
--
-- 3. Eventos monitorados:
--    - profiles: UPDATE (mudança de role)
--    - user_units: INSERT, UPDATE, DELETE (adição/remoção de unidades)
--    - user_modules: INSERT, UPDATE, DELETE (adição/remoção de módulos)
