/**
 * Helpers de analytics — Google Analytics (GA4) + Meta Pixel
 * Todas as funções são seguras: só disparam se os scripts estiverem carregados.
 */

// ── Google Analytics (GA4) ─────────────────────────────────────────────
function ga(eventName, params = {}) {
  if (typeof window.gtag === 'function') {
    window.gtag('event', eventName, params)
  }
}

// ── Meta Pixel ─────────────────────────────────────────────────────────
function pixel(eventName, params = {}) {
  if (typeof window.fbq === 'function') {
    window.fbq('track', eventName, params)
  }
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

/**
 * Usuário visitou a seção de planos (interesse demonstrado).
 * `segmento` (ex.: 'manicure', 'barbearia') identifica de qual landing veio,
 * pra medir conversão por campanha/segmento no GA e na Meta.
 */
export function trackVerPlanos(segmento) {
  ga('view_item_list', { item_list_name: 'Planos Lumen', ...(segmento ? { segmento } : {}) })
  pixel('ViewContent', { content_name: 'Planos', content_type: 'product', ...(segmento ? { content_category: segmento } : {}) })
}

/** Lead: usuário clicou em "Fale conosco" no WhatsApp. `segmento` = landing de origem. */
export function trackFaleConosco(segmento) {
  ga('generate_lead', segmento ? { segmento } : {})
  pixel('Lead', segmento ? { content_category: segmento } : {})
}
