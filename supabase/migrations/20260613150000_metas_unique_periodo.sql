-- Impede metas duplicadas: uma única meta por salão + tipo + período.
-- Conferido em 13/06/2026: não existem duplicatas, então a trava entra sem conflito.
-- NULLs em salao_id permanecem distintos (comportamento padrão do Postgres), sem risco.
alter table public.metas
  add constraint metas_salao_tipo_periodo_uniq unique (salao_id, tipo, periodo);
