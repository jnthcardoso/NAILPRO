/**
 * Helpers de formatação e validação de inputs.
 */

// ─── Telefone / WhatsApp brasileiro ───
export function formatTelefone(value) {
  const nums = (value || '').replace(/\D/g, '').slice(0, 11)
  if (nums.length === 0) return ''
  if (nums.length <= 2) return `(${nums}`
  if (nums.length <= 6) return `(${nums.slice(0, 2)}) ${nums.slice(2)}`
  if (nums.length <= 10) return `(${nums.slice(0, 2)}) ${nums.slice(2, 6)}-${nums.slice(6)}`
  return `(${nums.slice(0, 2)}) ${nums.slice(2, 7)}-${nums.slice(7)}`
}

export function unformatTelefone(value) {
  return (value || '').replace(/\D/g, '')
}

// ─── Dinheiro ───
export function formatMoeda(centavosOuValor) {
  const v = Number(centavosOuValor) || 0
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ─── Validadores ───
export function validarEmail(email) {
  // RFC-compatible: local@domain.tld — rejeita espaços, exige TLD de 2+ letras
  return /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test((email || '').trim())
}

export function validarTelefone(telefone) {
  const nums = unformatTelefone(telefone)
  return nums.length === 10 || nums.length === 11
}

export function validarSenha(senha) {
  return (senha || '').length >= 6
}

export function validarNome(nome) {
  return (nome || '').trim().length >= 2
}
