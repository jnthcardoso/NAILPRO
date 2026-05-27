/**
 * Helpers para Web Notifications API (notificações locais).
 * Funciona quando o app está aberto OU como PWA instalado.
 * Não requer servidor / VAPID keys.
 */

export function notificacoesSuportadas() {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function statusPermissao() {
  if (!notificacoesSuportadas()) return 'unsupported'
  return Notification.permission // 'granted' | 'denied' | 'default'
}

export async function pedirPermissao() {
  if (!notificacoesSuportadas()) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  const r = await Notification.requestPermission()
  return r
}

/**
 * Dispara uma notificação local.
 * @param {string} titulo
 * @param {object} opts - { body, icon, tag, data, onClick }
 */
export function notificar(titulo, opts = {}) {
  if (statusPermissao() !== 'granted') return null

  const notification = new Notification(titulo, {
    body: opts.body,
    icon: opts.icon || '/icon-192.png',
    badge: opts.badge || '/icon-192.png',
    tag: opts.tag,
    data: opts.data,
    silent: opts.silent || false,
    requireInteraction: opts.requireInteraction || false,
  })

  if (opts.onClick) {
    notification.onclick = (e) => {
      e.preventDefault()
      window.focus()
      opts.onClick(e)
      notification.close()
    }
  }

  return notification
}

/**
 * Storage helpers para evitar disparar notificação duplicada por dia
 */
const STORAGE_KEY = 'np_notif_disparadas'

function getDisparadasHoje() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const data = JSON.parse(raw)
    const hoje = new Date().toISOString().slice(0, 10)
    if (data.dia !== hoje) return new Set()
    return new Set(data.tags)
  } catch { return new Set() }
}

function marcarDisparada(tag) {
  try {
    const hoje = new Date().toISOString().slice(0, 10)
    const set = getDisparadasHoje()
    set.add(tag)
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ dia: hoje, tags: [...set] }))
  } catch {}
}

/**
 * Dispara notificação só uma vez por dia (mesmo abrindo o app várias vezes)
 */
export function notificarUmaVezPorDia(tag, titulo, opts = {}) {
  const disparadas = getDisparadasHoje()
  if (disparadas.has(tag)) return null
  const result = notificar(titulo, { ...opts, tag })
  if (result) marcarDisparada(tag)
  return result
}
