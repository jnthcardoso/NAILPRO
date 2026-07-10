-- Notas internas do Admin: hoje ficam em localStorage do navegador (somem ao trocar de
-- computador/navegador, sem histórico de autor). Passamos para o banco, no mesmo molde de
-- public.admin_contatos (RLS restrita a sou_admin()).

CREATE TABLE public.admin_notas (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  texto TEXT NOT NULL,
  atualizado_por TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_notas ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_notas_rw ON public.admin_notas
  FOR ALL USING (public.sou_admin()) WITH CHECK (public.sou_admin());

REVOKE ALL ON public.admin_notas FROM anon, PUBLIC;

CREATE FUNCTION public.admin_listar_notas()
RETURNS TABLE(user_id UUID, texto TEXT, updated_at TIMESTAMPTZ)
SECURITY DEFINER LANGUAGE sql SET search_path = public
AS $$
  SELECT n.user_id, n.texto, n.updated_at
  FROM public.admin_notas n
  WHERE public.sou_admin();
$$;

CREATE FUNCTION public.admin_salvar_nota(p_user_id UUID, p_texto TEXT)
RETURNS void
SECURITY DEFINER LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF NOT public.sou_admin() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF trim(coalesce(p_texto, '')) = '' THEN
    DELETE FROM public.admin_notas WHERE user_id = p_user_id;
  ELSE
    INSERT INTO public.admin_notas (user_id, texto, atualizado_por, updated_at)
    VALUES (p_user_id, trim(p_texto), auth.jwt() ->> 'email', now())
    ON CONFLICT (user_id) DO UPDATE
      SET texto = excluded.texto,
          atualizado_por = excluded.atualizado_por,
          updated_at = now();
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_listar_notas() FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.admin_salvar_nota(UUID, TEXT) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_listar_notas() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_salvar_nota(UUID, TEXT) TO authenticated;
