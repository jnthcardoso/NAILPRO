-- "Já enviei" das Oportunidades da Semana (Home) deixa de viver só no navegador
-- (localStorage) e passa a ser gravado no banco, sincronizando entre aparelhos.
-- Guarda 1 marca por cliente + tipo de oportunidade (aniversário / retorno).
-- Não-destrutivo: cria tabela nova, não toca em dados existentes.
create table if not exists public.oportunidade_contatos (
  salao_id     uuid not null references public.saloes(id)   on delete cascade,
  cliente_id   uuid not null references public.clientes(id) on delete cascade,
  tipo         text not null check (tipo in ('aniv', 'retorno')),
  contatado_em timestamptz not null default now(),
  primary key (salao_id, cliente_id, tipo)
);

alter table public.oportunidade_contatos enable row level security;

-- Cada salão só enxerga/grava os próprios contatos.
drop policy if exists oportunidade_contatos_all on public.oportunidade_contatos;
create policy oportunidade_contatos_all on public.oportunidade_contatos for all
  using (salao_id = public.meu_salao_id())
  with check (salao_id = public.meu_salao_id());

-- Acesso anônimo não tem nada a ver com isso (tela interna).
revoke all on public.oportunidade_contatos from anon;
