-- Hardening: a função de gatilho trigger_stats_pagamento_fn() ficou chamável por
-- anon/authenticated via /rest/v1/rpc. A migration que a criou só fez
-- "revoke from public" — no Supabase isso NÃO tira o acesso dos papéis anon e
-- authenticated. Aqui revogamos explicitamente (igual já foi feito com as outras
-- 4 funções internas na migration 20260610032025).
--
-- O QUE FAZ: tira a permissão de CHAMAR direto essa função de gatilho. Ela continua
--   funcionando normalmente, pois roda por dentro do trigger (como dono do banco).
-- RISCO: zero. É não-destrutivo e reversível (basta um GRANT). Nenhum dado é tocado.

REVOKE EXECUTE ON FUNCTION public.trigger_stats_pagamento_fn() FROM anon, authenticated;
