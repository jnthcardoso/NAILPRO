-- Hardening de segurança: fixa o search_path das funções SECURITY DEFINER de
-- estatísticas de cliente.
--
-- O QUE FAZ: define search_path = public (+ pg_temp) nessas duas funções.
-- POR QUÊ: função SECURITY DEFINER sem search_path fixo roda com o caminho de
--   schema de quem chamou. Um usuário poderia plantar um objeto (ex.: uma tabela
--   "clientes") num schema sob seu controle e fazer a função operar no objeto
--   errado. Fixar o search_path elimina esse vetor.
-- RISCO: praticamente nulo — só altera a resolução de nomes; o corpo das funções
--   não muda e ambas já referenciam apenas objetos do schema public.
-- Advisor: 0011_function_search_path_mutable.

ALTER FUNCTION public.recalcular_stats_cliente(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.trigger_stats_cliente_fn()      SET search_path = public, pg_temp;
