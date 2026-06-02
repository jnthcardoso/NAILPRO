
-- Trigger: ao criar usuário, cria linha em configuracoes com onboarding_completo = FALSE
CREATE OR REPLACE FUNCTION public.handle_new_user_configuracoes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.configuracoes (user_id, onboarding_completo)
  VALUES (NEW.id, FALSE)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_configuracoes ON auth.users;
CREATE TRIGGER on_auth_user_created_configuracoes
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_configuracoes();

-- Cria linha pra usuários que já existem mas não têm configuracoes
INSERT INTO public.configuracoes (user_id, onboarding_completo)
SELECT u.id, FALSE
FROM auth.users u
LEFT JOIN public.configuracoes c ON c.user_id = u.id
WHERE c.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;
