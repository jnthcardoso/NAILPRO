# Lumen — regras do projeto

SaaS de gestão para nail designers/salões (React + Vite + Supabase, deploy no Vercel).
Duas pontas: a **dona** (telas internas: agenda, clientes, financeiro, metas, equipe, admin)
e a **cliente do salão** (página pública de agendamento em `/agendar/:slug`).
Banco Supabase: projeto **NAILPRO** (`mfovxxzxcawtlwflrrbp`).

## Deploy
- Commitar e dar push **direto na branch `main`** (sem branch/PR).
- Push na `main` = **deploy automático no Vercel → Lumen em produção**.

## SEGURANÇA — sempre cumprir antes de cada push para a `main`
- **Rodar o build** (`npm run build`) e confirmar que passou. Nunca subir código quebrado.
- **Nunca** commitar senhas/chaves. O `.env` fica fora do Git.
- **Mudança no banco** (migration/RPC): explicar em português simples o que faz e o risco
  **antes** de aplicar; versionar o `.sql` em `supabase/migrations/`.
- **Operação destrutiva** (apagar dados, conta, coluna): **sempre pedir confirmação** antes.
- O dono não é desenvolvedor: explicar decisões e riscos em linguagem simples.

## Banco de dados
- Migrations versionadas em `supabase/migrations/` — mantidas **em sincronia** com o banco real.
- Ao alterar o schema, criar a migration correspondente no mesmo commit.
