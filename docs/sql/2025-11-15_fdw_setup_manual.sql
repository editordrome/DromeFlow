-- =====================================================
-- MANUAL FDW SETUP - Execute este script manualmente
-- =====================================================
-- Este script deve ser executado no SQL Editor do Supabase
-- após obter a senha do banco Data Drome
-- =====================================================

-- PASSO 1: Obter a senha
-- 1. Acesse: https://supabase.com/dashboard/project/jeoegybltyqbdcjpuhbc/settings/database
-- 2. Copie o campo "Database Password"
-- 3. Cole abaixo substituindo COLE_SENHA_AQUI

-- =====================================================
-- EXECUTAR NO DROMEFLOW (uframhbsgtxckdxttofo)
-- =====================================================

-- Extensão já habilitada ✓
-- Schema data_drome já criado ✓

-- Criar servidor remoto
DROP SERVER IF EXISTS data_drome_server CASCADE;

CREATE SERVER data_drome_server
  FOREIGN DATA WRAPPER postgres_fdw
  OPTIONS (
    host 'db.jeoegybltyqbdcjpuhbc.supabase.co',
    dbname 'postgres',
    port '6543',
    fetch_size '10000'
  );

-- Criar user mapping (SUBSTITUA A SENHA!)
CREATE USER MAPPING FOR CURRENT_USER
  SERVER data_drome_server
  OPTIONS (
    user 'postgres',
    password 'DRom@29011725'  -- ← COLE A SENHA DO DATA DROME AQUI
  );

-- Importar tabelas
IMPORT FOREIGN SCHEMA public
  LIMIT TO (
    monitoramento_dromeboard,
    error_dromeboard,
    actions
  )
  FROM SERVER data_drome_server
  INTO data_drome;

-- Testar conexão
SELECT COUNT(*) as total_logs FROM data_drome.monitoramento_dromeboard;

-- Se funcionou, você verá o número de logs!
-- Caso contrário, verifique a senha e tente novamente.
