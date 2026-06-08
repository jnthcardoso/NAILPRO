-- RPC transacional para registrar o pagamento de um agendamento.
--
-- Motivo (auditoria): o fluxo antigo em Agenda.jsx fazia DELETE dos pagamentos
-- antigos e DEPOIS o INSERT dos novos, em chamadas separadas. Se o insert
-- falhasse após o delete (rede/RLS/validação), o atendimento ficava SEM
-- pagamento — perda silenciosa de receita nos relatórios da dona e da manicure.
--
-- Esta função executa delete + insert numa ÚNICA transação (atômico): ou aplica
-- tudo, ou nada. SECURITY INVOKER (padrão) → a RLS de pagamentos continua valendo
-- normalmente; ninguém consegue gravar/apagar pagamento de atendimento que não
-- seja seu. user_id e salao_id são derivados no servidor (não confia no cliente).
--
-- p_pagamentos: array JSON com 1 ou 2 formas, ex.:
--   [{"valor": 100.0, "forma": "pix"}, {"valor": 50.0, "forma": "dinheiro"}]

create or replace function public.salvar_pagamento_agendamento(
  p_agendamento_id uuid,
  p_data date,
  p_status text,
  p_pagamentos jsonb
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_item jsonb;
begin
  if p_status not in ('pago', 'pendente') then
    raise exception 'status invalido: %', p_status;
  end if;
  if jsonb_typeof(p_pagamentos) <> 'array' or jsonb_array_length(p_pagamentos) = 0 then
    raise exception 'pagamentos vazio ou invalido';
  end if;

  -- Apaga os pagamentos antigos do agendamento (RLS restringe ao escopo do caller).
  delete from public.pagamentos where agendamento_id = p_agendamento_id;

  -- Insere os novos (1 ou 2 formas) — mesma transação do delete.
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
  end loop;
end;
$$;

grant execute on function public.salvar_pagamento_agendamento(uuid, date, text, jsonb) to authenticated;
