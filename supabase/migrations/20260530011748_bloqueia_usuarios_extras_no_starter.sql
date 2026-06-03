create or replace function public.check_membro_plano()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plano text;
  v_status text;
begin
  -- a dona/admin sempre pode existir (login base do plano)
  if NEW.papel = 'dona' then
    return NEW;
  end if;

  select plano, status into v_plano, v_status
  from public.assinaturas
  where salao_id = NEW.salao_id
  order by created_at asc
  limit 1;

  -- só bloqueia quando a assinatura está ATIVA no Starter.
  -- Em trial (sem plano definido) e no Pro, libera normalmente.
  if v_status = 'active' and v_plano = 'starter' then
    raise exception 'O plano Starter inclui apenas o login de administrador. Faça upgrade para o Pro para adicionar usuários.';
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_check_membro_plano on public.salao_membros;
create trigger trg_check_membro_plano
  before insert on public.salao_membros
  for each row execute function public.check_membro_plano();
