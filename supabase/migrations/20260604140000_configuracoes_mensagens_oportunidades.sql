-- Mensagens editaveis das "Oportunidades da semana" (aniversario e retorno).
-- Colunas opcionais; quando vazias, o app usa um texto padrao com variaveis {nome}/{salao}.
ALTER TABLE public.configuracoes
  ADD COLUMN IF NOT EXISTS msg_aniversario text,
  ADD COLUMN IF NOT EXISTS msg_retorno text;
