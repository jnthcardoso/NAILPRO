-- Relatório dev: funil trial -> pago. O que já existe (admin_rel_funil/coorte/status) mede
-- uso acumulado ou retenção "ativa hoje", mas não a conversão trial->pago propriamente dita
-- nem o tempo médio até converter. public.assinaturas já guarda trial_inicia_em (início do
-- teste) e periodo_inicia_em (início do primeiro período pago) — usamos o par pra calcular
-- taxa e tempo médio de conversão. Só leitura, travado por sou_dev().

CREATE FUNCTION public.admin_rel_conversao()
RETURNS TABLE(total_cadastros BIGINT, total_convertidos BIGINT, taxa_conversao NUMERIC, dias_medio_conversao NUMERIC)
SECURITY DEFINER LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF NOT public.sou_dev() THEN RAISE EXCEPTION 'unauthorized'; END IF;

  RETURN QUERY
  WITH base AS (
    SELECT a.user_id, a.trial_inicia_em, a.periodo_inicia_em, a.cortesia
    FROM public.assinaturas a
    WHERE a.user_id NOT IN (SELECT public.rel_excluidas())
  )
  SELECT
    count(*)::BIGINT,
    count(*) FILTER (WHERE periodo_inicia_em IS NOT NULL AND NOT cortesia)::BIGINT,
    round(100.0 * count(*) FILTER (WHERE periodo_inicia_em IS NOT NULL AND NOT cortesia)
          / NULLIF(count(*), 0), 1),
    round(avg(extract(epoch FROM (periodo_inicia_em - trial_inicia_em)) / 86400)
          FILTER (WHERE periodo_inicia_em IS NOT NULL AND NOT cortesia AND trial_inicia_em IS NOT NULL), 1)
  FROM base;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_rel_conversao() TO authenticated;
