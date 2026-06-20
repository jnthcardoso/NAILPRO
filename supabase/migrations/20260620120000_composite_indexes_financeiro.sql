-- Índices compostos para as queries mais frequentes do Financeiro.
-- Operação segura: não altera nem apaga dados, reversível com DROP INDEX.

-- Pagamentos: a query padrão filtra salao_id + status + intervalo de data.
-- O índice simples (salao_id, data) já existe mas não cobre o filtro de status.
CREATE INDEX IF NOT EXISTS idx_pagamentos_salao_status_data
  ON public.pagamentos (salao_id, status, data DESC);

-- Despesas: com o filtro de tipo (salão/pessoal) adicionado, convém cobri-lo.
CREATE INDEX IF NOT EXISTS idx_despesas_salao_tipo_data
  ON public.despesas (salao_id, tipo, data DESC);
