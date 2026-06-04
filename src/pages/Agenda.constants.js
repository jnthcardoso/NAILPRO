// Constantes da Agenda — extraídas de Agenda.jsx para reaproveitar nos
// componentes de modal/cards sem duplicar.

export const STATUS = {
  confirmado: { label: 'Confirmada', bg: '#DCFCE7', color: '#15803D', border: '#4ADE80' },
  pendente:   { label: 'Aguardando', bg: '#FEF3C7', color: '#92400E', border: '#FCD34D' },
  realizado:  { label: 'Realizado',  bg: '#EDE9FE', color: '#5B21B6', border: '#A78BFA' },
  cancelado:  { label: 'Cancelado',  bg: '#FEE2E2', color: '#B91C1C', border: '#FCA5A5' },
}

export const FORMAS = [
  { value: 'pix',            label: '💠 Pix' },
  { value: 'dinheiro',       label: '💵 Dinheiro' },
  { value: 'cartao_debito',  label: '💳 Débito' },
  { value: 'cartao_credito', label: '💳 Crédito' },
]

export const VIEWS = ['Dia', 'Semana', 'Mês']
