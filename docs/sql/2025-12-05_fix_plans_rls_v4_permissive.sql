-- Fix plans RLS to match application pattern (Permissive Anon Access)

alter table public.plans enable row level security;

-- Drop previous policies
drop policy if exists "Super Admins can manage plans" on public.plans;
drop policy if exists "Authenticated users can view active plans" on public.plans;
drop policy if exists "Debug Access" on public.plans;

-- Create Permissive Policies matching 'units' table pattern
create policy "Allow anon select access to plans" on public.plans for select using (true);
create policy "Allow anon insert access to plans" on public.plans for insert with check (true);
create policy "Allow anon update access to plans" on public.plans for update using (true) with check (true);
create policy "Allow anon delete access to plans" on public.plans for delete using (true);
