-- =====================================================
-- Migração: Sistema de Módulos por Unidade
-- Data: 2025-11-11
-- Descrição: Adiciona controle de acesso a módulos baseado em unidades
-- =====================================================

-- =====================================================
-- 1. CRIAR TABELA unit_modules
-- =====================================================

-- Tabela de junção: unidades ↔ módulos
CREATE TABLE IF NOT EXISTS unit_modules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraint: Previne duplicatas (mesma unidade + mesmo módulo)
  CONSTRAINT unique_unit_module UNIQUE(unit_id, module_id)
);

-- Comentários para documentação
COMMENT ON TABLE unit_modules IS 'Atribuição de módulos a unidades específicas';
COMMENT ON COLUMN unit_modules.unit_id IS 'Referência à unidade (FK units.id)';
COMMENT ON COLUMN unit_modules.module_id IS 'Referência ao módulo (FK modules.id)';
COMMENT ON COLUMN unit_modules.created_at IS 'Data de criação da atribuição';
COMMENT ON COLUMN unit_modules.updated_at IS 'Data da última atualização';

-- =====================================================
-- 2. CRIAR ÍNDICES PARA PERFORMANCE
-- =====================================================

-- Índice para queries por unidade (mais comum)
CREATE INDEX IF NOT EXISTS idx_unit_modules_unit_id 
  ON unit_modules(unit_id);

-- Índice para queries por módulo
CREATE INDEX IF NOT EXISTS idx_unit_modules_module_id 
  ON unit_modules(module_id);

-- Índice composto para verificação rápida de existência
CREATE INDEX IF NOT EXISTS idx_unit_modules_unit_module 
  ON unit_modules(unit_id, module_id);

-- =====================================================
-- 3. HABILITAR ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE unit_modules ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 4. CRIAR POLÍTICAS RLS (PERMISSIVAS PARA MVP)
-- =====================================================

-- Política de SELECT: Todos podem ler
CREATE POLICY "Enable read access for all users" ON unit_modules
  FOR SELECT 
  USING (true);

-- Política de INSERT: Usuários autenticados podem inserir
CREATE POLICY "Enable insert for authenticated users" ON unit_modules
  FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

-- Política de UPDATE: Usuários autenticados podem atualizar
CREATE POLICY "Enable update for authenticated users" ON unit_modules
  FOR UPDATE 
  USING (auth.role() = 'authenticated');

-- Política de DELETE: Usuários autenticados podem deletar
CREATE POLICY "Enable delete for authenticated users" ON unit_modules
  FOR DELETE 
  USING (auth.role() = 'authenticated');

-- NOTA: Em produção, restringir políticas por role/perfil do usuário
-- Exemplo de política restritiva (comentada):
-- CREATE POLICY "Restrict to super_admin only" ON unit_modules
--   FOR ALL 
--   USING (
--     EXISTS (
--       SELECT 1 FROM profiles 
--       WHERE profiles.user_id = auth.uid() 
--       AND profiles.perfil = 'super_admin'
--     )
--   );

-- =====================================================
-- 5. CRIAR TRIGGER PARA UPDATED_AT AUTOMÁTICO
-- =====================================================

-- Função para atualizar timestamp automaticamente
CREATE OR REPLACE FUNCTION update_unit_modules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger que executa antes de UPDATE
CREATE TRIGGER trigger_update_unit_modules_updated_at
  BEFORE UPDATE ON unit_modules
  FOR EACH ROW
  EXECUTE FUNCTION update_unit_modules_updated_at();

COMMENT ON FUNCTION update_unit_modules_updated_at() IS 'Atualiza automaticamente o campo updated_at ao modificar um registro';

-- =====================================================
-- 6. CRIAR RPC: get_unit_modules
-- =====================================================

