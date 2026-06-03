ALTER TABLE public.assinaturas
  ADD COLUMN IF NOT EXISTS cortesia boolean NOT NULL DEFAULT false;

DROP FUNCTION IF EXISTS public.admin_listar_usuarios();

CREATE FUNCTION public.admin_listar_usuarios()
 RETURNS TABLE(user_id uuid, email text, nome text, nome_salao text, whatsapp text,
   user_created_at timestamp with time zone, assinatura_status text, assinatura_plano text,
   assinatura_ciclo text, trial_termina_em timestamp with time zone,
   periodo_termina_em timestamp with time zone, total_clientes bigint,
   licencas_adicionais integer, cortesia boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    (SELECT COUNT(*) FROM public.clientes cl WHERE cl.user_id = u.id),
    COALESCE(asn.licencas_adicionais, 0),
    COALESCE(asn.cortesia, false)
  FROM auth.users u
  LEFT JOIN public.configuracoes c ON c.user_id = u.id
  LEFT JOIN public.assinaturas asn ON asn.user_id = u.id
  ORDER BY u.created_at DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_definir_cortesia(p_user_id uuid, p_cortesia boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.admins a WHERE a.email = (auth.jwt() ->> 'email')
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  UPDATE public.assinaturas
  SET cortesia = p_cortesia
  WHERE user_id = p_user_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_excluir_usuario(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_email text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.admins a WHERE a.email = (auth.jwt() ->> 'email')
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = p_user_id;
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'usuario nao encontrado';
  END IF;

  IF EXISTS (SELECT 1 FROM public.admins a WHERE a.email = v_email) THEN
    RAISE EXCEPTION 'nao e possivel excluir uma conta administradora';
  END IF;

  DELETE FROM public.saloes WHERE dona_user_id = p_user_id;
  DELETE FROM public.pagamentos      WHERE user_id = p_user_id;
  DELETE FROM public.agendamentos    WHERE user_id = p_user_id;
  DELETE FROM public.metas           WHERE user_id = p_user_id;
  DELETE FROM public.despesas        WHERE user_id = p_user_id;
  DELETE FROM public.clientes        WHERE user_id = p_user_id;
  DELETE FROM public.salao_membros   WHERE user_id = p_user_id;
  DELETE FROM public.configuracoes   WHERE user_id = p_user_id;
  DELETE FROM public.assinaturas     WHERE user_id = p_user_id;
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$function$;
