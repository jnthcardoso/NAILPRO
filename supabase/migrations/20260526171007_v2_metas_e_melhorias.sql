
CREATE TABLE IF NOT EXISTS metas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('semana','mes','ano')),
  periodo text NOT NULL,
  valor_meta numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE metas ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='owner_metas' AND tablename='metas') THEN
    CREATE POLICY "owner_metas" ON metas FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS dias_retorno_alerta int DEFAULT 30;
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS updated_at timestamptz;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS agendamentos_updated_at ON agendamentos;
CREATE TRIGGER agendamentos_updated_at
  BEFORE UPDATE ON agendamentos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
