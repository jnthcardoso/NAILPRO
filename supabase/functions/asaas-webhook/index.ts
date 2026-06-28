import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { PRECOS, PRECO_MANICURE } from '../_shared/precos.ts'

// PRECOS e PRECO_MANICURE vêm de _shared/precos.ts — fonte única de verdade.

// SHA-256 em hex (exigido pelo Meta para dados de contato como e-mail).
async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// Envia a compra ao Meta pela Conversions API (server-side). Roda mesmo que a
// cliente feche a aba apos pagar; manda o valor real para o Meta otimizar.
async function enviarCompraMeta(opts: {
  pixelId: string; token: string; appUrl: string;
  eventId: string; emailHash: string | null; userIdHash: string;
  fbp: string | null; fbc: string | null;
  valor: number; plano: string; ciclo: string;
}): Promise<void> {
  const userData: Record<string, unknown> = { external_id: [opts.userIdHash] }
  if (opts.emailHash) userData.em = [opts.emailHash]
  // Carimbos do clique do anuncio — melhoram a atribuicao da venda a campanha.
  if (opts.fbp) userData.fbp = opts.fbp
  if (opts.fbc) userData.fbc = opts.fbc

  const payload = {
    data: [{
      event_name: 'Purchase',
      event_time: Math.floor(Date.now() / 1000),
      action_source: 'website',
      event_id: opts.eventId, // dedup: se o Asaas reenviar o webhook, nao conta 2x
      event_source_url: `${opts.appUrl}/app`,
      user_data: userData,
      custom_data: { currency: 'BRL', value: opts.valor, content_name: `Lumen ${opts.plano} ${opts.ciclo}` },
    }],
  }
  const url = `https://graph.facebook.com/v21.0/${opts.pixelId}/events?access_token=${opts.token}`
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
  if (!r.ok) console.error('Meta CAPI erro:', r.status, await r.text())
  else console.log('Meta CAPI Purchase enviada:', opts.valor, opts.plano, opts.ciclo)
}

// Envia a compra ao GA4 pelo Measurement Protocol (opcional — so dispara se os
// dois segredos estiverem configurados). Mantem o GA4 com receita real tambem.
async function enviarCompraGa4(opts: {
  measurementId: string; apiSecret: string;
  clientId: string; eventId: string; valor: number; plano: string; ciclo: string;
}): Promise<void> {
  const url = `https://www.google-analytics.com/mp/collect?measurement_id=${opts.measurementId}&api_secret=${opts.apiSecret}`
  const payload = {
    client_id: opts.clientId,
    events: [{
      name: 'purchase',
      params: {
        currency: 'BRL', value: opts.valor, transaction_id: opts.eventId,
        items: [{ item_name: `Lumen ${opts.plano} ${opts.ciclo}`, price: opts.valor, quantity: 1 }],
      },
    }],
  }
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
  if (!r.ok) console.error('GA4 MP erro:', r.status, await r.text())
  else console.log('GA4 purchase enviada:', opts.valor, opts.plano, opts.ciclo)
}

// Comparacao de tempo constante: evita timing attack para inferir o token byte a byte.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  const ab = new TextEncoder().encode(a)
  const bb = new TextEncoder().encode(b)
  let result = 0
  for (let i = 0; i < ab.length; i++) result |= ab[i] ^ bb[i]
  return result === 0
}

