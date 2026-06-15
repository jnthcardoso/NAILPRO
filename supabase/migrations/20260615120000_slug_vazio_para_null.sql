-- Corrige o bug de "não consigo salvar configurações".
--
-- A coluna configuracoes.slug tem índice UNIQUE. O app salvava slug = '' (string
-- vazia) para todo salão que ainda não definiu um link público de agendamento.
-- Como '' é um valor real (e não NULL), apenas UM salão conseguia gravar ''; os
-- demais batiam na constraint única e o salvamento falhava com erro 23505
-- ("duplicate key"), sem persistir nada. NULL pode se repetir à vontade no índice.
--
-- O app já foi corrigido para gravar NULL no lugar de '' (Configuracoes.jsx).
-- Aqui apenas normalizamos os registros antigos que ficaram com slug = ''.
-- Sem risco: '' nunca foi um link público válido.

update public.configuracoes
set slug = null
where slug = '';
