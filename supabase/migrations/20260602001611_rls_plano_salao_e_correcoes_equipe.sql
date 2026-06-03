-- 1. CRÍTICO: remove policy de INSERT permissiva demais em salao_membros.
-- Ela permitia inserir papel='dona' apontando para QUALQUER salao_id (furo
-- cross-tenant). O cadastro inicial da dona já é feito pelo trigger
-- handle_new_user_completo (SECURITY DEFINER), então essa policy é desnecessária.
-- A policy correta (membros_insert) permanece.
DROP POLICY IF EXISTS membros_insert_requer_plano_pro ON public.salao_membros;

-- 2. CRÍTICO: equipe agora é do plano Salão (não mais Pro). Só Salão ATIVO
--    (pago) libera; trial não libera (decisão de produto).
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
      AND a.status = 'active'
  )
$function$;

-- 2b. Trigger de validação alinhado: dona sempre pode; demais papéis exigem
--     plano Salão ativo. (defesa em profundidade junto da policy)
CREATE OR REPLACE FUNCTION public.check_membro_plano()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
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

-- 3. IMPORTANTE: cobrança por profissional ativa. Dona e recepcionista são
--    inclusas no Salão; conta-se só profissional ativa (com ou sem login),
--    batendo com a tela de Equipe.
CREATE OR REPLACE FUNCTION public.sync_licencas_adicionais()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_salao uuid;
  v_count int;
begin
  v_salao := coalesce(NEW.salao_id, OLD.salao_id);
  if v_salao is null then
    return coalesce(NEW, OLD);
  end if;

  -- manicures adicionais = profissionais ativas (dona e recepcionista inclusas)
  select count(*) into v_count
  from public.salao_membros
  where salao_id = v_salao
    and papel = 'profissional'
    and ativo = true;

  update public.assinaturas
  set licencas_adicionais = v_count
  where salao_id = v_salao;

  return coalesce(NEW, OLD);
end;
$function$;
