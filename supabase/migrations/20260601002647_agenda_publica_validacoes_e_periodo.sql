-- Reforça o agendamento público: bloqueia horário no passado (fuso de Brasília)
-- e impede dois agendamentos no mesmo horário (double booking).
CREATE OR REPLACE FUNCTION public.agenda_publica_criar_agendamento(
  p_slug text, p_cliente_nome text, p_cliente_telefone text, p_servico text,
  p_data date, p_horario time without time zone, p_observacoes text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID; v_salao_id UUID; v_cliente_id UUID; v_agendamento_id UUID;
  v_hoje_local DATE := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_agora_local TIME := (now() AT TIME ZONE 'America/Sao_Paulo')::time;
BEGIN
  SELECT user_id, salao_id INTO v_user_id, v_salao_id
  FROM public.configuracoes WHERE slug = p_slug AND agenda_publica_ativa = true LIMIT 1;
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'agenda nao encontrada ou inativa'; END IF;
  IF p_cliente_nome IS NULL OR LENGTH(TRIM(p_cliente_nome)) < 2 THEN RAISE EXCEPTION 'nome invalido'; END IF;

  -- Sem datas/horários no passado (fuso de Brasília)
  IF p_data < v_hoje_local THEN RAISE EXCEPTION 'data no passado'; END IF;
  IF p_data = v_hoje_local AND p_horario <= v_agora_local THEN RAISE EXCEPTION 'horario no passado'; END IF;

  -- Anti double-booking: não deixa dois no mesmo horário
  IF EXISTS (
    SELECT 1 FROM public.agendamentos
    WHERE user_id = v_user_id AND data = p_data AND horario = p_horario
      AND status <> 'cancelado'
  ) THEN
    RAISE EXCEPTION 'horario ja reservado';
  END IF;

  SELECT id INTO v_cliente_id FROM public.clientes
  WHERE salao_id = v_salao_id AND telefone = p_cliente_telefone LIMIT 1;
  IF v_cliente_id IS NULL THEN
    INSERT INTO public.clientes (user_id, salao_id, nome, telefone)
    VALUES (v_user_id, v_salao_id, p_cliente_nome, p_cliente_telefone)
    RETURNING id INTO v_cliente_id;
  END IF;

  INSERT INTO public.agendamentos (user_id, salao_id, cliente_id, servico, data, horario, status, observacoes)
  VALUES (v_user_id, v_salao_id, v_cliente_id, p_servico, p_data, p_horario, 'pendente', p_observacoes)
  RETURNING id INTO v_agendamento_id;
  RETURN v_agendamento_id;
END;
$function$;

-- Ocupação por período: usada para cinzar no calendário os dias já lotados.
CREATE OR REPLACE FUNCTION public.agenda_publica_ocupados_periodo(
  p_slug text, p_inicio date, p_fim date)
RETURNS TABLE(data date, horario time without time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT user_id INTO v_user_id FROM public.configuracoes
  WHERE slug = p_slug AND agenda_publica_ativa = true LIMIT 1;
  IF v_user_id IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT a.data, a.horario::TIME
  FROM public.agendamentos a
  WHERE a.user_id = v_user_id AND a.data BETWEEN p_inicio AND p_fim
    AND a.status NOT IN ('cancelado');
END;
$function$;

GRANT EXECUTE ON FUNCTION public.agenda_publica_ocupados_periodo(text, date, date) TO anon, authenticated;
