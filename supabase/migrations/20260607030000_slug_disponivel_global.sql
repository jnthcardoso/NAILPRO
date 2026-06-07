-- Auditoria #5: checagem global de disponibilidade do link (slug) de agendamento.
-- A RLS impede o app de "ver" slugs de OUTROS salões, então a checagem ficava incompleta
-- (a manicure podia escolher um link já usado por outro salão e o link dela não funcionar).
-- Esta função SECURITY DEFINER enxerga TODOS os slugs (configuracoes + agenda_profissional)
-- e diz se está livre. Exclui a própria linha da manicure (p_membro_id) pra ela poder re-salvar.
create or replace function public.slug_disponivel(p_slug text, p_membro_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.configuracoes where slug = p_slug
    union all
    select 1 from public.agenda_profissional
      where slug = p_slug and (p_membro_id is null or membro_id <> p_membro_id)
  );
$$;

revoke execute on function public.slug_disponivel(text, uuid) from public, anon;
grant execute on function public.slug_disponivel(text, uuid) to authenticated;
