-- Confirmação do agendamento pela própria cliente, por link seguro.
--
-- Hoje: o lembrete é enviado pelo WhatsApp da manicure e, quando a cliente
-- responde "pode confirmar", a manicure precisa marcar na mão no Lumen.
--
-- Objetivo: a mensagem de lembrete passa a levar um link "✅ Confirmar". A
-- cliente toca, abre uma telinha pública do Lumen e o agendamento vira
-- 'confirmado' SOZINHO — sem a manicure mexer em nada.
--
-- Como fica seguro: cada agendamento ganha um "código secreto" (token, um UUID
-- aleatório impossível de adivinhar). O link só funciona com esse código e ele
-- só consegue CONFIRMAR aquele agendamento — não lê nem altera mais nada.
--
-- RISCO: baixo. A coluna é ADITIVA e NÃO-DESTRUTIVA — só acrescenta o token em
-- cada agendamento (os antigos ganham um token automaticamente). Nenhum dado é
-- apagado ou alterado. A função pública só troca o status de 'pendente' para
-- 'confirmado'; não toca em horário já 'realizado', 'cancelado' ou no passado.

-- 1) Coluna com o "código secreto" (token) de cada agendamento.
alter table public.agendamentos
  add column if not exists token_confirmacao uuid not null default gen_random_uuid();

-- Índice único: busca rápida pelo token e garante que não se repita.
create unique index if not exists idx_agendamentos_token_confirmacao
  on public.agendamentos (token_confirmacao);

-- 2) Função pública: confirma UM agendamento pelo token. Não expõe a tabela.
--    Retorna um JSON com o resultado e os dados do horário (pra telinha mostrar).
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

  -- Token inválido / inexistente.
  IF v_id IS NULL THEN
    RETURN jsonb_build_object('resultado', 'nao_encontrado');
  END IF;

  -- Já cancelado: não dá pra confirmar.
  IF v_status = 'cancelado' THEN
    RETURN jsonb_build_object('resultado','cancelado','nome',v_nome,'data',v_data,'horario',v_horario,'servico',v_servico);
  END IF;

  -- Horário no passado ou já realizado: nada a confirmar.
  IF v_status = 'realizado' OR v_data < v_hoje_local THEN
    RETURN jsonb_build_object('resultado','expirado','nome',v_nome,'data',v_data,'horario',v_horario,'servico',v_servico);
  END IF;

  -- Já estava confirmado (clicou de novo): tudo certo, sem erro.
  IF v_status = 'confirmado' THEN
    RETURN jsonb_build_object('resultado','ja_confirmado','nome',v_nome,'data',v_data,'horario',v_horario,'servico',v_servico);
  END IF;

  -- Caso bom: estava 'pendente' → confirma.
  UPDATE public.agendamentos
    SET status = 'confirmado', updated_at = now()
    WHERE id = v_id;

  RETURN jsonb_build_object('resultado','confirmado','nome',v_nome,'data',v_data,'horario',v_horario,'servico',v_servico);
END;
$function$;

-- Permissões: ninguém por padrão; só liberar a CHAMADA pra quem não está logado
-- (a cliente) e pra quem está logado. A função em si é security definer e só
-- confirma — não expõe leitura/escrita da tabela.
revoke all on function public.confirmar_agendamento_por_token(uuid) from public;
grant execute on function public.confirmar_agendamento_por_token(uuid) to anon, authenticated;
