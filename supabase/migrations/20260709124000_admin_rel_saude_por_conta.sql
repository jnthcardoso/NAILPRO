-- admin_rel_saude() hoje só retorna a lista inteira (contas active/trial). Pra dar suporte à
-- ficha completa de UMA conta (item 5), adiciona parâmetro opcional p_user_id: quando
-- informado, ignora o filtro de status/contas-internas e devolve o score daquela conta
-- específica (mesmo cancelada/expirada), pra não duplicar a lógica de cálculo do score em
-- outro lugar. Sem p_user_id, comportamento idêntico ao de hoje (lista completa).
-- Muda a assinatura (novo parâmetro) — precisa dropar antes de recriar.

DROP FUNCTION IF EXISTS public.admin_rel_saude();

CREATE FUNCTION public.admin_rel_saude(p_user_id UUID DEFAULT NULL)
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
    WHERE (
      (p_user_id IS NOT NULL AND u.id = p_user_id)
      OR (
        p_user_id IS NULL
        AND asn.status IN ('active','trialing')
        AND u.id NOT IN (SELECT public.rel_excluidas())
      )
    )
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

GRANT EXECUTE ON FUNCTION public.admin_rel_saude(UUID) TO authenticated;
