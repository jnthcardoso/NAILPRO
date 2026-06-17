-- Ponto 3 — Cobrança no WhatsApp com chave Pix
-- Colunas opcionais; quando vazias, o app usa um texto padrao com variaveis
-- {nome}/{servico}/{valor}/{pix}/{salao}. A chave Pix some da mensagem se vazia.
ALTER TABLE public.configuracoes
  ADD COLUMN IF NOT EXISTS chave_pix    text,
  ADD COLUMN IF NOT EXISTS msg_cobranca text;

-- Ponto 5 — Contas a pagar
-- Despesa "a pagar" vs "paga". Padrao = true para que TODAS as despesas atuais
-- continuem como ja pagas (dinheiro que ja saiu) — nada muda no que existe hoje.
-- Apenas as novas "contas a pagar" nascerao com pago = false.
ALTER TABLE public.despesas
  ADD COLUMN IF NOT EXISTS pago boolean NOT NULL DEFAULT true;
