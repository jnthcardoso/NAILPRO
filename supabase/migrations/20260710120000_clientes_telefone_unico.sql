-- Trava de WhatsApp duplicado por salão (índice único no banco).
--
-- Contexto: o app já avisa/bloqueia na tela ao cadastrar (Clientes.jsx) e a RPC
-- pública faz "buscar ou criar" por telefone (agenda_publica_criar_agendamento).
-- Este índice é a garantia de última instância: impede, no próprio banco, duas
-- clientes com o mesmo WhatsApp dentro do mesmo salão.
--
-- Decisões:
--  * Normaliza para só dígitos (regexp_replace) — casa com unformatTelefone (app)
--    e com v_tel da RPC pública. Assim "(54) 99999-9999" e "54999999999" colidem.
--  * Índice PARCIAL: ignora telefone nulo/vazio. Cliente sem WhatsApp não colide
--    com outra cliente sem WhatsApp.
--  * É por (salao_id, telefone): cada salão é isolado; um número pode existir em
--    salões diferentes (são bases de clientes distintas).
--
-- ATENÇÃO: esta trava passa a IMPEDIR número compartilhado (ex.: mãe/filha, casal)
-- no mesmo salão. Foi uma decisão consciente do dono (10/07/2026).

create unique index if not exists uq_clientes_salao_telefone_digitos
  on public.clientes (salao_id, regexp_replace(telefone, '\D', '', 'g'))
  where telefone is not null and length(regexp_replace(telefone, '\D', '', 'g')) > 0;
