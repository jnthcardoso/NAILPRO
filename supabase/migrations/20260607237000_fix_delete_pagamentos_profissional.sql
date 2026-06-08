-- Corrige assimetria na RLS de pagamentos: a policy de DELETE só permitia
-- dona/recepcionista, enquanto SELECT e UPDATE já liberam a profissional para
-- os pagamentos dos atendimentos DELA. Resultado: a manicure conseguia editar,
-- mas não apagar o próprio pagamento — então o fluxo "apagar e reinserir"
-- (registrar pagamento) deixava os lançamentos antigos pra trás, duplicando.
--
-- Alinhamos o DELETE com as demais policies: dona/recepção mexem em tudo do
-- salão; a profissional, só nos pagamentos dos agendamentos dela.

drop policy if exists "pagamentos_salao_delete" on public.pagamentos;

create policy "pagamentos_salao_delete" on public.pagamentos
for delete
using (
  salao_id = meu_salao_id()
  and (
    meu_papel() = any (array['dona'::text, 'recepcionista'::text])
    or agendamento_id in (
      select id from public.agendamentos where profissional_id = meu_membro_id()
    )
  )
);
