import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { differenceInDays } from 'date-fns'

// Preço de cada usuário adicional (login próprio além da dona/admin) — só no Pro
export const PRECO_USUARIO_ADICIONAL = 4490 // R$ 44,90/mês por usuário

export const PLANOS = {
  solo: {
    id: 'solo',
    nome: 'Solo',
    precoMensalAnual: 9700,    // R$ 97,00/mês — cobrado anualmente
    precoMensalMensal: 12700,  // R$ 127,00/mês — cobrado mensalmente (sem fidelidade)
    precoAnual: 116400,        // R$ 97 × 12 = R$ 1.164,00/ano
    cor: '#8B2655',
    limites: {
      clientes: 40,
      agendaPublica: false,
      lembretesWhatsapp: false,
      googleCalendar: false,
      exportPDF: false,
      relatoriosAvancados: false,
      usuariosAdicionais: false,
    },
    features: [
      '✓ Até 40 clientes',
      '✓ 1 login de administrador',
      '✓ Agenda completa (dia, semana, mês)',
      '✓ Pagamento em até 2 formas (PIX, crédito, débito, dinheiro)',
      '✓ Financeiro completo com DRE',
      '✓ Controle de despesas por categoria',
      '✓ Metas com projeção inteligente',
      '✓ KPI: faturamento por serviço',
      '✓ Avisos e alertas do salão',
      '✓ Alertas de clientes sumidas e aniversariantes',
      '✗ Lembretes WhatsApp automáticos',
      '✗ KPIs avançados (retenção de clientes)',
      '✗ Exportar relatórios PDF',
      '✗ Agenda online (link público)',
      '✗ Google Calendar',
      '✗ Logins adicionais para equipe',
    ],
  },
  pro: {
    id: 'pro',
    nome: 'Pro',
    precoMensalAnual: 17900,   // R$ 179,00/mês — cobrado anualmente
    precoMensalMensal: 22900,  // R$ 229,00/mês — cobrado mensalmente (sem fidelidade)
    precoAnual: 214800,        // R$ 179 × 12 = R$ 2.148,00/ano
    cor: '#D4AF37',
    limites: {
      clientes: Infinity,
      agendaPublica: true,
      lembretesWhatsapp: true,
      googleCalendar: true,
      exportPDF: true,
      relatoriosAvancados: true,
      usuariosAdicionais: false,
    },
    features: [
      '✓ Clientes ilimitadas',
      '✓ 1 login (ideal pra quem atende sozinha)',
      '✓ Agenda completa (dia, semana, mês)',
      '✓ Pagamento em até 2 formas (PIX, crédito, débito, dinheiro)',
      '✓ Financeiro completo com DRE',
      '✓ Controle de despesas por categoria',
      '✓ Metas com projeção inteligente',
      '✓ KPIs avançados (retenção, novas clientes, faturamento por serviço)',
      '✓ Exportar relatórios PDF (mensal e anual)',
      '✓ Lembretes WhatsApp automáticos',
      '✓ Avisos e alertas do salão',
      '✓ Alertas de clientes sumidas e aniversariantes',
      '✓ Agenda online (link público)',
      '✓ Integração Google Calendar',
      '✓ Suporte prioritário via WhatsApp',
      '✗ Logins para equipe (disponível no Salão)',
    ],
  },
  salao: {
    id: 'salao',
    nome: 'Salão',
    precoMensalAnual: 19900,   // R$ 199,00/mês — cobrado anualmente
    precoMensalMensal: 24900,  // R$ 249,00/mês — cobrado mensalmente (sem fidelidade)
    precoAnual: 238800,        // R$ 199 × 12 = R$ 2.388,00/ano
    cor: '#6366F1',
    limites: {
      clientes: Infinity,
      agendaPublica: true,
      lembretesWhatsapp: true,
      googleCalendar: true,
      exportPDF: true,
      relatoriosAvancados: true,
      usuariosAdicionais: true,
    },
    features: [
      '✓ Tudo do Pro, para o salão inteiro',
      '✓ Login da dona + recepcionista inclusos',
      `✓ Manicures adicionais (R$ 44,90/mês cada)`,
      '✓ Papéis: dona, recepcionista e profissional',
      '✓ Cada profissional vê só a própria agenda e financeiro',
      '✓ Recepcionista gerencia agenda e financeiro de todas',
      '✓ Clientes ilimitadas',
      '✓ Financeiro completo com DRE',
      '✓ Metas com projeção inteligente',
      '✓ KPIs avançados (retenção, novas clientes, faturamento por serviço)',
      '✓ Exportar relatórios PDF (mensal e anual)',
      '✓ Lembretes WhatsApp automáticos',
      '✓ Agenda online (link público)',
      '✓ Integração Google Calendar',
      '✓ Suporte prioritário via WhatsApp',
    ],
  },
}

// Compatibilidade com assinaturas antigas (plano='starter' no banco)
PLANOS.starter = { ...PLANOS.solo, id: 'starter', nome: 'Solo' }

// WhatsApp do suporte para assinaturas (você recebe as solicitações aqui)
export const SUPORTE_WHATSAPP = import.meta.env.VITE_SUPORTE_WHATSAPP || '5554999419628'

function formatPreco(centavos) {
  return (centavos / 100).toFixed(2).replace('.', ',')
}

export { formatPreco }

const AssinaturaContext = createContext({})

