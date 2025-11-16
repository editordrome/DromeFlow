-- =====================================================
-- Tabela: file_metadata
-- Data: 2025-11-15
-- Descrição: Metadados de arquivos armazenados no Cloudflare R2
-- =====================================================
-- EXECUTAR NO PROJETO: DromeFlow (uframhbsgtxckdxttofo)
-- =====================================================

-- =====================================================
-- 1. CRIAR TABELA
-- =====================================================

CREATE TABLE IF NOT EXISTS public.file_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  storage_key TEXT NOT NULL UNIQUE, -- Caminho completo no R2
  storage_provider TEXT DEFAULT 'r2' CHECK (storage_provider IN ('r2', 'supabase', 'b2')),
  file_type TEXT NOT NULL, -- 'xlsx', 'pdf', 'csv', 'image', 'backup'
  mime_type TEXT, -- 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  file_size BIGINT NOT NULL, -- Bytes
  checksum TEXT, -- MD5 ou SHA256 para validação
  
  -- Metadados de processamento
  is_processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  processing_error TEXT,
  
  -- Metadados customizados (JSON flexível)
  metadata JSONB DEFAULT '{}', -- Ex: { "atendimentos_count": 150, "period": "2025-11", "original_rows": 200 }
  
  -- Acesso e segurança
  is_public BOOLEAN DEFAULT false,
  public_url TEXT, -- URL pública se is_public = true
  expires_at TIMESTAMPTZ, -- Auto-delete após esta data (opcional)
  
  -- Audit
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ -- Soft delete
);

-- =====================================================
-- 2. COMENTÁRIOS
-- =====================================================

COMMENT ON TABLE public.file_metadata IS 'Metadados de arquivos armazenados no Cloudflare R2 ou outros provedores';
COMMENT ON COLUMN public.file_metadata.storage_key IS 'Caminho completo no bucket R2: uploads/unit-id/timestamp_filename.xlsx';
COMMENT ON COLUMN public.file_metadata.metadata IS 'JSON flexível para dados específicos do tipo de arquivo';
COMMENT ON COLUMN public.file_metadata.is_processed IS 'Indica se o arquivo foi processado (ex: XLSX importado para processed_data)';
COMMENT ON COLUMN public.file_metadata.expires_at IS 'Data de expiração para limpeza automática de arquivos temporários';

-- =====================================================
-- 3. ÍNDICES
-- =====================================================

CREATE INDEX idx_file_metadata_unit_id ON public.file_metadata(unit_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_file_metadata_type ON public.file_metadata(file_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_file_metadata_provider ON public.file_metadata(storage_provider);
CREATE INDEX idx_file_metadata_processed ON public.file_metadata(is_processed) WHERE is_processed = false;
CREATE INDEX idx_file_metadata_created ON public.file_metadata(created_at DESC);
CREATE INDEX idx_file_metadata_expires ON public.file_metadata(expires_at) WHERE expires_at IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_file_metadata_uploaded_by ON public.file_metadata(uploaded_by);

-- GIN index para busca em metadata JSONB
CREATE INDEX idx_file_metadata_metadata_gin ON public.file_metadata USING gin(metadata);

-- =====================================================
-- 4. TRIGGER DE UPDATED_AT
-- =====================================================

CREATE OR REPLACE FUNCTION update_file_metadata_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_file_metadata_updated_at
  BEFORE UPDATE ON public.file_metadata
  FOR EACH ROW
  EXECUTE FUNCTION update_file_metadata_timestamp();

-- =====================================================
-- 5. POLÍTICAS RLS
-- =====================================================

ALTER TABLE public.file_metadata ENABLE ROW LEVEL SECURITY;

-- Usuários autenticados podem ler arquivos de suas unidades
DROP POLICY IF EXISTS "Usuários podem ver arquivos de suas unidades" ON public.file_metadata;
CREATE POLICY "Usuários podem ver arquivos de suas unidades"
  ON public.file_metadata
  FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      -- Super admin vê tudo
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'super_admin'
      )
      OR
      -- Usuários veem arquivos de suas unidades
      EXISTS (
        SELECT 1 FROM user_units
        WHERE user_units.user_id = auth.uid()
        AND user_units.unit_id = file_metadata.unit_id
      )
    )
  );

-- Usuários autenticados podem fazer upload
DROP POLICY IF EXISTS "Usuários podem fazer upload para suas unidades" ON public.file_metadata;
CREATE POLICY "Usuários podem fazer upload para suas unidades"
  ON public.file_metadata
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_units
      WHERE user_units.user_id = auth.uid()
      AND user_units.unit_id = file_metadata.unit_id
    )
  );

-- Usuários podem atualizar metadata de arquivos que enviaram
DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios uploads" ON public.file_metadata;
CREATE POLICY "Usuários podem atualizar seus próprios uploads"
  ON public.file_metadata
  FOR UPDATE
  TO authenticated
  USING (uploaded_by = auth.uid())
  WITH CHECK (uploaded_by = auth.uid());

-- Soft delete: usuários podem deletar seus próprios arquivos
DROP POLICY IF EXISTS "Usuários podem deletar seus próprios uploads" ON public.file_metadata;
CREATE POLICY "Usuários podem deletar seus próprios uploads"
  ON public.file_metadata
  FOR UPDATE
  TO authenticated
  USING (uploaded_by = auth.uid() AND deleted_at IS NULL)
  WITH CHECK (deleted_at IS NOT NULL); -- Apenas permite soft delete

