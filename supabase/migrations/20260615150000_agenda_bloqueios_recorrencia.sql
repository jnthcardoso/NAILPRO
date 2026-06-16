-- ============================================================================
-- Bloqueios recorrentes (ex.: almoço Seg–Sex 12–13h) + base p/ edição.
-- Adiciona à tabela agenda_bloqueios:
--   recorrencia  'nenhuma' (data única, como antes) | 'semanal'
--   dias_semana  int[] (0=domingo … 6=sábado) — usado quando 'semanal'
--   data_fim     date — fim opcional da recorrência (NULL = repete pra sempre)
-- Para recorrência semanal, a coluna `data` passa a ser o "a partir de" (início).
-- ============================================================================

alter table public.agenda_bloqueios
  add column if not exists recorrencia text not null default 'nenhuma',
  add column if not exists dias_semana int[],
  add column if not exists data_fim date;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'chk_bloqueio_recorrencia') then
    alter table public.agenda_bloqueios
      add constraint chk_bloqueio_recorrencia check (recorrencia in ('nenhuma', 'semanal'));
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- RPC pública: expande a recorrência em datas concretas dentro do período.
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
  select dd::date as data, b.dia_inteiro, b.horario_inicio, b.horario_fim
  from public.agenda_bloqueios b
  cross join lateral generate_series(p_inicio, p_fim, interval '1 day') as dd
  where b.salao_id = v_salao_id
    and ( b.profissional_id is null or (v_filtro is not null and b.profissional_id = v_filtro) )
    and (
      (b.recorrencia = 'nenhuma' and b.data = dd::date)
      or (b.recorrencia = 'semanal'
          and extract(dow from dd)::int = any(b.dias_semana)
          and dd::date >= b.data
          and (b.data_fim is null or dd::date <= b.data_fim))
    );
end;
$function$;

grant execute on function public.agenda_publica_bloqueios_periodo(text, date, date, uuid)
  to anon, authenticated;

-- ----------------------------------------------------------------------------
-- Criar agendamento público: recusa horário/dia bloqueado, agora considerando
-- também os bloqueios recorrentes.
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

  IF EXISTS (
    SELECT 1 FROM public.agenda_bloqueios b
    WHERE b.salao_id = v_salao_id
      AND (b.profissional_id IS NULL OR (v_prof_id IS NOT NULL AND b.profissional_id = v_prof_id))
      AND (
        (b.recorrencia = 'nenhuma' AND b.data = p_data)
        OR (b.recorrencia = 'semanal'
            AND extract(dow from p_data)::int = ANY(b.dias_semana)
            AND p_data >= b.data
            AND (b.data_fim IS NULL OR p_data <= b.data_fim))
      )
      AND (b.dia_inteiro OR (p_horario >= b.horario_inicio AND p_horario < b.horario_fim))
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