export function AssinaturaProvider({ children }) {
  const { user } = useAuth()
  const [assinatura, setAssinatura] = useState(null)
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(async () => {
    if (!user?.id) { setLoading(false); return }
    const { data } = await supabase.from('assinaturas')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    setAssinatura(data)
    setLoading(false)
  }, [user?.id])

  useEffect(() => { carregar() }, [carregar])

  const plano = assinatura ? (PLANOS[assinatura.plano] || PLANOS.pro) : PLANOS.pro
  const status = assinatura?.status || 'trialing'
  const isTrialing = status === 'trialing'
  const isActive = status === 'active'
  const isExpired = status === 'expired' || status === 'canceled'

  let diasRestantesTrial = null
  let trialAcabou = false
  if (isTrialing && assinatura?.trial_termina_em) {
    const dias = differenceInDays(new Date(assinatura.trial_termina_em), new Date())
    diasRestantesTrial = Math.max(0, dias)
    trialAcabou = new Date(assinatura.trial_termina_em) < new Date()
  }

  function temAcesso(feature) {
    if (isActive || (isTrialing && !trialAcabou)) {
      return plano.limites[feature] === true || plano.limites[feature] === Infinity
    }
    return false
  }

  function dentroDoLimite(feature, valorAtual) {
    if (isActive || (isTrialing && !trialAcabou)) {
      const limite = plano.limites[feature]
      if (limite === Infinity) return true
      return valorAtual < limite
    }
    return false
  }

  const precisaUpgrade = trialAcabou || isExpired
  const podeUsuariosAdicionais = plano?.limites?.usuariosAdicionais === true

  let contrato = null
  if (isActive && assinatura?.periodo_termina_em) {
    const fim = new Date(assinatura.periodo_termina_em)
    const hoje = new Date()
    const diasRestantes = Math.max(0, differenceInDays(fim, hoje))
    const mesesRestantes = Math.min(12, Math.max(0, Math.ceil(diasRestantes / 30)))
    const mensalidadeCentavos = (plano.precoMensalAnual || Math.round(plano.precoAnual / 12)) + (assinatura.licencas_adicionais || 0) * PRECO_USUARIO_ADICIONAL
    const multaCentavos = Math.round(0.5 * mensalidadeCentavos * mesesRestantes)
    contrato = {
      inicio: assinatura.periodo_inicia_em,
      fim: assinatura.periodo_termina_em,
      diasRestantes,
      mesesRestantes,
      fidelidadeMeses: 12,
      mensalidadeCentavos,
      multaCentavos,
      dentroFidelidade: mesesRestantes > 0,
    }
  }

  return (
    <AssinaturaContext.Provider value={{
      assinatura, plano, status, loading,
      isTrialing, isActive, isExpired, trialAcabou,
      diasRestantesTrial, precisaUpgrade,
      podeUsuariosAdicionais, contrato,
      temAcesso, dentroDoLimite, recarregar: carregar,
    }}>
      {children}
    </AssinaturaContext.Provider>
  )
}

export const useAssinatura = () => useContext(AssinaturaContext)

export function useIsAdmin() {
  const { user } = useAuth()
  const [isAdmin, setIsAdmin] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    if (!user?.id) { setChecking(false); return }
    supabase.rpc('sou_admin').then(({ data }) => {
      setIsAdmin(data === true)
      setChecking(false)
    }).catch(() => {
      setIsAdmin(false)
      setChecking(false)
    })
  }, [user?.id])

  return { isAdmin, checking }
}

function sanitizarTexto(str) {
  return (str || '').replace(/[<>'"\\]/g, '').trim().slice(0, 200)
}

export function whatsappAssinarLink({ nomeUsuario, emailUsuario, planoId, usuarios = 0, ciclo = 'anual' }) {
  const plano = PLANOS[planoId] || PLANOS.pro
  const planoNome = plano?.nome || 'Pro'
  const isAnual = ciclo === 'anual'

  const precoBase = isAnual ? plano.precoMensalAnual : plano.precoMensalMensal
  const podeUsuarios = plano.limites?.usuariosAdicionais === true
  const qtdUsuarios = podeUsuarios ? Math.max(0, usuarios) : 0
  const usuariosMes = qtdUsuarios * PRECO_USUARIO_ADICIONAL
  const totalMes = precoBase + usuariosMes
  const totalAno = (plano.precoAnual + usuariosMes * 12)

  const nomeSeguro = sanitizarTexto(nomeUsuario)
  const emailSeguro = sanitizarTexto(emailUsuario)

  const linhaUsuarios = qtdUsuarios > 0
    ? `\n👥 Manicures adicionais: ${qtdUsuarios} × R$ ${formatPreco(PRECO_USUARIO_ADICIONAL)} = R$ ${formatPreco(usuariosMes)}/mês`
    : ''

  const descricaoCiclo = isAnual ? 'Anual — fidelidade 12 meses' : 'Mensal — sem fidelidade'
  const valorCobrado = isAnual
    ? `R$ ${formatPreco(totalMes)}/mês (R$ ${formatPreco(totalAno)}/ano)`
    : `R$ ${formatPreco(totalMes)}/mês (sem fidelidade)`

  const msg = `Olá! Quero assinar a Lumen 💅

📋 Plano: ${planoNome} (${descricaoCiclo})
💰 Mensalidade do plano: R$ ${formatPreco(precoBase)}/mês${linhaUsuarios}
🧾 Total: ${valorCobrado}
👤 Nome: ${nomeSeguro}
📧 E-mail: ${emailSeguro}

Pode me enviar o PIX/link de pagamento? Obrigada!`

  return `https://wa.me/${SUPORTE_WHATSAPP}?text=${encodeURIComponent(msg)}`
}
