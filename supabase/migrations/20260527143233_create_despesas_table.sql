-- Tabela de despesas/custos
CREATE TABLE IF NOT EXISTS public.despesas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  categoria TEXT NOT NULL CHECK (categoria IN (
    'aluguel', 'agua', 'luz', 'internet', 'telefone',
    'produtos', 'materiais', 'equipamentos',
    'salario', 'imposto', 'marketing', 'manutencao', 'transporte', 'outros'
  )),
  valor NUMERIC(10,2) NOT NULL CHECK (valor > 0),
  data DATE NOT NULL,
  forma_pagamento TEXT,
  recorrente BOOLEAN DEFAULT FALSE,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_despesas_user_data ON public.despesas(user_id, data DESC);

ALTER TABLE public.despesas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "despesas_select_own" ON public.despesas;
DROP POLICY IF EXISTS "despesas_insert_own" ON public.despesas;
DROP POLICY IF EXISTS "despesas_update_own" ON public.despesas;
DROP POLICY IF EXISTS "despesas_delete_own" ON public.despesas;

CREATE POLICY "despesas_select_own" ON public.despesas
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "despesas_insert_own" ON public.despesas
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "despesas_update_own" ON public.despesas
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "despesas_delete_own" ON public.despesas
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_despesas_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS despesas_updated_at ON public.despesas;
CREATE TRIGGER despesas_updated_at
  BEFORE UPDATE ON public.despesas
  FOR EACH ROW EXECUTE FUNCTION public.set_despesas_updated_at();

-- Popular despesas demo para conta de demonstracao
INSERT INTO public.despesas (user_id, descricao, categoria, valor, data, forma_pagamento, recorrente)
SELECT
  (SELECT id FROM auth.users WHERE email = 'contatojcardoso12@gmail.com'),
  descricao, categoria, valor, data::date, forma_pagamento, recorrente
FROM (VALUES
  ('Aluguel do espaco',         'aluguel',     900,  '2026-05-05', 'pix',    true),
  ('Conta de luz',              'luz',         180,  '2026-05-10', 'debito', true),
  ('Conta de agua',             'agua',         65,  '2026-05-10', 'debito', true),
  ('Internet fibra',            'internet',    120,  '2026-05-15', 'debito', true),
  ('Esmaltes (kit colorido)',   'produtos',    240,  '2026-05-08', 'pix',    false),
  ('Gel base e top coat',       'produtos',    180,  '2026-05-12', 'credito', false),
  ('Lixas e algodao',           'materiais',    60,  '2026-05-18', 'dinheiro', false),
  ('Marketing Instagram (ads)', 'marketing',   150,  '2026-05-20', 'credito', false),
  ('Conta de telefone',         'telefone',     45,  '2026-05-22', 'debito', true)
) AS dados(descricao, categoria, valor, data, forma_pagamento, recorrente);

SELECT COUNT(*), SUM(valor) FROM public.despesas
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'contatojcardoso12@gmail.com');
