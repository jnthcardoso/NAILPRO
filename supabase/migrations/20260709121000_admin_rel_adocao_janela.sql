-- Relatório dev (adoção): hoje "usados" é COUNT(DISTINCT user_id) histórico — uma conta
-- que usou 1 vez há 8 meses conta igual a quem usa toda semana. Adiciona "usados_30d"
-- (mesmo critério, mas só quem teve uso do recurso nos últimos 30 dias), pra dar noção de
-- engajamento real. Para os recursos que são "flag ligado/desligado" (agenda pública, Google,
-- licenças extras), não existe um "evento" com data pra filtrar — usados_30d repete o total,
-- já que é um estado permanente, não uma ação recorrente.
-- Continua tudo só-leitura e travado por sou_dev().

-- Muda a assinatura de retorno (coluna nova usados_30d) — precisa dropar antes de recriar.
DROP FUNCTION IF EXISTS public.admin_rel_adocao();

CREATE FUNCTION public.admin_rel_adocao()
RETURNS TABLE(recurso TEXT, usados BIGINT, usados_30d BIGINT, total BIGINT, ordem INT)
SECURITY DEFINER LANGUAGE plpgsql SET search_path = public
AS $$
DECLARE v_total BIGINT;
BEGIN
  IF NOT public.sou_dev() THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT COUNT(*) INTO v_total FROM auth.users WHERE id NOT IN (SELECT public.rel_excluidas());

  RETURN QUERY
  SELECT
    'Clientes'::TEXT,
    (SELECT COUNT(DISTINCT cl.user_id) FROM public.clientes cl WHERE cl.user_id NOT IN (SELECT public.rel_excluidas())),
    (SELECT COUNT(DISTINCT cl.user_id) FROM public.clientes cl WHERE cl.user_id NOT IN (SELECT public.rel_excluidas()) AND cl.created_at >= now() - interval '30 days'),
    v_total, 1
  UNION ALL
  SELECT
    'Agenda'::TEXT,
    (SELECT COUNT(DISTINCT a.user_id) FROM public.agendamentos a WHERE a.user_id NOT IN (SELECT public.rel_excluidas())),
    (SELECT COUNT(DISTINCT a.user_id) FROM public.agendamentos a WHERE a.user_id NOT IN (SELECT public.rel_excluidas()) AND a.created_at >= now() - interval '30 days'),
    v_total, 2
  UNION ALL
  SELECT
    'Financeiro (pagamentos)'::TEXT,
    (SELECT COUNT(DISTINCT p.user_id) FROM public.pagamentos p WHERE p.user_id NOT IN (SELECT public.rel_excluidas())),
    (SELECT COUNT(DISTINCT p.user_id) FROM public.pagamentos p WHERE p.user_id NOT IN (SELECT public.rel_excluidas()) AND p.created_at >= now() - interval '30 days'),
    v_total, 3
  UNION ALL
  SELECT
    'Despesas'::TEXT,
    (SELECT COUNT(DISTINCT d.user_id) FROM public.despesas d WHERE d.user_id NOT IN (SELECT public.rel_excluidas())),
    (SELECT COUNT(DISTINCT d.user_id) FROM public.despesas d WHERE d.user_id NOT IN (SELECT public.rel_excluidas()) AND d.created_at >= now() - interval '30 days'),
    v_total, 4
  UNION ALL
  SELECT
    'Metas'::TEXT,
    (SELECT COUNT(DISTINCT m.user_id) FROM public.metas m WHERE m.user_id NOT IN (SELECT public.rel_excluidas())),
    (SELECT COUNT(DISTINCT m.user_id) FROM public.metas m WHERE m.user_id NOT IN (SELECT public.rel_excluidas()) AND m.created_at >= now() - interval '30 days'),
    v_total, 5
  UNION ALL
  SELECT
    'Agenda pública (ativa)'::TEXT,
    (SELECT COUNT(*) FROM public.configuracoes c WHERE c.agenda_publica_ativa AND c.user_id NOT IN (SELECT public.rel_excluidas())),
    (SELECT COUNT(*) FROM public.configuracoes c WHERE c.agenda_publica_ativa AND c.user_id NOT IN (SELECT public.rel_excluidas())),
    v_total, 6
  UNION ALL
  SELECT
    'Google Agenda'::TEXT,
    (SELECT COUNT(*) FROM public.configuracoes c WHERE c.google_conectado AND c.user_id NOT IN (SELECT public.rel_excluidas())),
    (SELECT COUNT(*) FROM public.configuracoes c WHERE c.google_conectado AND c.user_id NOT IN (SELECT public.rel_excluidas())),
    v_total, 7
  UNION ALL
  SELECT
    'Lembrete já enviado'::TEXT,
    (SELECT COUNT(DISTINCT a.user_id) FROM public.agendamentos a WHERE a.lembrete_enviado_em IS NOT NULL AND a.user_id NOT IN (SELECT public.rel_excluidas())),
    (SELECT COUNT(DISTINCT a.user_id) FROM public.agendamentos a WHERE a.lembrete_enviado_em IS NOT NULL AND a.user_id NOT IN (SELECT public.rel_excluidas()) AND a.lembrete_enviado_em >= now() - interval '30 days'),
    v_total, 8
  UNION ALL
  SELECT
    'Equipe (licenças extras)'::TEXT,
    (SELECT COUNT(*) FROM public.assinaturas asn WHERE COALESCE(asn.licencas_adicionais,0) > 0 AND asn.user_id NOT IN (SELECT public.rel_excluidas())),
    (SELECT COUNT(*) FROM public.assinaturas asn WHERE COALESCE(asn.licencas_adicionais,0) > 0 AND asn.user_id NOT IN (SELECT public.rel_excluidas())),
    v_total, 9
  ORDER BY 5;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_rel_adocao() TO authenticated;
