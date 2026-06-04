import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Eventos de cobranca do Asaas (nao ha webhook de assinatura — so de cobranca).
Deno.serve(async (req: Request) => {
  const key = Deno.env.get('ASAAS_API_KEY') ?? ''
  const base = key.includes('_hmlg_') ? 'https://api-sandbox.asaas.com/v3' : 'https://api.asaas.com/v3'
  const tokenEsperado = Deno.env.get('ASAAS_WEBHOOK_TOKEN') ?? ''

  // Seguranca: se um token foi configurado, exige que bata com o header do Asaas.
  const tokenRecebido = req.headers.get('asaas-access-token') ?? ''
  if (tokenEsperado && tokenRecebido !== tokenEsperado) {
    console.warn('Webhook: token invalido')
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
    const [userId, plano, ciclo] = (ref || '').split('|')
    if (!userId) { console.warn('Webhook sem externalReference utilizavel'); return new Response('OK') }

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
      const { error } = await supabase.from('assinaturas').update(upd).eq('user_id', userId)
      if (error) console.error('Erro update (ok):', error.message)
      else console.log('Assinatura ATIVADA/renovada:', userId, plano, ciclo)
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
