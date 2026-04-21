-- Unit Plans & Payments
-- Connects units to plans and tracks monthly payments

-- 1) Link table: Unit -> Plan
create table if not exists public.unit_plans (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  plan_id uuid not null references public.plans(id) on delete restrict,
  start_date date not null,
  end_date date,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  constraint unit_plans_status_check 
    check (status = any (array['active', 'inactive', 'cancelled'])),
    
  constraint unit_plans_dates_check
    check (end_date is null or end_date >= start_date)
);

create index if not exists unit_plans_unit_id_idx on public.unit_plans(unit_id);
-- Ensure only one active plan per unit? Maybe not strict unique, but app logic should handle.
-- For now, allowing history, but status='active' should be managed carefully.

create trigger set_unit_plans_updated_at
before update on public.unit_plans
for each row execute function public.set_timestamp_updated_at();

-- RLS for unit_plans
alter table public.unit_plans enable row level security;

-- Super admin fully manages, others might view
create policy unit_plans_sa_full on public.unit_plans
as permissive
for all
using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'super_admin')
)
with check (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'super_admin')
);

create policy unit_plans_read_own_unit on public.unit_plans
as permissive
for select
using (
  exists (
    select 1 from public.user_units 
    where user_id = auth.uid() and unit_id = public.unit_plans.unit_id
  )
);

-- 2) Payments table
create table if not exists public.unit_payments (
  id uuid primary key default gen_random_uuid(),
  unit_plan_id uuid not null references public.unit_plans(id) on delete cascade,
  reference_date date not null, -- 1st day of the month (e.g., 2025-01-01)
  amount decimal(10,2) not null default 0,
  status text not null default 'pending',
  payment_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  constraint unit_payments_status_check
    check (status = any (array['pending', 'paid', 'overdue', 'cancelled']))
);

create index if not exists unit_payments_plan_idx on public.unit_payments(unit_plan_id);
create unique index if not exists unit_payments_unique_month 
on public.unit_payments(unit_plan_id, reference_date);

create trigger set_unit_payments_updated_at
before update on public.unit_payments
for each row execute function public.set_timestamp_updated_at();

-- RLS for unit_payments
alter table public.unit_payments enable row level security;

create policy unit_payments_sa_full on public.unit_payments
as permissive
for all
using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'super_admin')
)
with check (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'super_admin')
);

-- Users can read their own unit's payments
create policy unit_payments_read_own_unit on public.unit_payments
as permissive
for select
using (
  exists (
    select 1 from public.unit_plans up
    join public.user_units cu on cu.unit_id = up.unit_id
    where up.id = public.unit_payments.unit_plan_id
    and cu.user_id = auth.uid()
  )
);
