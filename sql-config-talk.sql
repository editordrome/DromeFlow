-- ============
-- UTALK: INTEGRAÇÃO POR UNIDADE
-- ============

create table if not exists public.utalk_integrations (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,

  -- organizationId exigido em várias chamadas da API
  organization_id text not null,

  -- token Bearer guardado via FK para access_credentials (reuso do seu padrão)
  access_credential_id uuid not null references public.access_credentials(id) on delete restrict,

  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(unit_id)
);

create index if not exists idx_utalk_integrations_unit on public.utalk_integrations(unit_id);


-- ============
-- UTALK: USER MAP
-- ============

create table if not exists public.utalk_user_map (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,

  -- usuário interno do seu sistema (compatível com seu schema atual)
  profile_id uuid not null references public.profiles(id) on delete cascade,

  -- ID do membro/agente no uTalk (da API /members)
  utalk_member_id text not null,
  utalk_member_email text,
  is_active boolean not null default true,

  created_at timestamptz not null default now(),

  unique(unit_id, profile_id),
  unique(unit_id, utalk_member_id)
);

create index if not exists idx_utalk_user_map_unit_profile on public.utalk_user_map(unit_id, profile_id);
create index if not exists idx_utalk_user_map_unit_member on public.utalk_user_map(unit_id, utalk_member_id);


-- ============
-- UTALK: CHATS (INBOX)
-- ============

create table if not exists public.utalk_chats (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,

  utalk_chat_id text not null,

  -- Quem está atribuído no uTalk (member_id)
  assigned_to_member_id text,

  status text,
  last_message_at timestamptz,
  last_message_preview text,

  -- carimbo local
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(unit_id, utalk_chat_id)
);

create index if not exists idx_utalk_chats_unit_assignee on public.utalk_chats(unit_id, assigned_to_member_id, updated_at desc);
create index if not exists idx_utalk_chats_unit_updated on public.utalk_chats(unit_id, updated_at desc);



-- ============
-- UTALK: MESSAGES
-- ============

create table if not exists public.utalk_messages (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,

  utalk_chat_id text not null,
  utalk_message_id text,

  direction text check (direction in ('in','out','system')) default 'in',
  body text,

  created_at timestamptz not null default now(),

  unique(unit_id, utalk_message_id)
);

create index if not exists idx_utalk_messages_unit_chat on public.utalk_messages(unit_id, utalk_chat_id, created_at desc);


-- ============
-- UTALK: WEBHOOK EVENTS (QUEUE)
-- ============

create table if not exists public.utalk_webhook_events (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,

  -- chave única por evento (se o uTalk não mandar, você cria uma composta no receiver)
  event_key text not null,

  payload jsonb not null,

  status text not null default 'pending'
    check (status in ('pending','processed','failed')),

  tries int not null default 0,
  last_error text,

  created_at timestamptz not null default now(),
  processed_at timestamptz,

  unique(unit_id, event_key)
);

create index if not exists idx_utalk_events_status_created on public.utalk_webhook_events(status, created_at asc);


-- ============
-- VIEW: MINHAS CONVERSAS POR PROFILE
-- ============
create or replace view public.v_utalk_my_chats as
select
  c.*,
  m.profile_id
from public.utalk_chats c
join public.utalk_user_map m
  on m.unit_id = c.unit_id
 and m.utalk_member_id = c.assigned_to_member_id
where m.is_active = true;


VERSAO 2

-- =========================
-- V2: UTALK MODULE + RLS (Supabase Auth)
-- =========================

-- 0) LINK: profiles <-> auth.users
-- Adiciona coluna para ligar usuário autenticado ao profile interno
alter table public.profiles
  add column if not exists auth_user_id uuid;

-- Um auth_user_id não pode se repetir
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_auth_user_id_unique'
  ) then
    alter table public.profiles
      add constraint profiles_auth_user_id_unique unique (auth_user_id);
  end if;
end$$;

create index if not exists idx_profiles_auth_user_id
  on public.profiles(auth_user_id);

-- 1) UTALK TABLES

-- 1.1) Integração por unidade (token via access_credentials)
create table if not exists public.utalk_integrations (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  organization_id text not null,
  access_credential_id uuid not null references public.access_credentials(id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(unit_id)
);

create index if not exists idx_utalk_integrations_unit
  on public.utalk_integrations(unit_id);

-- 1.2) Map usuário (profile) -> member (utalk) por unidade
create table if not exists public.utalk_user_map (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  utalk_member_id text not null,
  utalk_member_email text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(unit_id, profile_id),
  unique(unit_id, utalk_member_id)
);

