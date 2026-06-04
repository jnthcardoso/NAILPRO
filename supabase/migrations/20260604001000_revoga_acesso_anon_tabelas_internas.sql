-- Defesa em profundidade (Falha 2 da auditoria): o papel `anon` (visitante sem
-- login) tinha SELECT/INSERT/UPDATE/DELETE concedidos em TODAS as tabelas,
-- inclusive `clientes`, `pagamentos`, `admins` etc. Hoje a RLS bloqueia o acesso
-- (porque `meu_salao_id()` e nulo sem login), entao NAO ha vazamento ativo — mas
-- depender de uma unica camada e arriscado: se um dia uma policy nascer com erro
-- de logica, o buraco fica imediato.
--
-- O agendamento publico NAO precisa desse acesso direto: ele usa as funcoes
-- `agenda_publica_*`, que sao SECURITY DEFINER (donas = postgres) e rodam com o
-- poder do dono, nao do anon. A unica leitura direta do anon e em `configuracoes`
-- (ja restrita as colunas publicas na migration anterior).
--
-- Aqui removemos QUALQUER privilegio do anon nas tabelas internas. Nao altera
-- dados nem afeta a dona (authenticated) nem o fluxo de agendamento publico.

REVOKE ALL ON public.clientes       FROM anon;
REVOKE ALL ON public.agendamentos   FROM anon;
REVOKE ALL ON public.pagamentos     FROM anon;
REVOKE ALL ON public.despesas       FROM anon;
REVOKE ALL ON public.metas          FROM anon;
REVOKE ALL ON public.saloes         FROM anon;
REVOKE ALL ON public.salao_membros  FROM anon;
REVOKE ALL ON public.assinaturas    FROM anon;
REVOKE ALL ON public.admins         FROM anon;
