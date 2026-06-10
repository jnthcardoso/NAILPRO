-- Relatórios: ignorar contas internas (não são clientes reais).
-- Exclui: qualquer conta cortesia + a conta de desenvolvimento + a conta demo.
-- Assim os números de adoção/funil/SaaS/saúde refletem só clientes de verdade.
-- Continua tudo só-leitura.

CREATE OR REPLACE FUNCTION public.rel_excluidas()
RETURNS SETOF UUID
STABLE
SECURITY DEFINER
LANGUAGE sql
SET search_path = public
AS $$
  SELECT u.id
  FROM auth.users u
  LEFT JOIN public.assinaturas a ON a.user_id = u.id
  WHERE COALESCE(a.cortesia, false) = true
     OR u.email IN ('vagasjonathancardoso@gmail.com', 'demo@lumengestaoempresarial.com.br');
$$;

-- ── Onda 1: adoção ──
CREATE OR REPLACE FUNCTION public.admin_rel_adocao()
RETURNS TABLE(recurso TEXT, usados BIGINT, total BIGINT, ordem INT)
SECURITY DEFINER LANGUAGE plpgsql SET search_path = public
AS $$
DECLARE v_total BIGINT;
BEGIN
  IF NOT public.sou_dev() THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT COUNT(*) INTO v_total FROM auth.users WHERE id NOT IN (SELECT public.rel_excluidas());

  RETURN QUERY
  SELECT 'Clientes'::TEXT,                 (SELECT COUNT(DISTINCT cl.user_id) FROM public.clientes cl WHERE cl.user_id NOT IN (SELECT public.rel_excluidas())), v_total, 1
  UNION ALL
  SELECT 'Agenda'::TEXT,                   (SELECT COUNT(DISTINCT a.user_id) FROM public.agendamentos a WHERE a.user_id NOT IN (SELECT public.rel_excluidas())), v_total, 2
  UNION ALL
  SELECT 'Financeiro (pagamentos)'::TEXT,  (SELECT COUNT(DISTINCT p.user_id) FROM public.pagamentos p WHERE p.user_id NOT IN (SELECT public.rel_excluidas())), v_total, 3
  UNION ALL
  SELECT 'Despesas'::TEXT,                 (SELECT COUNT(DISTINCT d.user_id) FROM public.despesas d WHERE d.user_id NOT IN (SELECT public.rel_excluidas())), v_total, 4
  UNION ALL
  SELECT 'Metas'::TEXT,                    (SELECT COUNT(DISTINCT m.user_id) FROM public.metas m WHERE m.user_id NOT IN (SELECT public.rel_excluidas())), v_total, 5
  UNION ALL
  SELECT 'Agenda pública (ativa)'::TEXT,   (SELECT COUNT(*) FROM public.configuracoes c WHERE c.agenda_publica_ativa AND c.user_id NOT IN (SELECT public.rel_excluidas())), v_total, 6
  UNION ALL
  SELECT 'Google Agenda'::TEXT,            (SELECT COUNT(*) FROM public.configuracoes c WHERE c.google_conectado AND c.user_id NOT IN (SELECT public.rel_excluidas())), v_total, 7
  UNION ALL
  SELECT 'Lembretes ligados'::TEXT,        (SELECT COUNT(*) FROM public.configuracoes c WHERE c.lembretes_ativos AND c.user_id NOT IN (SELECT public.rel_excluidas())), v_total, 8
  UNION ALL
  SELECT 'Lembrete já enviado'::TEXT,      (SELECT COUNT(DISTINCT a.user_id) FROM public.agendamentos a WHERE a.lembrete_enviado_em IS NOT NULL AND a.user_id NOT IN (SELECT public.rel_excluidas())), v_total, 9
  UNION ALL
  SELECT 'Equipe (licenças extras)'::TEXT, (SELECT COUNT(*) FROM public.assinaturas asn WHERE COALESCE(asn.licencas_adicionais,0) > 0 AND asn.user_id NOT IN (SELECT public.rel_excluidas())), v_total, 10
  ORDER BY 4;
