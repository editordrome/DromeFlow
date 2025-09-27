-- Recrutadora: histórico de alterações
-- Cria a tabela de logs, trigger e função para registrar alterações automaticamente

-- 1) Tabela de logs
create table if not exists public.recrutadora_logs (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  card_id integer not null references public.recrutadora(id) on delete cascade,
  action text,
  details text
);

-- Índice para consultas por card e ordenação por data
create index if not exists recrutadora_logs_card_created_at_idx
  on public.recrutadora_logs (card_id, created_at desc);

-- 2) Função de trigger para registrar alterações
create or replace function public.recrutadora_log_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  diff jsonb := '{}'::jsonb;
  k text;
  v_old jsonb;
  v_new jsonb;
  act text := null;
begin
  if tg_op = 'INSERT' then
    act := 'create';
    insert into public.recrutadora_logs(card_id, action, details)
    values (new.id, act, json_build_object('status', new.status, 'nome', new.nome)::text);
    return new;
  elsif tg_op = 'UPDATE' then
    -- monta json apenas com campos alterados: { campo: [old, new], ... }
    for k, v_new in select key, value from jsonb_each(to_jsonb(new)) loop
      v_old := to_jsonb(old)->k;
      if v_new is distinct from v_old then
        if k in ('created_at') then
          continue;
        end if;
        diff := diff || jsonb_build_object(k, jsonb_build_array(v_old, v_new));
      end if;
    end loop;

    if coalesce(old.status, '') is distinct from coalesce(new.status, '') or coalesce(old.position, -1) is distinct from coalesce(new.position, -1) then
      act := 'move';
    else
      act := 'update';
    end if;

    insert into public.recrutadora_logs(card_id, action, details)
    values (new.id, act, nullif(diff::text, '{}'));
    return new;
  elsif tg_op = 'DELETE' then
    act := 'delete';
    insert into public.recrutadora_logs(card_id, action, details)
    values (old.id, act, null);
    return old;
  end if;
  return null;
end;
$$;

-- 3) Trigger na tabela principal
create trigger recrutadora_log_trg
after insert or update or delete on public.recrutadora
for each row execute function public.recrutadora_log_changes();

-- Observações:
-- - O campo details armazena um JSON como texto com os campos alterados, no formato
--   { "campo": [valor_antigo, valor_novo], ... }
-- - A ação será 'create', 'update', 'move' (quando status/position mudam) ou 'delete'.
-- - Caso RLS esteja ativado no seu projeto, ajuste as políticas para permitir SELECT na tabela de logs conforme necessário.

-- 4) RLS na tabela de logs (recomendado)
alter table if exists public.recrutadora_logs enable row level security;

-- Remover políticas antigas (se existirem)
drop policy if exists recrutadora_logs_select_authenticated on public.recrutadora_logs;
drop policy if exists recrutadora_logs_select_anon on public.recrutadora_logs;

-- Policies de leitura: espelham acesso ao card (se o usuário consegue "ver" o card, consegue ver os logs dele)
create policy recrutadora_logs_select_authenticated
on public.recrutadora_logs
for select
to authenticated
using (
  exists (
    select 1 from public.recrutadora r
    where r.id = recrutadora_logs.card_id
  )
);

create policy recrutadora_logs_select_anon
on public.recrutadora_logs
for select
to anon
using (
  exists (
    select 1 from public.recrutadora r
    where r.id = recrutadora_logs.card_id
  )
);
