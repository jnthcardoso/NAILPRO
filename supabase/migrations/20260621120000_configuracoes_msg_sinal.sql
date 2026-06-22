-- Mensagem de "pedir sinal" editável pela dona (Configurações → cobrança).
-- Usada no botão "Pedir sinal" do indicador de Cancelamentos, pra clientes
-- que cancelam muito (reincidência). Variáveis: {nome}, {pix}.
-- Aditivo e seguro: coluna de texto nova, opcional (nada muda no que já existe).
ALTER TABLE public.configuracoes
  ADD COLUMN IF NOT EXISTS msg_sinal text;
