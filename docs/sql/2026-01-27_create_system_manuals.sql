-- =====================================================
-- Migração: Tabela de Manuais do Sistema
-- Data: 2026-01-27
-- Descrição: Cria a tabela system_manuals para o novo módulo Sistema
-- =====================================================

BEGIN;

-- 1. Cria a tabela system_manuals
CREATE TABLE IF NOT EXISTS public.system_manuals (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    module_id uuid REFERENCES public.modules(id) ON DELETE CASCADE,
    content text,
    image_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    UNIQUE(module_id)
);

-- 2. Habilita RLS
ALTER TABLE public.system_manuals ENABLE ROW LEVEL SECURITY;

-- 3. Políticas RLS
-- Qualquer usuário autenticado pode ler os manuais
CREATE POLICY "Qualquer usuário autenticado pode ler manuais" 
ON public.system_manuals FOR SELECT 
TO authenticated 
USING (true);

-- Apenas super_admin pode inserir/atualizar/deletar
CREATE POLICY "Apenas super_admin pode gerenciar manuais" 
ON public.system_manuals FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'super_admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'super_admin'
    )
);

-- 4. Trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_system_manuals_updated_at
    BEFORE UPDATE ON public.system_manuals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 5. Comentários
COMMENT ON TABLE public.system_manuals IS 'Manuais e passo-a-passo para cada módulo do sistema';
COMMENT ON COLUMN public.system_manuals.module_id IS 'Referência ao módulo proprietário do manual';
COMMENT ON COLUMN public.system_manuals.content IS 'Conteúdo do manual (suporta Markdown)';
COMMENT ON COLUMN public.system_manuals.image_url IS 'URL da imagem ilustrativa para o manual';

COMMIT;