// Eventos de cobranca do Asaas (nao ha webhook de assinatura — so de cobranca).
Deno.serve(async (req: Request) => {
  const key = Deno.env.get('ASAAS_API_KEY') ?? ''
  const base = key.includes('_hmlg_') ? 'https://api-sandbox.asaas.com/v3' : 'https://api.asaas.com/v3'
  const tokenEsperado = Deno.env.get('ASAAS_WEBHOOK_TOKEN') ?? ''
  const APP_URL = Deno.env.get('APP_URL') ?? 'https://lumengestaoempresarial.com.br'

  // Seguranca (fail-closed): SEM token configurado, recusa tudo — em vez de aceitar
  // tudo. Assim ninguem consegue forjar um "pagamento confirmado" se o segredo
  // ASAAS_WEBHOOK_TOKEN faltar. IMPORTANTE: so faca deploy desta funcao DEPOIS de
  // confirmar que o segredo esta setado no Supabase, senao os webhooks reais caem.
  const tokenRecebido = req.headers.get('asaas-access-token') ?? ''
  if (!tokenEsperado || !timingSafeEqual(tokenRecebido, tokenEsperado)) {
    console.warn('Webhook: token ausente ou invalido')
    return new Response('unauthorized', { status: 401 })
  }

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* vazio */ }
  const event = (body?.event as string) || ''
  const payment = (body?.payment as Record<string, unknown>) || {}
  console.log('Asaas webhook:', event, payment?.id)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  try {
    // Resolve a referencia (userId|plano|ciclo). Vem na cobranca; se nao vier,
    // busca na assinatura ligada a cobranca.
    let ref = (payment?.externalReference as string) || ''
    const subId = (payment?.subscription as string) || ''
    if (!ref && subId) {
      const r = await fetch(`${base}/subscriptions/${subId}`, { headers: { access_token: key } })
      if (r.ok) { const sub = await r.json(); ref = sub?.externalReference || '' }
    }
    const [userId, plano, ciclo, manicuresRaw] = (ref || '').split('|')
    if (!userId) { console.warn('Webhook sem externalReference utilizavel'); return new Response('OK') }
    // Manicures pagas (assentos de profissional). So existe em externalReference novo do Salao.
    const manicuresPagas = plano === 'salao' ? Math.max(0, Math.floor(Number(manicuresRaw) || 0)) : 0

    const now = new Date()
    const setPeriodo = () => {
      const fim = new Date(now)
      fim.setMonth(fim.getMonth() + (ciclo === 'anual' ? 12 : 1))
      return fim.toISOString()
    }

    const pagamentoOk = ['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED', 'PAYMENT_RECEIVED_IN_CASH'].includes(event)
    const inadimplente = event === 'PAYMENT_OVERDUE'
    const cancelado = ['PAYMENT_REFUNDED', 'PAYMENT_CHARGEBACK_REQUESTED', 'PAYMENT_DELETED'].includes(event)

    // Numero da parcela no parcelamento (1..12). So vem em cobranca parcelada (anual).
    const installmentNumber = Number(payment?.installmentNumber) || null

    if (pagamentoOk) {
      // Anual e parcelado: o Asaas dispara um evento de pagamento POR PARCELA
      // (uma vez por mes). Se recalculassemos a validade a cada parcela, o acesso
      // iria sendo "empurrado" e a cliente teria ~24 meses em vez de 12.
      // Por isso, nas parcelas 2..12 so confirmamos que segue ativa, sem mexer na data.
      if (ciclo === 'anual' && installmentNumber && installmentNumber > 1) {
        const { error } = await supabase.from('assinaturas')
          .update({ status: 'active', updated_at: now.toISOString() })
          .eq('user_id', userId)
        if (error) console.error('Erro update (parcela seguinte):', error.message)
        else console.log('Parcela', installmentNumber, 'recebida (sem estender periodo):', userId)
        return new Response('OK', { status: 200 })
      }
      const upd: Record<string, unknown> = {
        status: 'active', periodo_inicia_em: now.toISOString(), periodo_termina_em: setPeriodo(),
        mp_subscription_id: subId || null, updated_at: now.toISOString(),
      }
      if (plano) upd.plano = plano
      if (ciclo) upd.ciclo = ciclo
      // Libera os assentos de manicure pagos no checkout (Salao). A enforcement no banco
      // bloqueia adicionar mais profissionais do que o pago.
      if (plano === 'salao') upd.licencas_pagas = manicuresPagas
      // Retorna fbp/fbc (carimbos do anuncio gravados no checkout) p/ atribuir o Purchase.
      const { data: assRow, error } = await supabase.from('assinaturas')
        .update(upd).eq('user_id', userId).select('fbp, fbc').maybeSingle()
      if (error) console.error('Erro update (ok):', error.message)
      else console.log('Assinatura ATIVADA/renovada:', userId, plano, ciclo)

      // ── Conversao server-side (compra) — Meta + GA4 ──────────────────
      // So na 1a cobranca confirmada (acima ja barramos parcelas 2..12).
      // E robusto: qualquer erro aqui nao pode derrubar o webhook.
      try {
        // Valor real pago = base + manicures (mensal 1x/mes; anual 12x no ano).
        const extraManicures = manicuresPagas * PRECO_MANICURE * (ciclo === 'anual' ? 12 : 1)
        const valor = (PRECOS[`${plano}_${ciclo}`] ?? 0) + extraManicures
        const eventId = String(payment?.id || `${userId}_${plano}_${ciclo}`)
        if (valor > 0) {
          const pixelId = Deno.env.get('META_PIXEL_ID') ?? ''
          const metaToken = Deno.env.get('META_CAPI_TOKEN') ?? ''
          if (pixelId && metaToken) {
            // E-mail da cliente (para casamento de evento) — hash SHA-256.
            let emailHash: string | null = null
            const { data: u } = await supabase.auth.admin.getUserById(userId)
            const email = u?.user?.email
            if (email) emailHash = await sha256Hex(email.trim().toLowerCase())
            const userIdHash = await sha256Hex(userId)
            await enviarCompraMeta({
              pixelId, token: metaToken, appUrl: APP_URL, eventId, emailHash, userIdHash,
              fbp: assRow?.fbp ?? null, fbc: assRow?.fbc ?? null, valor, plano, ciclo,
            })
          } else {
            console.warn('CAPI nao configurada (faltam META_PIXEL_ID / META_CAPI_TOKEN)')
          }

          const ga4Id = Deno.env.get('GA4_MEASUREMENT_ID') ?? ''
          const ga4Secret = Deno.env.get('GA4_API_SECRET') ?? ''
          if (ga4Id && ga4Secret) {
            await enviarCompraGa4({ measurementId: ga4Id, apiSecret: ga4Secret, clientId: userId, eventId, valor, plano, ciclo })
          }
        }
      } catch (convErr) {
        console.error('Erro ao enviar conversao (ignorado):', convErr)
      }
    } else if (inadimplente) {
      // Tolerancia: marca past_due (NAO bloqueia o acesso de imediato) ate o Asaas re-tentar.
      const { error } = await supabase.from('assinaturas').update({ status: 'past_due', updated_at: now.toISOString() }).eq('user_id', userId)
      if (error) console.error('Erro update (overdue):', error.message)
      else console.log('Pagamento em atraso (past_due):', userId)
    } else if (cancelado) {
      const { error } = await supabase.from('assinaturas').update({ status: 'canceled', cancelada_em: now.toISOString(), updated_at: now.toISOString() }).eq('user_id', userId)
      if (error) console.error('Erro update (cancel):', error.message)
      else console.log('Assinatura cancelada/estornada:', userId)
    }
  } catch (err) {
    console.error('Erro no webhook:', err)
  }
  // Sempre 200 para o Asaas nao reenviar em loop.
  return new Response('OK', { status: 200 })
})
