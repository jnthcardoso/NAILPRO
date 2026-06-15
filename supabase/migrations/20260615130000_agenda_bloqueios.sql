-- ============================================================================
-- Bloqueios de horário da agenda
-- ----------------------------------------------------------------------------
-- Permite à profissional/dona reservar tempo para compromissos pessoais (ou
-- marcar o dia inteiro como indisponível). Vale para a agenda interna e para o
-- link público: um horário/dia bloqueado some dos horários oferecidos no link.
--
-- Tabela NOVA e isolada (não mistura com `agendamentos`), então não afeta
-- financeiro, metas ou contadores de atendimentos. Risco baixo.
-- ============================================================================

create table if not exists public.agenda_bloqueios (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  salao_id        uuid not null references public.saloes(id) on delete cascade,
  -- NULL = bloqueio do salão inteiro; preenchido = só aquela profissional.
  profissional_id uuid references public.salao_membros(id) on delete cascade,
  data            date not null,
  dia_inteiro     boolean not null default false,
  horario_inicio  time,
  horario_fim     time,
  motivo          text,
  created_at      timestamptz default now(),
  constraint chk_bloqueio_horario check (
    dia_inteiro = true
    or (horario_inicio is not null and horario_fim is not null and horario_fim > horario_inicio)
  )
);

create index if not exists idx_agenda_bloqueios_lookup
  on public.agenda_bloqueios (salao_id, data);

alter table public.agenda_bloqueios enable row level security;

-- RLS espelha a de `agendamentos`: dona/recepção gerenciam tudo do salão;
-- profissional só os bloqueios dela (profissional_id = seu membro).
create policy "bloqueios_salao_select" on public.agenda_bloqueios for select
  using (
    salao_id = meu_salao_id()
    and (meu_papel() = any (array['dona','recepcionista']) or profissional_id = meu_membro_id())
  );

create policy "bloqueios_salao_insert" on public.agenda_bloqueios for insert
  with check (
    salao_id = meu_salao_id()
    and (meu_papel() = any (array['dona','recepcionista']) or profissional_id = meu_membro_id())
  );

create policy "bloqueios_salao_update" on public.agenda_bloqueios for update
  using (
    salao_id = meu_salao_id()
    and (meu_papel() = any (array['dona','recepcionista']) or profissional_id = meu_membro_id())
  )
  with check (
    salao_id = meu_salao_id()
    and (meu_papel() = any (array['dona','recepcionista']) or profissional_id = meu_membro_id())
  );

create policy "bloqueios_salao_delete" on public.agenda_bloqueios for delete
  using (
    salao_id = meu_salao_id()
    and (meu_papel() = any (array['dona','recepcionista']) or profissional_id = meu_membro_id())
  );

-- ----------------------------------------------------------------------------
-- RPC pública: bloqueios do período (para a agenda online).
-- Mesmo padrão das funções de ocupação: resolve o dono pelo slug (salão ou
-- agenda própria da profissional) e filtra pela profissional escolhida.
-- Um bloqueio "do salão inteiro" (profissional_id NULL) vale para qualquer
-- agendamento; um bloqueio de profissional vale só quando ela é a escolhida.
-- ----------------------------------------------------------------------------
create or replace function public.agenda_publica_bloqueios_periodo(
  p_slug text, p_inicio date, p_fim date, p_profissional_id uuid default null
)
returns table(data date, dia_inteiro boolean, horario_inicio time, horario_fim time)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_user_id uuid; v_salao_id uuid; v_prof_id uuid; v_filtro uuid;
begin
  select user_id, salao_id into v_user_id, v_salao_id
  from public.configuracoes where slug = p_slug and agenda_publica_ativa = true limit 1;
  if v_user_id is null then
    select user_id, salao_id, membro_id into v_user_id, v_salao_id, v_prof_id
    from public.agenda_profissional where slug = p_slug and agenda_publica_ativa = true limit 1;
  end if;
  if v_user_id is null then return; end if;

  v_filtro := v_prof_id;
  if v_filtro is null and p_profissional_id is not null and exists (
    select 1 from public.salao_membros where id = p_profissional_id and salao_id = v_salao_id and ativo = true
  ) then
    v_filtro := p_profissional_id;
  end if;

  return query
  select b.data, b.dia_inteiro, b.horario_inicio, b.horario_fim
  from public.agenda_bloqueios b
  where b.salao_id = v_salao_id
    and b.data between p_inicio and p_fim
    and ( b.profissional_id is null
       or (v_filtro is not null and b.profissional_id = v_filtro) );
end;
$function$;

grant execute on function public.agenda_publica_bloqueios_periodo(text, date, date, uuid)
  to anon, authenticated;

