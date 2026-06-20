-- Categorias de despesa personalizadas (criadas pelo próprio salão).
-- Antes só existiam 14 categorias fixas no código; agora o salão pode criar as suas.
-- O id de uma categoria personalizada é o uuid da linha, gravado em
-- despesas.categoria como texto (igual aos ids fixos 'aluguel', 'luz', etc.).

-- 1) Liberar a coluna `categoria`: ela tinha um CHECK que só aceitava os 14 ids
--    fixos. Sem remover, não dá pra gravar uma categoria nova. Aditivo e seguro:
--    nenhum dado é apagado; só deixamos de barrar ids fora da lista antiga.
ALTER TABLE public.despesas DROP CONSTRAINT IF EXISTS despesas_categoria_check;

-- 2) Tabela das categorias do salão.
CREATE TABLE IF NOT EXISTS public.categorias_despesa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salao_id uuid NOT NULL REFERENCES public.saloes(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  label text NOT NULL,
  icon text NOT NULL DEFAULT '📦',
  cor text NOT NULL DEFAULT '#525252',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_categorias_despesa_salao ON public.categorias_despesa(salao_id);

ALTER TABLE public.categorias_despesa ENABLE ROW LEVEL SECURITY;

-- RLS: cada salão só enxerga e mexe nas suas próprias categorias (meu_salao_id()).
DROP POLICY IF EXISTS categorias_despesa_select ON public.categorias_despesa;
DROP POLICY IF EXISTS categorias_despesa_insert ON public.categorias_despesa;
DROP POLICY IF EXISTS categorias_despesa_update ON public.categorias_despesa;
DROP POLICY IF EXISTS categorias_despesa_delete ON public.categorias_despesa;

CREATE POLICY categorias_despesa_select ON public.categorias_despesa
  FOR SELECT USING (salao_id = public.meu_salao_id());
CREATE POLICY categorias_despesa_insert ON public.categorias_despesa
  FOR INSERT WITH CHECK (salao_id = public.meu_salao_id());
CREATE POLICY categorias_despesa_update ON public.categorias_despesa
  FOR UPDATE USING (salao_id = public.meu_salao_id()) WITH CHECK (salao_id = public.meu_salao_id());
CREATE POLICY categorias_despesa_delete ON public.categorias_despesa
  FOR DELETE USING (salao_id = public.meu_salao_id());
