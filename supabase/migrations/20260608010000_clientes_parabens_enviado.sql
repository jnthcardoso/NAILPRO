-- Registrar quando o parabéns de aniversário foi enviado para cada cliente.
-- Usado no filtro "Aniversários" da página de Clientes (botão "Já enviei").
-- O app considera "enviado este ano" quando o ano dessa data == ano atual,
-- então no próximo aniversário a cliente volta a aparecer como pendente.
ALTER TABLE clientes
ADD COLUMN IF NOT EXISTS parabens_enviado_em TIMESTAMPTZ;
