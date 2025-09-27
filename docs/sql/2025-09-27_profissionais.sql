-- Criação da tabela profissionais e sincronização com a tabela recrutadora
-- Observação: esta migração foi aplicada via MCP (Supabase). Mantemos o script aqui para versionamento.

-- Extensões necessárias
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- Tabela profissionais (espelha registros "ativos" da recrutadora)
create table if not exists public.profissionais (
  id uuid primary key default gen_random_uuid(),
  recrutadora_id bigint unique,
  unit_id text,
  unidade text,
  nome text,
  cpf text,
  rg text,
  tipo text,
  primeiro_atendimento date,
  habilidade text,
  preferencia text,
  status text,
  whatsapp text,
  estado_civil text,
  filhos text,
  qto_filhos text,
  rotina_filhos text,
  endereco text,
  data_nasc text,
  nome_recado text,
  tel_recado text,
  data_cadastro date,
  data_ativo date,
  medo_pet text,
  motivo_inativar text,
  observacao text,
  dias_livres text,
  dias_semana text,
  fumante text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Índices
create index if not exists profissionais_unidade_idx on public.profissionais (unidade);
create index if not exists profissionais_unit_id_idx on public.profissionais (unit_id);
create index if not exists profissionais_status_idx on public.profissionais (status);
create index if not exists profissionais_nome_trgm_idx on public.profissionais using gin (nome gin_trgm_ops);

-- Função de atualização do updated_at
create or replace function public.set_timestamp_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_timestamp_updated_at on public.profissionais;
create trigger set_timestamp_updated_at before update on public.profissionais for each row execute function public.set_timestamp_updated_at();

-- Função de sync da recrutadora -> profissionais (quando status contém "ativo")
create or replace function public.sync_recrutadora_to_profissionais()
returns trigger as $$
declare
  v_status text := coalesce(new.status, '');
  v_data_ativo date := now()::date;
begin
  if v_status ilike '%ativo%' then
    insert into public.profissionais as p (
      recrutadora_id, unit_id, unidade,
      nome, cpf, rg,
      tipo, primeiro_atendimento, habilidade, preferencia,
      status, whatsapp, estado_civil, filhos, qto_filhos, rotina_filhos,
      endereco, data_nasc, nome_recado, tel_recado, data_cadastro, data_ativo,
      medo_pet, motivo_inativar, observacao, dias_livres, dias_semana, fumante
    ) values (
      new.id, new.unit_id, new.unidade,
      new.nome, new.cpf, new.rg,
      null, null, null, null,
      new.status, new.whatsapp, new.estado_civil, new.filhos, new.qto_filhos, new.rotina_filhos,
      new."endereço", new.data_nasc, null, null, (new.created_at)::date, v_data_ativo,
      null, null, new.observacao, new.dias_livres, new.dias_semana, new.fumante
    )
    on conflict (recrutadora_id) do update set
      unit_id = excluded.unit_id,
      unidade = excluded.unidade,
      nome = excluded.nome,
      cpf = excluded.cpf,
      rg = excluded.rg,
      status = excluded.status,
      whatsapp = excluded.whatsapp,
      estado_civil = excluded.estado_civil,
      filhos = excluded.filhos,
      qto_filhos = excluded.qto_filhos,
      rotina_filhos = excluded.rotina_filhos,
      endereco = excluded.endereco,
      data_nasc = excluded.data_nasc,
      data_cadastro = excluded.data_cadastro,
      data_ativo = coalesce(p.data_ativo, excluded.data_ativo),
      observacao = excluded.observacao,
      dias_livres = excluded.dias_livres,
      dias_semana = excluded.dias_semana,
      fumante = excluded.fumante;
  else
    update public.profissionais p
      set status = new.status
      where p.recrutadora_id = new.id;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- Trigger na tabela recrutadora (somente colunas conhecidas)
drop trigger if exists trg_sync_recrutadora_to_profissionais on public.recrutadora;
create trigger trg_sync_recrutadora_to_profissionais
  after insert or update of status, unit_id, unidade, nome, cpf, rg, whatsapp,
  estado_civil, filhos, qto_filhos, rotina_filhos, "endereço", data_nasc, created_at, observacao,
  dias_livres, dias_semana, fumante
on public.recrutadora
for each row execute function public.sync_recrutadora_to_profissionais();

-- RLS básico
alter table public.profissionais enable row level security;
drop policy if exists profissionais_read on public.profissionais;
drop policy if exists profissionais_write on public.profissionais;
drop policy if exists profissionais_update on public.profissionais;

create policy profissionais_read on public.profissionais for select to authenticated using (true);
create policy profissionais_write on public.profissionais for insert to authenticated with check (true);
create policy profissionais_update on public.profissionais for update to authenticated using (true) with check (true);
