/**
 * Helpers de analytics — Google Analytics (GA4) + Meta Pixel
 * Todas as funções são seguras: só disparam se os scripts estiverem carregados.
 */
import { supabase } from './supabase'

// ID do Pixel — espelha o init no index.html. Usado p/ Advanced Matching.
const META_PIXEL_ID = '1310982824540037'

// Lê um cookie do navegador pelo nome (ex.: _fbp/_fbc). null se não existir.
function lerCookie(nome) {
  if (typeof document === 'undefined') return null
  const m = document.cookie.match(new RegExp('(?:^|; )' + nome + '=([^;]*)'))
  return m ? decodeURIComponent(m[1]) : null
}

// id único do evento — usado para deduplicar entre Pixel (navegador) e CAPI (servidor).
function novoEventId() {
  try { return crypto.randomUUID() } catch { return `${Date.now()}-${Math.random().toString(16).slice(2)}` }
}

// ── Google Analytics (GA4) ─────────────────────────────────────────────
function ga(eventName, params = {}) {
  if (typeof window.gtag === 'function') {
    window.gtag('event', eventName, params)
  }
}

// ── Meta Pixel ─────────────────────────────────────────────────────────
function pixel(eventName, params = {}, eventId) {
  if (typeof window.fbq === 'function') {
    if (eventId) window.fbq('track', eventName, params, { eventID: eventId })
    else window.fbq('track', eventName, params)
  }
}

/**
 * Advanced Matching: associa o e-mail do usuário logado ao Pixel (o próprio
 * Pixel faz o hash no navegador). Melhora o casamento/atribuição dos eventos.
 * Chamada no AuthContext quando há sessão.
 */
export function setPixelUser(email) {
  if (!email || typeof window.fbq !== 'function') return
  window.fbq('init', META_PIXEL_ID, { em: String(email).trim().toLowerCase() })
}

// ── Eventos principais ─────────────────────────────────────────────────

/** Usuário criou uma conta (dispara no signup bem-sucedido) */
export function trackCadastro() {
  ga('sign_up', { method: 'email' })
  pixel('CompleteRegistration')
}

/** Usuário iniciou o fluxo de assinatura (clicou "Assinar com cartão") */
export function trackInicioAssinatura(plano, ciclo, valorReais) {
  ga('begin_checkout', {
    currency: 'BRL',
    value: valorReais,
    items: [{ item_name: `Lumen ${plano} ${ciclo}`, price: valorReais }],
  })
  pixel('InitiateCheckout', { value: valorReais, currency: 'BRL', content_name: `Lumen ${plano} ${ciclo}` })
}

/**
 * ⚠️ NÃO USAR no cliente. A conversão de compra (Purchase) é enviada pelo
 * SERVIDOR — Meta Conversions API no webhook do Asaas
 * (supabase/functions/asaas-webhook/index.ts) — com o valor real e de forma
 * confiável. Religar este disparo no navegador contaria a venda DUAS VEZES.
 * Mantido apenas como referência.
 */
export function trackPagamentoConfirmado(plano, ciclo, valorReais) {
  ga('purchase', {
    currency: 'BRL',
    value: valorReais,
    transaction_id: `${plano}_${ciclo}_${Date.now()}`,
    items: [{ item_name: `Lumen ${plano} ${ciclo}`, price: valorReais, quantity: 1 }],
  })
  pixel('Purchase', { value: valorReais, currency: 'BRL', content_name: `Lumen ${plano} ${ciclo}` })
}

/** Usuário visitou a seção de planos (interesse demonstrado) */
export function trackVerPlanos() {
  ga('view_item_list', { item_list_name: 'Planos Lumen' })
  pixel('ViewContent', { content_name: 'Planos', content_type: 'product' })
}

/** Lead: usuário clicou em "Fale conosco" no WhatsApp */
export function trackFaleConosco() {
  const eventId = novoEventId()
  ga('generate_lead')
  pixel('Lead', {}, eventId)
  // Espelha o Lead pelo SERVIDOR (CAPI) com o MESMO event_id (dedup). Recupera
  // os ~20-30% de eventos que o navegador perde por iOS/bloqueadores. Fire-and-forget.
  try {
    supabase.functions.invoke('meta-capi-lead', {
      body: { eventId, fbp: lerCookie('_fbp'), fbc: lerCookie('_fbc'), sourceUrl: window.location.href },
    }).catch(() => {})
  } catch { /* nunca atrapalha o clique */ }
}
