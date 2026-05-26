import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { differenceInDays, differenceInHours } from 'date-fns'

// Configuração de planos
export const PLANOS = {
  starter: {
    id: 'starter',
    nome: 'Starter',
    precoMensal: 4990, // centavos: R$ 49,90
    precoAnual: 49900, // centavos: R$ 499,00
    cor: '#8B2655',
    limites: {
      clientes: 50,
      agendaPublica: false,
      lembretesWhatsapp: false,
      googleCalendar: false,
      exportPDF: false,
      relatoriosAvancados: false,
    },
    features: [
      '✓ Até 50 clientes',
      '✓ Agenda básica',
      '✓ Histórico financeiro',
      '✓ Metas e estimativas',
      '✗ Lembretes WhatsApp',
      '✗ Agenda online (link público)',
      '✗ Google Calendar',
      '✗ Exportar relatórios PDF',
    ],
  },
  pro: {
    id: 'pro',
    nome: 'Pro',
    precoMensal: 9990,
    precoAnual: 99900,
    cor: '#D4AF37',
    limites: {
      clientes: Infinity,
      agendaPublica: true,
      lembretesWhatsapp: true,
      googleCalendar: true,
      exportPDF: true,
      relatoriosAvancados: true,
    },
    features: [
      '✓ Clientes ilimitadas',
      '✓ Agenda completa',
      '✓ Lembretes WhatsApp',
      '✓ Agenda online (link público)',
      '✓ Integração Google Calendar',
      '✓ Exportar relatórios PDF',
      '✓ Foto de perfil + branding',
      '✓ Suporte prioritário',
    ],
  },
}

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
      .eq('user_id', user.id)
      .maybeSingle()
    setAssinatura(data)
    setLoading(false)
  }, [user?.id])

  useEffect(() => { carregar() }, [carregar])

  // Helpers derivados
  const plano = assinatura ? PLANOS[assinatura.plano] : PLANOS.pro // fallback otimista
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

  // Tem acesso a feature?
  function temAcesso(feature) {
    // Se tá ativo ou em trial válido, libera tudo que o plano permite
    if (isActive || (isTrialing && !trialAcabou)) {
      return plano.limites[feature] === true || plano.limites[feature] === Infinity
    }
    // Trial expirado ou cancelado: bloqueia tudo
    return false
  }

  // Está dentro do limite numérico (ex: 50 clientes)?
  function dentroDoLimite(feature, valorAtual) {
    if (isActive || (isTrialing && !trialAcabou)) {
      const limite = plano.limites[feature]
      if (limite === Infinity) return true
      return valorAtual < limite
    }
    return false
  }

  // Precisa fazer upgrade?
  const precisaUpgrade = trialAcabou || isExpired

  return (
    <AssinaturaContext.Provider value={{
      assinatura, plano, status, loading,
      isTrialing, isActive, isExpired, trialAcabou,
      diasRestantesTrial, precisaUpgrade,
      temAcesso, dentroDoLimite, recarregar: carregar,
    }}>
      {children}
    </AssinaturaContext.Provider>
  )
}

export const useAssinatura = () => useContext(AssinaturaContext)

// Helper pra gerar link WhatsApp de assinatura
export function whatsappAssinarLink({ nomeUsuario, emailUsuario, planoId, ciclo }) {
  const planoNome = PLANOS[planoId]?.nome || 'Pro'
  const preco = ciclo === 'anual'
    ? `R$ ${formatPreco(PLANOS[planoId].precoAnual)}/ano`
    : `R$ ${formatPreco(PLANOS[planoId].precoMensal)}/mês`

  const msg = `Olá! Quero assinar o NailPro 💅

📋 Plano: ${planoNome} (${ciclo})
💰 Valor: ${preco}
👤 Nome: ${nomeUsuario || ''}
📧 E-mail: ${emailUsuario || ''}

Pode me enviar o PIX/link de pagamento? Obrigada!`

  return `https://wa.me/${SUPORTE_WHATSAPP}?text=${encodeURIComponent(msg)}`
}
