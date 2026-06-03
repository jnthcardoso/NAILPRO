-- Trial nasce como 'salao' para que novos usuários possam testar equipe.
CREATE OR REPLACE FUNCTION public.handle_new_user_completo()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_salao_id uuid;
  v_membro_pendente uuid;
begin
  -- convite pendente?
  select id, salao_id into v_membro_pendente, v_salao_id
  from public.salao_membros
  where lower(email) = lower(NEW.email) and user_id is null and ativo = true
  order by created_at asc
  limit 1;

  if v_membro_pendente is not null then
    update public.salao_membros
      set user_id = NEW.id
      where id = v_membro_pendente;
    return NEW; -- usa config/assinatura do salão; não cria novos
  end if;

  -- fluxo normal: cria salão próprio com trial no plano Salão
  -- (permite testar equipe durante o trial)
  insert into public.saloes (nome, dona_user_id) values ('Meu Salão', NEW.id) returning id into v_salao_id;
  insert into public.salao_membros (salao_id, user_id, nome, email, papel) values (v_salao_id, NEW.id, 'Dona', NEW.email, 'dona');
  insert into public.configuracoes (user_id, salao_id, onboarding_completo) values (NEW.id, v_salao_id, false) on conflict (user_id) do nothing;
  insert into public.assinaturas (user_id, salao_id, plano, status, trial_inicia_em, trial_termina_em)
    values (NEW.id, v_salao_id, 'salao', 'trialing', now(), now() + interval '14 days') on conflict (user_id) do nothing;
  return NEW;
end;
$function$;

-- plano_permite_equipe: Salão em trialing também libera equipe.
CREATE OR REPLACE FUNCTION public.plano_permite_equipe(p_salao_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM saloes s
    JOIN assinaturas a ON a.user_id = s.dona_user_id
    WHERE s.id = p_salao_id
      AND a.plano = 'salao'
      AND a.status IN ('active', 'trialing')
  )
$function$;
