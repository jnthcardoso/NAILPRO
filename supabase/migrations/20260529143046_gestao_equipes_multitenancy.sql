-- ============================================================
-- FASE 1: Multi-tenancy / Gestão de equipes (idempotente)
-- ============================================================

create table if not exists public.saloes (
  id uuid primary key default gen_random_uuid(),
  nome text not null default 'Meu Salão',
  dona_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);
alter table public.saloes enable row level security;

create table if not exists public.salao_membros (
  id uuid primary key default gen_random_uuid(),
  salao_id uuid not null references public.saloes(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  nome text not null default '',
  email text,
  papel text not null default 'profissional'
    check (papel in ('dona','recepcionista','profissional')),
  ativo boolean not null default true,
  created_at timestamptz default now(),
  unique (salao_id, user_id)
);
alter table public.salao_membros enable row level security;
create index if not exists idx_salao_membros_salao on public.salao_membros(salao_id);
create index if not exists idx_salao_membros_user on public.salao_membros(user_id);

alter table public.clientes      add column if not exists salao_id uuid references public.saloes(id) on delete cascade;
alter table public.agendamentos  add column if not exists salao_id uuid references public.saloes(id) on delete cascade;
alter table public.agendamentos  add column if not exists profissional_id uuid references public.salao_membros(id) on delete set null;
alter table public.pagamentos    add column if not exists salao_id uuid references public.saloes(id) on delete cascade;
alter table public.despesas      add column if not exists salao_id uuid references public.saloes(id) on delete cascade;
alter table public.metas         add column if not exists salao_id uuid references public.saloes(id) on delete cascade;
alter table public.configuracoes add column if not exists salao_id uuid references public.saloes(id) on delete cascade;
alter table public.assinaturas   add column if not exists salao_id uuid references public.saloes(id) on delete cascade;
alter table public.assinaturas   add column if not exists licencas_adicionais integer not null default 0;

insert into public.saloes (nome, dona_user_id)
select coalesce(nullif(trim(c.nome_salao), ''), 'Meu Salão'), c.user_id
from public.configuracoes c
where not exists (select 1 from public.saloes s where s.dona_user_id = c.user_id);

insert into public.saloes (nome, dona_user_id)
select 'Meu Salão', a.user_id
from public.assinaturas a
where not exists (select 1 from public.saloes s where s.dona_user_id = a.user_id);

insert into public.salao_membros (salao_id, user_id, nome, papel)
select s.id, s.dona_user_id, coalesce(nullif(trim(s.nome), ''), 'Dona'), 'dona'
from public.saloes s
where not exists (
  select 1 from public.salao_membros m where m.salao_id = s.id and m.user_id = s.dona_user_id
);

update public.clientes      t set salao_id = s.id from public.saloes s where s.dona_user_id = t.user_id and t.salao_id is null;
update public.agendamentos  t set salao_id = s.id from public.saloes s where s.dona_user_id = t.user_id and t.salao_id is null;
update public.pagamentos    t set salao_id = s.id from public.saloes s where s.dona_user_id = t.user_id and t.salao_id is null;
update public.despesas      t set salao_id = s.id from public.saloes s where s.dona_user_id = t.user_id and t.salao_id is null;
update public.metas         t set salao_id = s.id from public.saloes s where s.dona_user_id = t.user_id and t.salao_id is null;
update public.configuracoes t set salao_id = s.id from public.saloes s where s.dona_user_id = t.user_id and t.salao_id is null;
update public.assinaturas   t set salao_id = s.id from public.saloes s where s.dona_user_id = t.user_id and t.salao_id is null;

update public.agendamentos a
set profissional_id = m.id
from public.salao_membros m
where m.salao_id = a.salao_id and m.papel = 'dona' and a.profissional_id is null;

create or replace function public.meu_salao_id()
returns uuid language sql stable security definer set search_path = public as $$
  select salao_id from public.salao_membros where user_id = auth.uid() and ativo = true limit 1;
$$;
create or replace function public.meu_membro_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.salao_membros where user_id = auth.uid() and ativo = true limit 1;
$$;
create or replace function public.meu_papel()
returns text language sql stable security definer set search_path = public as $$
  select papel from public.salao_membros where user_id = auth.uid() and ativo = true limit 1;
$$;

do $$
declare r record;
begin
  for r in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in ('clientes','agendamentos','pagamentos','despesas','metas')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

create policy clientes_salao_select on public.clientes for select using (salao_id = public.meu_salao_id());
create policy clientes_salao_insert on public.clientes for insert with check (salao_id = public.meu_salao_id());
create policy clientes_salao_update on public.clientes for update using (salao_id = public.meu_salao_id()) with check (salao_id = public.meu_salao_id());
create policy clientes_salao_delete on public.clientes for delete using (salao_id = public.meu_salao_id() and public.meu_papel() in ('dona','recepcionista'));

create policy agendamentos_salao_select on public.agendamentos for select
  using (salao_id = public.meu_salao_id() and (public.meu_papel() in ('dona','recepcionista') or profissional_id = public.meu_membro_id()));
create policy agendamentos_salao_insert on public.agendamentos for insert
  with check (salao_id = public.meu_salao_id() and (public.meu_papel() in ('dona','recepcionista') or profissional_id = public.meu_membro_id()));
create policy agendamentos_salao_update on public.agendamentos for update
  using (salao_id = public.meu_salao_id() and (public.meu_papel() in ('dona','recepcionista') or profissional_id = public.meu_membro_id()))
  with check (salao_id = public.meu_salao_id() and (public.meu_papel() in ('dona','recepcionista') or profissional_id = public.meu_membro_id()));
create policy agendamentos_salao_delete on public.agendamentos for delete
  using (salao_id = public.meu_salao_id() and (public.meu_papel() in ('dona','recepcionista') or profissional_id = public.meu_membro_id()));

create policy pagamentos_salao_select on public.pagamentos for select
  using (salao_id = public.meu_salao_id() and (public.meu_papel() in ('dona','recepcionista')
    or agendamento_id in (select id from public.agendamentos where profissional_id = public.meu_membro_id())));
create policy pagamentos_salao_insert on public.pagamentos for insert
  with check (salao_id = public.meu_salao_id() and (public.meu_papel() in ('dona','recepcionista')
    or agendamento_id in (select id from public.agendamentos where profissional_id = public.meu_membro_id())));
create policy pagamentos_salao_update on public.pagamentos for update
  using (salao_id = public.meu_salao_id() and (public.meu_papel() in ('dona','recepcionista')
    or agendamento_id in (select id from public.agendamentos where profissional_id = public.meu_membro_id())))
  with check (salao_id = public.meu_salao_id());
create policy pagamentos_salao_delete on public.pagamentos for delete
  using (salao_id = public.meu_salao_id() and public.meu_papel() in ('dona','recepcionista'));

create policy despesas_salao_all on public.despesas for all
  using (salao_id = public.meu_salao_id() and public.meu_papel() in ('dona','recepcionista'))
  with check (salao_id = public.meu_salao_id() and public.meu_papel() in ('dona','recepcionista'));

create policy metas_salao_all on public.metas for all
  using (salao_id = public.meu_salao_id() and public.meu_papel() in ('dona','recepcionista'))
  with check (salao_id = public.meu_salao_id() and public.meu_papel() in ('dona','recepcionista'));

drop policy if exists "users can manage own config" on public.configuracoes;
create policy config_salao_select on public.configuracoes for select using (salao_id = public.meu_salao_id());
create policy config_salao_update on public.configuracoes for update
  using (salao_id = public.meu_salao_id() and public.meu_papel() in ('dona','recepcionista'))
  with check (salao_id = public.meu_salao_id() and public.meu_papel() in ('dona','recepcionista'));
create policy config_salao_insert on public.configuracoes for insert
  with check (salao_id = public.meu_salao_id() and public.meu_papel() in ('dona','recepcionista'));

drop policy if exists "users can read own subscription" on public.assinaturas;
create policy assinatura_salao_select on public.assinaturas for select using (salao_id = public.meu_salao_id());

create policy saloes_select on public.saloes for select using (id = public.meu_salao_id());
create policy saloes_update on public.saloes for update
  using (id = public.meu_salao_id() and public.meu_papel() = 'dona')
  with check (id = public.meu_salao_id() and public.meu_papel() = 'dona');

create policy membros_select on public.salao_membros for select using (salao_id = public.meu_salao_id());
create policy membros_insert on public.salao_membros for insert with check (salao_id = public.meu_salao_id() and public.meu_papel() = 'dona');
create policy membros_update on public.salao_membros for update
  using (salao_id = public.meu_salao_id() and public.meu_papel() = 'dona')
  with check (salao_id = public.meu_salao_id() and public.meu_papel() = 'dona');
create policy membros_delete on public.salao_membros for delete using (salao_id = public.meu_salao_id() and public.meu_papel() = 'dona');

drop trigger if exists on_auth_user_created_configuracoes on auth.users;
drop trigger if exists on_auth_user_created_assinatura on auth.users;
drop trigger if exists on_auth_user_created_completo on auth.users;

create or replace function public.handle_new_user_completo()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_salao_id uuid;
begin
  insert into public.saloes (nome, dona_user_id) values ('Meu Salão', NEW.id) returning id into v_salao_id;
  insert into public.salao_membros (salao_id, user_id, nome, email, papel) values (v_salao_id, NEW.id, 'Dona', NEW.email, 'dona');
  insert into public.configuracoes (user_id, salao_id, onboarding_completo) values (NEW.id, v_salao_id, false) on conflict (user_id) do nothing;
  insert into public.assinaturas (user_id, salao_id, plano, status, trial_inicia_em, trial_termina_em)
    values (NEW.id, v_salao_id, 'pro', 'trialing', now(), now() + interval '14 days') on conflict (user_id) do nothing;
  return NEW;
end;
$$;

create trigger on_auth_user_created_completo after insert on auth.users for each row execute function public.handle_new_user_completo();

drop function if exists public.agenda_publica_criar_agendamento(text,text,text,text,date,time without time zone,text);
create function public.agenda_publica_criar_agendamento(
  p_slug text, p_cliente_nome text, p_cliente_telefone text,
  p_servico text, p_data date, p_horario time without time zone, p_observacoes text)
returns uuid language plpgsql security definer set search_path = public as $$
DECLARE
  v_user_id UUID; v_salao_id UUID; v_cliente_id UUID; v_agendamento_id UUID;
BEGIN
  SELECT user_id, salao_id INTO v_user_id, v_salao_id
  FROM public.configuracoes WHERE slug = p_slug AND agenda_publica_ativa = true LIMIT 1;
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'agenda nao encontrada ou inativa'; END IF;
  IF p_cliente_nome IS NULL OR LENGTH(TRIM(p_cliente_nome)) < 2 THEN RAISE EXCEPTION 'nome invalido'; END IF;
  IF p_data < CURRENT_DATE THEN RAISE EXCEPTION 'data nao pode estar no passado'; END IF;
  SELECT id INTO v_cliente_id FROM public.clientes WHERE salao_id = v_salao_id AND telefone = p_cliente_telefone LIMIT 1;
  IF v_cliente_id IS NULL THEN
    INSERT INTO public.clientes (user_id, salao_id, nome, telefone) VALUES (v_user_id, v_salao_id, p_cliente_nome, p_cliente_telefone) RETURNING id INTO v_cliente_id;
  END IF;
  INSERT INTO public.agendamentos (user_id, salao_id, cliente_id, servico, data, horario, status, observacoes)
  VALUES (v_user_id, v_salao_id, v_cliente_id, p_servico, p_data, p_horario, 'pendente', p_observacoes) RETURNING id INTO v_agendamento_id;
  RETURN v_agendamento_id;
END;
$$;
