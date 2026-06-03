-- Item 3: bypass no trigger para operações via service_role (suporte/admin).
-- Sem isso, inserir membros diretamente pelo painel do Supabase ou via
-- service_role levantaria exceção mesmo para contas sem plano Salão.
CREATE OR REPLACE FUNCTION public.check_membro_plano()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- operações de suporte/admin (service_role) passam sem verificação de plano
  if current_setting('role', true) = 'service_role' then
    return NEW;
  end if;

  -- a dona/admin sempre pode existir (login base do plano)
  if NEW.papel = 'dona' then
    return NEW;
  end if;

  -- recepcionista e profissional exigem o plano Salão ativo
  if not public.plano_permite_equipe(NEW.salao_id) then
    raise exception 'Adicionar equipe requer o plano Salão ativo. Faça upgrade para o Salão.';
  end if;

  return NEW;
end;
$function$;
