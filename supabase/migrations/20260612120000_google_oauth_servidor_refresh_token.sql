-- Integração Google Agenda no SERVIDOR (authorization code flow + refresh token).
--
-- O QUE FAZ (em português simples):
--   Cria uma "caixa-forte" para guardar a chave-mestra (refresh_token) do Google
--   de cada usuário (dona ou profissional). Com ela, o servidor renova o acesso
--   sozinho, pra sempre, sem abrir popup. É segredo: NINGUÉM lê pelo navegador.
--
-- RISCO: baixo. Só CRIA uma tabela nova; não altera nem apaga nada existente.
--   A flag "google_conectado" (que o app já usa pra mostrar Conectado/Desconectar)
--   continua em configuracoes/agenda_profissional, sem mudança.

create table if not exists public.google_credenciais (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  refresh_token text not null,
  email_google  text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table public.google_credenciais is
  'Chave-mestra (refresh_token) do Google por usuário. Segredo — só acessível pelo service_role via Edge Function.';

-- Trava total: RLS ligado e SEM políticas para anon/authenticated.
-- Resultado: nenhum cliente (navegador) consegue ler/escrever o refresh_token.
-- Apenas o service_role (usado dentro das Edge Functions) acessa, pois ignora o RLS.
alter table public.google_credenciais enable row level security;

revoke all on public.google_credenciais from anon, authenticated;
