-- Fix unit_plans and unit_payments RLS to match application pattern (Permissive Anon Access)

-- 1. unit_plans
alter table public.unit_plans enable row level security;

-- Drop previous policies
drop policy if exists "unit_plans_sa_full" on public.unit_plans;
drop policy if exists "unit_plans_read_own_unit" on public.unit_plans;

-- Create Permissive Policies
create policy "Allow anon select access to unit_plans" on public.unit_plans for select using (true);
create policy "Allow anon insert access to unit_plans" on public.unit_plans for insert with check (true);
create policy "Allow anon update access to unit_plans" on public.unit_plans for update using (true) with check (true);
create policy "Allow anon delete access to unit_plans" on public.unit_plans for delete using (true);


-- 2. unit_payments
alter table public.unit_payments enable row level security;

-- Drop previous policies
drop policy if exists "unit_payments_sa_full" on public.unit_payments;
drop policy if exists "unit_payments_read_own_unit" on public.unit_payments;

-- Create Permissive Policies
create policy "Allow anon select access to unit_payments" on public.unit_payments for select using (true);
create policy "Allow anon insert access to unit_payments" on public.unit_payments for insert with check (true);
create policy "Allow anon update access to unit_payments" on public.unit_payments for update using (true) with check (true);
create policy "Allow anon delete access to unit_payments" on public.unit_payments for delete using (true);
