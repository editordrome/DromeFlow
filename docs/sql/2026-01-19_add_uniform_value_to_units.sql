-- Migration: Add uniform_value column to units table
-- Date: 2026-01-19
-- Description: Adds a column to store the uniform value (valor do uniforme) for each unit

-- Add the uniform_value column to the units table
ALTER TABLE units 
ADD COLUMN IF NOT EXISTS uniform_value NUMERIC(10, 2) DEFAULT 0.00;

-- Add a comment to document the column
COMMENT ON COLUMN units.uniform_value IS 'Valor do uniforme retido pela unidade (em reais)';

-- Update existing records to have a default value of 0.00 if NULL
UPDATE units 
SET uniform_value = 0.00 
WHERE uniform_value IS NULL;
