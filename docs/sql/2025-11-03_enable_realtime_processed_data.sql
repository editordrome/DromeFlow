-- Habilitar Realtime para a tabela processed_data
-- Data: 2025-11-03
-- Módulo: Agendamentos
-- Objetivo: Permitir atualização automática da tabela de agendamentos sem recarregar a página

-- 1. Habilitar publicação realtime para a tabela processed_data
ALTER PUBLICATION supabase_realtime ADD TABLE processed_data;

-- Nota: Execute este comando no SQL Editor do Supabase Dashboard
-- ou via CLI: supabase db push

-- Verificar se a publicação foi criada com sucesso:
-- SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'processed_data';

-- Para desabilitar (se necessário no futuro):
-- ALTER PUBLICATION supabase_realtime DROP TABLE processed_data;
