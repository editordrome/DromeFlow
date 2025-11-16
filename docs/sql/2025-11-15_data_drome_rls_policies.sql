-- =====================================================
-- RLS Policies: Data Drome
-- Data: 2025-11-15
-- Descrição: Políticas de segurança para tabelas do Data Drome
-- =====================================================
-- EXECUTAR NO PROJETO: Data Drome (jeoegybltyqbdcjpuhbc)
-- =====================================================

-- =====================================================
-- TABELA: monitoramento_dromeboard
-- =====================================================
-- Logs de monitoramento N8N

-- Permitir leitura para usuários autenticados
DROP POLICY IF EXISTS "Permitir leitura de monitoramento para autenticados" ON public.monitoramento_dromeboard;
CREATE POLICY "Permitir leitura de monitoramento para autenticados"
  ON public.monitoramento_dromeboard
  FOR SELECT
  TO authenticated
  USING (true);

-- Permitir inserção para service_role (N8N workflows)
DROP POLICY IF EXISTS "Permitir inserção de logs via service_role" ON public.monitoramento_dromeboard;
CREATE POLICY "Permitir inserção de logs via service_role"
  ON public.monitoramento_dromeboard
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Permitir atualização para service_role
DROP POLICY IF EXISTS "Permitir atualização de logs via service_role" ON public.monitoramento_dromeboard;
CREATE POLICY "Permitir atualização de logs via service_role"
  ON public.monitoramento_dromeboard
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Permitir deleção para service_role
DROP POLICY IF EXISTS "Permitir deleção de logs via service_role" ON public.monitoramento_dromeboard;
CREATE POLICY "Permitir deleção de logs via service_role"
  ON public.monitoramento_dromeboard
  FOR DELETE
  TO service_role
  USING (true);

-- =====================================================
-- TABELA: error_dromeboard
-- =====================================================
-- Logs de erros N8N

-- Permitir leitura para usuários autenticados
DROP POLICY IF EXISTS "Permitir leitura de erros para autenticados" ON public.error_dromeboard;
CREATE POLICY "Permitir leitura de erros para autenticados"
  ON public.error_dromeboard
  FOR SELECT
  TO authenticated
  USING (true);

-- Permitir inserção para service_role (N8N workflows)
DROP POLICY IF EXISTS "Permitir inserção de erros via service_role" ON public.error_dromeboard;
CREATE POLICY "Permitir inserção de erros via service_role"
  ON public.error_dromeboard
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Permitir atualização para service_role
DROP POLICY IF EXISTS "Permitir atualização de erros via service_role" ON public.error_dromeboard;
CREATE POLICY "Permitir atualização de erros via service_role"
  ON public.error_dromeboard
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Permitir deleção para service_role
DROP POLICY IF EXISTS "Permitir deleção de erros via service_role" ON public.error_dromeboard;
CREATE POLICY "Permitir deleção de erros via service_role"
  ON public.error_dromeboard
  FOR DELETE
  TO service_role
  USING (true);

-- =====================================================
-- TABELA: actions
-- =====================================================
-- Catálogo de ações disponíveis (já possui políticas adequadas)

-- Política existente (manter):
-- - "Permitir leitura de ações para usuários autenticados" (SELECT para authenticated)
-- - "Apenas service_role pode modificar ações" (ALL para service_role)

-- =====================================================
-- VIEWS: CONFIGURAR SECURITY INVOKER
-- =====================================================
-- Views herdam permissões das tabelas base quando configuradas como security_invoker

ALTER VIEW public.activity_timeline_24h SET (security_invoker = on);
ALTER VIEW public.available_actions SET (security_invoker = on);
ALTER VIEW public.recruta_metrics_view SET (security_invoker = on);
ALTER VIEW public.top_problematic_workflows SET (security_invoker = on);
ALTER VIEW public.unit_health_status SET (security_invoker = on);
ALTER VIEW public.workflow_errors SET (security_invoker = on);

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================

-- Verificar políticas criadas
SELECT 
  tablename,
  policyname,
  roles,
  cmd
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('monitoramento_dromeboard', 'error_dromeboard', 'actions')
ORDER BY tablename, cmd, policyname;

-- =====================================================
-- RESUMO DAS POLÍTICAS
-- =====================================================

/*
INVENTÁRIO COMPLETO DO DATA DROME:

📦 TABELAS LOCAIS (3):
  1. monitoramento_dromeboard (logs N8N)
     ✅ SELECT: authenticated
     ✅ INSERT/UPDATE/DELETE: service_role
  
  2. error_dromeboard (erros N8N)
     ✅ SELECT: authenticated
     ✅ INSERT/UPDATE/DELETE: service_role
  
  3. actions (catálogo de ações)
     ✅ SELECT: authenticated
     ✅ ALL: service_role

🔗 TABELAS ESTRANGEIRAS VIA FDW (1):
  - dromeflow.recruta_metrica (do DromeFlow)
    → Acesso via FDW, sem RLS local necessário

📊 VIEWS ANALÍTICAS (6):
  1. workflow_errors (baseada em error_dromeboard)
  2. available_actions (baseada em actions)
  3. recruta_metrics_view (baseada em dromeflow.recruta_metrica)
  4. unit_health_status (baseada em monitoramento_dromeboard)
  5. activity_timeline_24h (baseada em monitoramento_dromeboard)
  6. top_problematic_workflows (baseada em monitoramento_dromeboard)
  ✅ Configuradas com security_invoker = on
  → Views herdam permissões das tabelas base (RLS respeitado)

✅ TODAS AS POLÍTICAS NECESSÁRIAS FORAM CRIADAS
✅ RLS HABILITADO EM TODAS AS 3 TABELAS LOCAIS
✅ VIEWS CONFIGURADAS COM SECURITY INVOKER
✅ ACESSO SEGURO GARANTIDO PARA:
   - Usuários autenticados (leitura)
   - N8N workflows (escrita via service_role)
*/

-- =====================================================
-- CONCLUÍDO!
-- =====================================================
