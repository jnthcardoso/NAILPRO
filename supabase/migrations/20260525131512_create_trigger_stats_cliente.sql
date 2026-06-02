
create or replace function atualizar_stats_cliente()
returns trigger language plpgsql security definer as $$
begin
  if new.status = 'realizado' and (old.status is distinct from 'realizado') then
    update clientes set
      ultimo_atendimento = new.data,
      total_visitas = total_visitas + 1,
      total_gasto = total_gasto + coalesce(new.valor, 0)
    where id = new.cliente_id;
  end if;
  return new;
end;
$$;

create trigger trigger_stats_cliente
after update on agendamentos
for each row execute function atualizar_stats_cliente();
