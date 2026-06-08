-- Permite que a PROFISSIONAL (manicure) lance e gerencie as DESPESAS DELA.
--
-- Antes, só dona/recepcionista podiam (policy despesas_salao_all), então a
-- profissional recebia "new row violates row-level security policy" ao tentar
-- salvar uma despesa.
--
-- Regra do negócio (escolhida pelo dono): a despesa da profissional é PRIVADA —
-- fica só com ela e NÃO entra no financeiro/DRE do salão da dona. Para garantir
-- a separação, a despesa da profissional é gravada com salao_id = NULL (o
-- financeiro da dona filtra por salao_id, então essas linhas nunca aparecem
-- pra ela). A profissional enxerga as próprias despesas via user_id.
--
-- Policy ADITIVA: não altera a despesas_salao_all (dona/recepcionista seguem
-- iguais). Sem mudança em dados existentes.

create policy "despesas_profissional_own"
on public.despesas
for all
to authenticated
using (
  user_id = auth.uid()
  and meu_papel() = 'profissional'
)
with check (
  user_id = auth.uid()
  and meu_papel() = 'profissional'
  and salao_id is null
);
