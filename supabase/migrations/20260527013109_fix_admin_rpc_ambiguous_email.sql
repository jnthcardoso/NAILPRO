
-- Recriar com qualificacao explicita (admins.email)
CREATE OR REPLACE FUNCTION public.admin_listar_usuarios()
RETURNS TABLE(
  user_id UUID,
  email TEXT,
  nome TEXT,
  nome_salao TEXT,
  whatsapp TEXT,
  user_created_at TIMESTAMPTZ,
  assinatura_status TEXT,
  assinatura_plano TEXT,
  assinatura_ciclo TEXT,
  trial_termina_em TIMESTAMPTZ,
  periodo_termina_em TIMESTAMPTZ,
  total_clientes BIGINT
)
SECURITY DEFINER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.admins a WHERE a.email = (auth.jwt() ->> 'email')
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.email::TEXT,
    COALESCE(u.raw_user_meta_data->>'full_name', '')::TEXT,
    COALESCE(c.nome_salao, '')::TEXT,
    COALESCE(c.whatsapp, '')::TEXT,
    u.created_at,
    asn.status::TEXT,
    asn.plano::TEXT,
    asn.ciclo::TEXT,
    asn.trial_termina_em,
    asn.periodo_termina_em,
    (SELECT COUNT(*) FROM public.clientes cl WHERE cl.user_id = u.id)
  FROM auth.users u
  LEFT JOIN public.configuracoes c ON c.user_id = u.id
  LEFT JOIN public.assinaturas asn ON asn.user_id = u.id
  ORDER BY u.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_ativar_assinatura(
  p_user_id UUID,
  p_plano TEXT,
  p_ciclo TEXT
)
RETURNS void
SECURITY DEFINER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.admins a WHERE a.email = (auth.jwt() ->> 'email')
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF p_plano NOT IN ('starter', 'pro') THEN
    RAISE EXCEPTION 'plano invalido';
  END IF;
  IF p_ciclo NOT IN ('mensal', 'anual') THEN
    RAISE EXCEPTION 'ciclo invalido';
  END IF;

  UPDATE public.assinaturas
  SET
    status = 'active',
    plano = p_plano,
    ciclo = p_ciclo,
    periodo_inicia_em = NOW(),
    periodo_termina_em = NOW() + (CASE WHEN p_ciclo = 'anual' THEN INTERVAL '1 year' ELSE INTERVAL '1 month' END),
    cancelada_em = NULL
  WHERE user_id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_cancelar_assinatura(p_user_id UUID)
RETURNS void
SECURITY DEFINER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.admins a WHERE a.email = (auth.jwt() ->> 'email')
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  UPDATE public.assinaturas
  SET status = 'canceled', cancelada_em = NOW()
  WHERE user_id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_estender_trial(p_user_id UUID, p_dias INT)
RETURNS void
SECURITY DEFINER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.admins a WHERE a.email = (auth.jwt() ->> 'email')
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  UPDATE public.assinaturas
  SET status = 'trialing', trial_termina_em = NOW() + (p_dias || ' days')::INTERVAL
  WHERE user_id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sou_admin()
RETURNS BOOLEAN
SECURITY DEFINER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admins a WHERE a.email = (auth.jwt() ->> 'email')
  );
END;
$$;
