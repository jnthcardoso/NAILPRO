-- Hardening de segurança: reduz a superfície de ataque das funções SECURITY DEFINER.
--
-- O QUE FAZ: tira a permissão de chamar diretamente (via /rest/v1/rpc) 4 funções
--   que são SÓ internas — funções de gatilho (trigger) e auxiliares que o app
--   nunca chama de fora. Elas continuam funcionando normalmente porque rodam
--   por dentro dos gatilhos/funções donas (que executam como o dono do banco).
-- POR QUÊ: por padrão o Postgres concede EXECUTE a todo mundo (anon/authenticated).
--   Mesmo sem vazar dados, expor função interna como endpoint é superfície de
--   ataque desnecessária (advisors 0028/0029).
-- NÃO MEXEMOS em meu_salao_id/meu_papel/meu_membro_id/plano_permite_equipe/
--   sou_admin/slug_disponivel/admin_*/agenda_publica_*/excluir_minha_conta/
--   aceitar_termos: essas SÃO usadas pelas policies de RLS ou chamadas pelo
--   frontend e PRECISAM continuar executáveis (revogar quebraria o acesso).
-- RISCO: baixo. Gatilhos disparam pelo próprio banco (independem de EXECUTE) e
--   recalcular_stats_cliente só é chamada por dentro do gatilho (como dono).

-- Revoga de PUBLIC (grant padrão do Postgres) e também dos papéis explícitos.
REVOKE EXECUTE ON FUNCTION public.trigger_stats_cliente_fn()        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalcular_stats_cliente(uuid)    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protege_membro_dona()             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_membro_plano()              FROM PUBLIC, anon, authenticated;
