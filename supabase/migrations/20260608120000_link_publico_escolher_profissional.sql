-- Link público do salão: permite a cliente ESCOLHER a profissional ao agendar.
--
-- Motivo (auditoria #5): hoje a reserva pelo link do salão não tem profissional
-- definida (vira "órfã": entra no total da dona, mas some da visão da manicure e
-- não dá pra atribuir comissão). Além disso, o link tratava o salão como UMA
-- agenda só (um agendamento por horário no salão inteiro).
--
-- Com isto, a cliente escolhe a profissional; os horários livres passam a ser os
-- DELA e a reserva é atribuída a ela. "Sem preferência" mantém o comportamento
-- antigo (reserva do salão). É opcional por salão (coluna abaixo, ligada por padrão).

-- 1) Liga/desliga por salão (default: ligado)
alter table public.configuracoes
  add column if not exists agenda_publica_escolher_profissional boolean not null default true;

-- 2) Lista pública das profissionais de um salão (só id + nome). Usada pelo seletor.
create or replace function public.agenda_publica_profissionais(p_slug text)
returns table(id uuid, nome text)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_salao_id uuid; v_escolher boolean;
begin
  select salao_id, agenda_publica_escolher_profissional
    into v_salao_id, v_escolher
  from public.configuracoes
  where slug = p_slug and agenda_publica_ativa = true
  limit 1;
  if v_salao_id is null then return; end if;     -- não é link de salão (ou inativo)
  if v_escolher is not true then return; end if;  -- salão desativou a escolha
  return query
    select m.id, m.nome
    from public.salao_membros m
    where m.salao_id = v_salao_id and m.ativo = true
      and m.papel in ('dona', 'profissional')
      and coalesce(trim(m.nome), '') <> ''
    order by m.nome;
end;
$function$;

-- 3) Horários ocupados — agora aceita a profissional escolhida (opcional)
drop function if exists public.agenda_publica_horarios_ocupados(text, date);
create function public.agenda_publica_horarios_ocupados(p_slug text, p_data date, p_profissional_id uuid default null)
returns table(horario time without time zone)
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

  -- Link próprio da profissional define o membro; senão usa a escolhida (se válida no salão).
  v_filtro := v_prof_id;
  if v_filtro is null and p_profissional_id is not null and exists (
    select 1 from public.salao_membros where id = p_profissional_id and salao_id = v_salao_id and ativo = true
  ) then
    v_filtro := p_profissional_id;
  end if;

  return query
  select a.horario::time from public.agendamentos a
  where a.data = p_data and a.status not in ('cancelado')
    and ( (v_filtro is not null and a.profissional_id = v_filtro)
       or (v_filtro is null and a.user_id = v_user_id) );
end;
$function$;

-- 4) Ocupação do período (cinza dias lotados) — idem
drop function if exists public.agenda_publica_ocupados_periodo(text, date, date);
create function public.agenda_publica_ocupados_periodo(p_slug text, p_inicio date, p_fim date, p_profissional_id uuid default null)
returns table(data date, horario time without time zone)
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
  select a.data, a.horario::time from public.agendamentos a
  where a.data between p_inicio and p_fim and a.status not in ('cancelado')
    and ( (v_filtro is not null and a.profissional_id = v_filtro)
       or (v_filtro is null and a.user_id = v_user_id) );
end;
$function$;

-- 5) Criar agendamento — atribui a profissional escolhida (validada no salão)
drop function if exists public.agenda_publica_criar_agendamento(text, text, text, text, date, time without time zone, text);
create function public.agenda_publica_criar_agendamento(
  p_slug text, p_cliente_nome text, p_cliente_telefone text, p_servico text,
  p_data date, p_horario time without time zone, p_observacoes text,
  p_profissional_id uuid default null
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

  -- Link de salão com profissional escolhida: valida que pertence ao salão.
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

  INSERT INTO public.agendamentos (user_id, salao_id, cliente_id, profissional_id, servico, data, horario, status, observacoes)
  VALUES (v_user_id, v_salao_id, v_cliente_id, v_prof_id, p_servico, p_data, p_horario, 'pendente', p_observacoes)
  RETURNING id INTO v_agendamento_id;
  RETURN v_agendamento_id;
END;
$function$;

-- Grants (recriados após o drop): o link público é anônimo.
grant execute on function public.agenda_publica_profissionais(text) to anon, authenticated;
grant execute on function public.agenda_publica_horarios_ocupados(text, date, uuid) to anon, authenticated;
grant execute on function public.agenda_publica_ocupados_periodo(text, date, date, uuid) to anon, authenticated;
grant execute on function public.agenda_publica_criar_agendamento(text, text, text, text, date, time without time zone, text, uuid) to anon, authenticated;
