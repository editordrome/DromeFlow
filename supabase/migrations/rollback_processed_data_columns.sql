-- Rollback Migration: Revert columns back to UPPERCASE
-- Data: 2026-04-29

-- Tabela: processed_data

-- Atenção: Estas alterações exigem que os triggers sejam desabilitados primeiro
-- e que a publicação do realtime seja temporariamente removida

ALTER TABLE public.processed_data 
  RENAME COLUMN data TO "DATA";

ALTER TABLE public.processed_data 
  RENAME COLUMN horario TO "HORARIO";

ALTER TABLE public.processed_data 
  RENAME COLUMN valor TO "VALOR";

ALTER TABLE public.processed_data 
  RENAME COLUMN servico TO "SERVIÇO";

ALTER TABLE public.processed_data 
  RENAME COLUMN tipo TO "TIPO";

ALTER TABLE public.processed_data 
  RENAME COLUMN cliente TO "CLIENTE";

ALTER TABLE public.processed_data 
  RENAME COLUMN profissional TO "PROFISSIONAL";

ALTER TABLE public.processed_data 
  RENAME COLUMN endereco TO "ENDEREÇO";

ALTER TABLE public.processed_data 
  RENAME COLUMN dia TO "DIA";

ALTER TABLE public.processed_data 
  RENAME COLUMN repasse TO "REPASSE";

ALTER TABLE public.processed_data 
  RENAME COLUMN cupom TO "CUPOM";

ALTER TABLE public.processed_data 
  RENAME COLUMN origem TO "ORIGEM";

ALTER TABLE public.processed_data 
  RENAME COLUMN atendimento_id TO "ATENDIMENTO_ID";

ALTER TABLE public.processed_data 
  RENAME COLUMN is_divisao TO "IS_DIVISAO";

ALTER TABLE public.processed_data 
  RENAME COLUMN cadastro TO "CADASTRO";

ALTER TABLE public.processed_data 
  RENAME COLUMN acao TO "ACAO";

ALTER TABLE public.processed_data 
  RENAME COLUMN status TO "STATUS";

ALTER TABLE public.processed_data 
  RENAME COLUMN periodo TO "PERÍODO";

ALTER TABLE public.processed_data 
  RENAME COLUMN momento TO "MOMENTO";

ALTER TABLE public.processed_data 
  RENAME COLUMN pos_vendas TO "pos vendas";
