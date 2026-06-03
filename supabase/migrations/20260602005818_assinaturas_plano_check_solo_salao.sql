ALTER TABLE public.assinaturas DROP CONSTRAINT IF EXISTS assinaturas_plano_check;
ALTER TABLE public.assinaturas ADD CONSTRAINT assinaturas_plano_check
  CHECK (plano = ANY (ARRAY['solo'::text, 'starter'::text, 'pro'::text, 'salao'::text]));
