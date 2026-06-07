-- AUDITORIA Sugestão #3: protege a DONA do salão de se "auto-rebaixar".
--
-- Brecha: a dona podia mudar o próprio papel (ou se desativar) e ficar sem o acesso
-- de dona, travando o salão. Esta trava impede, no UPDATE, alterar o papel ou desativar
-- a linha do DONO do salão (saloes.dona_user_id). Suporte/admin (service_role) passa.
--
-- Escopo só em UPDATE (não em DELETE), de propósito: a exclusão de conta apaga o salão
-- em cascata e dispararia esta trava indevidamente. A remoção de membro já é restrita
-- à dona por RLS; e a exclusão de conta tem fluxo próprio.

create or replace function public.protege_membro_dona()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dona uuid;
begin
  -- suporte/admin (service_role) passa sem trava
  if current_setting('role', true) = 'service_role' then
    return NEW;
  end if;

  select dona_user_id into v_dona from public.saloes where id = OLD.salao_id;

  -- só protege a linha do DONO do salão; demais membros seguem normais
  if OLD.user_id is distinct from v_dona then
    return NEW;
  end if;

  if NEW.papel <> 'dona' then
    raise exception 'A dona do salão não pode mudar o próprio papel.';
  end if;
  if NEW.ativo = false then
    raise exception 'A dona do salão não pode ser desativada.';
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_protege_membro_dona on public.salao_membros;
create trigger trg_protege_membro_dona
  before update on public.salao_membros
  for each row execute function public.protege_membro_dona();
