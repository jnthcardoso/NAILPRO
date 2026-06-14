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

// Alerta visual: atendimento REALIZADO com pagamento a receber (pendente ou sem
// pagamento registrado). Usado pra pintar o card de vermelho na agenda.
export const PAG_PENDENTE_COR = '#DC2626'
export const PAG_PENDENTE_BG = '#FEF2F2'
export function temPagamentoPendente(ag) {
  if (ag?.status !== 'realizado') return false
  const pags = ag.pagamentos || []
  return pags.length === 0 || pags.some(p => p.status === 'pendente')
}

// Resumo do pagamento p/ o card/drawer, considerando pagamento em 1 OU 2 formas.
// Retorna null se não há pagamento. pago = todos os lançamentos estão pagos.
// formas = nomes curtos, sem repetir, juntados (ex.: "Pix + Crédito").
export function resumoPagamento(ag) {
  const pags = ag?.pagamentos || []
  if (!pags.length) return null
  const pago = pags.every(p => p.status === 'pago')
  const nomes = pags.map(p => FORMAS.find(f => f.value === p.forma)?.label.split(' ')[1] || p.forma)
  return { pago, formas: [...new Set(nomes)].join(' + ') }
}
