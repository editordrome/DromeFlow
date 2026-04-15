-- Migração para o Módulo de Produção (Super Admin)

-- 1. Colunas do Kanban
CREATE TABLE IF NOT EXISTS public.production_columns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    is_fixed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Itens de Template por Coluna (Plataformas)
CREATE TABLE IF NOT EXISTS public.production_column_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    column_id UUID NOT NULL REFERENCES public.production_columns(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Cards de Produção (Unidades)
CREATE TABLE IF NOT EXISTS public.production_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
    current_column_id UUID NOT NULL REFERENCES public.production_columns(id),
    position INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(unit_id) -- Cada unidade só pode ter um card de produção ativo
);

-- 4. Progresso dos Checkpoints por Card
CREATE TABLE IF NOT EXISTS public.production_card_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id UUID NOT NULL REFERENCES public.production_cards(id) ON DELETE CASCADE,
    template_item_id UUID NOT NULL REFERENCES public.production_column_templates(id) ON DELETE CASCADE,
    column_id UUID NOT NULL REFERENCES public.production_columns(id) ON DELETE CASCADE,
    is_completed BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(card_id, template_item_id)
);

-- Inserir a coluna fixa Inicial
INSERT INTO public.production_columns (name, position, is_fixed) 
VALUES ('Inicial', 0, true)
ON CONFLICT DO NOTHING;

-- Habilitar RLS
ALTER TABLE public.production_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_column_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_card_progress ENABLE ROW LEVEL SECURITY;

-- Políticas de Acesso (Apenas Super Admin)
CREATE POLICY "Super Admin Full Access Production Columns" ON public.production_columns
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'));

CREATE POLICY "Super Admin Full Access Production Templates" ON public.production_column_templates
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'));

CREATE POLICY "Super Admin Full Access Production Cards" ON public.production_cards
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'));

CREATE POLICY "Super Admin Full Access Production Progress" ON public.production_card_progress
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'));

-- Trigger para updated_at em production_cards
CREATE OR REPLACE FUNCTION public.handle_production_card_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_production_card_updated
    BEFORE UPDATE ON public.production_cards
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_production_card_updated_at();
