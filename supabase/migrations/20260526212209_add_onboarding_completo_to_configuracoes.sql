
ALTER TABLE configuracoes 
ADD COLUMN IF NOT EXISTS onboarding_completo BOOLEAN DEFAULT FALSE;

-- Marcar como completo para usuários que já têm configurações (não devem ver onboarding)
UPDATE configuracoes SET onboarding_completo = TRUE WHERE nome_salao IS NOT NULL AND nome_salao != '';
