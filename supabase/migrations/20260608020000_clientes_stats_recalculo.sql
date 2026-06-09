-- Totais da cliente (visitas, gasto, última vez) confiáveis.
--
-- ANTES: o trigger só SOMAVA quando um atendimento virava 'realizado'. Nunca
-- corrigia ao cancelar/desfazer um realizado, nem ao editar o valor, nem ao
-- excluir — então total_visitas / total_gasto / ultimo_atendimento iam saindo
-- da realidade com o uso.
--
-- AGORA: a cada inclusão/edição/exclusão de agendamento, recalculamos os totais
-- da cliente a partir dos atendimentos 'realizado' (fonte da verdade). Sem risco
-- de inflar ou ficar defasado. Não altera agendamentos nem pagamentos.

-- Recalcula os totais de UMA cliente a partir dos atendimentos realizados.
create or replace function recalcular_stats_cliente(p_cliente uuid)
returns void language plpgsql security definer as $$
begin
  if p_cliente is null then return; end if;
  update clientes c set
    total_visitas = coalesce((
      select count(*) from agendamentos a
      where a.cliente_id = p_cliente and a.status = 'realizado'), 0),
    total_gasto = coalesce((
      select sum(a.valor) from agendamentos a
      where a.cliente_id = p_cliente and a.status = 'realizado'), 0),
    ultimo_atendimento = (
      select max(a.data) from agendamentos a
      where a.cliente_id = p_cliente and a.status = 'realizado')
  where c.id = p_cliente;
end;
$$;

create or replace function trigger_stats_cliente_fn()
returns trigger language plpgsql security definer as $$
begin
  if tg_op = 'DELETE' then
    perform recalcular_stats_cliente(old.cliente_id);
    return old;
  end if;

  -- No UPDATE, só recalcula se mudou algo que afeta os totais
  -- (evita reprocessar em coisas como marcar lembrete enviado).
  if tg_op = 'UPDATE'
     and new.status     is not distinct from old.status
     and new.valor      is not distinct from old.valor
     and new.data       is not distinct from old.data
     and new.cliente_id is not distinct from old.cliente_id then
    return new;
  end if;

  perform recalcular_stats_cliente(new.cliente_id);
  -- Se o atendimento mudou de cliente, recalcula a antiga também.
  if tg_op = 'UPDATE' and old.cliente_id is distinct from new.cliente_id then
    perform recalcular_stats_cliente(old.cliente_id);
  end if;
  return new;
end;
$$;

-- Substitui o trigger antigo (que só somava no UPDATE → 'realizado').
drop trigger if exists trigger_stats_cliente on agendamentos;
create trigger trigger_stats_cliente
after insert or update or delete on agendamentos
for each row execute function trigger_stats_cliente_fn();

drop function if exists atualizar_stats_cliente();

-- Correção única: alinha todos os clientes existentes com a realidade.
update clientes c set
  total_visitas = coalesce(r.v, 0),
  total_gasto   = coalesce(r.g, 0),
  ultimo_atendimento = r.u
from (
  select cl.id,
    (select count(*)   from agendamentos a where a.cliente_id = cl.id and a.status = 'realizado') as v,
    (select sum(a.valor) from agendamentos a where a.cliente_id = cl.id and a.status = 'realizado') as g,
    (select max(a.data)  from agendamentos a where a.cliente_id = cl.id and a.status = 'realizado') as u
  from clientes cl
) r
where r.id = c.id;
