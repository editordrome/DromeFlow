-- Script de Criação do Módulo Agenda
-- Tabelas, Relacionamentos, RLS Policies e Registro do Módulo
-- Data: 2026-03-13

-- ==============================================================================
-- 1. Criação das Tabelas
-- ==============================================================================

-- Tabela: agenda_settings
-- Descreve as configurações de abertura de agenda por unidade. 
CREATE TABLE IF NOT EXISTS public.agenda_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
    
    -- Exemplo: '[1,2,3,4,5]' para Seg a Sex. '[]' para bloquear todos os dias.
    dias_liberados JSONB DEFAULT '[]'::JSONB,
    
    -- Exemplo: '["Manhã", "Tarde", "Integral"]'
    periodos_cadastrados JSONB DEFAULT '["Manhã", "Tarde"]'::JSONB,
    
    -- Status da Agenda: Ativa ou Desativada
    is_link_active BOOLEAN DEFAULT false,
    
    -- Controle
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Garantir 1 registro por unidade
    CONSTRAINT agenda_settings_unit_id_unique UNIQUE (unit_id)
);

-- Index para buscas rápidas
CREATE INDEX IF NOT EXISTS idx_agenda_settings_unit_id ON public.agenda_settings(unit_id);

-- Tabela: agenda_disponibilidade
-- Guarda os envios das profissionais.
CREATE TABLE IF NOT EXISTS public.agenda_disponibilidade (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
    profissional_id UUID NOT NULL REFERENCES public.profissionais(id) ON DELETE CASCADE,
    
    data DATE NOT NULL,
    -- Ex: '["Manhã", "Tarde"]' ou '["Indisponível"]'
    periodos JSONB NOT NULL DEFAULT '[]'::JSONB,
    status_manha TEXT DEFAULT NULL,
    status_tarde TEXT DEFAULT NULL,
    
    -- Verificação cruzada com a tabela processed_data
    -- Atualizado via edge-function ou aplicação na leitura
    conflito BOOLEAN DEFAULT false,
    
    -- Histórico
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Evitar que a profissional mande várias respostas conflitantes para o mesmo dia e unidade
    CONSTRAINT agenda_disp_unit_prof_data_unique UNIQUE (unit_id, profissional_id, data)
);

-- Index para relatórios, dashboard e UI pública
CREATE INDEX IF NOT EXISTS idx_agenda_disp_unit_date ON public.agenda_disponibilidade(unit_id, data);
CREATE INDEX IF NOT EXISTS idx_agenda_disp_prof ON public.agenda_disponibilidade(profissional_id);


-- ==============================================================================
-- 2. Políticas RLS (Row Level Security)
-- ==============================================================================

-- Habilitar RLS nas tabelas
ALTER TABLE public.agenda_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_disponibilidade ENABLE ROW LEVEL SECURITY;

-- agenda_settings: Acesso restrito (MVP: full access autenticado, permissivo temporário conforme DromeFlow rules)
CREATE POLICY "Permitir acesso total (autenticado) - MVP agenda_settings"
ON public.agenda_settings
FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- agenda_disponibilidade: Acesso Público para INSERT (pois a profissional usa o painel via celular sem login)
-- E acesso autenticado (Gestor) para Leitura e Update
CREATE POLICY "Permitir INSERT público (profissionais)"
ON public.agenda_disponibilidade
FOR INSERT
WITH CHECK (true); -- Controle feito via backend verificando ID da profissional

CREATE POLICY "Permitir leitura anonima (app externo buscar agenda)"
ON public.agenda_disponibilidade
FOR SELECT
USING (true);

CREATE POLICY "Permitir alteração e deleção apenas autenticado"
ON public.agenda_disponibilidade
FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- ==============================================================================
-- 3. Inserção do Módulo na Tabela `modules`
-- ==============================================================================

INSERT INTO public.modules (
    id, code, name, icon, view_id, is_active, allowed_profiles, position, webhook_url
) VALUES (
    gen_random_uuid(),          -- id
    'agenda',                   -- code
    'Agenda Profissionais',     -- name
    'CalendarDays',            -- icon (lucide)
    'agenda',                   -- view_id (mesmo do types.ts)
    true,                       -- is_active
    ARRAY['super_admin', 'admin', 'user'], -- allowed_profiles (disponível p/ todos via permissões de unidade)
    11,                         -- position (Abaixo de Pos-vendas, Comercial, etc)
    'internal://agenda'         -- webhook_url
)
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name,
    icon = EXCLUDED.icon,
    view_id = EXCLUDED.view_id,
    is_active = EXCLUDED.is_active,
    webhook_url = EXCLUDED.webhook_url;