create index if not exists idx_utalk_user_map_unit_profile
  on public.utalk_user_map(unit_id, profile_id);

create index if not exists idx_utalk_user_map_unit_member
  on public.utalk_user_map(unit_id, utalk_member_id);

-- 1.3) Espelho Inbox
create table if not exists public.utalk_chats (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  utalk_chat_id text not null,
  assigned_to_member_id text,
  status text,
  last_message_at timestamptz,
  last_message_preview text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(unit_id, utalk_chat_id)
);

create index if not exists idx_utalk_chats_unit_assignee
  on public.utalk_chats(unit_id, assigned_to_member_id, updated_at desc);

-- 1.4) Mensagens
create table if not exists public.utalk_messages (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  utalk_chat_id text not null,
  utalk_message_id text,
  direction text check (direction in ('in','out','system')) default 'in',
  body text,
  created_at timestamptz not null default now(),
  unique(unit_id, utalk_message_id)
);

create index if not exists idx_utalk_messages_unit_chat
  on public.utalk_messages(unit_id, utalk_chat_id, created_at desc);

-- 1.5) Webhook events (fila/idempotência) - deve ser só backend
create table if not exists public.utalk_webhook_events (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  event_key text not null,
  payload jsonb not null,
  status text not null default 'pending'
    check (status in ('pending','processed','failed')),
  tries int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  unique(unit_id, event_key)
);

create index if not exists idx_utalk_events_status_created
  on public.utalk_webhook_events(status, created_at asc);

-- 1.6) Contatos Vinculados (Cache local para tags e identificação)
create table if not exists public.utalk_contacts (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  utalk_contact_id text not null,
  name text,
  phone_number text,
  profile_picture_url text,
  tags jsonb default '[]'::jsonb,
  client_id uuid references public.unit_clients(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(unit_id, utalk_contact_id)
);

create index if not exists idx_utalk_contacts_unit_id on public.utalk_contacts(unit_id);
create index if not exists idx_utalk_contacts_phone on public.utalk_contacts(phone_number);

-- 1.7) RPC: Upsert de Contato com Tags
create or replace function public.upsert_utalk_contact(
  p_unit_id uuid,
  p_utalk_contact_id text,
  p_name text,
  p_phone_number text,
  p_profile_picture_url text,
  p_tags jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
as $$
begin
  insert into public.utalk_contacts (
    unit_id,
    utalk_contact_id,
    name,
    phone_number,
    profile_picture_url,
    tags,
    updated_at
  )
  values (
    p_unit_id,
    p_utalk_contact_id,
    p_name,
    p_phone_number,
    p_profile_picture_url,
    p_tags,
    now()
  )
  on conflict (unit_id, utalk_contact_id)
  do update set
    name = excluded.name,
    phone_number = excluded.phone_number,
    profile_picture_url = excluded.profile_picture_url,
    tags = excluded.tags,
    updated_at = now();
end;
$$;

-- 2) RLS ENABLE

alter table public.profiles enable row level security;
alter table public.user_units enable row level security;
alter table public.units enable row level security;

alter table public.access_credentials enable row level security;

alter table public.utalk_integrations enable row level security;
alter table public.utalk_user_map enable row level security;
alter table public.utalk_chats enable row level security;
alter table public.utalk_messages enable row level security;
alter table public.utalk_webhook_events enable row level security;

-- 3) HELPERS (inline via policies)
-- Mapeamento: auth.uid() -> profile.id
-- (feito via subqueries nas policies)

-- 4) POLICIES

-- 4.1) profiles: usuário pode ler/atualizar seu próprio profile (via auth_user_id)
drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own"
on public.profiles
for select
using (auth.uid() = auth_user_id);

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own"
on public.profiles
for update
using (auth.uid() = auth_user_id)
with check (auth.uid() = auth_user_id);

-- 4.2) units: usuário pode ver somente unidades onde ele está em user_units
drop policy if exists "units: read if member" on public.units;
create policy "units: read if member"
on public.units
for select
using (
  exists (
    select 1
    from public.user_units uu
    join public.profiles p on p.id = uu.user_id
    where uu.unit_id = units.id
      and p.auth_user_id = auth.uid()
  )
);

-- 4.3) user_units: usuário pode ver seus vínculos
-- (mantém o seu modelo atual: user_units.user_id = profiles.id)
drop policy if exists "user_units: read own memberships" on public.user_units;
create policy "user_units: read own memberships"
on public.user_units
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = user_units.user_id
      and p.auth_user_id = auth.uid()
  )
);

