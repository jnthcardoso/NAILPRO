-- Mantém o "Valor" do agendamento em sincronia com o total registrado no pagamento.
-- Antes: ao marcar "realizado" e digitar o valor no modal, o valor ia só pro
-- pagamento e o agendamento ficava com o valor antigo (ex.: 0) → Agenda mostrava
-- 0 e Financeiro mostrava o valor real. Agora a RPC atualiza os dois juntos.
-- SECURITY INVOKER preservado: o UPDATE respeita a RLS do agendamento (só do próprio salão).
-- Não-destrutivo: nada nos dados atuais muda; só vale para os próximos salvamentos.
create or replace function public.salvar_pagamento_agendamento(
  p_agendamento_id uuid, p_data date, p_status text, p_pagamentos jsonb
)
returns void
language plpgsql
set search_path to 'public'
as $function$
declare
  v_item jsonb;
  v_total numeric := 0;
begin
  if p_status not in ('pago', 'pendente') then
    raise exception 'status invalido: %', p_status;
  end if;
  if jsonb_typeof(p_pagamentos) <> 'array' or jsonb_array_length(p_pagamentos) = 0 then
    raise exception 'pagamentos vazio ou invalido';
  end if;

  delete from public.pagamentos where agendamento_id = p_agendamento_id;

  for v_item in select * from jsonb_array_elements(p_pagamentos)
  loop
    insert into public.pagamentos (user_id, salao_id, agendamento_id, data, status, valor, forma)
    values (
      auth.uid(),
      meu_salao_id(),
      p_agendamento_id,
      p_data,
      p_status,
      (v_item->>'valor')::numeric,
      v_item->>'forma'
    );
    v_total := v_total + coalesce((v_item->>'valor')::numeric, 0);
  end loop;

  -- Sincroniza o valor do atendimento com o total registrado (evita Agenda 0 × Financeiro 130).
  update public.agendamentos set valor = v_total where id = p_agendamento_id;
end;
$function$;
