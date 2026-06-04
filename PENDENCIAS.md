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

## 3. Automatizar o programa de indicação
- **Situação atual:** programa **manual** — o cadastro captura "quem indicou" (campo
  `indicado_por`) e o Admin exibe, mas o dono paga a comissão (50% da mensalidade via
  PIX) e aplica o desconto (50% na 1ª mensalidade) na mão.
- **A evoluir no futuro:** gerar link único de indicação por cliente, calcular a
  comissão automaticamente quando a indicada vira pagante, aplicar o desconto na
  cobrança automaticamente, e controlar pago/pendente. A base (campo de indicação)
  já está pronta para isso.

## 4. Refatoração profunda das telas grandes (split em componentes)
- **Agenda — ✅ RESOLVIDO (04/06/2026):** quebrada em 3 passos incrementais
  (`1168 → 630 linhas`, −46%). Constantes (`Agenda.constants.js`), modais
  (`Novo/Editar/Pagamento` em `components/agenda/`), cards (`cards.jsx`), views
  Dia/Semana/Mês/Busca (`views.jsx`) e o drawer de detalhe
  (`DetalheAgendamentoDrawer.jsx`). O `Agenda.jsx` ficou só com estado + lógica.
  Validado de ponta a ponta numa conta real (todas as views, cards, drawer e os
  3 modais), sem regressões. Build OK nos 3 passos.
- **Falta ainda — Configurações (~940 linhas):** mesma ideia (cada aba em seu
  próprio arquivo). Mesmo cuidado: incremental e validado, fica atrás de login.
- **Cuidado importante:** essas telas ficam atrás de login e mudam comportamento
  real. O split deve ser feito **incrementalmente e com validação** (testar cada
  passo numa conta real), não "no escuro". É melhoria interna de manutenção —
  não bloqueia nada nem afeta a usuária.

---
_Registrado em 03/06/2026. Atualizar/remover itens conforme forem resolvidos._
