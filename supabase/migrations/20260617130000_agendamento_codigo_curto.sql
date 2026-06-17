-- Código CURTO pro link de confirmação ficar bonito.
--
-- O link de confirmar usava o token longo (UUID de 36 caracteres):
--   .../c/c9773475-3778-4ee9-bb41-fb3ba861b573
-- Fica feio e ocupa várias linhas no WhatsApp. Esta migration adiciona um
-- código curto (10 caracteres) por agendamento, deixando o link assim:
--   .../c/c97734553   (curto, 1 linha)
--
-- RISCO: baixo. É ADITIVO e NÃO-DESTRUTIVO — só acrescenta uma coluna. Nenhum
-- dado é apagado. Os links ANTIGOS (com o token longo) continuam funcionando,
-- porque a função de confirmar aceita os dois: o código curto OU o token longo.

-- 1) Coluna do código curto.
alter table public.agendamentos
  add column if not exists codigo_confirmacao text;

-- Preenche os agendamentos que já existem (10 caracteres hexadecimais aleatórios).
update public.agendamentos
  set codigo_confirmacao = substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)
  where codigo_confirmacao is null;

-- Novos agendamentos ganham o código sozinhos.
alter table public.agendamentos
  alter column codigo_confirmacao set default substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);

alter table public.agendamentos
  alter column codigo_confirmacao set not null;

-- Único: garante que dois agendamentos nunca tenham o mesmo código.
create unique index if not exists idx_agendamentos_codigo_confirmacao
  on public.agendamentos (codigo_confirmacao);

-- 2) Função pública que confirma pelo CÓDIGO (curto) ou pelo TOKEN (longo antigo).
--    Mesma lógica de antes; só passa a aceitar texto e casar nas duas colunas.
create or replace function public.confirmar_agendamento(p_codigo text)
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
  WHERE a.codigo_confirmacao = p_codigo OR a.token_confirmacao::text = p_codigo
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
    SET status = 'confirmado', updated_at = now()
    WHERE id = v_id;

  RETURN jsonb_build_object('resultado','confirmado','nome',v_nome,'data',v_data,'horario',v_horario,'servico',v_servico);
END;
$function$;

revoke all on function public.confirmar_agendamento(text) from public;
grant execute on function public.confirmar_agendamento(text) to anon, authenticated;
