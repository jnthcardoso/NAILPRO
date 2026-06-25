-- Mensagem de "vamos remarcar?" editável pela dona (Configurações → oportunidades).
-- Usada no insight "cancelaram e não remarcaram" da tela inicial e no botão
-- "Chamar" das clientes que cancelaram sem reagendar. Variáveis: {nome}.
-- Aditiva e segura: coluna de texto nova, opcional (nada muda no que já existe).
ALTER TABLE public.configuracoes
  ADD COLUMN IF NOT EXISTS msg_reagendar text;
