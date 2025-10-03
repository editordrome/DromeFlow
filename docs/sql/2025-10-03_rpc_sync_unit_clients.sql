-- RPC: sync_unit_clients_from_processed(unit_code_arg)
-- Insere clientes distintos de processed_data na tabela unit_clients da unidade informada, ignorando os já existentes

create or replace function public.sync_unit_clients_from_processed(unit_code_arg text)
returns integer
language plpgsql
as $$
declare
  v_unit_id uuid;
  v_inserted_count integer := 0;
begin
  select id into v_unit_id from public.units where unit_code = unit_code_arg limit 1;
  if v_unit_id is null then
    raise exception 'Unidade com code % não encontrada', unit_code_arg;
  end if;

  with source_clients as (
    select distinct
      trim(coalesce(pd."CLIENTE", '')) as nome,
      nullif(trim(coalesce(pd."TIPO", '')), '') as tipo,
      nullif(trim(coalesce(pd."ENDEREÇO", '')), '') as endereco,
      nullif(trim(coalesce(pd."whatsapp", '')), '') as contato
    from public.processed_data pd
    where pd.unidade_code = unit_code_arg
      and trim(coalesce(pd."CLIENTE", '')) <> ''
  ), missing as (
    select s.*
    from source_clients s
    left join public.unit_clients uc
      on uc.unit_id = v_unit_id
     and lower(trim(uc.nome)) = lower(trim(s.nome))
    where uc.id is null
  ), ins as (
    insert into public.unit_clients (id, unit_id, nome, tipo, endereco, contato)
    select gen_random_uuid(), v_unit_id, nome, tipo, endereco, contato
    from missing
    returning 1
  )
  select count(*) into v_inserted_count from ins;

  return v_inserted_count;
end;
$$;
