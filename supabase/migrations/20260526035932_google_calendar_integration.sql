
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS google_conectado boolean DEFAULT false;
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS google_event_id text;
