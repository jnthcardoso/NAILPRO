-- Ciclo de retorno individual por cliente (em dias).
-- NULL = usa o padrão do salão (configuracoes.dias_retorno_alerta).
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS dias_retorno integer;

COMMENT ON COLUMN public.clientes.dias_retorno IS
  'Ciclo de retorno individual da cliente, em dias. NULL = herda o padrão do salão (configuracoes.dias_retorno_alerta).';

-- Garante valores válidos quando preenchido (entre 1 e 365 dias).
ALTER TABLE public.clientes
  DROP CONSTRAINT IF EXISTS clientes_dias_retorno_check;
ALTER TABLE public.clientes
  ADD CONSTRAINT clientes_dias_retorno_check
  CHECK (dias_retorno IS NULL OR (dias_retorno >= 1 AND dias_retorno <= 365));
