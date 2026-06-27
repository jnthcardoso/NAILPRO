-- Marcador de "confirmado pelo link": quando a cliente confirma o agendamento
-- pelo link do lembrete, guardamos a data/hora. Serve para o recap mensal
-- ("Meu mes") contar quantas confirmacoes vieram do link (faltas evitadas).
--
-- RISCO: baixo. ADITIVO e NAO-DESTRUTIVO -- so acrescenta uma coluna (nula nos
-- agendamentos antigos) e faz a funcao publica de confirmacao preencher a data.
-- Nenhum dado e apagado ou alterado; a funcao segue so trocando pendente->confirmado.

alter table public.agendamentos
  add column if not exists confirmado_link_em timestamptz;

-- Atualiza a funcao: alem de confirmar, anota quando a confirmacao veio do link.
create or replace function public.confirmar_agendamento_por_token(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  v_id uuid; v_status text; v_data date; v_horario time without time zone;
  v_servico text; v_nome text;
  v_hoje_local date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  SELECT a.id, a.status, a.data, a.horario, a.servico, split_part(coalesce(c.nome,''),' ',1)
    INTO v_id, v_status, v_data, v_horario, v_servico, v_nome
  FROM public.agendamentos a
  JOIN public.clientes c ON c.id = a.cliente_id
  WHERE a.token_confirmacao = p_token
  LIMIT 1;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('resultado', 'nao_encontrado');
  END IF;

  IF v_status = 'cancelado' THEN
    RETURN jsonb_build_object('resultado','cancelado','nome',v_nome,'data',v_data,'horario',v_horario,'servico',v_servico);
  END IF;

  IF v_status = 'realizado' OR v_data < v_hoje_local THEN
    RETURN jsonb_build_object('resultado','expirado','nome',v_nome,'data',v_data,'horario',v_horario,'servico',v_servico);
  END IF;

  IF v_status = 'confirmado' THEN
    RETURN jsonb_build_object('resultado','ja_confirmado','nome',v_nome,'data',v_data,'horario',v_horario,'servico',v_servico);
  END IF;

  UPDATE public.agendamentos
    SET status = 'confirmado', confirmado_link_em = now(), updated_at = now()
    WHERE id = v_id;

  RETURN jsonb_build_object('resultado','confirmado','nome',v_nome,'data',v_data,'horario',v_horario,'servico',v_servico);
END;
$function$;

revoke all on function public.confirmar_agendamento_por_token(uuid) from public;
grant execute on function public.confirmar_agendamento_por_token(uuid) to anon, authenticated;