-- Service role tem acesso total
DROP POLICY IF EXISTS "Service role acesso total" ON public.file_metadata;
CREATE POLICY "Service role acesso total"
  ON public.file_metadata
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- 6. FUNÇÕES UTILITÁRIAS
-- =====================================================

-- Função: Soft delete de arquivo
CREATE OR REPLACE FUNCTION soft_delete_file(p_file_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.file_metadata
  SET deleted_at = NOW()
  WHERE id = p_file_id
    AND deleted_at IS NULL
    AND uploaded_by = auth.uid();
  
  RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION soft_delete_file IS 'Marca arquivo como deletado (soft delete)';

-- Função: Limpar arquivos expirados
CREATE OR REPLACE FUNCTION cleanup_expired_files()
RETURNS TABLE (
  deleted_count BIGINT,
  total_size BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count BIGINT;
  v_total_size BIGINT;
BEGIN
  -- Marcar como deletados
  WITH deleted AS (
    UPDATE public.file_metadata
    SET deleted_at = NOW()
    WHERE expires_at < NOW()
      AND deleted_at IS NULL
    RETURNING id, file_size
  )
  SELECT 
    COUNT(*),
    COALESCE(SUM(file_size), 0)
  INTO v_deleted_count, v_total_size
  FROM deleted;
  
  RETURN QUERY SELECT v_deleted_count, v_total_size;
END;
$$;

COMMENT ON FUNCTION cleanup_expired_files IS 'Remove automaticamente arquivos expirados (soft delete)';

-- Função: Estatísticas de storage por unidade
CREATE OR REPLACE FUNCTION get_unit_storage_stats(p_unit_id UUID)
RETURNS TABLE (
  total_files BIGINT,
  total_size BIGINT,
  total_size_mb NUMERIC,
  by_type JSONB
)
LANGUAGE SQL
STABLE
AS $$
  SELECT 
    COUNT(*) as total_files,
    COALESCE(SUM(file_size), 0) as total_size,
    ROUND(COALESCE(SUM(file_size), 0) / 1048576.0, 2) as total_size_mb,
    jsonb_object_agg(
      file_type,
      jsonb_build_object(
        'count', count,
        'size_mb', size_mb
      )
    ) as by_type
  FROM (
    SELECT 
      file_type,
      COUNT(*) as count,
      ROUND(SUM(file_size) / 1048576.0, 2) as size_mb
    FROM public.file_metadata
    WHERE unit_id = p_unit_id
      AND deleted_at IS NULL
    GROUP BY file_type
  ) stats;
$$;

COMMENT ON FUNCTION get_unit_storage_stats IS 'Retorna estatísticas de storage de uma unidade';

-- =====================================================
-- 7. VIEW: Arquivos recentes
-- =====================================================

CREATE OR REPLACE VIEW public.recent_files AS
SELECT 
  fm.id,
  fm.filename,
  fm.file_type,
  fm.file_size,
  ROUND(fm.file_size / 1048576.0, 2) as size_mb,
  fm.is_processed,
  fm.created_at,
  fm.unit_id,
  u.unit_name,
  p.name as uploaded_by_name,
  fm.metadata
FROM public.file_metadata fm
LEFT JOIN units u ON u.id = fm.unit_id
LEFT JOIN profiles p ON p.id = fm.uploaded_by
WHERE fm.deleted_at IS NULL
ORDER BY fm.created_at DESC
LIMIT 50;

COMMENT ON VIEW public.recent_files IS 'Últimos 50 arquivos enviados (não deletados)';

-- =====================================================
-- 8. DADOS DE TESTE (OPCIONAL)
-- =====================================================

-- Descomentar para inserir dados de teste
/*
INSERT INTO public.file_metadata (
  unit_id,
  filename,
  storage_key,
  storage_provider,
  file_type,
  mime_type,
  file_size,
  is_processed,
  metadata,
  uploaded_by
) VALUES (
  (SELECT id FROM units LIMIT 1),
  'atendimentos_2025-11.xlsx',
  'uploads/test-unit/1731715200_atendimentos_2025-11.xlsx',
  'r2',
  'xlsx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  245760,
  true,
  '{"atendimentos_count": 150, "period": "2025-11", "original_rows": 155}'::jsonb,
  (SELECT id FROM profiles LIMIT 1)
);
*/

-- =====================================================
-- 9. VERIFICAÇÃO
-- =====================================================

-- Verificar tabela criada
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'file_metadata') as column_count
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'file_metadata';

-- Verificar índices
SELECT 
  indexname,
  indexdef
FROM pg_indexes 
WHERE tablename = 'file_metadata'
ORDER BY indexname;

-- Verificar políticas RLS
SELECT 
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename = 'file_metadata'
ORDER BY policyname;

-- =====================================================
-- CONCLUÍDO!
-- =====================================================
-- Tabela file_metadata criada com:
-- ✅ 20+ colunas otimizadas
-- ✅ 8 índices (incluindo GIN para JSONB)
-- ✅ Trigger de updated_at
-- ✅ 5 políticas RLS
-- ✅ 3 funções utilitárias
-- ✅ 1 view de arquivos recentes
-- =====================================================
