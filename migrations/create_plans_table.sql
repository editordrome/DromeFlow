-- Migration: Create plans table
-- Run this in Supabase SQL Editor

-- Create plans table
CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  value NUMERIC(10, 2) NOT NULL,
  cycle TEXT NOT NULL CHECK (cycle IN ('monthly', 'annual')),
  status BOOLEAN DEFAULT true,
  payment_link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comments
COMMENT ON TABLE plans IS 'Subscription plans management';
COMMENT ON COLUMN plans.name IS 'Plan name';
COMMENT ON COLUMN plans.description IS 'Plan description';
COMMENT ON COLUMN plans.value IS 'Plan value in BRL';
COMMENT ON COLUMN plans.cycle IS 'Billing cycle: monthly or annual';
COMMENT ON COLUMN plans.status IS 'Whether plan is active';
COMMENT ON COLUMN plans.payment_link IS 'Payment/checkout link';

-- Enable RLS
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

-- Super admin can do everything
CREATE POLICY "Super admins can manage plans"
  ON plans
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Add indexes
CREATE INDEX idx_plans_status ON plans(status);
CREATE INDEX idx_plans_cycle ON plans(cycle);
CREATE INDEX idx_plans_created_at ON plans(created_at DESC);

-- Add trigger for updated_at (assuming function exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_plans_updated_at
  BEFORE UPDATE ON plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
