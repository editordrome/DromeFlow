-- RPCs para administrar colunas da tabela public.unit_keys
-- Observação: Não cria novas tabelas. Apenas funções para listar, adicionar, renomear e excluir colunas existentes.
-- Segurança básica: exige caller_id de profiles.role = 'super_admin'. Esta checagem depende do app enviar um id válido.
-- Em produção, recomenda-se migrar para Supabase Auth e usar auth.uid() + RLS adequada.

-- Lista colunas atuais (exclui colunas de sistema por padrão)
create or replace function public.unit_keys_list_columns(
  p_include_system boolean default false
)
returns table(
  column_name text,
  data_type text,
  is_nullable boolean,
  column_default text,
  ordinal_position integer
) language sql stable as $$
  select c.column_name,
         c.data_type,
         (c.is_nullable = 'YES') as is_nullable,
         c.column_default,
         c.ordinal_position
    from information_schema.columns c
   where c.table_schema = 'public'
     and c.table_name = 'unit_keys'
     and (
       p_include_system
       or c.column_name not in ('id','unit_id','created_at','updated_at','is_active')
     )
   order by c.ordinal_position;
$$;

-- Permissões de execução
grant execute on function public.unit_keys_list_columns(boolean) to anon, authenticated;

-- Adiciona coluna (nome e tipo com whitelist) – requer super_admin
create or replace function public.unit_keys_add_column(
  p_caller_id uuid,
  p_column_name text,
  p_data_type text,
  p_nullable boolean default true,
  p_default text default null
) returns void language plpgsql security definer as $$
declare
  v_role text;
  v_safe_type text;
  v_already_exists boolean;
begin
  -- Checagem simples de permissão
  select role into v_role from public.profiles where id = p_caller_id;
  if v_role is distinct from 'super_admin' then
    raise exception 'permission denied: super_admin required';
  end if;

  -- Validação de nome
  if p_column_name !~ '^[a-zA-Z_][a-zA-Z0-9_]*$' then
    raise exception 'invalid column name: %', p_column_name;
  end if;

  -- Impede nomes protegidos
  if p_column_name in ('id','unit_id','created_at','updated_at','is_active') then
    raise exception 'column name is reserved: %', p_column_name;
  end if;

  -- Verifica se já existe
  select exists (
    select 1 from information_schema.columns 
     where table_schema='public' and table_name='unit_keys' and column_name=p_column_name
  ) into v_already_exists;
  if v_already_exists then
    raise exception 'column already exists: %', p_column_name;
  end if;

  -- Whitelist de tipos aceitos: text, varchar(n), boolean, integer, numeric(p,s), date, timestamp, timestamptz
  if lower(p_data_type) ~ '^(text|boolean|integer|date|timestamp|timestamptz)$' then
    v_safe_type := lower(p_data_type);
  elsif lower(p_data_type) ~ '^varchar\(\d+\)$' then
    v_safe_type := lower(p_data_type);
  elsif lower(p_data_type) ~ '^numeric\(\d+\s*,\s*\d+\)$' then
    v_safe_type := lower(p_data_type);
  else
    raise exception 'unsupported data type: %', p_data_type;
  end if;

  -- Monta DDL
  execute format('alter table public.unit_keys add column %I %s', p_column_name, v_safe_type);

  if p_default is not null then
    execute format('alter table public.unit_keys alter column %I set default %s', p_column_name, p_default);
  end if;

  if not p_nullable then
    execute format('alter table public.unit_keys alter column %I set not null', p_column_name);
  end if;
end;
$$;

-- Permissões de execução
grant execute on function public.unit_keys_add_column(uuid, text, text, boolean, text) to anon, authenticated;

-- Renomeia coluna – requer super_admin
create or replace function public.unit_keys_rename_column(
  p_caller_id uuid,
  p_old_name text,
  p_new_name text
) returns void language plpgsql security definer as $$
declare
  v_role text;
  v_exists boolean;
