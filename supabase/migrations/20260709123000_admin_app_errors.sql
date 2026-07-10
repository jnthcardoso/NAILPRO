-- Log básico de erros do app. Hoje não existe nenhum registro — se a cliente encontra um
-- bug, o dev só fica sabendo se ela reclamar. Tabela insert-only: qualquer usuário logado
-- pode registrar um erro DELE MESMO (auth.uid() = user_id), sem ler nada; só o dev lê.

CREATE TABLE public.app_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  mensagem TEXT NOT NULL,
  stack TEXT,
  contexto TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.app_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY app_errors_insert ON public.app_errors
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY app_errors_select ON public.app_errors
  FOR SELECT USING (public.sou_dev());

REVOKE ALL ON public.app_errors FROM anon, PUBLIC;
GRANT INSERT ON public.app_errors TO authenticated;

CREATE FUNCTION public.admin_listar_erros(p_limit INT DEFAULT 50)
RETURNS TABLE(id UUID, user_id UUID, email TEXT, nome_salao TEXT, mensagem TEXT, contexto TEXT, created_at TIMESTAMPTZ)
SECURITY DEFINER LANGUAGE sql SET search_path = public
AS $$
  SELECT e.id, e.user_id, u.email::TEXT, c.nome_salao, e.mensagem, e.contexto, e.created_at
  FROM public.app_errors e
  LEFT JOIN auth.users u ON u.id = e.user_id
  LEFT JOIN public.configuracoes c ON c.user_id = e.user_id
  WHERE public.sou_dev()
  ORDER BY e.created_at DESC
  LIMIT GREATEST(p_limit, 1);
$$;

REVOKE ALL ON FUNCTION public.admin_listar_erros(INT) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_listar_erros(INT) TO authenticated;