END;
$$;

-- ── Onda 1: funil ──
CREATE OR REPLACE FUNCTION public.admin_rel_funil()
RETURNS TABLE(etapa TEXT, contas BIGINT, ordem INT)
SECURITY DEFINER LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF NOT public.sou_dev() THEN RAISE EXCEPTION 'unauthorized'; END IF;

  RETURN QUERY
  SELECT 'Cadastraram'::TEXT,            (SELECT COUNT(*) FROM auth.users u WHERE u.id NOT IN (SELECT public.rel_excluidas())), 1
  UNION ALL
  SELECT '1ª cliente'::TEXT,             (SELECT COUNT(DISTINCT cl.user_id) FROM public.clientes cl WHERE cl.user_id NOT IN (SELECT public.rel_excluidas())), 2
  UNION ALL
  SELECT '1º agendamento'::TEXT,         (SELECT COUNT(DISTINCT a.user_id) FROM public.agendamentos a WHERE a.user_id NOT IN (SELECT public.rel_excluidas())), 3
  UNION ALL
  SELECT '1º pagamento'::TEXT,           (SELECT COUNT(DISTINCT p.user_id) FROM public.pagamentos p WHERE p.user_id NOT IN (SELECT public.rel_excluidas())), 4
  UNION ALL
  SELECT 'Publicou agenda online'::TEXT, (SELECT COUNT(*) FROM public.configuracoes c WHERE c.agenda_publica_ativa AND c.user_id NOT IN (SELECT public.rel_excluidas())), 5
  ORDER BY 3;
END;
$$;

-- ── Onda 2: planos & MRR ──
CREATE OR REPLACE FUNCTION public.admin_rel_planos()
RETURNS TABLE(plano TEXT, ciclo TEXT, ativas BIGINT, mrr_centavos BIGINT)
SECURITY DEFINER LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF NOT public.sou_dev() THEN RAISE EXCEPTION 'unauthorized'; END IF;

  RETURN QUERY
  SELECT
    COALESCE(a.plano,'—')::TEXT,
    COALESCE(a.ciclo,'—')::TEXT,
    COUNT(*)::BIGINT,
    SUM(
      (CASE a.plano WHEN 'pro' THEN 17900 WHEN 'salao' THEN 19900 WHEN 'solo' THEN 9700 WHEN 'starter' THEN 9700 ELSE 9700 END)
      + COALESCE(a.licencas_adicionais,0) * 4490
    )::BIGINT
  FROM public.assinaturas a
  WHERE a.status = 'active'
    AND COALESCE(a.cortesia,false) = false
    AND a.user_id NOT IN (SELECT public.rel_excluidas())
  GROUP BY a.plano, a.ciclo
  ORDER BY a.plano, a.ciclo;
END;
$$;

-- ── Onda 2: status ──
CREATE OR REPLACE FUNCTION public.admin_rel_status()
RETURNS TABLE(status TEXT, contas BIGINT)
SECURITY DEFINER LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF NOT public.sou_dev() THEN RAISE EXCEPTION 'unauthorized'; END IF;

  RETURN QUERY
  SELECT COALESCE(a.status,'—')::TEXT, COUNT(*)::BIGINT
  FROM public.assinaturas a
  WHERE a.user_id NOT IN (SELECT public.rel_excluidas())
  GROUP BY a.status
  ORDER BY COUNT(*) DESC;
END;
$$;

-- ── Onda 2: mês a mês ──
CREATE OR REPLACE FUNCTION public.admin_rel_mensal(p_meses INT DEFAULT 6)
RETURNS TABLE(mes DATE, novas BIGINT, canceladas BIGINT)
SECURITY DEFINER LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF NOT public.sou_dev() THEN RAISE EXCEPTION 'unauthorized'; END IF;

  RETURN QUERY
  WITH meses AS (
    SELECT generate_series(
      date_trunc('month', now()) - ((GREATEST(p_meses,1) - 1) || ' months')::interval,
      date_trunc('month', now()),
      interval '1 month'
    )::date AS mes
  )
  SELECT
    m.mes,
    (SELECT COUNT(*) FROM public.assinaturas a WHERE date_trunc('month', a.periodo_inicia_em)::date = m.mes AND a.user_id NOT IN (SELECT public.rel_excluidas())),
    (SELECT COUNT(*) FROM public.assinaturas a WHERE date_trunc('month', a.cancelada_em)::date = m.mes AND a.user_id NOT IN (SELECT public.rel_excluidas()))
  FROM meses m
  ORDER BY m.mes;
