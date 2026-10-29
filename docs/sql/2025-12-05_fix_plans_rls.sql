-- Fix RLS policies for plans table to allow Super Admin insertion

alter table public.plans enable row level security;

-- 1. Policy for Super Admins (Full Access)
drop policy if exists "Super Admins can manage plans" on public.plans;
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

-- 2. Policy for Authenticated Users (Read Only, Active Plans)
drop policy if exists "Authenticated users can view active plans" on public.plans;
create policy "Authenticated users can view active plans" on public.plans
for select
using (
  status = true
);
