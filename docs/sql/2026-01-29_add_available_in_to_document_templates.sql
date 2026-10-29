-- =====================================================
-- Add available_in column to document_templates
-- Date: 2026-01-29
-- Description: Adds control for document availability in modules
-- =====================================================

-- Add column to control document availability
ALTER TABLE public.document_templates 
ADD COLUMN IF NOT EXISTS available_in TEXT[] DEFAULT ARRAY['recrutadora', 'profissional'];

-- Update existing templates to be available in both modules by default
UPDATE public.document_templates 
SET available_in = ARRAY['recrutadora', 'profissional']
WHERE available_in IS NULL;

-- Add column comment
COMMENT ON COLUMN public.document_templates.available_in IS 
'Array indicating where the document is available: recrutadora, profissional';