END;
$$;

-- ── Onda 2: coorte ──
CREATE OR REPLACE FUNCTION public.admin_rel_coorte(p_meses INT DEFAULT 6)
RETURNS TABLE(mes DATE, cadastros BIGINT, ativas_hoje BIGINT)
SECURITY DEFINER LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF NOT public.sou_dev() THEN RAISE EXCEPTION 'unauthorized'; END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      date_trunc('month', u.created_at)::date AS mes,
      (asn.status = 'active') AS ativa
    FROM auth.users u
    LEFT JOIN public.assinaturas asn ON asn.user_id = u.id
    WHERE u.created_at >= date_trunc('month', now()) - ((GREATEST(p_meses,1) - 1) || ' months')::interval
      AND u.id NOT IN (SELECT public.rel_excluidas())
  )
  SELECT b.mes, COUNT(*)::BIGINT, COUNT(*) FILTER (WHERE b.ativa)::BIGINT
  FROM base b
  GROUP BY b.mes
  ORDER BY b.mes;
END;
$$;

-- ── Onda 3: saúde ──
CREATE OR REPLACE FUNCTION public.admin_rel_saude()
RETURNS TABLE(
  user_id UUID, nome TEXT, email TEXT, nome_salao TEXT,
  ultimo_acesso TIMESTAMPTZ, ultima_atividade TIMESTAMPTZ,
  agendamentos_30d BIGINT, plano TEXT, status TEXT, score INT
)
SECURITY DEFINER LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF NOT public.sou_dev() THEN RAISE EXCEPTION 'unauthorized'; END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      u.id AS user_id,
      COALESCE(u.raw_user_meta_data->>'full_name','')::TEXT AS nome,
      u.email::TEXT AS email,
      COALESCE(c.nome_salao,'')::TEXT AS nome_salao,
      u.last_sign_in_at AS ultimo_acesso,
      GREATEST(
        (SELECT MAX(cl.created_at) FROM public.clientes cl WHERE cl.user_id = u.id),
        (SELECT MAX(GREATEST(a.created_at, a.updated_at)) FROM public.agendamentos a WHERE a.user_id = u.id),
        (SELECT MAX(p.created_at) FROM public.pagamentos p WHERE p.user_id = u.id),
        c.updated_at
      ) AS ultima_atividade,
      (SELECT COUNT(*) FROM public.agendamentos a WHERE a.user_id = u.id AND a.created_at >= now() - interval '30 days')::BIGINT AS agendamentos_30d,
      asn.plano::TEXT AS plano,
      asn.status::TEXT AS status
    FROM auth.users u
    LEFT JOIN public.configuracoes c ON c.user_id = u.id
    LEFT JOIN public.assinaturas asn ON asn.user_id = u.id
    WHERE asn.status IN ('active','trialing')
      AND u.id NOT IN (SELECT public.rel_excluidas())
  )
  SELECT
    b.user_id, b.nome, b.email, b.nome_salao,
    b.ultimo_acesso, b.ultima_atividade, b.agendamentos_30d, b.plano, b.status,
    CASE
      WHEN b.ultimo_acesso IS NULL OR b.ultimo_acesso < now() - interval '14 days'
        OR b.ultima_atividade IS NULL OR b.ultima_atividade < now() - interval '30 days' THEN 0
      WHEN b.ultimo_acesso >= now() - interval '7 days' AND b.agendamentos_30d >= 5 THEN 2
      ELSE 1
    END AS score
  FROM base b
  ORDER BY score ASC, b.ultima_atividade ASC NULLS FIRST;
END;
$$;
