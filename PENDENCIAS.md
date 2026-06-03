# Pendências — conversar no futuro

Anotações de assuntos que ficaram para depois (decisão do dono). Não são bugs;
são políticas declaradas nos documentos legais que ainda não têm rotina técnica
que as cumpra automaticamente.

## 1. Retenção de dados após cancelamento (90 dias)
- **Onde está declarado:** Termos de Uso §5 e Política de Privacidade §6 dizem que,
  após o cancelamento, os dados ficam guardados por **90 dias** para reativação.
- **Situação atual:** não existe nenhuma rotina automática que apague dados após
  esse prazo — na prática, os dados permanecem guardados indefinidamente.
- **A decidir:** queremos cumprir os 90 dias de verdade? Se sim, precisa criar uma
  rotina de limpeza (operação **destrutiva** — exige planejamento e confirmação do
  dono). Alternativa: ajustar o texto legal para refletir a prática atual.

## 2. Backups "diários com retenção de 7 dias"
- **Onde está declarado:** Política de Privacidade §8.
- **Situação atual:** isso depende do plano contratado do Supabase. Conferir se o
  plano atual realmente oferece backup diário com 7 dias de retenção, para não
  prometer além do que é entregue.
- **A decidir:** confirmar o plano do Supabase e, se necessário, ajustar o texto ou
  fazer upgrade do plano.

---
_Registrado em 03/06/2026. Atualizar/remover itens conforme forem resolvidos._
