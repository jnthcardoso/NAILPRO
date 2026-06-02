
create table if not exists configuracoes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nome_salao text default '',
  whatsapp text default '',
  meta_mensal numeric default 4000,
  servicos_padrao text[] default '{}',
  updated_at timestamptz default now()
);

alter table configuracoes enable row level security;

create policy "users can manage own config"
  on configuracoes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
