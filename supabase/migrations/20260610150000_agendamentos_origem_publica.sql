-- Marca a ORIGEM de cada agendamento.
--
-- Problema: agendamentos criados pela dona/recepção/profissional E os que chegam
-- sozinhos pelo link de agendamento online nascem ambos com status 'pendente'.
-- Hoje é impossível distinguir os dois — então a dona não tem como ver, na tela
-- inicial, "quais pedidos caíram pelo meu link e ainda preciso confirmar".
--
-- Solução: coluna `origem` com dois valores:
--   'interno'  → criado dentro do app (padrão de tudo que já existe)
--   'publica'  → chegou pelo link público (/agendar/:slug)
-- O RPC do link público passa a gravar 'publica'. A Home usa isso pra destacar
-- os pedidos novos aguardando confirmação.
--
-- RISCO: baixo. É ADITIVA e NÃO-DESTRUTIVA — só acrescenta uma coluna com valor
-- padrão 'interno'. Nenhum dado é apagado ou alterado; agendamentos antigos
-- ficam como 'interno' (que é o correto, já que não vieram do link público).

alter table public.agendamentos
  add column if not exists origem text not null default 'interno';

-- Índice parcial: a Home consulta só os pedidos públicos pendentes (poucos).
create index if not exists idx_agendamentos_pedidos_publicos
  on public.agendamentos (salao_id, data)
  where origem = 'publica' and status = 'pendente';

-- Recria o RPC de criação do link público marcando origem='publica' no insert.
-- (Mesma assinatura de antes — CREATE OR REPLACE preserva as permissões/grants.)
create or replace function public.agenda_publica_criar_agendamento(
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

  INSERT INTO public.agendamentos (user_id, salao_id, cliente_id, profissional_id, servico, data, horario, status, observacoes, origem)
  VALUES (v_user_id, v_salao_id, v_cliente_id, v_prof_id, p_servico, p_data, p_horario, 'pendente', p_observacoes, 'publica')
  RETURNING id INTO v_agendamento_id;
  RETURN v_agendamento_id;
END;
$function$;
