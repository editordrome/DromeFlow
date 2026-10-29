-- Migration: Add is_active column to units table
-- Run this in Supabase SQL Editor

-- Add is_active column to units table
ALTER TABLE units ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Add comment to column
COMMENT ON COLUMN units.is_active IS 'Indicates if the unit is active and accessible';

-- Update existing rows to be active by default
UPDATE units SET is_active = true WHERE is_active IS NULL;
