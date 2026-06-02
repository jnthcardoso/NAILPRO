
-- Rastrear quando o lembrete foi enviado para cada agendamento
ALTER TABLE agendamentos 
ADD COLUMN IF NOT EXISTS lembrete_enviado_em TIMESTAMPTZ;

-- Configurações de lembretes
ALTER TABLE configuracoes 
ADD COLUMN IF NOT EXISTS lembretes_ativos BOOLEAN DEFAULT TRUE;

ALTER TABLE configuracoes 
ADD COLUMN IF NOT EXISTS mensagem_lembrete TEXT DEFAULT 'Oi {nome}! 💅 Passando pra lembrar do seu horário amanhã ({data}) às {horario} - {servico}. Posso confirmar?';

ALTER TABLE configuracoes 
ADD COLUMN IF NOT EXISTS antecedencia_lembrete_horas INT DEFAULT 24;
