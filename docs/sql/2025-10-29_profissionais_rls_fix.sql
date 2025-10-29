-- Fix para permitir UPDATE na tabela profissionais com autenticação customizada
-- Data: 2025-10-29
-- Problema: Sistema usa autenticação customizada (consulta tabela profiles)
--           mas RLS só permitia UPDATE para usuários 'authenticated'
-- Solução: Adicionar política permitindo UPDATE para role 'anon'

-- Criar política de UPDATE para anon (necessário para auth customizada)
CREATE POLICY profissionais_update_anon
ON profissionais
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- Verificar políticas aplicadas:
-- SELECT policyname, roles, cmd 
-- FROM pg_policies 
-- WHERE tablename = 'profissionais' AND cmd = 'UPDATE';