begin
  select role into v_role from public.profiles where id = p_caller_id;
  if v_role is distinct from 'super_admin' then
    raise exception 'permission denied: super_admin required';
  end if;

  if p_new_name !~ '^[a-zA-Z_][a-zA-Z0-9_]*$' then
    raise exception 'invalid new column name: %', p_new_name;
  end if;

  if p_old_name in ('id','unit_id','created_at','updated_at','is_active') then
    raise exception 'cannot rename reserved column: %', p_old_name;
  end if;

  select exists (
    select 1 from information_schema.columns 
     where table_schema='public' and table_name='unit_keys' and column_name=p_old_name
  ) into v_exists;
  if not v_exists then
    raise exception 'column does not exist: %', p_old_name;
  end if;

  execute format('alter table public.unit_keys rename column %I to %I', p_old_name, p_new_name);
end;
$$;

-- Permissões de execução
grant execute on function public.unit_keys_rename_column(uuid, text, text) to anon, authenticated;

-- Exclui coluna – requer super_admin
create or replace function public.unit_keys_drop_column(
  p_caller_id uuid,
  p_column_name text
) returns void language plpgsql security definer as $$
declare
  v_role text;
  v_exists boolean;
begin
  select role into v_role from public.profiles where id = p_caller_id;
  if v_role is distinct from 'super_admin' then
    raise exception 'permission denied: super_admin required';
  end if;

  if p_column_name in ('id','unit_id','created_at','updated_at','is_active') then
    raise exception 'cannot drop reserved column: %', p_column_name;
  end if;

  select exists (
    select 1 from information_schema.columns 
     where table_schema='public' and table_name='unit_keys' and column_name=p_column_name
  ) into v_exists;
  if not v_exists then
    raise exception 'column does not exist: %', p_column_name;
  end if;

  execute format('alter table public.unit_keys drop column %I', p_column_name);
end;
$$;

-- Permissões de execução
grant execute on function public.unit_keys_drop_column(uuid, text) to anon, authenticated;

-- Estatísticas de uso por coluna (quantas UNIDs possuem valor na coluna; quantas estão ativas)
create or replace function public.unit_keys_columns_stats(
  p_include_system boolean default false
)
returns table(
  column_name text,
  usage_count integer,
  active_count integer
) language plpgsql as $$
declare
  r record;
  v_usage integer;
  v_active integer;
begin
  for r in (
    select c.column_name
      from information_schema.columns c
     where c.table_schema = 'public'
       and c.table_name = 'unit_keys'
       and (
         p_include_system
         or c.column_name not in ('id','unit_id','created_at','updated_at','is_active')
       )
     order by c.ordinal_position
  ) loop
    execute format('select count(*) from public.unit_keys where %I is not null and cast(%I as text) <> ''''''', r.column_name, r.column_name)
      into v_usage;
    execute format('select count(*) from public.unit_keys where %I is not null and cast(%I as text) <> '''''' and is_active = true', r.column_name, r.column_name)
      into v_active;
    column_name := r.column_name;
    usage_count := coalesce(v_usage,0);
    active_count := coalesce(v_active,0);
    return next;
  end loop;
end;
$$;

grant execute on function public.unit_keys_columns_stats(boolean) to anon, authenticated;

-- Define status (is_active) em massa para as linhas que possuem valor na coluna informada
create or replace function public.unit_keys_set_column_status(
  p_caller_id uuid,
  p_column_name text,
  p_active boolean
) returns void language plpgsql security definer as $$
declare
  v_role text;
  v_exists boolean;
begin
  select role into v_role from public.profiles where id = p_caller_id;
  if v_role is distinct from 'super_admin' then
    raise exception 'permission denied: super_admin required';
  end if;

  if p_column_name in ('id','unit_id','created_at','updated_at','is_active') then
    raise exception 'invalid target column: %', p_column_name;
  end if;

  select exists (
    select 1 from information_schema.columns 
     where table_schema='public' and table_name='unit_keys' and column_name=p_column_name
  ) into v_exists;
  if not v_exists then
    raise exception 'column does not exist: %', p_column_name;
  end if;

  execute format('update public.unit_keys set is_active = %L where %I is not null and cast(%I as text) <> ''''''', p_active, p_column_name, p_column_name);
end;
$$;

grant execute on function public.unit_keys_set_column_status(uuid, text, boolean) to anon, authenticated;
