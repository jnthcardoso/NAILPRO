-- Ponto 5: profissional não deve ler toda a base de clientes do salão.
-- Dona/recepcionista veem tudo; profissional vê só clientes que ela criou
-- (user_id = auth.uid(), cobre criar cliente nova na Agenda) ou que estão
-- em algum agendamento dela (profissional_id = meu_membro_id()).
ALTER POLICY clientes_salao_select ON public.clientes
USING (
  salao_id = meu_salao_id()
  AND (
    meu_papel() = ANY (ARRAY['dona'::text, 'recepcionista'::text])
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.agendamentos a
      WHERE a.cliente_id = clientes.id
        AND a.profissional_id = meu_membro_id()
    )
  )
);
