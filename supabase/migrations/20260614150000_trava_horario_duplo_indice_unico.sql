-- Trava contra "horario duplo" (corrida no agendamento).
-- Antes: a checagem de conflito e o insert eram passos separados; duas clientes
-- simultaneas podiam pegar o MESMO horario. Agora o banco garante unicidade.
--
-- Duas partes, batendo com a regra da RPC agenda_publica_criar_agendamento:
--  (a) quando HA profissional: unico por (profissional_id, data, horario)
--  (b) quando NAO ha profissional: unico por (user_id, data, horario)
-- Em ambos, cancelados nao contam (liberam o horario).
-- Indices parciais: so valem para linhas nao-canceladas.
--
-- Pre-requisito de dados: removidos (marcados como cancelado) duplicados antigos
-- de teste na CONTA DESENVOLVIMENTO (26-27/05, 11:00) para a trava poder entrar.

CREATE UNIQUE INDEX IF NOT EXISTS uniq_agendamento_prof_slot
  ON public.agendamentos (profissional_id, data, horario)
  WHERE profissional_id IS NOT NULL AND status IS DISTINCT FROM 'cancelado';

CREATE UNIQUE INDEX IF NOT EXISTS uniq_agendamento_user_slot
  ON public.agendamentos (user_id, data, horario)
  WHERE profissional_id IS NULL AND status IS DISTINCT FROM 'cancelado';

-- Rede de seguranca na RPC publica: se a trava disparar numa corrida (o insert
-- da 2a cliente bate na trava), devolve a mensagem amigavel ja traduzida pelo app
-- ("Esse horario acabou de ser reservado.") em vez de erro tecnico do Postgres.
CREATE OR REPLACE FUNCTION public.agenda_publica_criar_agendamento(p_slug text, p_cliente_nome text, p_cliente_telefone text, p_servico text, p_data date, p_horario time without time zone, p_observacoes text, p_profissional_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Rede de seguranca: se a trava de horario disparar (corrida), traduz para a
  -- mensagem amigavel que o app ja reconhece.
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