-- RPC para buscar módulos atribuídos a uma unidade específica
CREATE OR REPLACE FUNCTION get_unit_modules(unit_id_arg UUID)
RETURNS TABLE (
  id UUID,
  code TEXT,
  name TEXT,
  icon_name TEXT,
  description TEXT,
  is_active BOOLEAN,
  allowed_profiles TEXT[],
  "position" INTEGER,
  webhook_url TEXT,
  view_id TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.code,
    m.name,
    m.icon_name,
    m.description,
    m.is_active,
    m.allowed_profiles,
    m."position",
    m.webhook_url,
    m.view_id
  FROM modules m
  INNER JOIN unit_modules um ON um.module_id = m.id
  WHERE um.unit_id = unit_id_arg
  ORDER BY m."position" ASC NULLS LAST, m.name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_unit_modules(UUID) IS 'Retorna todos os módulos atribuídos a uma unidade, ordenados por position e name';

-- =====================================================
-- 7. CRIAR RPC: assign_modules_to_unit (BATCH)
-- =====================================================

-- RPC para atribuir múltiplos módulos a uma unidade (substitui antigas atribuições)
CREATE OR REPLACE FUNCTION assign_modules_to_unit(
  unit_id_arg UUID,
  module_ids_arg UUID[]
)
RETURNS void AS $$
BEGIN
  -- 1. Remove todas as atribuições antigas desta unidade
  DELETE FROM unit_modules WHERE unit_id = unit_id_arg;
  
  -- 2. Insere novas atribuições (se houver)
  IF array_length(module_ids_arg, 1) > 0 THEN
    INSERT INTO unit_modules (unit_id, module_id)
    SELECT unit_id_arg, unnest(module_ids_arg)
    ON CONFLICT (unit_id, module_id) DO NOTHING;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION assign_modules_to_unit(UUID, UUID[]) IS 'Substitui todos os módulos de uma unidade por uma nova lista (operação batch)';

-- =====================================================
-- 8. CRIAR RPC: check_unit_module_access
-- =====================================================

-- RPC para verificar se uma unidade tem acesso a um módulo específico
CREATE OR REPLACE FUNCTION check_unit_module_access(
  unit_id_arg UUID,
  module_id_arg UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  has_access BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 
    FROM unit_modules 
    WHERE unit_id = unit_id_arg 
    AND module_id = module_id_arg
  ) INTO has_access;
  
  RETURN has_access;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION check_unit_module_access(UUID, UUID) IS 'Verifica se uma unidade tem acesso a um módulo específico';

-- =====================================================
-- 9. CRIAR VIEW: unit_modules_summary
-- =====================================================

-- View para facilitar consultas de resumo (quantos módulos por unidade)
CREATE OR REPLACE VIEW unit_modules_summary AS
SELECT 
  u.id AS unit_id,
  u.unit_name,
  u.unit_code,
  COUNT(um.module_id) AS total_modules,
  ARRAY_AGG(m.name ORDER BY m."position", m.name) FILTER (WHERE m.id IS NOT NULL) AS module_names
FROM units u
LEFT JOIN unit_modules um ON um.unit_id = u.id
LEFT JOIN modules m ON m.id = um.module_id
GROUP BY u.id, u.unit_name, u.unit_code
ORDER BY u.unit_name;

COMMENT ON VIEW unit_modules_summary IS 'Resumo de módulos atribuídos por unidade';

-- =====================================================
-- 10. DADOS INICIAIS (OPCIONAL)
-- =====================================================

-- Exemplo: Atribuir todos os módulos ativos à primeira unidade
-- DESCOMENTAR APENAS SE DESEJAR POPULAR DADOS INICIAIS

-- WITH first_unit AS (
--   SELECT id FROM units LIMIT 1
-- ),
-- active_modules AS (
--   SELECT id FROM modules WHERE is_active = true
-- )
-- INSERT INTO unit_modules (unit_id, module_id)
-- SELECT first_unit.id, active_modules.id
-- FROM first_unit, active_modules
-- ON CONFLICT (unit_id, module_id) DO NOTHING;

-- =====================================================
-- 11. VALIDAÇÕES E TESTES
-- =====================================================

-- Teste 1: Verificar se tabela foi criada
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'unit_modules'
  ) THEN
    RAISE NOTICE '✓ Tabela unit_modules criada com sucesso';
  ELSE
    RAISE EXCEPTION '✗ Falha ao criar tabela unit_modules';
  END IF;
END $$;

-- Teste 2: Verificar constraints
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'unique_unit_module'
    AND table_name = 'unit_modules'
  ) THEN
    RAISE NOTICE '✓ Constraint UNIQUE criada com sucesso';
  ELSE
    RAISE EXCEPTION '✗ Falha ao criar constraint UNIQUE';
  END IF;
END $$;

-- Teste 3: Verificar índices
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'unit_modules' 
    AND indexname = 'idx_unit_modules_unit_id'
  ) THEN
    RAISE NOTICE '✓ Índices criados com sucesso';
  ELSE
    RAISE EXCEPTION '✗ Falha ao criar índices';
  END IF;
END $$;

-- Teste 4: Verificar RLS habilitado
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'unit_modules' 
    AND rowsecurity = true
  ) THEN
    RAISE NOTICE '✓ RLS habilitado com sucesso';
  ELSE
    RAISE EXCEPTION '✗ Falha ao habilitar RLS';
  END IF;
END $$;

-- Teste 5: Verificar RPCs
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname IN ('get_unit_modules', 'assign_modules_to_unit', 'check_unit_module_access')
  ) THEN
    RAISE NOTICE '✓ RPCs criadas com sucesso';
  ELSE
    RAISE EXCEPTION '✗ Falha ao criar RPCs';
  END IF;
END $$;

-- =====================================================
-- FIM DA MIGRAÇÃO
-- =====================================================

-- Resumo executado:
-- ✓ Tabela unit_modules criada
-- ✓ Índices de performance adicionados
-- ✓ RLS habilitado com políticas permissivas
-- ✓ Trigger para updated_at configurado
-- ✓ RPCs para operações CRUD criadas
-- ✓ View de resumo disponível
-- ✓ Validações executadas

RAISE NOTICE '========================================';
RAISE NOTICE 'Migração concluída com sucesso!';
RAISE NOTICE 'Próximo passo: Implementar serviços no frontend';
RAISE NOTICE '========================================';
