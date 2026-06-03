-- Admin: último acesso + última atividade na listagem, e feed de atividade por usuário.

DROP FUNCTION IF EXISTS public.admin_listar_usuarios();

CREATE FUNCTION public.admin_listar_usuarios()
RETURNS TABLE(
  user_id UUID, email TEXT, nome TEXT, nome_salao TEXT, whatsapp TEXT,
  user_created_at TIMESTAMPTZ, assinatura_status TEXT, assinatura_plano TEXT,
  assinatura_ciclo TEXT, trial_termina_em TIMESTAMPTZ, periodo_termina_em TIMESTAMPTZ,
  total_clientes BIGINT, licencas_adicionais INTEGER, cortesia BOOLEAN,
  ultimo_acesso TIMESTAMPTZ, ultima_atividade TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admins a WHERE a.email = (auth.jwt() ->> 'email')) THEN
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
    COALESCE(asn.cortesia, false),
    u.last_sign_in_at,
    GREATEST(
      (SELECT MAX(cl.created_at) FROM public.clientes cl WHERE cl.user_id = u.id),
      (SELECT MAX(GREATEST(a.created_at, a.updated_at)) FROM public.agendamentos a WHERE a.user_id = u.id),
      (SELECT MAX(p.created_at) FROM public.pagamentos p WHERE p.user_id = u.id),
      (SELECT MAX(GREATEST(d.created_at, d.updated_at)) FROM public.despesas d WHERE d.user_id = u.id),
      (SELECT MAX(m.created_at) FROM public.metas m WHERE m.user_id = u.id),
      c.updated_at
    )
  FROM auth.users u
  LEFT JOIN public.configuracoes c ON c.user_id = u.id
  LEFT JOIN public.assinaturas asn ON asn.user_id = u.id
  ORDER BY u.created_at DESC;
END;
$function$;

-- Feed de atividade recente de um usuário (sem tabela de auditoria — une as tabelas existentes).
CREATE OR REPLACE FUNCTION public.admin_atividade_usuario(p_user_id UUID, p_limit INT DEFAULT 20)
RETURNS TABLE(quando TIMESTAMPTZ, tipo TEXT, descricao TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admins a WHERE a.email = (auth.jwt() ->> 'email')) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  RETURN QUERY
  SELECT ev.quando, ev.tipo, ev.descricao FROM (
    SELECT a.created_at AS quando, 'agendamento'::TEXT AS tipo,
           (COALESCE(a.servico,'Atendimento') || ' · ' || to_char(a.data,'DD/MM/YYYY'))::TEXT AS descricao
    FROM public.agendamentos a WHERE a.user_id = p_user_id
    UNION ALL
    SELECT p.created_at, 'pagamento',
           ('R$ ' || replace(to_char(COALESCE(p.valor,0),'FM999990.00'),'.',',') || ' · ' || COALESCE(p.status,'-'))::TEXT
    FROM public.pagamentos p WHERE p.user_id = p_user_id
    UNION ALL
    SELECT cl.created_at, 'cliente', ('Cliente: ' || COALESCE(cl.nome,'(sem nome)'))::TEXT
    FROM public.clientes cl WHERE cl.user_id = p_user_id
    UNION ALL
    SELECT d.created_at, 'despesa',
           (COALESCE(d.descricao,'Despesa') || ' · R$ ' || replace(to_char(COALESCE(d.valor,0),'FM999990.00'),'.',','))::TEXT
    FROM public.despesas d WHERE d.user_id = p_user_id
    UNION ALL
    SELECT m.created_at, 'meta', ('Meta ' || COALESCE(m.tipo,'') || ' ' || COALESCE(m.periodo,''))::TEXT
    FROM public.metas m WHERE m.user_id = p_user_id
  ) ev
  ORDER BY ev.quando DESC NULLS LAST
  LIMIT GREATEST(p_limit, 1);
END;
$function$;
