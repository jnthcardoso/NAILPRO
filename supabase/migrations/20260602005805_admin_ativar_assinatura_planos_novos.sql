CREATE OR REPLACE FUNCTION public.admin_ativar_assinatura(p_user_id uuid, p_plano text, p_ciclo text)
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

  IF p_plano NOT IN ('solo', 'starter', 'pro', 'salao') THEN
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
$function$;
