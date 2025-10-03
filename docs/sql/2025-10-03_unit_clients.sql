-- Criação da tabela unit_clients para cadastro de clientes por unidade
-- Campos: id, unit_id (FK), nome, tipo, endereco, contato, timestamps
-- Unicidade: (unit_id, lower(trim(nome)))

-- Extensão opcional para gen_random_uuid (geralmente já habilitada no Supabase)
-- CREATE EXTENSION IF NOT EXISTS pgcrypto;

create table if not exists public.unit_clients (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  nome text not null,
  tipo text,
  endereco text,
  contato text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Índices
create index if not exists unit_clients_unit_id_idx on public.unit_clients(unit_id);

-- Índice único para evitar duplicados por unidade + nome (normalizado)
do $$
begin
  if not exists (
    select 1 from pg_indexes where schemaname='public' and indexname='unit_clients_unique_name_per_unit'
  ) then
    execute 'create unique index unit_clients_unique_name_per_unit on public.unit_clients (unit_id, lower(trim(nome)))';
  end if;
end$$;

-- Trigger para updated_at
create or replace function public.set_timestamp_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'set_unit_clients_updated_at'
  ) then
    create trigger set_unit_clients_updated_at
    before update on public.unit_clients
    for each row execute function public.set_timestamp_updated_at();
  end if;
end$$;

-- RLS permissivo (MVP): habilita RLS e políticas de CRUD livres
alter table if exists public.unit_clients enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='unit_clients' and policyname='unit_clients_read_all') then
    create policy unit_clients_read_all on public.unit_clients for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='unit_clients' and policyname='unit_clients_insert_all') then
    create policy unit_clients_insert_all on public.unit_clients for insert with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='unit_clients' and policyname='unit_clients_update_all') then
    create policy unit_clients_update_all on public.unit_clients for update using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='unit_clients' and policyname='unit_clients_delete_all') then
    create policy unit_clients_delete_all on public.unit_clients for delete using (true);
  end if;
end$$;
