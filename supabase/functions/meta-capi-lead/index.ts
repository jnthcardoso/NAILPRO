// Espelha o evento "Lead" (clique em "Agendar demonstracao"/WhatsApp) pelo
// SERVIDOR via Meta Conversions API. O navegador ja dispara o Lead pelo Pixel
// com o MESMO event_id; o Meta deduplica os dois. Isso recupera os eventos que
// o navegador perde (iOS/ATT, bloqueadores de anuncio) -> campanha aprende melhor.
//
// Endpoint publico (verify_jwt=false): a Landing e publica, sem login. Nao mexe
// no banco e nao expoe segredo nenhum; no pior caso alguem infla a contagem de
// Lead (so atrapalha quem fizer isso). Token do Pixel fica em segredo no Supabase.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Valida o formato dos cookies do Meta ("fb.1.<ts>.<id>"); ignora qualquer outra coisa.
const fbCookie = (v: unknown): string | null =>
  typeof v === 'string' && /^fb\.\d\.\d+\..+$/.test(v) && v.length <= 255 ? v : null

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  const json = (o: unknown, status = 200) =>
    new Response(JSON.stringify(o), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  try {
    const pixelId = Deno.env.get('META_PIXEL_ID') ?? ''
    const token = Deno.env.get('META_CAPI_TOKEN') ?? ''
    // Sem credenciais, ignora silenciosamente (nao quebra o front).
    if (!pixelId || !token) return json({ ok: false })

    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const eventId = typeof body.eventId === 'string' ? body.eventId.slice(0, 100) : undefined
    const sourceUrl = typeof body.sourceUrl === 'string' ? body.sourceUrl.slice(0, 500) : undefined

    const userData: Record<string, unknown> = {}
    const fbp = fbCookie(body.fbp); if (fbp) userData.fbp = fbp
    const fbc = fbCookie(body.fbc); if (fbc) userData.fbc = fbc
    // IP + user agent melhoram o casamento do evento (sempre presentes).
    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim()
    if (ip) userData.client_ip_address = ip
    const ua = req.headers.get('user-agent')
    if (ua) userData.client_user_agent = ua

    const payload = {
      data: [{
        event_name: 'Lead',
        event_time: Math.floor(Date.now() / 1000),
        action_source: 'website',
        event_id: eventId,          // mesmo id do Pixel -> dedup
        event_source_url: sourceUrl,
        user_data: userData,
      }],
    }
    const url = `https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${token}`
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!r.ok) console.error('CAPI Lead erro:', r.status, await r.text())
    else console.log('CAPI Lead enviado:', eventId)
    return json({ ok: r.ok })
  } catch (e) {
    console.error('meta-capi-lead erro:', e)
    return json({ ok: false })
  }
})
