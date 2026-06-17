-- Relatório dev (adoção): remove a métrica "Lembretes ligados".
-- Como os lembretes agora são SEMPRE ativos (toggle removido), essa contagem
-- contaria quase todo mundo e nao diz mais nada. A metrica "Lembrete ja enviado"
-- (quem de fato usou) continua. Renumera as seguintes pra ordem ficar contigua.
-- Continua tudo so-leitura e travado por sou_dev().

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
  SELECT 'Lembrete já enviado'::TEXT,      (SELECT COUNT(DISTINCT a.user_id) FROM public.agendamentos a WHERE a.lembrete_enviado_em IS NOT NULL AND a.user_id NOT IN (SELECT public.rel_excluidas())), v_total, 8
  UNION ALL
  SELECT 'Equipe (licenças extras)'::TEXT, (SELECT COUNT(*) FROM public.assinaturas asn WHERE COALESCE(asn.licencas_adicionais,0) > 0 AND asn.user_id NOT IN (SELECT public.rel_excluidas())), v_total, 9
  ORDER BY 4;
END;
$$;
