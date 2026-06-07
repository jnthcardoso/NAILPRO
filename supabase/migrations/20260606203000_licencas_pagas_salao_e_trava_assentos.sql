-- Plano Salão: assentos de manicure PAGOS no checkout + trava de uso.
--
-- Contexto: agora o checkout do Asaas cobra "base + N manicures". Este arquivo
-- guarda quantas manicures foram pagas (licencas_pagas) e impede que um salão
-- JÁ PAGO (status active) adicione mais manicures do que pagou. Aumentar depois
-- é feito pelo suporte (que roda via service_role e passa sem a trava).
--
-- Seguro: só ADICIONA uma coluna e aperta um trigger. Não apaga dados.
-- Durante o TESTE (trialing) nada é travado — a dona pode montar a equipe à vontade.

-- 1) Coluna que guarda os assentos de manicure pagos.
alter table public.assinaturas
  add column if not exists licencas_pagas int not null default 0;

-- 2) Backfill: salões que JÁ pagam (active) recebem assentos = nº de manicures
--    ativas hoje, pra ninguém que já usava ficar travado de repente.
update public.assinaturas a
set licencas_pagas = (
  select count(*)
  from public.salao_membros m
  where m.salao_id = a.salao_id
    and m.papel = 'profissional'
    and m.ativo = true
)
where a.plano = 'salao' and a.status = 'active';

-- 3) Trava de uso: no Salão JÁ PAGO, não deixa passar do nº de manicures pagas.
CREATE OR REPLACE FUNCTION public.check_membro_plano()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_status text;
  v_pagas  int;
  v_usadas int;
begin
  -- operações de suporte/admin (service_role) passam sem verificação
  if current_setting('role', true) = 'service_role' then
    return NEW;
  end if;

  -- a dona/admin sempre pode existir (login base do plano)
  if NEW.papel = 'dona' then
    return NEW;
  end if;

  -- recepcionista e profissional exigem o plano Salão ativo (ou em teste)
  if not public.plano_permite_equipe(NEW.salao_id) then
    raise exception 'Adicionar equipe requer o plano Salão ativo. Faça upgrade para o Salão.';
  end if;

  -- Limite de manicures pagas: só vale no Salão JÁ PAGO (active).
  -- No teste (trialing) libera, pra dona montar a equipe e experimentar.
  if NEW.papel = 'profissional' then
    select status, coalesce(licencas_pagas, 0)
      into v_status, v_pagas
    from public.assinaturas
    where salao_id = NEW.salao_id
    order by created_at asc
    limit 1;

    if v_status = 'active' then
      -- conta manicures já existentes (aceitas + convites pendentes), sem a nova
      select count(*) into v_usadas
      from public.salao_membros
      where salao_id = NEW.salao_id
        and papel = 'profissional'
        and ativo = true;

      if v_usadas >= v_pagas then
        raise exception 'Seu plano inclui % manicure(s). Para adicionar mais, fale com o suporte para aumentar seu plano.', v_pagas;
      end if;
    end if;
  end if;

  return NEW;
end;
$function$;
