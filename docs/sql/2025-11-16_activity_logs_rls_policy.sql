-- =====================================================
-- RLS Policy para activity_logs
-- Data: 2025-11-16
-- Descrição: Permite INSERT para usuários autenticados
-- =====================================================

-- Habilitar RLS na tabela (se ainda não estiver)
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Política de INSERT: Qualquer usuário autenticado pode inserir
CREATE POLICY "Allow authenticated users to insert activity logs"
ON activity_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Política de SELECT: Apenas super_admin pode visualizar
-- (Opcionalmente, pode permitir que usuários vejam apenas seus próprios logs)
CREATE POLICY "Allow authenticated users to view activity logs"
ON activity_logs
FOR SELECT
TO authenticated
USING (true);

-- Se quiser restringir SELECT apenas para super_admin, use:
-- DROP POLICY IF EXISTS "Allow authenticated users to view activity logs" ON activity_logs;
-- CREATE POLICY "Allow super_admin to view activity logs"
-- ON activity_logs
-- FOR SELECT
-- TO authenticated
-- USING (
--   auth.jwt() ->> 'role' = 'super_admin'
-- );

-- Comentários:
-- 1. INSERT é permitido para todos os usuários autenticados (WITH CHECK true)
-- 2. SELECT permite visualização para todos (ajuste conforme necessidade de segurança)
-- 3. Não há políticas de UPDATE/DELETE, então apenas INSERT e SELECT são permitidos
-- 4. Para produção, considere adicionar validações mais específicas no WITH CHECK
