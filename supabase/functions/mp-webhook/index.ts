import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Mapeamento de status MP -> status Lumen
const STATUS_MAP: Record<string, string> = {
  authorized: 'active',
  paused:     'active',
  cancelled:  'canceled',
  pending:    'trialing',
  expired:    'expired',
}

Deno.serve(async (req: Request) => {
  // MP envia dados via query params E body
  const url = new URL(req.url)
  const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN') ?? ''

  // Lê query params do MP
  const queryType = url.searchParams.get('type') ?? ''
  const queryId   = url.searchParams.get('data.id') ?? ''

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* body pode vir vazio */ }

  const eventType = queryType || (body?.type as string) || ''
  const eventId   = queryId   || ((body?.data as Record<string, unknown>)?.id as string) || ''

  console.log('MP Webhook:', { eventType, eventId })

  // Ignora eventos que nao sao de assinatura
  if (!eventType.includes('subscription') && eventType !== 'payment') {
    return new Response('OK', { status: 200 })
  }

  // Admin client (bypassa RLS)
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  try {
    if (eventType === 'subscription_preapproval' && eventId) {
      // Busca detalhes da assinatura no MP
      const mpRes = await fetch(`https://api.mercadopago.com/preapproval/${eventId}`, {
        headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` }
      })

      if (!mpRes.ok) {
        console.error('Erro ao buscar assinatura MP:', eventId)
        return new Response('OK', { status: 200 }) // 200 pra MP nao retentar
      }

      const sub = await mpRes.json()
      console.log('Assinatura MP:', sub.id, sub.status, sub.external_reference)

      // external_reference = "userId|plano|ciclo"
      const parts = (sub.external_reference ?? '').split('|')
      const userId = parts[0]
      const plano  = parts[1]
      const ciclo  = parts[2]

      if (!userId) {
        console.error('external_reference invalido:', sub.external_reference)
        return new Response('OK', { status: 200 })
      }

      const status = STATUS_MAP[sub.status] ?? 'expired'
      const now = new Date()
      const periodoFim = new Date(now)
      periodoFim.setMonth(periodoFim.getMonth() + (ciclo === 'anual' ? 12 : 1))

      const { error } = await supabase
        .from('assinaturas')
        .update({
          status,
          plano,
          ciclo,
          mp_subscription_id: eventId,
          periodo_inicia_em: now.toISOString(),
          periodo_termina_em: periodoFim.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq('user_id', userId)

      if (error) console.error('Erro ao atualizar assinatura:', error)
      else console.log('Assinatura atualizada:', userId, status, plano, ciclo)
    }

    // Pagamento individual (renovacao mensal)
    if (eventType === 'payment' && eventId) {
      const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${eventId}`, {
        headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` }
      })

      if (!mpRes.ok) return new Response('OK', { status: 200 })

      const payment = await mpRes.json()
      const parts   = (payment.external_reference ?? '').split('|')
      const userId  = parts[0]

      if (!userId) return new Response('OK', { status: 200 })

      if (payment.status === 'approved') {
        const now = new Date()
        const periodoFim = new Date(now)
        periodoFim.setMonth(periodoFim.getMonth() + 1)

        await supabase
          .from('assinaturas')
          .update({
            status: 'active',
            periodo_inicia_em: now.toISOString(),
            periodo_termina_em: periodoFim.toISOString(),
            updated_at: now.toISOString(),
          })
          .eq('user_id', userId)

        console.log('Pagamento aprovado, assinatura renovada:', userId)
      } else if (['rejected', 'cancelled'].includes(payment.status)) {
        await supabase
          .from('assinaturas')
          .update({ status: 'expired', updated_at: new Date().toISOString() })
          .eq('user_id', userId)

        console.log('Pagamento recusado, assinatura expirada:', userId)
      }
    }

  } catch (err) {
    console.error('Erro no webhook:', err)
  }

  // Sempre retorna 200 pra MP nao reenviar
  return new Response('OK', { status: 200 })
})
