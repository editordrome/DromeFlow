-- Comercial module tables and triggers
-- Creates tables for opportunities and their column metadata, plus sync to unit_clients

-- 1) Main table for commercial opportunities
create table if not exists public.comercial (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  nome text not null,
  tipo text,
  endereco text,
  contato text,
  status text not null default 'leads',
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint comercial_status_check
    check (status = any (array['leads','andamento','ganhos','perdidos','aguardando']))
);

alter table if exists public.comercial
  add column if not exists position integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'comercial_tipo_check' and conrelid = 'public.comercial'::regclass
  ) then
    alter table public.comercial
      add constraint comercial_tipo_check
        check (tipo is null or tipo = any (array['Residencial','Comercial','Pós Obra']));
  end if;
end$$;

create index if not exists comercial_unit_id_idx on public.comercial(unit_id);

-- Evita duplicar registros por unidade + nome normalizado
do $$
begin
  if not exists (
    select 1 from pg_indexes where schemaname = 'public' and indexname = 'comercial_unique_name_per_unit'
  ) then
    execute 'create unique index comercial_unique_name_per_unit on public.comercial (unit_id, lower(trim(nome)))';
  end if;
end$$;

-- Trigger de updated_at reutilizando função global
create or replace function public.set_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'set_comercial_updated_at'
  ) then
    create trigger set_comercial_updated_at
    before update on public.comercial
    for each row execute function public.set_timestamp_updated_at();
  end if;
end$$;

-- RLS permissivo (padrão atual do projeto)
alter table if exists public.comercial enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='comercial' and policyname='comercial_read_all'
  ) then
    create policy comercial_read_all on public.comercial for select using (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='comercial' and policyname='comercial_insert_all'
  ) then
    create policy comercial_insert_all on public.comercial for insert with check (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='comercial' and policyname='comercial_update_all'
  ) then
    create policy comercial_update_all on public.comercial for update using (true) with check (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='comercial' and policyname='comercial_delete_all'
  ) then
    create policy comercial_delete_all on public.comercial for delete using (true);
  end if;
end$$;

-- 2) Metadata table for kanban columns
create table if not exists public.comercial_columns (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid references public.units(id) on delete cascade,
  code text not null,
  name text not null,
  color text,
  image_url text,
  position integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint comercial_columns_unique_code unique (unit_id, code)
);

create index if not exists comercial_columns_unit_id_idx on public.comercial_columns(unit_id);

alter table if exists public.comercial_columns
  add column if not exists image_url text;

-- Trigger de updated_at nas colunas

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'set_comercial_columns_updated_at'
  ) then
    create trigger set_comercial_columns_updated_at
    before update on public.comercial_columns
    for each row execute function public.set_timestamp_updated_at();
  end if;
end$$;

alter table if exists public.comercial_columns enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='comercial_columns' and policyname='comercial_columns_read_all'
  ) then
    create policy comercial_columns_read_all on public.comercial_columns for select using (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='comercial_columns' and policyname='comercial_columns_insert_all'
  ) then
    create policy comercial_columns_insert_all on public.comercial_columns for insert with check (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='comercial_columns' and policyname='comercial_columns_update_all'
  ) then
    create policy comercial_columns_update_all on public.comercial_columns for update using (true) with check (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='comercial_columns' and policyname='comercial_columns_delete_all'
  ) then
    create policy comercial_columns_delete_all on public.comercial_columns for delete using (true);
  end if;
end$$;

-- Carga inicial de colunas padrão globais (unit_id nulo)
insert into public.comercial_columns (unit_id, code, name, position, image_url)
select null, t.code, t.name, t.position, t.image_url
from (values
  ('leads', 'Leads', 1, null),
  ('andamento', 'Em andamento', 2, null),
  ('ganhos', 'Ganhos', 3, null),
  ('perdidos', 'Perdidos', 4, null),
  ('aguardando', 'Aguardando', 5, null)
) as t(code, name, position, image_url)
on conflict (unit_id, code) do update
  set name = excluded.name,
      position = excluded.position,
      image_url = excluded.image_url,
      updated_at = now();

-- 3) Trigger to sync won opportunities to unit_clients
create or replace function public.comercial_sync_unit_clients()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and coalesce(old.status, '') = coalesce(new.status, '') then
    return new;
  end if;

  if new.status <> 'ganhos' then
    return new;
  end if;

  insert into public.unit_clients (unit_id, nome, tipo, endereco, contato)
  values (new.unit_id, new.nome, new.tipo, new.endereco, new.contato)
  on conflict on constraint unit_clients_unique_name_per_unit do update
    set tipo = excluded.tipo,
        endereco = excluded.endereco,
        contato = excluded.contato,
        updated_at = now();

  return new;
end;
$$;

do $$
begin
  if exists (select 1 from pg_trigger where tgname = 'comercial_sync_unit_clients_trg') then
    drop trigger comercial_sync_unit_clients_trg on public.comercial;
  end if;
end$$;

create trigger comercial_sync_unit_clients_trg
after insert or update on public.comercial
for each row execute function public.comercial_sync_unit_clients();
