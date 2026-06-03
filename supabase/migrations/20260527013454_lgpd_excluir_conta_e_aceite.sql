-- Coluna para registrar aceite de termos (LGPD requer evidência)
ALTER TABLE public.configuracoes
ADD COLUMN IF NOT EXISTS termos_aceitos_em TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS termos_versao TEXT;

-- RPC: usuário exclui a própria conta (direito do titular - LGPD Art. 18)
CREATE OR REPLACE FUNCTION public.excluir_minha_conta()
RETURNS void
SECURITY DEFINER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'nao autenticado';
  END IF;

  -- Deleta o user - CASCADE em todas as tabelas remove os dados
  DELETE FROM auth.users WHERE id = v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.excluir_minha_conta() TO authenticated;

-- RPC: registrar aceite de termos
CREATE OR REPLACE FUNCTION public.aceitar_termos(p_versao TEXT)
RETURNS void
SECURITY DEFINER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'nao autenticado'; END IF;

  UPDATE public.configuracoes
  SET termos_aceitos_em = NOW(), termos_versao = p_versao
  WHERE user_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.aceitar_termos(TEXT) TO authenticated;
