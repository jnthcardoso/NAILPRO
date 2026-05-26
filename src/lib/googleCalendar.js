const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const SCOPE = 'https://www.googleapis.com/auth/calendar.events'
const BASE = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'

let _client = null
let _token = null
let _expiry = 0

export function initTokenClient(onReady) {
  if (!window.google?.accounts?.oauth2 || !CLIENT_ID) return
  _client = window.google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPE,
    callback: (resp) => {
      if (resp.access_token) {
        _token = resp.access_token
        _expiry = Date.now() + (resp.expires_in - 60) * 1000
      }
      onReady?.(!!resp.access_token)
    },
  })
  return _client
}

export function conectarGoogle() {
  return new Promise((resolve, reject) => {
    if (!_client) { reject(new Error('GIS não carregado')); return }
    _client.callback = (resp) => {
      if (resp.error) { reject(new Error(resp.error)); return }
      _token = resp.access_token
      _expiry = Date.now() + (resp.expires_in - 60) * 1000
      resolve(true)
    }
    _client.requestAccessToken({ prompt: 'consent' })
  })
}

export function desconectarGoogle() {
  if (_token && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(_token, () => {})
  }
  _token = null
  _expiry = 0
}

async function getToken() {
  if (_token && Date.now() < _expiry) return _token
  return new Promise((resolve, reject) => {
    if (!_client) { reject(new Error('Google não conectado')); return }
    _client.callback = (resp) => {
      if (resp.error) { reject(new Error(resp.error)); return }
      _token = resp.access_token
      _expiry = Date.now() + (resp.expires_in - 60) * 1000
      resolve(_token)
    }
    _client.requestAccessToken({ prompt: '' })
  })
}

export async function criarEvento(ag, clienteNome, duracao = 60) {
  const token = await getToken()
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(buildEvento(ag, clienteNome, duracao)),
  })
  if (!res.ok) throw new Error(`Falha ao criar evento: ${res.status}`)
  return res.json()
}

export async function excluirEvento(eventId) {
  const token = await getToken()
  const res = await fetch(`${BASE}/${eventId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Falha ao excluir evento: ${res.status}`)
  }
}

function buildEvento(ag, clienteNome, duracao) {
  const start = new Date(`${ag.data}T${ag.horario.slice(0, 8)}`)
  const end = new Date(start.getTime() + duracao * 60000)
  return {
    summary: `${clienteNome} — ${ag.servico}`,
    description: ag.observacoes || '',
    start: { dateTime: start.toISOString(), timeZone: 'America/Sao_Paulo' },
    end: { dateTime: end.toISOString(), timeZone: 'America/Sao_Paulo' },
    colorId: '4',
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 60 },
        { method: 'popup', minutes: 30 },
      ],
    },
  }
}
