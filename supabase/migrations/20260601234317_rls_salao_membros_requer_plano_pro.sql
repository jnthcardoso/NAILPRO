-- Função auxiliar que verifica se o salão tem plano Pro ativo
CREATE OR REPLACE FUNCTION plano_permite_equipe(p_salao_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM saloes s
    JOIN assinaturas a ON a.user_id = s.dona_user_id
    WHERE s.id = p_salao_id
      AND a.plano IN ('pro')
      AND a.status IN ('active', 'trialing')
  )
$$;

-- Policy de INSERT: só permite adicionar membros (não-dona) se o salão for Pro
DROP POLICY IF EXISTS "membros_insert_requer_plano_pro" ON salao_membros;

CREATE POLICY "membros_insert_requer_plano_pro"
ON salao_membros
FOR INSERT
TO authenticated
WITH CHECK (
  papel = 'dona'
  OR plano_permite_equipe(salao_id)
);
