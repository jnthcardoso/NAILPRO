ALTER TABLE public.configuracoes
ADD COLUMN IF NOT EXISTS agenda_externa_url TEXT;
