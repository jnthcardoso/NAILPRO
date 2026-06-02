
create table clientes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  nome text not null,
  telefone text,
  email text,
  data_nascimento date,
  observacoes text,
  ultimo_atendimento date,
  total_visitas int default 0,
  total_gasto numeric(10,2) default 0,
  created_at timestamptz default now()
);

alter table clientes enable row level security;

create policy "clientes: owner only" on clientes
  for all using (auth.uid() = user_id);
