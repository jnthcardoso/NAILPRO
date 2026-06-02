
-- Adiciona campos de agenda pública à tabela configuracoes
ALTER TABLE configuracoes
  ADD COLUMN IF NOT EXISTS slug text UNIQUE,
  ADD COLUMN IF NOT EXISTS horario_inicio time DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS horario_fim time DEFAULT '18:00',
  ADD COLUMN IF NOT EXISTS duracao_atendimento int DEFAULT 60,
  ADD COLUMN IF NOT EXISTS dias_semana int[] DEFAULT '{1,2,3,4,5}',
  ADD COLUMN IF NOT EXISTS agenda_publica_ativa boolean DEFAULT false;

-- Política: anon pode ler configuracoes pelo slug (para página de agendamento público)
CREATE POLICY "anon read configuracoes by slug"
  ON configuracoes FOR SELECT
  TO anon
  USING (slug IS NOT NULL AND agenda_publica_ativa = true);

-- Política: anon pode ler agendamentos (para checar disponibilidade de horários)
CREATE POLICY "anon read agendamentos availability"
  ON agendamentos FOR SELECT
  TO anon
  USING (true);

-- Política: anon pode inserir agendamentos (para criar agendamento público)
CREATE POLICY "anon insert agendamentos"
  ON agendamentos FOR INSERT
  TO anon
  WITH CHECK (true);

-- Política: anon pode ler clientes por telefone (para identificar cliente já cadastrado)
CREATE POLICY "anon read clientes by phone"
  ON clientes FOR SELECT
  TO anon
  USING (true);

-- Política: anon pode inserir clientes (novo cliente via agendamento público)
CREATE POLICY "anon insert clientes"
  ON clientes FOR INSERT
  TO anon
  WITH CHECK (true);
