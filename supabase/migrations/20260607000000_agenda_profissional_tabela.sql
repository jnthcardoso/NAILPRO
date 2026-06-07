-- Agenda própria da profissional (manicure): Google Agenda dela + link público próprio.
--
-- Por que tabela separada (e não na `configuracoes`): várias telas leem `configuracoes`
-- por salao_id esperando UMA linha (a da dona). Criar linha por manicure ali quebraria
-- essas leituras. Isolando aqui, nada do salão é afetado.
--
-- Uma linha por membro (manicure). Guarda: link público (slug), se está ativa,
-- horários/dias/serviços/whatsapp dela e se conectou o Google Agenda.

create table if not exists public.agenda_profissional (
  membro_id            uuid primary key references public.salao_membros(id) on delete cascade,
  user_id              uuid not null references auth.users(id) on delete cascade,
  salao_id             uuid not null references public.saloes(id) on delete cascade,
  slug                 text unique,
  nome_exibicao        text,
  whatsapp             text,
  agenda_publica_ativa boolean not null default false,
  horario_inicio       time not null default '09:00',
  horario_fim          time not null default '18:00',
  duracao_atendimento  int  not null default 60,
  dias_semana          int[] not null default '{1,2,3,4,5}',
  servicos_padrao      text[] not null default '{}',
  google_conectado     boolean not null default false,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);
create index if not exists idx_agenda_prof_salao on public.agenda_profissional(salao_id);
create index if not exists idx_agenda_prof_user  on public.agenda_profissional(user_id);

alter table public.agenda_profissional enable row level security;

-- A própria manicure lê/gerencia a linha dela; dona/recepcionista enxergam as do salão.
drop policy if exists agenda_prof_select on public.agenda_profissional;
create policy agenda_prof_select on public.agenda_profissional for select
  using (user_id = auth.uid() or salao_id = public.meu_salao_id());

drop policy if exists agenda_prof_insert on public.agenda_profissional;
create policy agenda_prof_insert on public.agenda_profissional for insert
  with check (user_id = auth.uid() and salao_id = public.meu_salao_id() and membro_id = public.meu_membro_id());

drop policy if exists agenda_prof_update on public.agenda_profissional;
create policy agenda_prof_update on public.agenda_profissional for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Público (anon) lê só pelo link, e só se a agenda dela estiver ativa.
drop policy if exists "anon read agenda_profissional by slug" on public.agenda_profissional;
create policy "anon read agenda_profissional by slug" on public.agenda_profissional for select
  to anon
  using (slug is not null and agenda_publica_ativa = true);
