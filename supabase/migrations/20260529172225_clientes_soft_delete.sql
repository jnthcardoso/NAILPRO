alter table public.clientes add column if not exists arquivada boolean not null default false;
update public.clientes set arquivada = false where arquivada is null;
create index if not exists idx_clientes_arquivada on public.clientes(salao_id, arquivada);
