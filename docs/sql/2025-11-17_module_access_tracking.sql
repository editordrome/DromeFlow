-- =====================================================
-- Arquivo: Module Access Tracking
-- Data: 2025-11-17
-- Descrição: Implementa rastreamento automático de acesso a módulos
--            conectando actions com modules para sincronização automática
-- =====================================================

-- =====================================================
-- 1. Criar ação base para acesso a módulos
-- =====================================================

INSERT INTO actions (action_code, action_name, description)
VALUES ('module_access', 'Acessar Módulo', 'Acesso a um módulo do sistema')
ON CONFLICT (action_code) DO NOTHING;

-- =====================================================
-- 2. Criar ações para cada módulo existente
-- =====================================================

-- Função para sincronizar módulos com actions
CREATE OR REPLACE FUNCTION sync_modules_to_actions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insere action para cada módulo que ainda não tem
  INSERT INTO actions (action_code, action_name, description)
  SELECT 
    'access_module_' || LOWER(REPLACE(REPLACE(m.code, '-', '_'), ' ', '_')) as action_code,
    'Acessar: ' || m.name as action_name,
    'Acesso ao módulo ' || m.name as description
  FROM modules m
  WHERE NOT EXISTS (
    SELECT 1 
    FROM actions a 
    WHERE a.action_code = 'access_module_' || LOWER(REPLACE(REPLACE(m.code, '-', '_'), ' ', '_'))
  );
  
  RAISE NOTICE 'Módulos sincronizados com actions';
END;
$$;

-- Executar sincronização inicial
SELECT sync_modules_to_actions();

-- =====================================================
-- 3. Criar trigger para sincronização automática
-- =====================================================

-- Função do trigger
CREATE OR REPLACE FUNCTION auto_create_module_action()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_action_code TEXT;
BEGIN
  -- Gera o action_code baseado no code do módulo
  v_action_code := 'access_module_' || LOWER(REPLACE(REPLACE(NEW.code, '-', '_'), ' ', '_'));
  
  -- Insere a action correspondente
  INSERT INTO actions (action_code, action_name, description)
  VALUES (
    v_action_code,
    'Acessar: ' || NEW.name,
    'Acesso ao módulo ' || NEW.name
  )
  ON CONFLICT (action_code) DO UPDATE
  SET 
    action_name = 'Acessar: ' || NEW.name,
    description = 'Acesso ao módulo ' || NEW.name;
  
  RAISE NOTICE 'Action criada/atualizada para módulo: %', NEW.name;
  
  RETURN NEW;
END;
$$;

-- Trigger para INSERT de novos módulos
DROP TRIGGER IF EXISTS trigger_auto_create_module_action ON modules;
CREATE TRIGGER trigger_auto_create_module_action
  AFTER INSERT OR UPDATE OF name, code ON modules
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_module_action();

-- =====================================================
-- 4. Verificar resultado
-- =====================================================

SELECT 
  action_code,
  action_name,
  description
FROM actions
WHERE action_code LIKE 'access_module_%'
ORDER BY action_name;

COMMENT ON FUNCTION sync_modules_to_actions() IS 
'Sincroniza todos os módulos existentes criando actions correspondentes';

COMMENT ON FUNCTION auto_create_module_action() IS 
'Trigger function que cria/atualiza automaticamente uma action quando um módulo é criado ou renomeado';

COMMENT ON TRIGGER trigger_auto_create_module_action ON modules IS 
'Trigger que mantém sincronização automática entre módulos e actions';
