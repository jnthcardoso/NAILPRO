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

// Valor em reais → "127,50" (sem símbolo). Use quando o "R$" já está no layout.
export function formatReais(reais) {
  return (Number(reais) || 0).toFixed(2).replace('.', ',')
}

// Valor em reais → "R$ 127,50" (com símbolo). Formato padrão para exibição.
export function formatBRL(reais) {
  return (Number(reais) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// ─── WhatsApp ───
// Monta link wa.me a partir de um telefone BR (com ou sem máscara) e mensagem
// opcional. Sempre aplica o DDI 55 e codifica o texto. Sem telefone, gera um
// link "compartilhar" (só com texto).
export function linkWhatsApp(telefone, mensagem = '') {
  const num = unformatTelefone(telefone)
  const destino = num ? `55${num}` : ''
  const texto = mensagem ? `?text=${encodeURIComponent(mensagem)}` : ''
  return `https://wa.me/${destino}${texto}`
}

// Variante para números que já incluem o DDI (ex.: SUPORTE_WHATSAPP = '5554...').
export function linkWhatsAppCompleto(numeroCompleto, mensagem = '') {
  const destino = (numeroCompleto || '').replace(/\D/g, '')
  const texto = mensagem ? `?text=${encodeURIComponent(mensagem)}` : ''
  return `https://wa.me/${destino}${texto}`
}

// ─── Datas (string 'YYYY-MM-DD' sem problemas de fuso) ───
// '2026-06-02' → Date no fuso local (evita o shift de UTC do new Date(str)).
export function dataParaDate(str) {
  const [y, m, d] = (str || '').split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

// '2026-06-02' → '02/06/2026'.
export function dataBR(str) {
  const [y, m, d] = (str || '').split('-')
  if (!y || !m || !d) return ''
  return `${d}/${m}/${y}`
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
