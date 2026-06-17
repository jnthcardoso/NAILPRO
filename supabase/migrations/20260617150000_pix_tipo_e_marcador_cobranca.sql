-- Tipo da chave Pix (cpf | celular | email | aleatoria) — pra reabrir o seletor
-- certo ao recarregar. Opcional; quando vazio, o app assume 'celular'.
ALTER TABLE public.configuracoes
  ADD COLUMN IF NOT EXISTS chave_pix_tipo text;

-- Marcador de "cobrado": quando a dona clica em Cobrar, guardamos a data/hora.
-- Assim o botao vira "Cobrado" (igual aos lembretes) e ela nao cobra 2x sem querer.
ALTER TABLE public.pagamentos
  ADD COLUMN IF NOT EXISTS cobranca_enviada_em timestamptz;
