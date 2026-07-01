import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { differenceInDays } from 'date-fns'
import { formatReais, linkWhatsAppCompleto } from '../lib/formatters'

// Preço de cada manicure adicional (login próprio além da dona/recepcionista) — só no Salão.
// DEVE espelhar PRECO_MANICURE em supabase/functions/_shared/precos.ts (× 100, centavos).
export const PRECO_USUARIO_ADICIONAL = 4490 // R$ 44,90/mês por usuário

// Preços exibidos na tela em centavos.
// DEVEM espelhar os valores em supabase/functions/_shared/precos.ts (× 100).
// Ao reajustar: atualize _shared/precos.ts PRIMEIRO, depois ajuste aqui.
export const PLANOS = {
  solo: {
    id: 'solo',
    nome: 'Solo',
    precoMensalAnual: 9700,    // R$ 97,00/mês — cobrado anualmente
    precoMensalMensal: 12700,  // R$ 127,00/mês — cobrado mensalmente (sem fidelidade)
    precoAnual: 116400,        // R$ 97 × 12 = R$ 1.164,00/ano
    cor: '#8B2655',
    subtitulo: 'Pra quem está começando',
    heranca: null,
    diferenciais: [
      'Até 40 clientes',
      'Agenda completa (dia, semana, mês)',
      'Financeiro completo com DRE',
      'Controle de despesas por categoria',
      'Metas com projeção inteligente',
      'Pagamento em até 2 formas (PIX, crédito, débito, dinheiro)',
      'Avisos e alertas do salão',
    ],
    limites: {
      clientes: 40,
      agendaPublica: false,
      lembretesWhatsapp: false,
      googleCalendar: false,
      exportPDF: false,
      relatoriosAvancados: false,
      cobrancaWhatsapp: false,
      contasAPagar: false,
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
      '✓ Avisos e alertas do salão',
      '✓ Alertas de clientes sumidas e aniversariantes',
      '✗ Lembretes WhatsApp automáticos',
      '✗ Confirmação de horário pela cliente (link)',
      '✗ Cobrança por WhatsApp com Pix',
      '✗ Contas a pagar com alerta de vencimento',
      '✗ Indicadores avançados (clientes ativas, cancelamento, ocupação)',
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
    subtitulo: 'Pra quem atende sozinha e quer tudo',
    heranca: 'Solo',
    diferenciais: [
      'Clientes ilimitadas',
      'Lembrete no WhatsApp automático',
      'Confirmação de horário pela cliente (1 toque)',
      'Cobrança por WhatsApp com chave Pix',
      'Contas a pagar com alerta de vencimento',
      'Página de agendamento online (link público)',
      'Integração com Google Calendar',
      'Relatórios em PDF (mensal e anual)',
      'Indicadores que mostram quem (sumidas, cancelamento, ocupação)',
      'Chamar cliente sumida e pedir sinal pelo WhatsApp',
      'Suporte prioritário no WhatsApp',
    ],
    limites: {
      clientes: Infinity,
      agendaPublica: true,
      lembretesWhatsapp: true,
      googleCalendar: true,
      exportPDF: true,
      relatoriosAvancados: true,
      cobrancaWhatsapp: true,
      contasAPagar: true,
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
      '✓ Indicadores: clientes ativas/sumidas, cancelamento, ocupação',
      '✓ Chamar cliente sumida e pedir sinal pelo WhatsApp (1 toque)',
      '✓ Exportar relatórios PDF (mensal e anual)',
      '✓ Lembretes WhatsApp automáticos',
      '✓ Confirmação de horário pela cliente (link)',
      '✓ Cobrança por WhatsApp com Pix',
      '✓ Contas a pagar com alerta de vencimento',
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
    subtitulo: 'Pra quem tem equipe',
    heranca: 'Pro',
    diferenciais: [
      'Logins para a equipe (recepcionista já incluso)',
      'Manicures adicionais (R$ 44,90/mês cada)',
      'Papéis: dona, recepcionista e profissional',
      'Cada profissional vê só a própria agenda e financeiro',
      'Recepcionista gerencia a agenda e o financeiro de todas',
      'Desempenho por profissional (faturamento e atendimentos)',
    ],
    limites: {
      clientes: Infinity,
      agendaPublica: true,
      lembretesWhatsapp: true,
      googleCalendar: true,
      exportPDF: true,
      relatoriosAvancados: true,
      cobrancaWhatsapp: true,
      contasAPagar: true,
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
      '✓ Indicadores avançados + desempenho por profissional',
      '✓ Exportar relatórios PDF (mensal e anual)',
      '✓ Lembretes WhatsApp automáticos',
      '✓ Confirmação de horário pela cliente (link)',
      '✓ Cobrança por WhatsApp com Pix',
      '✓ Contas a pagar com alerta de vencimento',
      '✓ Agenda online (link público)',
      '✓ Integração Google Calendar',
      '✓ Suporte prioritário via WhatsApp',
    ],
  },
}

// Compatibilidade com assinaturas antigas (plano='starter' no banco)
PLANOS.starter = { ...PLANOS.solo, id: 'starter', nome: 'Solo' }

// WhatsApp do suporte para assinaturas (você recebe as solicitações aqui)
export const SUPORTE_WHATSAPP = import.meta.env.VITE_SUPORTE_WHATSAPP || '5554999185715'

// Centavos → "127,50" (sem símbolo). Reaproveita o util compartilhado.
function formatPreco(centavos) {
  return formatReais((centavos || 0) / 100)
}

export { formatPreco }

const AssinaturaContext = createContext({})

export function AssinaturaProvider({ children }) {
  const { user } = useAuth()
  const [assinatura, setAssinatura] = useState(null)
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(async () => {
    if (!user?.id) { setLoading(false); return }
    try {
      // Pega a assinatura mais RECENTE (DESC): se um dia houver mais de uma linha
      // pro mesmo salão (ex.: re-assinatura), vale a atual — nunca uma antiga já vencida.
      const { data } = await supabase.from('assinaturas')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      setAssinatura(data)
    } catch (err) {
      // Falha de rede aqui não pode travar o app em loading pra sempre.
      console.error('AssinaturaContext: falha ao carregar', err)
      setAssinatura(null)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => { carregar() }, [carregar])

  const plano = assinatura ? (PLANOS[assinatura.plano] || PLANOS.pro) : PLANOS.pro
  // Sem linha de assinatura = nega por padrão (pending = "criou conta mas não
  // contratou"). Evita liberar tudo por engano se a assinatura não carregar.
  const status = assinatura?.status || 'pending'
  const isTrialing = status === 'trialing'
  const isActive = status === 'active'
  const isExpired = status === 'expired' || status === 'canceled'
  // 'pending' = conta criada mas ainda não contratada (modelo "pagar primeiro").
  // Sem teste grátis: precisa assinar para acessar o app.
  const isPending = status === 'pending'

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

  const precisaUpgrade = trialAcabou || isExpired || isPending
  const podeUsuariosAdicionais = plano?.limites?.usuariosAdicionais === true

  // Modelo atual: sem fidelidade/multa (anual parcelado, mensal recorrente).
  // Só expomos início e fim do período pago — quem consome usa apenas esses dois.
  let contrato = null
  if (isActive && assinatura?.periodo_termina_em) {
    contrato = {
      inicio: assinatura.periodo_inicia_em,
      fim: assinatura.periodo_termina_em,
    }
  }

  return (
    <AssinaturaContext.Provider value={{
      assinatura, plano, status, loading,
      isTrialing, isActive, isExpired, isPending, trialAcabou,
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

  const descricaoCiclo = isAnual ? 'Anual — até 12× sem juros, sem fidelidade' : 'Mensal — sem fidelidade'
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

  return linkWhatsAppCompleto(SUPORTE_WHATSAPP, msg)
}
