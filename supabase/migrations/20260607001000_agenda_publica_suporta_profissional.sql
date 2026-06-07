-- Agenda pública passa a reconhecer o link PRÓPRIO da manicure (agenda_profissional),
-- além do link do salão (configuracoes). Quando o slug é de uma manicure, o agendamento
-- é atribuído a ela (profissional_id) e a disponibilidade considera os atendimentos DELA
-- (inclusive os que a dona marcar pra ela) — evita agendamento duplicado.
-- A agenda do salão (dona) continua exatamente como era (filtro por user_id).

-- ── Horários ocupados de um dia ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.agenda_publica_horarios_ocupados(p_slug text, p_data date)
 RETURNS TABLE(horario time without time zone)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID; v_prof_id UUID;
BEGIN
  SELECT user_id, membro_id INTO v_user_id, v_prof_id
  FROM public.agenda_profissional WHERE slug = p_slug AND agenda_publica_ativa = true LIMIT 1;
  IF v_user_id IS NULL THEN
    SELECT user_id INTO v_user_id
    FROM public.configuracoes WHERE slug = p_slug AND agenda_publica_ativa = true LIMIT 1;
    v_prof_id := NULL;
  END IF;
  IF v_user_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT a.horario::TIME
  FROM public.agendamentos a
  WHERE a.data = p_data AND a.status NOT IN ('cancelado')
    AND ( (v_prof_id IS NOT NULL AND a.profissional_id = v_prof_id)
       OR (v_prof_id IS NULL AND a.user_id = v_user_id) );
END;
$function$;

-- ── Horários ocupados de um período (para cinzar dias lotados no calendário) ──
CREATE OR REPLACE FUNCTION public.agenda_publica_ocupados_periodo(p_slug text, p_inicio date, p_fim date)
 RETURNS TABLE(data date, horario time without time zone)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID; v_prof_id UUID;
BEGIN
  SELECT user_id, membro_id INTO v_user_id, v_prof_id
  FROM public.agenda_profissional WHERE slug = p_slug AND agenda_publica_ativa = true LIMIT 1;
  IF v_user_id IS NULL THEN
    SELECT user_id INTO v_user_id
    FROM public.configuracoes WHERE slug = p_slug AND agenda_publica_ativa = true LIMIT 1;
    v_prof_id := NULL;
  END IF;
  IF v_user_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT a.data, a.horario::TIME
  FROM public.agendamentos a
  WHERE a.data BETWEEN p_inicio AND p_fim AND a.status NOT IN ('cancelado')
    AND ( (v_prof_id IS NOT NULL AND a.profissional_id = v_prof_id)
       OR (v_prof_id IS NULL AND a.user_id = v_user_id) );
END;
$function$;

-- ── Criação do agendamento pela cliente ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.agenda_publica_criar_agendamento(
  p_slug text, p_cliente_nome text, p_cliente_telefone text,
  p_servico text, p_data date, p_horario time without time zone, p_observacoes text)
 RETURNS uuid
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID; v_salao_id UUID; v_prof_id UUID;
  v_cliente_id UUID; v_agendamento_id UUID;
  v_tel text := regexp_replace(COALESCE(p_cliente_telefone, ''), '\D', '', 'g');
  v_hoje_local DATE := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_agora_local TIME := (now() AT TIME ZONE 'America/Sao_Paulo')::time;
  v_qtd_pendentes int;
  v_conflito boolean;
BEGIN
  -- Resolve o slug: primeiro tenta a agenda da manicure; senão, a do salão.
  SELECT user_id, salao_id, membro_id INTO v_user_id, v_salao_id, v_prof_id
  FROM public.agenda_profissional WHERE slug = p_slug AND agenda_publica_ativa = true LIMIT 1;
  IF v_user_id IS NULL THEN
    SELECT user_id, salao_id INTO v_user_id, v_salao_id
    FROM public.configuracoes WHERE slug = p_slug AND agenda_publica_ativa = true LIMIT 1;
    v_prof_id := NULL;
  END IF;
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'agenda nao encontrada ou inativa'; END IF;

  IF p_cliente_nome IS NULL OR LENGTH(TRIM(p_cliente_nome)) < 2 THEN RAISE EXCEPTION 'nome invalido'; END IF;
  IF LENGTH(TRIM(p_cliente_nome)) > 80 THEN RAISE EXCEPTION 'nome muito longo'; END IF;
  IF LENGTH(COALESCE(p_servico, '')) > 80 THEN RAISE EXCEPTION 'servico invalido'; END IF;
  IF LENGTH(COALESCE(p_observacoes, '')) > 300 THEN RAISE EXCEPTION 'observacao muito longa'; END IF;
  IF v_tel !~ '^[0-9]{10,13}$' THEN RAISE EXCEPTION 'telefone invalido'; END IF;

  IF p_data < v_hoje_local THEN RAISE EXCEPTION 'data no passado'; END IF;
  IF p_data = v_hoje_local AND p_horario <= v_agora_local THEN RAISE EXCEPTION 'horario no passado'; END IF;

  -- Conflito de horário: por manicure (profissional_id) ou por dona (user_id).
  IF v_prof_id IS NOT NULL THEN
    SELECT EXISTS (SELECT 1 FROM public.agendamentos
      WHERE profissional_id = v_prof_id AND data = p_data AND horario = p_horario AND status <> 'cancelado')
      INTO v_conflito;
  ELSE
    SELECT EXISTS (SELECT 1 FROM public.agendamentos
      WHERE user_id = v_user_id AND data = p_data AND horario = p_horario AND status <> 'cancelado')
      INTO v_conflito;
  END IF;
  IF v_conflito THEN RAISE EXCEPTION 'horario ja reservado'; END IF;

  -- Limite de pendentes por telefone (anti-spam): mesmo escopo.
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

  -- Cliente é do salão (compartilhada): busca/cria por telefone no salão.
  SELECT id INTO v_cliente_id FROM public.clientes
  WHERE salao_id = v_salao_id AND telefone = v_tel LIMIT 1;
  IF v_cliente_id IS NULL THEN
    INSERT INTO public.clientes (user_id, salao_id, nome, telefone)
    VALUES (v_user_id, v_salao_id, TRIM(p_cliente_nome), v_tel)
    RETURNING id INTO v_cliente_id;
  END IF;

  -- Cria o agendamento; se for link da manicure, já atribui a ela (profissional_id).
  INSERT INTO public.agendamentos (user_id, salao_id, cliente_id, profissional_id, servico, data, horario, status, observacoes)
  VALUES (v_user_id, v_salao_id, v_cliente_id, v_prof_id, p_servico, p_data, p_horario, 'pendente', p_observacoes)
  RETURNING id INTO v_agendamento_id;
  RETURN v_agendamento_id;
END;
$function$;
