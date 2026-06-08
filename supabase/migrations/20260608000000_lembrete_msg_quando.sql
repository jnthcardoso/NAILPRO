-- Lembretes: troca o "amanhã" fixo da mensagem padrão pela variável {quando}.
-- {quando} é resolvido no app como "hoje" / "amanhã" / "na terça-feira (10/06)",
-- conforme a data do agendamento — assim a mensagem não diz "amanhã" nas abas
-- "Hoje" e "Próximos 7 dias".

-- 1) Atualiza só quem AINDA está com o texto padrão antigo (não mexe em mensagens
--    que a usuária personalizou).
UPDATE configuracoes
SET mensagem_lembrete =
  'Oi {nome}! 💅 Passando pra lembrar do seu horário {quando} às {horario} - {servico}. Posso confirmar?'
WHERE mensagem_lembrete =
  'Oi {nome}! 💅 Passando pra lembrar do seu horário amanhã ({data}) às {horario} - {servico}. Posso confirmar?';

-- 2) Novo padrão da coluna para contas futuras.
ALTER TABLE configuracoes
ALTER COLUMN mensagem_lembrete SET DEFAULT
  'Oi {nome}! 💅 Passando pra lembrar do seu horário {quando} às {horario} - {servico}. Posso confirmar?';
