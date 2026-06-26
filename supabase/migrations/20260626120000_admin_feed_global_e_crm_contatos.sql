-- Admin: feed global de eventos + CRM de contatos (dev only)
-- Risco: zero nos dados existentes — nova tabela + novas funções somente-leitura

-- ── 1. Feed global de eventos (somente-leitura, dev only) ────────────
CREATE OR REPLACE FUNCTION public.admin_rel_feed(p_limit INT DEFAULT 60)
RETURNS TABLE(
  quando TIMESTAMPTZ, tipo TEXT, descricao TEXT,
  user_id UUID, email TEXT, nome TEXT, nome_salao TEXT
)
SECURITY DEFINER LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF NOT sou_dev() THEN RAISE EXCEPTION 'unauthorized'; END IF;

  RETURN QUERY
  SELECT * FROM (

    -- Novos cadastros (últimos 30 dias)
    SELECT u.created_at,
           'cadastro'::TEXT,
           ('Nova conta: ' || COALESCE(u.raw_user_meta_data->>'full_name', u.email))::TEXT,
           u.id, u.email::TEXT,
           COALESCE(u.raw_user_meta_data->>'full_name','')::TEXT,
           COALESCE(conf.nome_salao,'')::TEXT
    FROM auth.users u
    LEFT JOIN public.configuracoes conf ON conf.user_id = u.id
    WHERE u.created_at > now() - interval '30 days'

    UNION ALL

    -- Novos agendamentos (últimos 7 dias)
    SELECT a.created_at, 'agendamento',
           (COALESCE(a.servico,'Atendimento') || ' · ' || to_char(a.data, 'DD/MM'))::TEXT,
           u.id, u.email::TEXT,
           COALESCE(u.raw_user_meta_data->>'full_name','')::TEXT,
           COALESCE(conf.nome_salao,'')::TEXT
    FROM public.agendamentos a
    JOIN auth.users u ON u.id = a.user_id
    LEFT JOIN public.configuracoes conf ON conf.user_id = u.id
    WHERE a.created_at > now() - interval '7 days'

    UNION ALL

    -- Pagamentos (últimos 7 dias)
    SELECT p.created_at, 'pagamento',
           ('R$ ' || replace(to_char(COALESCE(p.valor,0),'FM999990.00'),'.',','))::TEXT,
           u.id, u.email::TEXT,
           COALESCE(u.raw_user_meta_data->>'full_name','')::TEXT,
           COALESCE(conf.nome_salao,'')::TEXT
    FROM public.pagamentos p
    JOIN auth.users u ON u.id = p.user_id
    LEFT JOIN public.configuracoes conf ON conf.user_id = u.id
    WHERE p.created_at > now() - interval '7 days'

    UNION ALL

    -- Novos clientes (últimos 7 dias)
    SELECT cl.created_at, 'cliente',
           ('Cliente: ' || COALESCE(cl.nome,'(sem nome)'))::TEXT,
           u.id, u.email::TEXT,
           COALESCE(u.raw_user_meta_data->>'full_name','')::TEXT,
           COALESCE(conf.nome_salao,'')::TEXT
    FROM public.clientes cl
    JOIN auth.users u ON u.id = cl.user_id
    LEFT JOIN public.configuracoes conf ON conf.user_id = u.id
    WHERE cl.created_at > now() - interval '7 days'

  ) ev
  ORDER BY ev.quando DESC
  LIMIT GREATEST(p_limit, 1);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_rel_feed(INT) TO authenticated;

-- ── 2. CRM de contatos (nova tabela, dev only) ───────────────────────
CREATE TABLE IF NOT EXISTS public.admin_contatos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL,
  canal            TEXT NOT NULL DEFAULT 'whatsapp'
                     CHECK (canal IN ('whatsapp', 'email', 'ligacao', 'outro')),
  resumo           TEXT NOT NULL,
  proximo_followup DATE,
  created_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.admin_contatos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "somente_dev" ON public.admin_contatos;
CREATE POLICY "somente_dev" ON public.admin_contatos
  USING (public.sou_dev())
  WITH CHECK (public.sou_dev());

CREATE OR REPLACE FUNCTION public.admin_listar_contatos(p_user_id UUID DEFAULT NULL)
RETURNS TABLE(id UUID, user_id UUID, canal TEXT, resumo TEXT, proximo_followup DATE, created_at TIMESTAMPTZ)
SECURITY DEFINER LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF NOT sou_dev() THEN RAISE EXCEPTION 'unauthorized'; END IF;
  RETURN QUERY
  SELECT c.id, c.user_id, c.canal, c.resumo, c.proximo_followup, c.created_at
  FROM public.admin_contatos c
  WHERE p_user_id IS NULL OR c.user_id = p_user_id
  ORDER BY c.created_at DESC;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_listar_contatos(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_registrar_contato(
  p_user_id UUID, p_canal TEXT, p_resumo TEXT, p_proximo_followup DATE DEFAULT NULL
)
RETURNS UUID
SECURITY DEFINER LANGUAGE plpgsql SET search_path = public
AS $$
DECLARE v_id UUID;
BEGIN
  IF NOT sou_dev() THEN RAISE EXCEPTION 'unauthorized'; END IF;
  INSERT INTO public.admin_contatos (user_id, canal, resumo, proximo_followup)
  VALUES (p_user_id, p_canal, p_resumo, p_proximo_followup)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_registrar_contato(UUID, TEXT, TEXT, DATE) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_deletar_contato(p_id UUID)
RETURNS VOID
SECURITY DEFINER LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF NOT sou_dev() THEN RAISE EXCEPTION 'unauthorized'; END IF;
  DELETE FROM public.admin_contatos WHERE id = p_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_deletar_contato(UUID) TO authenticated;
