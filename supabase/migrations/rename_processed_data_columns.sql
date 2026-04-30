-- Migration Forward: Rename columns to snake_case
-- Data: 2026-04-29

-- Tabela: processed_data

-- Atenção: Estas alterações exigem que os triggers sejam desabilitados primeiro
-- e que a publicação do realtime seja temporariamente removida

ALTER TABLE public.processed_data 
  RENAME COLUMN "DATA" TO data;

ALTER TABLE public.processed_data 
  RENAME COLUMN "HORARIO" TO horario;

ALTER TABLE public.processed_data 
  RENAME COLUMN "VALOR" TO valor;

ALTER TABLE public.processed_data 
  RENAME COLUMN "SERVIÇO" TO servico;

ALTER TABLE public.processed_data 
  RENAME COLUMN "TIPO" TO tipo;

ALTER TABLE public.processed_data 
  RENAME COLUMN "CLIENTE" TO cliente;

ALTER TABLE public.processed_data 
  RENAME COLUMN "PROFISSIONAL" TO profissional;

ALTER TABLE public.processed_data 
  RENAME COLUMN "ENDEREÇO" TO endereco;

ALTER TABLE public.processed_data 
  RENAME COLUMN "DIA" TO dia;

ALTER TABLE public.processed_data 
  RENAME COLUMN "REPASSE" TO repasse;

ALTER TABLE public.processed_data 
  RENAME COLUMN "CUPOM" TO cupom;

ALTER TABLE public.processed_data 
  RENAME COLUMN "ORIGEM" TO origem;

ALTER TABLE public.processed_data 
  RENAME COLUMN "ATENDIMENTO_ID" TO atendimento_id;

ALTER TABLE public.processed_data 
  RENAME COLUMN "IS_DIVISAO" TO is_divisao;

ALTER TABLE public.processed_data 
  RENAME COLUMN "CADASTRO" TO cadastro;

ALTER TABLE public.processed_data 
  RENAME COLUMN "ACAO" TO acao;

ALTER TABLE public.processed_data 
  RENAME COLUMN "STATUS" TO status;

ALTER TABLE public.processed_data 
  RENAME COLUMN "PERÍODO" TO periodo;

ALTER TABLE public.processed_data 
  RENAME COLUMN "MOMENTO" TO momento;

ALTER TABLE public.processed_data 
  RENAME COLUMN "pos vendas" TO pos_vendas;
