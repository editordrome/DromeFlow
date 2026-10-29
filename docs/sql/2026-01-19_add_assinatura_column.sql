-- Migration: Add assinatura (contract signature date) column to recrutadora and profissionais tables
-- Date: 2026-01-19
-- Description: Adds a column to store the contract signature date for both recruitment and professional records

-- Add assinatura column to recrutadora table
ALTER TABLE recrutadora 
ADD COLUMN IF NOT EXISTS assinatura DATE;

-- Add comment to document the column
COMMENT ON COLUMN recrutadora.assinatura IS 'Data de assinatura do contrato';

-- Add assinatura column to profissionais table
ALTER TABLE profissionais 
ADD COLUMN IF NOT EXISTS assinatura DATE;

-- Add comment to document the column
COMMENT ON COLUMN profissionais.assinatura IS 'Data de assinatura do contrato';
