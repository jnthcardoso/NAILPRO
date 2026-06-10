-- Corrige admin_rel_adocao / admin_rel_funil: num UNION, o ORDER BY precisa
-- referenciar a coluna pela POSIÇÃO (não pelo nome). Sem isso o Postgres dá
-- "invalid UNION/INTERSECT/EXCEPT ORDER BY clause" ao executar.
-- Continua só-leitura — nenhum dado é alterado.

CREATE OR REPLACE FUNCTION public.admin_rel_adocao()
RETURNS TABLE(recurso TEXT, usados BIGINT, total BIGINT, ordem INT)
SECURITY DEFINER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE v_total BIGINT;
BEGIN
  IF NOT public.sou_dev() THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT COUNT(*) INTO v_total FROM auth.users;

  RETURN QUERY
  SELECT 'Clientes'::TEXT,                 (SELECT COUNT(DISTINCT cl.user_id) FROM public.clientes cl),       v_total, 1
  UNION ALL
  SELECT 'Agenda'::TEXT,                   (SELECT COUNT(DISTINCT a.user_id) FROM public.agendamentos a),     v_total, 2
  UNION ALL
  SELECT 'Financeiro (pagamentos)'::TEXT,  (SELECT COUNT(DISTINCT p.user_id) FROM public.pagamentos p),       v_total, 3
  UNION ALL
  SELECT 'Despesas'::TEXT,                 (SELECT COUNT(DISTINCT d.user_id) FROM public.despesas d),         v_total, 4
  UNION ALL
  SELECT 'Metas'::TEXT,                    (SELECT COUNT(DISTINCT m.user_id) FROM public.metas m),            v_total, 5
  UNION ALL
  SELECT 'Agenda pública (ativa)'::TEXT,   (SELECT COUNT(*) FROM public.configuracoes c WHERE c.agenda_publica_ativa), v_total, 6
  UNION ALL
  SELECT 'Google Agenda'::TEXT,            (SELECT COUNT(*) FROM public.configuracoes c WHERE c.google_conectado),     v_total, 7
  UNION ALL
  SELECT 'Lembretes ligados'::TEXT,        (SELECT COUNT(*) FROM public.configuracoes c WHERE c.lembretes_ativos),     v_total, 8
  UNION ALL
  SELECT 'Lembrete já enviado'::TEXT,      (SELECT COUNT(DISTINCT a.user_id) FROM public.agendamentos a WHERE a.lembrete_enviado_em IS NOT NULL), v_total, 9
  UNION ALL
  SELECT 'Equipe (licenças extras)'::TEXT, (SELECT COUNT(*) FROM public.assinaturas asn WHERE COALESCE(asn.licencas_adicionais,0) > 0), v_total, 10
  ORDER BY 4;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_rel_funil()
RETURNS TABLE(etapa TEXT, contas BIGINT, ordem INT)
SECURITY DEFINER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT public.sou_dev() THEN RAISE EXCEPTION 'unauthorized'; END IF;

  RETURN QUERY
  SELECT 'Cadastraram'::TEXT,            (SELECT COUNT(*) FROM auth.users),                                  1
  UNION ALL
  SELECT '1ª cliente'::TEXT,             (SELECT COUNT(DISTINCT cl.user_id) FROM public.clientes cl),        2
  UNION ALL
  SELECT '1º agendamento'::TEXT,         (SELECT COUNT(DISTINCT a.user_id) FROM public.agendamentos a),      3
  UNION ALL
  SELECT '1º pagamento'::TEXT,           (SELECT COUNT(DISTINCT p.user_id) FROM public.pagamentos p),        4
  UNION ALL
  SELECT 'Publicou agenda online'::TEXT, (SELECT COUNT(*) FROM public.configuracoes c WHERE c.agenda_publica_ativa), 5
  ORDER BY 3;
END;
$$;
