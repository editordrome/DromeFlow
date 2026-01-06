-- Fix RLS policies for plans table (V3)

alter table public.plans enable row level security;

-- Cleanup potential duplicates
drop policy if exists "Super admins can manage plans" on public.plans;
drop policy if exists "Super Admins can manage plans" on public.plans;
drop policy if exists "Authenticated users can view active plans" on public.plans;

-- 1. Create Policy for Super Admins (Full Access) using security definer function
create policy "Super Admins can manage plans" on public.plans
for all
using (
  public.is_super_admin()
)
with check (
  public.is_super_admin()
);

-- 2. Create Policy for Authenticated Users (Read Only, Active Plans)
create policy "Authenticated users can view active plans" on public.plans
for select
using (
  status = true
);
