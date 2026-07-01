-- Restaura o teste grátis de 14 dias no cadastro (volta atrás da migration
-- 20260606213000_pagar_primeiro_sem_teste_gratis.sql).
--
-- Contexto: às vésperas da campanha de tráfego pago, decidiu-se reabrir o
-- self-service: quem cria conta já entra direto no app com 14 dias de trial
-- no plano Salão (testa a equipe também), em vez de cair no paywall.
-- Os botões "Agendar demonstração" da Landing continuam do jeito que estão.
--
-- Seguro: só troca a função do trigger de cadastro (CREATE OR REPLACE).
-- Não mexe em contas existentes nem no fluxo de convite de equipe.

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
  -- convite pendente? (membro de equipe aceita o convite ao criar login)
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

  -- fluxo normal: cria salão próprio com trial de 14 dias no plano Salão
  -- (permite testar equipe durante o trial).
  insert into public.saloes (nome, dona_user_id) values ('Meu Salão', NEW.id) returning id into v_salao_id;
  insert into public.salao_membros (salao_id, user_id, nome, email, papel) values (v_salao_id, NEW.id, 'Dona', NEW.email, 'dona');
  insert into public.configuracoes (user_id, salao_id, onboarding_completo) values (NEW.id, v_salao_id, false) on conflict (user_id) do nothing;
  insert into public.assinaturas (user_id, salao_id, plano, status, trial_inicia_em, trial_termina_em)
    values (NEW.id, v_salao_id, 'salao', 'trialing', now(), now() + interval '14 days') on conflict (user_id) do nothing;
  return NEW;
end;
$function$;
