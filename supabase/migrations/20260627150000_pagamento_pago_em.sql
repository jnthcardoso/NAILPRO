-- Marca QUANDO um pagamento foi efetivamente pago. Serve para o recap mensal
-- ("Meu mes") medir "Recebido de pendencias": dinheiro que estava pendente e foi
-- quitado no mes, gracas a aba de pendentes do Lumen lembrar a manicure -- com ou
-- sem o WhatsApp de cobranca.
--
-- RISCO: baixo. ADITIVO e NAO-DESTRUTIVO. So acrescenta a coluna pago_em (nula nos
-- antigos) e um gatilho que a preenche AUTOMATICAMENTE quando o status passa de
-- pendente -> pago (e limpa se voltar pra pendente). Funciona em TODOS os caminhos
-- (Financeiro, Agenda, etc.) sem mexer em nenhuma tela. Pagamentos criados ja como
-- pagos (quitados na hora do atendimento) NAO recebem pago_em -- so os recuperados.

alter table public.pagamentos
  add column if not exists pago_em timestamptz;

create or replace function public.set_pago_em()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
BEGIN
  IF NEW.status = 'pago' AND (OLD.status IS DISTINCT FROM 'pago') THEN
    NEW.pago_em := now();
  ELSIF NEW.status <> 'pago' THEN
    NEW.pago_em := NULL;
  END IF;
  RETURN NEW;
END;
$function$;

drop trigger if exists trg_pagamentos_pago_em on public.pagamentos;
create trigger trg_pagamentos_pago_em
  before update on public.pagamentos
  for each row execute function public.set_pago_em();
