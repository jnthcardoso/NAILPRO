-- Falha de segurança (vazamento): a tabela `configuracoes` liberava LEITURA SEM
-- LOGIN (papel `anon`) da LINHA INTEIRA para qualquer salão com agenda pública
-- ativa. Como a RLS do Postgres filtra linhas (não colunas), o `anon` conseguia
-- ler TODAS as colunas — inclusive `meta_mensal` (meta de faturamento da dona),
-- `user_id`/`salao_id` (IDs internos) e a configuração de lembretes — bastando
-- chamar a API REST direto (o filtro do frontend não protege o banco).
--
-- Correção: trocar a permissão "tabela inteira" por permissão SÓ NAS COLUNAS
-- PÚBLICAS que a página de agendamento realmente precisa. A RLS continua
-- limitando QUAIS linhas (só agenda pública ativa); este GRANT limita QUAIS
-- colunas o anon enxerga.
--
-- Não apaga dado nenhum. A dona (logada / `authenticated`) continua com acesso
-- total às suas próprias configurações — só o visitante anônimo fica restrito.

-- 1) Remove o SELECT amplo (todas as colunas) do anon
REVOKE SELECT ON public.configuracoes FROM anon;

-- 2) Concede SELECT apenas nas colunas públicas usadas em /agendar/:slug
GRANT SELECT (
  slug,
  nome_salao,
  whatsapp,
  servicos_padrao,
  horario_inicio,
  horario_fim,
  duracao_atendimento,
  dias_semana,
  agenda_publica_ativa,
  agenda_externa_url
) ON public.configuracoes TO anon;

-- 3) Defesa em profundidade: o anon nunca deve ESCREVER em configuracoes
--    (a RLS já bloqueia, mas removemos a permissão por garantia).
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.configuracoes FROM anon;
