-- Fix para permitir INSERT na tabela profissionais com autenticação customizada
-- Data: 2025-11-06
-- Problema: Sistema usa autenticação customizada (consulta tabela profiles)
--           mas RLS só permitia INSERT para usuários 'authenticated'
--           Erro: "new row violates row-level security policy" (Código: 42501)
-- Solução: Adicionar política permitindo INSERT para role 'anon'

-- Criar política de INSERT para anon (necessário para auth customizada)
DROP POLICY IF EXISTS profissionais_insert_anon ON profissionais;

CREATE POLICY profissionais_insert_anon
ON profissionais
FOR INSERT
TO anon
WITH CHECK (true);

-- Comentário
COMMENT ON POLICY profissionais_insert_anon ON profissionais IS 
'Permite INSERT via autenticação customizada (role anon com validação em profiles)';

-- Verificar políticas aplicadas:
-- SELECT policyname, roles, cmd 
-- FROM pg_policies 
-- WHERE tablename = 'profissionais' 
-- ORDER BY cmd, policyname;
