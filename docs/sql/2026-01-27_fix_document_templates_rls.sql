-- =====================================================
-- Fix RLS Policies for document_templates
-- Date: 2026-01-27
-- Description: Enables RLS and ensures unit isolation + global access
-- =====================================================

-- 1. Enable RLS
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing problematic policies
DROP POLICY IF EXISTS "Templates are viewable by authenticated users" ON public.document_templates;
DROP POLICY IF EXISTS "Super admins can manage all templates" ON public.document_templates;
DROP POLICY IF EXISTS "Unit admins can manage their unit templates" ON public.document_templates;

-- 3. Create SELECT policy (Global + Unit-specific isolation)
CREATE POLICY "Templates are viewable by global or unit members"
ON public.document_templates
FOR SELECT
TO authenticated
USING (
    unit_id IS NULL OR 
    EXISTS (
        SELECT 1 FROM public.user_units 
        WHERE user_id = auth.uid() AND unit_id = document_templates.unit_id
    ) OR
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'super_admin'
    )
);

-- 4. Create ALL (Management) policy for Super Admins
CREATE POLICY "Super admins can manage all templates"
ON public.document_templates
FOR ALL
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

-- 5. Create ALL (Management) policy for Unit Admins
CREATE POLICY "Unit admins can manage their unit templates"
ON public.document_templates
FOR ALL
TO authenticated
USING (
    unit_id IS NOT NULL AND 
    EXISTS (
        SELECT 1 FROM public.user_units uu
        JOIN public.profiles p ON p.id = uu.user_id
        WHERE uu.user_id = auth.uid() 
          AND uu.unit_id = document_templates.unit_id
          AND p.role = 'admin'
    )
)
WITH CHECK (
    unit_id IS NOT NULL AND 
    EXISTS (
        SELECT 1 FROM public.user_units uu
        JOIN public.profiles p ON p.id = uu.user_id
        WHERE uu.user_id = auth.uid() 
          AND uu.unit_id = document_templates.unit_id
          AND p.role = 'admin'
    )
);
