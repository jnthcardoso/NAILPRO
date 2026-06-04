-- Auditoria de seguranca (jun/2026)
-- 1) Endurece a funcao de agendamento publico (anti-abuso): limites de tamanho,
--    telefone numerico e maximo de 5 reservas pendentes por telefone.
-- 2) Revoga EXECUTE das funcoes admin_* do papel anon (defesa em profundidade;
--    elas ja tem trava interna por e-mail na tabela admins).

CREATE OR REPLACE FUNCTION public.agenda_publica_criar_agendamento(
  p_slug text, p_cliente_nome text, p_cliente_telefone text, p_servico text,
  p_data date, p_horario time without time zone, p_observacoes text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID; v_salao_id UUID; v_cliente_id UUID; v_agendamento_id UUID;
  v_tel text := regexp_replace(COALESCE(p_cliente_telefone, ''), '\D', '', 'g');
  v_hoje_local DATE := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_agora_local TIME := (now() AT TIME ZONE 'America/Sao_Paulo')::time;
  v_qtd_pendentes int;
BEGIN
  SELECT user_id, salao_id INTO v_user_id, v_salao_id
  FROM public.configuracoes WHERE slug = p_slug AND agenda_publica_ativa = true LIMIT 1;
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'agenda nao encontrada ou inativa'; END IF;

  -- Validacoes de entrada (anti-abuso de storage / lixo)
  IF p_cliente_nome IS NULL OR LENGTH(TRIM(p_cliente_nome)) < 2 THEN RAISE EXCEPTION 'nome invalido'; END IF;
  IF LENGTH(TRIM(p_cliente_nome)) > 80 THEN RAISE EXCEPTION 'nome muito longo'; END IF;
  IF LENGTH(COALESCE(p_servico, '')) > 80 THEN RAISE EXCEPTION 'servico invalido'; END IF;
  IF LENGTH(COALESCE(p_observacoes, '')) > 300 THEN RAISE EXCEPTION 'observacao muito longa'; END IF;
  IF v_tel !~ '^[0-9]{10,13}$' THEN RAISE EXCEPTION 'telefone invalido'; END IF;

  -- Sem datas/horarios no passado (fuso de Brasilia)
  IF p_data < v_hoje_local THEN RAISE EXCEPTION 'data no passado'; END IF;
  IF p_data = v_hoje_local AND p_horario <= v_agora_local THEN RAISE EXCEPTION 'horario no passado'; END IF;

  -- Anti double-booking
  IF EXISTS (
    SELECT 1 FROM public.agendamentos
    WHERE user_id = v_user_id AND data = p_data AND horario = p_horario AND status <> 'cancelado'
  ) THEN
    RAISE EXCEPTION 'horario ja reservado';
  END IF;

  -- Rate limit: no maximo 5 reservas futuras pendentes por telefone neste salao
  SELECT COUNT(*) INTO v_qtd_pendentes
  FROM public.agendamentos a
  JOIN public.clientes c ON c.id = a.cliente_id
  WHERE a.user_id = v_user_id AND a.status = 'pendente' AND a.data >= v_hoje_local
    AND c.telefone = v_tel;
  IF v_qtd_pendentes >= 5 THEN RAISE EXCEPTION 'limite de agendamentos atingido'; END IF;

  -- Cliente: reusa pelo telefone (normalizado) ou cria
  SELECT id INTO v_cliente_id FROM public.clientes
  WHERE salao_id = v_salao_id AND telefone = v_tel LIMIT 1;
  IF v_cliente_id IS NULL THEN
    INSERT INTO public.clientes (user_id, salao_id, nome, telefone)
    VALUES (v_user_id, v_salao_id, TRIM(p_cliente_nome), v_tel)
    RETURNING id INTO v_cliente_id;
  END IF;

  INSERT INTO public.agendamentos (user_id, salao_id, cliente_id, servico, data, horario, status, observacoes)
  VALUES (v_user_id, v_salao_id, v_cliente_id, p_servico, p_data, p_horario, 'pendente', p_observacoes)
  RETURNING id INTO v_agendamento_id;
  RETURN v_agendamento_id;
END;
$function$;

-- Defesa em profundidade: o papel anon (e PUBLIC) nao precisam executar as funcoes
-- administrativas. Garante o EXECUTE ao authenticated para o painel admin continuar
-- funcionando (a autorizacao real e feita pela trava interna por e-mail na tabela admins).
REVOKE EXECUTE ON FUNCTION
  public.admin_listar_usuarios(),
  public.admin_excluir_usuario(uuid),
  public.admin_ativar_assinatura(uuid, text, text),
  public.admin_cancelar_assinatura(uuid),
  public.admin_estender_trial(uuid, integer),
  public.admin_definir_cortesia(uuid, boolean),
  public.admin_atividade_usuario(uuid, integer)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.admin_listar_usuarios(),
  public.admin_excluir_usuario(uuid),
  public.admin_ativar_assinatura(uuid, text, text),
  public.admin_cancelar_assinatura(uuid),
  public.admin_estender_trial(uuid, integer),
  public.admin_definir_cortesia(uuid, boolean),
  public.admin_atividade_usuario(uuid, integer)
TO authenticated;