-- 4.4) access_credentials: por segurança, só admin/super_admin (global)
-- Como access_credentials não tem unit_id, restringimos pelo role do profile.
drop policy if exists "access_credentials: admin only" on public.access_credentials;
create policy "access_credentials: admin only"
on public.access_credentials
for all
using (
  exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and p.role in ('super_admin','admin')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and p.role in ('super_admin','admin')
  )
);

-- 4.5) utalk_integrations:
-- - Admin/super_admin da plataforma pode ler e gerenciar
-- - Usuário comum NÃO lê (para não expor credenciais/ids internos)
drop policy if exists "utalk_integrations: admin rw" on public.utalk_integrations;
create policy "utalk_integrations: admin rw"
on public.utalk_integrations
for all
using (
  exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and p.role in ('super_admin','admin')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and p.role in ('super_admin','admin')
  )
);

-- 4.6) utalk_user_map:
-- - usuário pode ler o próprio map (pra UI saber member_id dele)
-- - admin/super_admin pode criar/editar maps (pra habilitar só alguns)
drop policy if exists "utalk_user_map: user read own" on public.utalk_user_map;
create policy "utalk_user_map: user read own"
on public.utalk_user_map
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = utalk_user_map.profile_id
      and p.auth_user_id = auth.uid()
  )
);

drop policy if exists "utalk_user_map: admin write" on public.utalk_user_map;
create policy "utalk_user_map: admin write"
on public.utalk_user_map
for insert
with check (
  exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and p.role in ('super_admin','admin')
  )
);

drop policy if exists "utalk_user_map: admin update" on public.utalk_user_map;
create policy "utalk_user_map: admin update"
on public.utalk_user_map
for update
using (
  exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and p.role in ('super_admin','admin')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and p.role in ('super_admin','admin')
  )
);

drop policy if exists "utalk_user_map: admin delete" on public.utalk_user_map;
create policy "utalk_user_map: admin delete"
on public.utalk_user_map
for delete
using (
  exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and p.role in ('super_admin','admin')
  )
);

-- 4.7) utalk_chats:
-- usuário só vê chats atribuídos ao member_id dele na unidade
drop policy if exists "utalk_chats: read assigned only" on public.utalk_chats;
create policy "utalk_chats: read assigned only"
on public.utalk_chats
for select
using (
  exists (
    select 1
    from public.utalk_user_map m
    join public.profiles p on p.id = m.profile_id
    join public.user_units uu on uu.user_id = p.id and uu.unit_id = utalk_chats.unit_id
    where p.auth_user_id = auth.uid()
      and m.unit_id = utalk_chats.unit_id
      and m.is_active = true
      and m.utalk_member_id = utalk_chats.assigned_to_member_id
  )
);

-- writes (insert/update/delete) devem ser só backend/service_role
-- (não criamos policy de escrita aqui)

-- 4.8) utalk_messages:
-- usuário só vê mensagens de chats que ele pode ver
drop policy if exists "utalk_messages: read if chat allowed" on public.utalk_messages;
create policy "utalk_messages: read if chat allowed"
on public.utalk_messages
for select
using (
  exists (
    select 1
    from public.utalk_chats c
    where c.unit_id = utalk_messages.unit_id
      and c.utalk_chat_id = utalk_messages.utalk_chat_id
  )
  and
  exists (
    select 1
    from public.utalk_user_map m
    join public.profiles p on p.id = m.profile_id
    join public.user_units uu on uu.user_id = p.id and uu.unit_id = utalk_messages.unit_id
    where p.auth_user_id = auth.uid()
      and m.unit_id = utalk_messages.unit_id
      and m.is_active = true
      and m.utalk_member_id = (
        select c2.assigned_to_member_id
        from public.utalk_chats c2
        where c2.unit_id = utalk_messages.unit_id
          and c2.utalk_chat_id = utalk_messages.utalk_chat_id
        limit 1
      )
  )
);

-- 4.9) utalk_webhook_events:
-- Nenhuma policy: client NÃO acessa. Somente service_role (Edge Function) consegue.
-- (de propósito)

-- 5) VIEW opcional: Minhas conversas (usa RLS por baixo)
create or replace view public.v_utalk_my_chats as
select
  c.*,
  m.profile_id
from public.utalk_chats c
join public.utalk_user_map m
  on m.unit_id = c.unit_id
 and m.utalk_member_id = c.assigned_to_member_id
where m.is_active = true;