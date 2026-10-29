
-- Inserção do módulo financeiro na tabela modules (Removido 'description' pois a coluna não existe no banco)
INSERT INTO modules (code, name, icon, is_active, position, view_id, allowed_profiles)
VALUES ('financial_module', 'Financeiro', 'dollar-sign', true, 99, 'financial', '{super_admin,admin}');
