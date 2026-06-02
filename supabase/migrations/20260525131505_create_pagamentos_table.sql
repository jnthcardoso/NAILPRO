
create table pagamentos (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  agendamento_id uuid references agendamentos(id) on delete set null,
  valor numeric(10,2) not null,
  status text default 'pendente' check (status in ('pago','pendente')),
  forma text default 'pix' check (forma in ('pix','dinheiro','cartao_debito','cartao_credito')),
  data date not null,
  created_at timestamptz default now()
);

alter table pagamentos enable row level security;

create policy "pagamentos: owner only" on pagamentos
  for all using (auth.uid() = user_id);
