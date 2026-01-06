-- Debug RLS policies for plans table

alter table public.plans enable row level security;

-- 1. Create Permissive Policy
create policy "Debug Access" on public.plans
for all
using (true)
with check (true);
