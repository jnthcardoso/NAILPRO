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
// Monta o link "Click to Chat" a partir de um telefone BR (com ou sem máscara)
// e mensagem opcional. Sempre aplica o DDI 55 e codifica o texto. Sem telefone,
// gera um link "compartilhar" (só com texto).
// Usamos api.whatsapp.com/send (e não wa.me) porque o WhatsApp Web/Desktop e
// algumas versões do Android decodificam EMOJI corretamente nesse endpoint —
// no wa.me eles vinham como "�" na caixa de digitar.
export function linkWhatsApp(telefone, mensagem = '') {
  const num = unformatTelefone(telefone)
  const destino = num ? `55${num}` : ''
  const params = []
  if (destino) params.push(`phone=${destino}`)
  if (mensagem) params.push(`text=${encodeURIComponent(mensagem)}`)
  return `https://api.whatsapp.com/send?${params.join('&')}`
}

// Variante para números que já incluem o DDI (ex.: SUPORTE_WHATSAPP = '5554...').
export function linkWhatsAppCompleto(numeroCompleto, mensagem = '') {
  const destino = (numeroCompleto || '').replace(/\D/g, '')
  const params = []
  if (destino) params.push(`phone=${destino}`)
  if (mensagem) params.push(`text=${encodeURIComponent(mensagem)}`)
  return `https://api.whatsapp.com/send?${params.join('&')}`
}

// ─── Slug / URL (link público de agendamento) ───
// 'Vivi Nails ✨' → 'vivi-nails'. Tira acentos, espaços e símbolos.
export function slugify(text) {
  return (text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
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

// ─── Lembretes ───
// Mensagem padrão dos lembretes (usada no banco, na tela de Config e na página de Lembretes).
// Usa {quando} em vez de "amanhã" fixo, pra funcionar nas abas Hoje / Amanhã / Próximos 7 dias.
export const MSG_LEMBRETE_PADRAO =
  'Oi {nome}! 💅 Passando pra lembrar do seu horário {quando} às {horario} - {servico}. Posso confirmar?'

// Texto relativo da data do agendamento: 'hoje', 'amanhã' ou 'na terça-feira (10/06)'.
// Assim o mesmo template serve pra qualquer aba sem dizer "amanhã" quando não é.
export function quandoRelativo(dataStr) {
  const alvo = dataParaDate(dataStr)
  if (!alvo) return ''
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const diff = Math.round((alvo - hoje) / 86400000)
  if (diff === 0) return 'hoje'
  if (diff === 1) return 'amanhã'
  const dias = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']
  const [, m, d] = (dataStr || '').split('-')
  const prep = (alvo.getDay() === 0 || alvo.getDay() === 6) ? 'no' : 'na'
  return `${prep} ${dias[alvo.getDay()]} (${d}/${m})`
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

// ─── CPF (usado como tipo de chave Pix) ───
// Formata progressivamente: 000.000.000-00. Só máscara — não valida dígito verificador.
export function formatCPF(valor) {
  const d = (valor || '').replace(/\D/g, '').slice(0, 11)
  if (d.length > 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
  if (d.length > 6) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  if (d.length > 3) return `${d.slice(0, 3)}.${d.slice(3)}`
  return d
}

export function validarCPF(valor) {
  return (valor || '').replace(/\D/g, '').length === 11
}

export function validarSenha(senha) {
  return (senha || '').length >= 6
}

export function validarNome(nome) {
  return (nome || '').trim().length >= 2
}
