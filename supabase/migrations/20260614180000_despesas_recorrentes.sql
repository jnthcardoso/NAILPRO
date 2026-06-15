-- Despesas recorrentes.
--
-- O QUE FAZ: permite cadastrar uma despesa como recorrente. Ao salvar, o app
-- cria de uma vez os lancamentos dos proximos meses, no MESMO dia, ate uma data
-- limite ("repetir ate"). Dois tipos:
--   - valor fixo:    as copias dos proximos meses entram ja com o valor.
--   - valor variavel: as copias entram EM BRANCO (valor 0, "a preencher"),
--                      pra dona so editar o valor ao chegar naquele mes.
--
-- NAO-DESTRUTIVO: nao apaga nem altera nenhuma despesa existente.
--   - 3 colunas novas (todas com default; linhas antigas continuam validas).
--   - troca a regra do valor: continua exigindo > 0, EXCETO quando a despesa for
--     recorrente variavel (ai aceita 0). Nunca aceita negativo.

ALTER TABLE public.despesas
  ADD COLUMN IF NOT EXISTS recorrencia_id UUID,           -- agrupa a serie (filtrar/apagar juntas)
  ADD COLUMN IF NOT EXISTS valor_variavel BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS valor_a_preencher BOOLEAN NOT NULL DEFAULT false;

-- Regra do valor: > 0 por padrao; 0 permitido so para recorrente variavel.
ALTER TABLE public.despesas DROP CONSTRAINT IF EXISTS despesas_valor_check;
ALTER TABLE public.despesas
  ADD CONSTRAINT despesas_valor_check
  CHECK ((valor > 0) OR (valor_variavel AND valor >= 0));

-- Filtro/agrupamento por serie de recorrencia.
CREATE INDEX IF NOT EXISTS idx_despesas_recorrencia
  ON public.despesas(recorrencia_id) WHERE recorrencia_id IS NOT NULL;
