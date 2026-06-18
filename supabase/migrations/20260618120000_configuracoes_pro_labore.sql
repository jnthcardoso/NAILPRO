-- Pró-labore ("meu salário"): quanto a dona tira pra ela por mês.
-- Entra no DRE como "(−) Seu salário" → mostra "Sobrou pra reinvestir".
-- Aditivo e seguro: coluna nova com default 0 (nada muda no que já existe).
ALTER TABLE public.configuracoes
  ADD COLUMN IF NOT EXISTS pro_labore numeric NOT NULL DEFAULT 0;
