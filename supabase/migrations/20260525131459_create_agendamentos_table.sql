
create table agendamentos (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  cliente_id uuid references clientes(id) on delete set null,
  data date not null,
  horario time not null,
  servico text not null,
  valor numeric(10,2) default 0,
  status text default 'pendente' check (status in ('pendente','confirmado','realizado','cancelado')),
  observacoes text,
  created_at timestamptz default now()
);

alter table agendamentos enable row level security;

create policy "agendamentos: owner only" on agendamentos
  for all using (auth.uid() = user_id);
