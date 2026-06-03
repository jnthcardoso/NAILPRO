-- Índices para as consultas mais frequentes (multi-tenant por salao_id + data).
-- Sem eles, Home/Agenda/Financeiro varrem a tabela inteira conforme os dados crescem.
-- Operação segura: índices não alteram nem apagam dados.

-- AGENDAMENTOS (tabela que mais cresce)
CREATE INDEX IF NOT EXISTS idx_agendamentos_salao_data ON public.agendamentos (salao_id, data);
CREATE INDEX IF NOT EXISTS idx_agendamentos_cliente ON public.agendamentos (cliente_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_user_data ON public.agendamentos (user_id, data);

-- PAGAMENTOS
CREATE INDEX IF NOT EXISTS idx_pagamentos_salao_data ON public.pagamentos (salao_id, data);
CREATE INDEX IF NOT EXISTS idx_pagamentos_agendamento ON public.pagamentos (agendamento_id);

-- DESPESAS: passa a indexar por salao_id (as consultas migraram de user_id p/ salao_id)
DROP INDEX IF EXISTS public.idx_despesas_user_data;
CREATE INDEX IF NOT EXISTS idx_despesas_salao_data ON public.despesas (salao_id, data DESC);

-- METAS
CREATE INDEX IF NOT EXISTS idx_metas_salao ON public.metas (salao_id);
