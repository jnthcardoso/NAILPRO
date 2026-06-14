-- Faz o "total gasto" da cliente refletir o DINHEIRO REALMENTE RECEBIDO.
--
-- PROBLEMA (auditoria do perfil da cliente):
--   No perfil, o card "total gasto" e o card "recebido" mostravam valores
--   diferentes (ex.: R$ 145 x R$ 202,50). Eram duas fontes distintas:
--     - "total gasto"  = clientes.total_gasto = soma de agendamentos.valor (o
--                        PREÇO digitado no agendamento);
--     - "recebido"     = soma de pagamentos.valor (o que de fato entrou).
--   Em 26 atendimentos realizados antigos os dois não batem (a maioria tinha
--   valor=0 no agendamento, mas com pagamento registrado).
--
-- DECISÃO: a fonte da verdade do dinheiro é o que foi RECEBIDO (pagamentos),
--   coerente com o resto do sistema (receita = recebido). Então total_gasto
--   passa a somar os PAGAMENTOS PAGOS dos atendimentos realizados, em vez do
--   campo agendamentos.valor.
--
-- O QUE MUDA / RISCO:
--   - Não apaga nem altera nenhum agendamento ou pagamento (não-destrutivo).
--   - Só recalcula a coluna clientes.total_gasto (e mantém total_visitas /
--     ultimo_atendimento como já eram: contagem/última data de realizados).
--   - Efeito colateral esperado: clientes cujo atendimento estava "realizado"
--     SEM pagamento registrado terão o total_gasto reduzido (passa a contar só
--     o que entrou de verdade). Isso é o comportamento correto de "recebido".
--   - total_visitas (nº de atendimentos) NÃO muda.

-- 1) Recalcula os totais de UMA cliente. total_gasto agora vem dos pagamentos pagos.
create or replace function public.recalcular_stats_cliente(p_cliente uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_cliente is null then return; end if;
  update clientes c set
    total_visitas = coalesce((
      select count(*) from agendamentos a
      where a.cliente_id = p_cliente and a.status = 'realizado'), 0),
    total_gasto = coalesce((
      select sum(p.valor)
      from pagamentos p
      join agendamentos a on a.id = p.agendamento_id
      where a.cliente_id = p_cliente
        and a.status = 'realizado'
        and p.status = 'pago'), 0),
    ultimo_atendimento = (
      select max(a.data) from agendamentos a
      where a.cliente_id = p_cliente and a.status = 'realizado')
  where c.id = p_cliente;
end;
$$;

-- 2) Gatilho em pagamentos: como total_gasto agora depende dos pagamentos, é
--    preciso recalcular quando um pagamento é incluído/editado/excluído.
--    (O gatilho em agendamentos continua valendo para mudanças de status/cliente.)
create or replace function public.trigger_stats_pagamento_fn()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cliente uuid;
begin
  if tg_op = 'DELETE' then
    select cliente_id into v_cliente from agendamentos where id = old.agendamento_id;
    perform recalcular_stats_cliente(v_cliente);
    return old;
  end if;

  -- Só recalcula se mudou algo que afeta o total recebido.
  if tg_op = 'UPDATE'
     and new.valor          is not distinct from old.valor
     and new.status         is not distinct from old.status
     and new.agendamento_id is not distinct from old.agendamento_id then
    return new;
  end if;

  select cliente_id into v_cliente from agendamentos where id = new.agendamento_id;
  perform recalcular_stats_cliente(v_cliente);

  -- Se o pagamento mudou de agendamento (logo, talvez de cliente), recalcula o antigo também.
  if tg_op = 'UPDATE' and old.agendamento_id is distinct from new.agendamento_id then
    select cliente_id into v_cliente from agendamentos where id = old.agendamento_id;
    perform recalcular_stats_cliente(v_cliente);
  end if;
  return new;
end;
$$;

-- Higiene de segurança (mesmo padrão das demais funções internas).
revoke execute on function public.trigger_stats_pagamento_fn() from public;

drop trigger if exists trigger_stats_pagamento on pagamentos;
create trigger trigger_stats_pagamento
after insert or update or delete on pagamentos
for each row execute function trigger_stats_pagamento_fn();

-- 3) Correção única: alinha todos os clientes com a nova regra (total_gasto = recebido).
update clientes c set
  total_visitas = coalesce(r.v, 0),
  total_gasto   = coalesce(r.g, 0),
  ultimo_atendimento = r.u
from (
  select cl.id,
    (select count(*) from agendamentos a
       where a.cliente_id = cl.id and a.status = 'realizado') as v,
    (select coalesce(sum(p.valor), 0)
       from pagamentos p
       join agendamentos a on a.id = p.agendamento_id
       where a.cliente_id = cl.id and a.status = 'realizado' and p.status = 'pago') as g,
    (select max(a.data) from agendamentos a
       where a.cliente_id = cl.id and a.status = 'realizado') as u
  from clientes cl
) r
where r.id = c.id;
