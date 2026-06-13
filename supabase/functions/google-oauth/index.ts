import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ───────────────────────────────────────────────────────────────────────────
// Integração Google Agenda no SERVIDOR (authorization code flow + refresh token)
//
//   GET  (com ?code=… &state=…)  -> Google redireciona pra cá após o consentimento.
//        Troca o code pela chave-mestra (refresh_token), guarda na caixa-forte e
//        REDIRECIONA o popup pra ${APP_URL}/?gcal=ok (o site fecha a janela).
//        Obs.: o Supabase força text/plain em respostas HTML do domínio .supabase.co
//        (proteção anti-phishing), por isso a página que fecha o popup vive no app.
//   POST {action:'auth-url'}    -> devolve a URL de consentimento do Google.
//   POST {action:'status'}      -> { conectado, email }
//   POST {action:'disconnect'}  -> revoga no Google e apaga a chave-mestra.
//   POST {action:'criar-evento' | 'atualizar-evento' | 'excluir-evento'}
//
// Segredos (Supabase > Edge Functions > Secrets):
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, APP_URL (já existe p/ Asaas)
//   SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY (automáticos)
// ───────────────────────────────────────────────────────────────────────────

const SCOPE = 'https://www.googleapis.com/auth/calendar.events'
const CAL_BASE = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') ?? ''
const CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') ?? ''
const APP_URL = Deno.env.get('APP_URL') ?? 'https://lumengestaoempresarial.com.br'
const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/google-oauth`

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Cliente "admin" (ignora RLS) só pra mexer na caixa-forte.
const admin = createClient(SUPABASE_URL, SERVICE_KEY)

// ── State assinado (anti-falsificação) ──────────────────────────────────────
const enc = new TextEncoder()
async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(SERVICE_KEY), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data))
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
async function signState(userId: string): Promise<string> {
  const exp = Date.now() + 10 * 60 * 1000 // vale 10 minutos
  return `${userId}.${exp}.${await hmac(`${userId}.${exp}`)}`
}
async function verifyState(state: string): Promise<string | null> {
  const parts = state.split('.')
  if (parts.length !== 3) return null
  const [userId, exp, sig] = parts
  if (await hmac(`${userId}.${exp}`) !== sig) return null
  if (Date.now() > Number(exp)) return null
  return userId
}

// ── Google: troca refresh_token por access_token fresquinho ─────────────────
async function getAccessToken(userId: string): Promise<string> {
  const { data } = await admin.from('google_credenciais').select('refresh_token').eq('user_id', userId).maybeSingle()
  if (!data?.refresh_token) throw new Error('NAO_CONECTADO')

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: data.refresh_token,
      grant_type: 'refresh_token',
    }),
  })
  const tok = await res.json()
  if (!res.ok || !tok.access_token) {
    // refresh_token revogado/expirado pelo usuário no Google -> limpa e sinaliza.
    if (tok.error === 'invalid_grant') await admin.from('google_credenciais').delete().eq('user_id', userId)
    throw new Error('NAO_CONECTADO')
  }
  return tok.access_token as string
}

// São Paulo é UTC-3 fixo (sem horário de verão desde 2019). Formatamos o horário
// SEMPRE no fuso de São Paulo, independente do servidor (que roda em UTC) — senão
// o "11:00" vira 11:00 UTC e o Google mostra 08:00 (bug de cliente->servidor).
const SP_OFFSET_MS = 3 * 60 * 60 * 1000
function toSPString(date: Date): string {
  const sp = new Date(date.getTime() - SP_OFFSET_MS)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${sp.getUTCFullYear()}-${p(sp.getUTCMonth() + 1)}-${p(sp.getUTCDate())}T${p(sp.getUTCHours())}:${p(sp.getUTCMinutes())}:${p(sp.getUTCSeconds())}-03:00`
}
function buildEvento(ag: any, clienteNome: string, duracao = 60) {
  const hms = String(ag.horario).length >= 8 ? String(ag.horario).slice(0, 8) : `${String(ag.horario).slice(0, 5)}:00`
  // -03:00 explícito no input: o instante é lido certo mesmo com o servidor em UTC.
  const start = new Date(`${ag.data}T${hms}-03:00`)
  const end = new Date(start.getTime() + duracao * 60000)
  return {
    summary: `${clienteNome} — ${ag.servico}`,
    description: ag.observacoes || '',
    start: { dateTime: toSPString(start), timeZone: 'America/Sao_Paulo' },
    end: { dateTime: toSPString(end), timeZone: 'America/Sao_Paulo' },
    colorId: '4',
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 60 }, { method: 'popup', minutes: 30 }] },
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  const json = (o: unknown, status = 200) =>
    new Response(JSON.stringify(o), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  try {
    const url = new URL(req.url)

    // ── 1) CALLBACK do Google (GET, sem JWT — quem chama é o navegador via Google) ──
    if (req.method === 'GET' && (url.searchParams.has('code') || url.searchParams.get('action') === 'callback')) {
      // Redireciona o popup pro app (que serve HTML e fecha a janela sozinho).
      const fechar = (ok: boolean) =>
        new Response(null, { status: 302, headers: { Location: `${APP_URL}/?gcal=${ok ? 'ok' : 'erro'}` } })

      const code = url.searchParams.get('code')
      const state = url.searchParams.get('state') ?? ''
      if (url.searchParams.get('error')) return fechar(false)
      const userId = await verifyState(state)
      if (!code || !userId) return fechar(false)

      const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          code,
          redirect_uri: REDIRECT_URI,
          grant_type: 'authorization_code',
        }),
      })
      const tok = await res.json()
      if (!res.ok || !tok.refresh_token) {
        console.error('Falha ao trocar code:', JSON.stringify(tok))
        return fechar(false)
      }
      const { error: upErr } = await admin.from('google_credenciais').upsert({
        user_id: userId,
        refresh_token: tok.refresh_token,
        atualizado_em: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      if (upErr) { console.error('Erro ao salvar credencial:', JSON.stringify(upErr)); return fechar(false) }

      return fechar(true)
    }

    // ── 2) AÇÕES autenticadas (POST com JWT do usuário logado) ──
    const authClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })
    const { data: { user }, error: authErr } = await authClient.auth.getUser()
    if (authErr || !user) return json({ error: 'Não autorizado' }, 401)

    const { action, ...args } = await req.json().catch(() => ({}))

    if (action === 'auth-url') {
      if (!CLIENT_ID) return json({ error: 'GOOGLE_CLIENT_ID não configurado no servidor' }, 500)
      const link = `${AUTH_URL}?${new URLSearchParams({
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        scope: SCOPE,
        access_type: 'offline',   // pede refresh_token
        prompt: 'consent',        // garante refresh_token mesmo se já autorizou antes
        include_granted_scopes: 'true',
        state: await signState(user.id),
      })}`
      return json({ url: link })
    }

    if (action === 'status') {
      const { data } = await admin.from('google_credenciais').select('email_google').eq('user_id', user.id).maybeSingle()
      return json({ conectado: !!data, email: data?.email_google ?? null })
    }

    if (action === 'disconnect') {
      const { data } = await admin.from('google_credenciais').select('refresh_token').eq('user_id', user.id).maybeSingle()
      if (data?.refresh_token) {
        try { await fetch(`${REVOKE_URL}?token=${encodeURIComponent(data.refresh_token)}`, { method: 'POST' }) } catch (_) { /* best-effort */ }
      }
      await admin.from('google_credenciais').delete().eq('user_id', user.id)
      return json({ ok: true })
    }

    // Ações de evento — todas precisam de um access_token válido.
    if (action === 'criar-evento' || action === 'atualizar-evento' || action === 'excluir-evento') {
      let accessToken: string
      try {
        accessToken = await getAccessToken(user.id)
      } catch (_) {
        return json({ conectado: false }, 200) // não conectado: o app ignora em silêncio
      }
      const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }

      if (action === 'criar-evento') {
        const r = await fetch(CAL_BASE, { method: 'POST', headers, body: JSON.stringify(buildEvento(args.ag, args.clienteNome || '', args.duracao || 60)) })
        if (!r.ok) return json({ error: `Falha ao criar evento: ${r.status}` }, 502)
        const ev = await r.json()
        return json({ conectado: true, id: ev.id })
      }

      if (action === 'atualizar-evento') {
        const r = await fetch(`${CAL_BASE}/${args.eventId}`, { method: 'PATCH', headers, body: JSON.stringify(buildEvento(args.ag, args.clienteNome || '', args.duracao || 60)) })
        // 404/410 = evento sumiu no Google; recria pra não perder a sincronia.
        if (r.status === 404 || r.status === 410) {
          const r2 = await fetch(CAL_BASE, { method: 'POST', headers, body: JSON.stringify(buildEvento(args.ag, args.clienteNome || '', args.duracao || 60)) })
          if (!r2.ok) return json({ error: `Falha ao recriar evento: ${r2.status}` }, 502)
          const ev2 = await r2.json()
          return json({ conectado: true, id: ev2.id, recriado: true })
        }
        if (!r.ok) return json({ error: `Falha ao atualizar evento: ${r.status}` }, 502)
        const ev = await r.json()
        return json({ conectado: true, id: ev.id })
      }

      if (action === 'excluir-evento') {
        const r = await fetch(`${CAL_BASE}/${args.eventId}`, { method: 'DELETE', headers })
        if (!r.ok && r.status !== 404 && r.status !== 410) return json({ error: `Falha ao excluir evento: ${r.status}` }, 502)
        return json({ conectado: true, ok: true })
      }
    }

    return json({ error: 'Ação desconhecida' }, 400)
  } catch (err) {
    console.error('Erro interno google-oauth:', err)
    return json({ error: 'Erro interno do servidor' }, 500)
  }
})
