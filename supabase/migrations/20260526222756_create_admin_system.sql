
-- Tabela de admins (whitelist por email)
CREATE TABLE IF NOT EXISTS public.admins (
  email TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- Ninguém lê admins direto (só via funções SECURITY DEFINER)
-- (sem policies = ninguém vê)

-- Adiciona o admin inicial (o dono)
INSERT INTO public.admins (email) VALUES ('vagasjonathancardoso@gmail.com')
ON CONFLICT DO NOTHING;

-- ===========================
-- RPC: listar todos os usuários (admin only)
-- ===========================
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
    SELECT 1 FROM public.admins WHERE email = (auth.jwt() ->> 'email')
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
    a.status::TEXT,
    a.plano::TEXT,
    a.ciclo::TEXT,
    a.trial_termina_em,
    a.periodo_termina_em,
    (SELECT COUNT(*) FROM public.clientes cl WHERE cl.user_id = u.id)
  FROM auth.users u
  LEFT JOIN public.configuracoes c ON c.user_id = u.id
  LEFT JOIN public.assinaturas a ON a.user_id = u.id
  ORDER BY u.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_listar_usuarios() TO authenticated;

-- ===========================
-- RPC: ativar assinatura (admin only)
-- ===========================
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
    SELECT 1 FROM public.admins WHERE email = (auth.jwt() ->> 'email')
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

GRANT EXECUTE ON FUNCTION public.admin_ativar_assinatura(UUID, TEXT, TEXT) TO authenticated;

-- ===========================
-- RPC: cancelar assinatura (admin only)
-- ===========================
CREATE OR REPLACE FUNCTION public.admin_cancelar_assinatura(p_user_id UUID)
RETURNS void
SECURITY DEFINER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.admins WHERE email = (auth.jwt() ->> 'email')
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  UPDATE public.assinaturas
  SET status = 'canceled', cancelada_em = NOW()
  WHERE user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_cancelar_assinatura(UUID) TO authenticated;

-- ===========================
-- RPC: estender trial (admin only)
-- ===========================
CREATE OR REPLACE FUNCTION public.admin_estender_trial(p_user_id UUID, p_dias INT)
RETURNS void
SECURITY DEFINER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.admins WHERE email = (auth.jwt() ->> 'email')
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  UPDATE public.assinaturas
  SET status = 'trialing', trial_termina_em = NOW() + (p_dias || ' days')::INTERVAL
  WHERE user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_estender_trial(UUID, INT) TO authenticated;

-- ===========================
-- RPC: verificar se sou admin
-- ===========================
CREATE OR REPLACE FUNCTION public.sou_admin()
RETURNS BOOLEAN
SECURITY DEFINER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admins WHERE email = (auth.jwt() ->> 'email')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sou_admin() TO authenticated;
