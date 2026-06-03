-- ============================================
-- REMOVE policies anon perigosas
-- ============================================
DROP POLICY IF EXISTS "anon read clientes by phone" ON public.clientes;
DROP POLICY IF EXISTS "anon insert clientes" ON public.clientes;
DROP POLICY IF EXISTS "anon read agendamentos availability" ON public.agendamentos;
DROP POLICY IF EXISTS "anon insert agendamentos" ON public.agendamentos;

-- ============================================
-- RECRIA policies com WITH CHECK em INSERT/UPDATE
-- (evita mudar user_id pra outro usuário)
-- ============================================

-- CLIENTES: dropa e recria sem brechas
DROP POLICY IF EXISTS "clientes: owner only" ON public.clientes;
CREATE POLICY "clientes_select_own" ON public.clientes
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "clientes_insert_own" ON public.clientes
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "clientes_update_own" ON public.clientes
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "clientes_delete_own" ON public.clientes
  FOR DELETE USING (auth.uid() = user_id);

-- AGENDAMENTOS
DROP POLICY IF EXISTS "agendamentos: owner only" ON public.agendamentos;
CREATE POLICY "agendamentos_select_own" ON public.agendamentos
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "agendamentos_insert_own" ON public.agendamentos
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "agendamentos_update_own" ON public.agendamentos
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "agendamentos_delete_own" ON public.agendamentos
  FOR DELETE USING (auth.uid() = user_id);

-- PAGAMENTOS
DROP POLICY IF EXISTS "pagamentos: owner only" ON public.pagamentos;
CREATE POLICY "pagamentos_select_own" ON public.pagamentos
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "pagamentos_insert_own" ON public.pagamentos
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pagamentos_update_own" ON public.pagamentos
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pagamentos_delete_own" ON public.pagamentos
  FOR DELETE USING (auth.uid() = user_id);

-- METAS
DROP POLICY IF EXISTS "owner_metas" ON public.metas;
CREATE POLICY "metas_select_own" ON public.metas
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "metas_insert_own" ON public.metas
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "metas_update_own" ON public.metas
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "metas_delete_own" ON public.metas
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- RPC: leitura limitada de horários ocupados (agenda pública)
-- Retorna apenas data+horario+duracao - nunca cliente nem valor
-- ============================================
CREATE OR REPLACE FUNCTION public.agenda_publica_horarios_ocupados(
  p_slug TEXT,
  p_data DATE
)
RETURNS TABLE(horario TIME)
SECURITY DEFINER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Encontra o user_id dono do slug (apenas se agenda publica ativa)
  SELECT user_id INTO v_user_id
  FROM public.configuracoes
  WHERE slug = p_slug AND agenda_publica_ativa = true
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN; -- não retorna nada
  END IF;

  -- Retorna apenas horários, sem expor nada além
  RETURN QUERY
  SELECT a.horario::TIME
  FROM public.agendamentos a
  WHERE a.user_id = v_user_id
    AND a.data = p_data
    AND a.status NOT IN ('cancelado');
END;
$$;

GRANT EXECUTE ON FUNCTION public.agenda_publica_horarios_ocupados(TEXT, DATE) TO anon, authenticated;

-- ============================================
-- RPC: criar agendamento via agenda pública
-- Cria cliente se não existe + agendamento, tudo no contexto do dono do slug
-- ============================================
CREATE OR REPLACE FUNCTION public.agenda_publica_criar_agendamento(
  p_slug TEXT,
  p_cliente_nome TEXT,
  p_cliente_telefone TEXT,
  p_servico TEXT,
  p_data DATE,
  p_horario TIME,
  p_observacoes TEXT DEFAULT NULL
)
RETURNS UUID
SECURITY DEFINER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_cliente_id UUID;
  v_agendamento_id UUID;
BEGIN
  -- Valida slug e pega user_id
  SELECT user_id INTO v_user_id
  FROM public.configuracoes
  WHERE slug = p_slug AND agenda_publica_ativa = true
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'agenda nao encontrada ou inativa';
  END IF;

  -- Validações básicas
  IF p_cliente_nome IS NULL OR LENGTH(TRIM(p_cliente_nome)) < 2 THEN
    RAISE EXCEPTION 'nome invalido';
  END IF;
  IF p_data < CURRENT_DATE THEN
    RAISE EXCEPTION 'data nao pode estar no passado';
  END IF;

  -- Encontra ou cria o cliente
  SELECT id INTO v_cliente_id
  FROM public.clientes
  WHERE user_id = v_user_id AND telefone = p_cliente_telefone
  LIMIT 1;

  IF v_cliente_id IS NULL THEN
    INSERT INTO public.clientes (user_id, nome, telefone)
    VALUES (v_user_id, p_cliente_nome, p_cliente_telefone)
    RETURNING id INTO v_cliente_id;
  END IF;

  -- Cria o agendamento
  INSERT INTO public.agendamentos (
    user_id, cliente_id, servico, data, horario, status, observacoes
  ) VALUES (
    v_user_id, v_cliente_id, p_servico, p_data, p_horario, 'pendente', p_observacoes
  ) RETURNING id INTO v_agendamento_id;

  RETURN v_agendamento_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.agenda_publica_criar_agendamento(TEXT, TEXT, TEXT, TEXT, DATE, TIME, TEXT) TO anon, authenticated;
