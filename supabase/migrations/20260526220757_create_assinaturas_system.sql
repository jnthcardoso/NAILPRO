
-- Tabela de assinaturas
CREATE TABLE IF NOT EXISTS public.assinaturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  plano TEXT NOT NULL DEFAULT 'pro' CHECK (plano IN ('starter', 'pro')),
  ciclo TEXT NOT NULL DEFAULT 'mensal' CHECK (ciclo IN ('mensal', 'anual')),
  status TEXT NOT NULL DEFAULT 'trialing' CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'expired')),
  trial_inicia_em TIMESTAMPTZ DEFAULT NOW(),
  trial_termina_em TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
  periodo_inicia_em TIMESTAMPTZ,
  periodo_termina_em TIMESTAMPTZ,
  cancelada_em TIMESTAMPTZ,
  mp_subscription_id TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.assinaturas ENABLE ROW LEVEL SECURITY;

-- Usuário só vê e atualiza sua própria assinatura
DROP POLICY IF EXISTS "users can read own subscription" ON public.assinaturas;
CREATE POLICY "users can read own subscription" ON public.assinaturas
  FOR SELECT USING (auth.uid() = user_id);

-- Usuário não pode INSERT/UPDATE/DELETE direto (só via service_role/trigger/admin)

-- Trigger: criar assinatura trial automaticamente quando user cria conta
CREATE OR REPLACE FUNCTION public.handle_new_user_assinatura()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.assinaturas (user_id, plano, status, trial_inicia_em, trial_termina_em)
  VALUES (NEW.id, 'pro', 'trialing', NOW(), NOW() + INTERVAL '14 days')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_assinatura ON auth.users;
CREATE TRIGGER on_auth_user_created_assinatura
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_assinatura();

-- Backfill: cria trial pra usuários existentes
INSERT INTO public.assinaturas (user_id, plano, status, trial_inicia_em, trial_termina_em)
SELECT u.id, 'pro', 'trialing', NOW(), NOW() + INTERVAL '14 days'
FROM auth.users u
LEFT JOIN public.assinaturas a ON a.user_id = u.id
WHERE a.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- Trigger pra updated_at
CREATE OR REPLACE FUNCTION public.set_assinatura_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS assinaturas_updated_at ON public.assinaturas;
CREATE TRIGGER assinaturas_updated_at
  BEFORE UPDATE ON public.assinaturas
  FOR EACH ROW EXECUTE FUNCTION public.set_assinatura_updated_at();
