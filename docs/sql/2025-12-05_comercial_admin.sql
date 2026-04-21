-- Commercial Admin module tables (Super Admin only)
-- Creates tables for B2B opportunities with plan tracking

-- 1) Main table for commercial admin opportunities
create table if not exists public.comercial_admin (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  nome text not null,
  endereco text,
  contato text,
  origem text,
  status text not null default 'leads',
  observacao text,
  plano_id uuid references public.plans(id) on delete set null,
  data_inicio_teste date,
  data_fim_teste date,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  constraint comercial_admin_status_check 
    check (status = any (array['leads','andamento','ganhos','perdidos'])),
    
  constraint comercial_admin_teste_dates_check
    check (data_fim_teste is null or data_inicio_teste is null or data_fim_teste >= data_inicio_teste)
);

-- Index optimization
create index if not exists comercial_admin_unit_id_idx on public.comercial_admin(unit_id);
create index if not exists comercial_admin_plano_id_idx on public.comercial_admin(plano_id);

-- Prevent duplicates per unit
create unique index if not exists comercial_admin_unique_name_per_unit 
on public.comercial_admin (unit_id, lower(trim(nome)));

-- Trigger for updated_at
create trigger set_comercial_admin_updated_at
before update on public.comercial_admin
for each row execute function public.set_timestamp_updated_at();

-- RLS Policies (Super Admin Only)
alter table public.comercial_admin enable row level security;

create policy comercial_admin_all_restricted on public.comercial_admin
as permissive
for all
using (
  exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'super_admin'
  )
)
with check (
  exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'super_admin'
  )
);

-- 2) Metadata table for kanban columns
create table if not exists public.comercial_admin_columns (
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
  constraint comercial_admin_columns_unique_code unique (unit_id, code)
);

create index if not exists comercial_admin_columns_unit_id_idx on public.comercial_admin_columns(unit_id);

-- Trigger for updated_at (columns)
create trigger set_comercial_admin_columns_updated_at
before update on public.comercial_admin_columns
for each row execute function public.set_timestamp_updated_at();

-- RLS Policies for Columns
alter table public.comercial_admin_columns enable row level security;

create policy comercial_admin_columns_all_restricted on public.comercial_admin_columns
as permissive
for all
using (
  exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'super_admin'
  )
)
with check (
  exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'super_admin'
  )
);

-- Initial default columns (Global)
insert into public.comercial_admin_columns (unit_id, code, name, position)
values 
  (null, 'leads', 'Leads', 1),
  (null, 'andamento', 'Em Andamento', 2),
  (null, 'ganhos', 'Ganhos', 3),
  (null, 'perdidos', 'Perdidos', 4)
on conflict (unit_id, code) do nothing;

-- 3) Register Module
-- Insert the new module into the modules table if it doesn't exist
insert into public.modules (code, name, allowed_profiles, position, icon, view_id, is_active, parent_id)
values (
  'comercial_admin',
  'Comercial Admin',
  array['super_admin'],
  100,
  'Building2',
  'comercial_admin',
  true,
  null
)
on conflict (code) do update
set 
  allowed_profiles = excluded.allowed_profiles;

-- 4) Sync 'ganhos' to unit_clients (Optional - similar to main commercial module)
create or replace function public.comercial_admin_sync_unit_clients()
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

  -- Insert into unit_clients
  -- Map 'plan' info to 'observacao' or just client info
  insert into public.unit_clients (unit_id, nome, endereco, contato, tipo)
  values (new.unit_id, new.nome, new.endereco, new.contato, 'B2B')
  on conflict (unit_id, lower(trim(nome))) do update
    set endereco = excluded.endereco,
        contato = excluded.contato,
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists comercial_admin_sync_unit_clients_trg on public.comercial_admin;
create trigger comercial_admin_sync_unit_clients_trg
after insert or update on public.comercial_admin
for each row execute function public.comercial_admin_sync_unit_clients();
