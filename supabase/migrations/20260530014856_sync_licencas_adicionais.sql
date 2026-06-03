create or replace function public.sync_licencas_adicionais()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_salao uuid;
  v_count int;
begin
  v_salao := coalesce(NEW.salao_id, OLD.salao_id);
  if v_salao is null then
    return coalesce(NEW, OLD);
  end if;

  -- usuários adicionais = membros com login próprio, ativos, que não são a dona/admin
  select count(*) into v_count
  from public.salao_membros
  where salao_id = v_salao
    and user_id is not null
    and papel <> 'dona'
    and ativo = true;

  update public.assinaturas
  set licencas_adicionais = v_count
  where salao_id = v_salao;

  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists trg_sync_licencas on public.salao_membros;
create trigger trg_sync_licencas
  after insert or update or delete on public.salao_membros
  for each row execute function public.sync_licencas_adicionais();

-- backfill: alinha as assinaturas existentes com a contagem real
update public.assinaturas a
set licencas_adicionais = (
  select count(*)
  from public.salao_membros m
  where m.salao_id = a.salao_id
    and m.user_id is not null
    and m.papel <> 'dona'
    and m.ativo = true
);
