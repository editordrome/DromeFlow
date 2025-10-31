-- Migration: Criação da tabela pos_vendas
-- Criado em: 2025-10-31
-- Objetivo: Gerenciar pós-vendas dos atendimentos

-- ============================================================================
-- TABELA: pos_vendas
-- ============================================================================
-- Armazena informações de acompanhamento pós-venda dos atendimentos
-- Conecta com processed_data através de ATENDIMENTO_ID
-- ============================================================================

CREATE TABLE IF NOT EXISTS pos_vendas (
    -- Chave primária
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Conexão com atendimento
    "ATENDIMENTO_ID" TEXT,
    
    -- Informações do cliente
    chat_id TEXT,
    nome TEXT,
    contato TEXT,
    
    -- Conexão com unidade
    unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
    
    -- Informações de pós-venda
    data TIMESTAMP WITH TIME ZONE,
    status TEXT,
    nota INTEGER CHECK (nota >= 1 AND nota <= 5),
    reagendou BOOLEAN DEFAULT false,
    feedback TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- COMENTÁRIOS
-- ============================================================================
COMMENT ON TABLE pos_vendas IS 'Armazena informações de pós-venda e acompanhamento de atendimentos';
COMMENT ON COLUMN pos_vendas."ATENDIMENTO_ID" IS 'ID do atendimento na tabela processed_data';
COMMENT ON COLUMN pos_vendas.chat_id IS 'ID do chat do cliente (WhatsApp, etc)';
COMMENT ON COLUMN pos_vendas.nome IS 'Nome do cliente';
COMMENT ON COLUMN pos_vendas.contato IS 'Telefone/contato do cliente';
COMMENT ON COLUMN pos_vendas.unit_id IS 'ID da unidade responsável pelo pós-venda';
COMMENT ON COLUMN pos_vendas.data IS 'Data do contato/registro de pós-venda';
COMMENT ON COLUMN pos_vendas.status IS 'Status do pós-venda (ex: pendente, contatado, finalizado)';
COMMENT ON COLUMN pos_vendas.nota IS 'Nota de satisfação (1 a 5)';
COMMENT ON COLUMN pos_vendas.reagendou IS 'Indica se o cliente reagendou o serviço';
COMMENT ON COLUMN pos_vendas.feedback IS 'Comentários/feedback do cliente';

-- ============================================================================
-- ÍNDICES
-- ============================================================================
-- Índice para busca por ATENDIMENTO_ID
CREATE INDEX IF NOT EXISTS idx_pos_vendas_atendimento_id 
ON pos_vendas("ATENDIMENTO_ID");

-- Índice para busca por unit_id
CREATE INDEX IF NOT EXISTS idx_pos_vendas_unit_id 
ON pos_vendas(unit_id);

-- Índice para busca por data
CREATE INDEX IF NOT EXISTS idx_pos_vendas_data 
ON pos_vendas(data);

-- Índice para busca por status
CREATE INDEX IF NOT EXISTS idx_pos_vendas_status 
ON pos_vendas(status);

-- Índice para busca por chat_id
CREATE INDEX IF NOT EXISTS idx_pos_vendas_chat_id 
ON pos_vendas(chat_id);

-- ============================================================================
-- TRIGGER: updated_at
-- ============================================================================
-- Atualiza automaticamente o campo updated_at quando o registro é modificado
CREATE OR REPLACE FUNCTION update_pos_vendas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_pos_vendas_updated_at
    BEFORE UPDATE ON pos_vendas
    FOR EACH ROW
    EXECUTE FUNCTION update_pos_vendas_updated_at();

-- ============================================================================
-- RLS (Row Level Security)
-- ============================================================================
-- Habilita RLS na tabela
ALTER TABLE pos_vendas ENABLE ROW LEVEL SECURITY;

-- Política: Usuários autenticados podem visualizar todos os registros
CREATE POLICY "Usuários autenticados podem visualizar pos_vendas"
ON pos_vendas FOR SELECT
TO authenticated
USING (true);

-- Política: Usuários autenticados podem inserir registros
CREATE POLICY "Usuários autenticados podem inserir pos_vendas"
ON pos_vendas FOR INSERT
TO authenticated
WITH CHECK (true);

-- Política: Usuários autenticados podem atualizar registros
CREATE POLICY "Usuários autenticados podem atualizar pos_vendas"
ON pos_vendas FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Política: Usuários autenticados podem deletar registros
CREATE POLICY "Usuários autenticados podem deletar pos_vendas"
ON pos_vendas FOR DELETE
TO authenticated
USING (true);

-- ============================================================================
-- DADOS DE EXEMPLO (Opcional - comentado)
-- ============================================================================
/*
-- Inserir registro de exemplo
INSERT INTO pos_vendas (
    "ATENDIMENTO_ID",
    chat_id,
    nome,
    contato,
    unit_id,
    data,
    status,
    nota,
    reagendou,
    feedback
) VALUES (
    'ATD123456',
    '5511999999999',
    'João Silva',
    '(11) 99999-9999',
    (SELECT id FROM units LIMIT 1),
    NOW(),
    'contatado',
    5,
    false,
    'Muito satisfeito com o atendimento!'
);
*/

-- ============================================================================
-- VERIFICAÇÃO
-- ============================================================================
-- Verificar se a tabela foi criada
SELECT 
    table_name,
    (SELECT count(*) FROM information_schema.columns WHERE table_name = 'pos_vendas') as total_columns
FROM information_schema.tables
WHERE table_schema = 'public' 
  AND table_name = 'pos_vendas';

-- Listar colunas criadas
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'pos_vendas'
ORDER BY ordinal_position;
