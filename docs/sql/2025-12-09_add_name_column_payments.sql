-- Adiciona a coluna 'nome' na tabela payment_records para simplificar exibição
ALTER TABLE payment_records
ADD COLUMN IF NOT EXISTS nome TEXT;

-- Opcional: Copiar nomes existentes se a relação estiver funcionando (Best Effort)
UPDATE payment_records pr
SET nome = uc.nome
FROM unit_clients uc
WHERE pr.cliente_asaas_id = uc.asaas_id
AND pr.nome IS NULL;