-- ----------------------------------------------------------------------------
-- Ajuste no criar agendamento público: recusa horário/dia bloqueado.
-- (Recriação completa da função existente, com o bloco de checagem novo.)
-- ----------------------------------------------------------------------------
create or replace function public.agenda_publica_criar_agendamento(
  p_slug text, p_cliente_nome text, p_cliente_telefone text, p_servico text,
  p_data date, p_horario time without time zone, p_observacoes text,
  p_profissional_id uuid default null::uuid
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  v_user_id UUID; v_salao_id UUID; v_prof_id UUID;
  v_cliente_id UUID; v_agendamento_id UUID;
  v_tel text := regexp_replace(COALESCE(p_cliente_telefone, ''), '\D', '', 'g');
  v_hoje_local DATE := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_agora_local TIME := (now() AT TIME ZONE 'America/Sao_Paulo')::time;
  v_qtd_pendentes int; v_conflito boolean;
BEGIN
  SELECT user_id, salao_id INTO v_user_id, v_salao_id
  FROM public.configuracoes WHERE slug = p_slug AND agenda_publica_ativa = true LIMIT 1;
  IF v_user_id IS NULL THEN
    SELECT user_id, salao_id, membro_id INTO v_user_id, v_salao_id, v_prof_id
    FROM public.agenda_profissional WHERE slug = p_slug AND agenda_publica_ativa = true LIMIT 1;
  END IF;
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'agenda nao encontrada ou inativa'; END IF;

  IF v_prof_id IS NULL AND p_profissional_id IS NOT NULL THEN
    SELECT id INTO v_prof_id FROM public.salao_membros
    WHERE id = p_profissional_id AND salao_id = v_salao_id AND ativo = true
      AND papel IN ('dona', 'profissional') LIMIT 1;
    IF v_prof_id IS NULL THEN RAISE EXCEPTION 'profissional invalida'; END IF;
  END IF;

  IF p_cliente_nome IS NULL OR LENGTH(TRIM(p_cliente_nome)) < 2 THEN RAISE EXCEPTION 'nome invalido'; END IF;
  IF LENGTH(TRIM(p_cliente_nome)) > 80 THEN RAISE EXCEPTION 'nome muito longo'; END IF;
  IF LENGTH(COALESCE(p_servico, '')) > 80 THEN RAISE EXCEPTION 'servico invalido'; END IF;
  IF LENGTH(COALESCE(p_observacoes, '')) > 300 THEN RAISE EXCEPTION 'observacao muito longa'; END IF;
  IF v_tel !~ '^[0-9]{10,13}$' THEN RAISE EXCEPTION 'telefone invalido'; END IF;

  IF p_data < v_hoje_local THEN RAISE EXCEPTION 'data no passado'; END IF;
  IF p_data = v_hoje_local AND p_horario <= v_agora_local THEN RAISE EXCEPTION 'horario no passado'; END IF;

  -- Bloqueio de horário/dia: vale o do salão inteiro (profissional_id NULL) ou
  -- o da profissional escolhida. Usa a mensagem que o app já traduz pra amigável.
  IF EXISTS (
    SELECT 1 FROM public.agenda_bloqueios b
    WHERE b.salao_id = v_salao_id
      AND b.data = p_data
      AND (b.profissional_id IS NULL OR (v_prof_id IS NOT NULL AND b.profissional_id = v_prof_id))
      AND (b.dia_inteiro = true OR (p_horario >= b.horario_inicio AND p_horario < b.horario_fim))
  ) THEN
    RAISE EXCEPTION 'horario indisponivel';
  END IF;

  IF v_prof_id IS NOT NULL THEN
    SELECT EXISTS (SELECT 1 FROM public.agendamentos
      WHERE profissional_id = v_prof_id AND data = p_data AND horario = p_horario AND status <> 'cancelado') INTO v_conflito;
  ELSE
    SELECT EXISTS (SELECT 1 FROM public.agendamentos
      WHERE user_id = v_user_id AND data = p_data AND horario = p_horario AND status <> 'cancelado') INTO v_conflito;
  END IF;
  IF v_conflito THEN RAISE EXCEPTION 'horario ja reservado'; END IF;

  IF v_prof_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_qtd_pendentes FROM public.agendamentos a
    JOIN public.clientes c ON c.id = a.cliente_id
    WHERE a.profissional_id = v_prof_id AND a.status = 'pendente' AND a.data >= v_hoje_local AND c.telefone = v_tel;
  ELSE
    SELECT COUNT(*) INTO v_qtd_pendentes FROM public.agendamentos a
    JOIN public.clientes c ON c.id = a.cliente_id
    WHERE a.user_id = v_user_id AND a.status = 'pendente' AND a.data >= v_hoje_local AND c.telefone = v_tel;
  END IF;
  IF v_qtd_pendentes >= 5 THEN RAISE EXCEPTION 'limite de agendamentos atingido'; END IF;

  SELECT id INTO v_cliente_id FROM public.clientes
  WHERE salao_id = v_salao_id AND telefone = v_tel LIMIT 1;
  IF v_cliente_id IS NULL THEN
    INSERT INTO public.clientes (user_id, salao_id, nome, telefone)
    VALUES (v_user_id, v_salao_id, TRIM(p_cliente_nome), v_tel) RETURNING id INTO v_cliente_id;
  END IF;

  BEGIN
    INSERT INTO public.agendamentos (user_id, salao_id, cliente_id, profissional_id, servico, data, horario, status, observacoes, origem)
    VALUES (v_user_id, v_salao_id, v_cliente_id, v_prof_id, p_servico, p_data, p_horario, 'pendente', p_observacoes, 'publica')
    RETURNING id INTO v_agendamento_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'horario ja reservado';
  END;

  RETURN v_agendamento_id;
END;
$function$;
