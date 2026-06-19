-- Separar dinheiro do salão x dinheiro pessoal da dona.
-- Cada despesa passa a ter um "bolso": 'salao' (custo do negócio) ou 'pessoal'
-- (gasto dela). Despesa pessoal NÃO entra no lucro do salão — vai pro "seu bolso".
-- Aditivo e seguro: default 'salao' → tudo que já existe continua como salão.
ALTER TABLE public.despesas
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'salao';
