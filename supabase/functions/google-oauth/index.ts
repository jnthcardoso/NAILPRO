import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ───────────────────────────────────────────────────────────────────────────
// Integração Google Agenda no SERVIDOR (authorization code flow + refresh token)
//
// Uma única função com várias "ações":
//   GET  ?action=callback   -> Google redireciona pra cá após o consentimento.
//                              Troca o code pela chave-mestra (refresh_token),
//                              guarda na caixa-forte e fecha o popup.
//   POST {action:'auth-url'} -> devolve a URL de consentimento do Google.
//   POST {action:'status'}   -> { conectado, email }
//   POST {action:'disconnect'} -> revoga no Google e apaga a chave-mestra.
//   POST {action:'criar-evento' | 'atualizar-evento' | 'excluir-evento'}
//
// Segredos necessários (Supabase > Edge Functions > Secrets):
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
// Endereço fixo que o Google chama de volta (precisa estar idêntico no Google Cloud).
const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/google-oauth`

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Cliente "admin" (ignora RLS) só pra mexer na caixa-forte.
const admin = createClient(SUPABASE_URL, SERVICE_KEY)

// ── State assinado (anti-falsificação) ─────────────────────────────────────
// O "state" leva o id do usuário até o callback. Assinamos com HMAC pra que
// ninguém consiga forjar um state e gravar uma chave em nome de outra pessoa.
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
  const payload = `${userId}.${exp}`
  return `${payload}.${await hmac(payload)}`
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
    if (tok.error === 'invalid_grant') {
      await admin.from('google_credenciais').delete().eq('user_id', userId)
    }
    throw new Error('NAO_CONECTADO')
  }
  return tok.access_token as string
}

function buildEvento(ag: any, clienteNome: string, duracao = 60) {
  const start = new Date(`${ag.data}T${String(ag.horario).slice(0, 8)}`)
  const end = new Date(start.getTime() + duracao * 60000)
  return {
    summary: `${clienteNome} — ${ag.servico}`,
    description: ag.observacoes || '',
    start: { dateTime: start.toISOString(), timeZone: 'America/Sao_Paulo' },
    end: { dateTime: end.toISOString(), timeZone: 'America/Sao_Paulo' },
    colorId: '4',
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 60 }, { method: 'popup', minutes: 30 }] },
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  const json = (o: unknown, status = 200) =>
    new Response(JSON.stringify(o), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  const html = (body: string) =>
    new Response(`<!doctype html><meta charset="utf-8">${body}`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })

  try {
    const url = new URL(req.url)

    // ── 1) CALLBACK do Google (GET, sem JWT — quem chama é o navegador via Google) ──
    if (req.method === 'GET' && (url.searchParams.has('code') || url.searchParams.get('action') === 'callback')) {
      const code = url.searchParams.get('code')
      const state = url.searchParams.get('state') ?? ''
      const err = url.searchParams.get('error')
      const fechar = (msg: string, ok: boolean) => html(
        `<body style="font-family:system-ui;text-align:center;padding:40px;color:#333">
         <p>${msg}</p>
         <script>
           try { window.opener && window.opener.postMessage(${JSON.stringify({ tipo: 'google-oauth', ok })}, '*'); } catch(e){}
           setTimeout(function(){ window.close(); }, 1200);
         </script></body>`)

      if (err) return fechar('Conexão cancelada. Pode fechar esta janela.', false)
      const userId = await verifyState(state)
      if (!code || !userId) return fechar('Link inválido ou expirado. Tente conectar de novo.', false)

      // Troca o code por tokens (aqui vem o refresh_token, só na 1ª autorização com prompt=consent).
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
        return fechar('Não consegui concluir a conexão. Tente novamente.', false)
      }
      await admin.from('google_credenciais').upsert({
        user_id: userId,
        refresh_token: tok.refresh_token,
        atualizado_em: new Date().toISOString(),
      }, { onConflict: 'user_id' })

      return fechar('Google Agenda conectado! Pode fechar esta janela. ✓', true)
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
      const state = await signState(user.id)
      const link = `${AUTH_URL}?${new URLSearchParams({
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        scope: SCOPE,
        access_type: 'offline',   // pede refresh_token
        prompt: 'consent',        // garante refresh_token mesmo se já autorizou antes
        include_granted_scopes: 'true',
        state,
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
        // 404/410 = evento sumiu no Google; tenta recriar pra não perder a sincronia.
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
