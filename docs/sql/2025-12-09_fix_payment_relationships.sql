-- Corrige o relacionamento entre payment_records e unit_clients
-- O erro 400 ocorre porque o Supabase não encontra uma Foreign Key (Chave Estrangeira) entre as tabelas
-- para realizar o JOIN solicitado na query.

-- 1. Garantir que a coluna asaas_id em unit_clients seja única (necessário para ser referenciada por FK)
-- Se já for única, este comando pode falhar ou não fazer nada, o que é ok.
-- Caso existam duplicatas, você precisará limpá-las antes.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'unit_clients_asaas_id_key'
    ) THEN
        ALTER TABLE unit_clients ADD CONSTRAINT unit_clients_asaas_id_key UNIQUE (asaas_id);
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Constraint unique for asaas_id might issue an error if duplicates exist: %', SQLERRM;
END $$;

-- 2. Adicionar a Foreign Key explícita na tabela payment_records
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_payment_records_client_asaas'
    ) THEN
        ALTER TABLE payment_records
        ADD CONSTRAINT fk_payment_records_client_asaas
        FOREIGN KEY (cliente_asaas_id)
        REFERENCES unit_clients (asaas_id)
        ON UPDATE CASCADE; -- Se o ID mudar no cliente, atualiza no pagamento
    END IF;
END $$;
