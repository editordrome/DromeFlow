-- Add due_day and payment_type to unit_plans

alter table public.unit_plans 
add column if not exists due_day integer check (due_day >= 1 and due_day <= 31),
add column if not exists payment_type text check (payment_type in ('pix', 'credit_card')),
add column if not exists parent_unit_id uuid references public.units(id);
