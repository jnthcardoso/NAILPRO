-- Complemento do hardening anterior: garante a revogação do grant de PUBLIC.
--
-- A migration anterior revogou EXECUTE de anon/authenticated, mas o grant padrão
-- do Postgres é para o papel PUBLIC. Revogar dos papéis não remove o grant de
-- PUBLIC, então as funções continuavam executáveis. Aqui revogamos de PUBLIC.
-- Idempotente e seguro (mesma justificativa da migration 20260610032025).

REVOKE EXECUTE ON FUNCTION public.trigger_stats_cliente_fn()     FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recalcular_stats_cliente(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.protege_membro_dona()          FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_membro_plano()           FROM PUBLIC;
