-- Clean up duplicate and fix RLS policies for plans table

alter table public.plans enable row level security;

-- Drop potentially duplicate policies (casing differences)
drop policy if exists "Super admins can manage plans" on public.plans;
drop policy if exists "Super Admins can manage plans" on public.plans;
drop policy if exists "Authenticated users can view active plans" on public.plans;

-- 1. Create Policy for Super Admins (Full Access)
create policy "Super Admins can manage plans" on public.plans
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

-- 2. Create Policy for Authenticated Users (Read Only, Active Plans)
create policy "Authenticated users can view active plans" on public.plans
for select
using (
  status = true
);
