-- Migration: Update get_user_units RPC to include uniform_value
-- Date: 2026-01-19
-- Description: Adds uniform_value field to the get_user_units RPC return type

-- Drop the existing function
DROP FUNCTION IF EXISTS public.get_user_units(uuid);

-- Recreate with uniform_value included
CREATE OR REPLACE FUNCTION public.get_user_units(p_user_id uuid)
RETURNS TABLE(
  id uuid, 
  unit_name text, 
  unit_code text, 
  created_at timestamp with time zone, 
  razao_social text, 
  cnpj text, 
  endereco text, 
  responsavel text, 
  contato text, 
  email text, 
  is_active boolean,
  uniform_value numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.unit_name,
    u.unit_code,
    u.created_at,
    u.razao_social,
    u.cnpj,
    u.endereco,
    u.responsavel,
    u.contato,
    u.email,
    u.is_active,
    u.uniform_value
  FROM units u
  INNER JOIN user_units uu ON u.id = uu.unit_id
  WHERE uu.user_id = p_user_id
  ORDER BY u.unit_name;
END;
$function$;
