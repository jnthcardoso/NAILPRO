-- Modelo "pagar primeiro": cadastro novo NÃO ganha mais teste grátis.
--
-- Contexto: o funil agora é conduzido (anúncio → contato → demonstração →
-- contratação direta com garantia de 7 dias). O self-service de 14 dias grátis
-- foi removido. Conta nova nasce 'pending' (aguardando contratação) e cai direto
-- no paywall de Planos; só libera o app depois de pagar (webhook do Asaas marca
-- 'active') OU de uma liberação manual da dona pelo Admin.
--
-- Seguro: amplia a trava de status (só ADICIONA 'pending') e troca o trigger de
-- cadastro. Não apaga nada. Contas já existentes e convites de equipe seguem iguais.

-- 1) Amplia a trava de status para aceitar 'pending'.
alter table public.assinaturas drop constraint if exists assinaturas_status_check;
alter table public.assinaturas add constraint assinaturas_status_check
  check (status = any (array['pending','trialing','active','past_due','canceled','expired']));

-- 2) Trigger de cadastro: conta nova nasce 'pending' (sem teste grátis).
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

  -- fluxo normal: cria salão próprio SEM teste grátis (pagar primeiro).
  -- Nasce 'pending' -> precisaUpgrade no app -> cai no paywall de Planos.
  insert into public.saloes (nome, dona_user_id) values ('Meu Salão', NEW.id) returning id into v_salao_id;
  insert into public.salao_membros (salao_id, user_id, nome, email, papel) values (v_salao_id, NEW.id, 'Dona', NEW.email, 'dona');
  insert into public.configuracoes (user_id, salao_id, onboarding_completo) values (NEW.id, v_salao_id, false) on conflict (user_id) do nothing;
  insert into public.assinaturas (user_id, salao_id, plano, status)
    values (NEW.id, v_salao_id, 'pro', 'pending') on conflict (user_id) do nothing;
  return NEW;
end;
$function$;
