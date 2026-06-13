import { supabase } from './supabase'

// ───────────────────────────────────────────────────────────────────────────
// Google Agenda — agora 100% no SERVIDOR (Edge Function `google-oauth`).
//
// A "chave-mestra" (refresh_token) fica guardada no servidor, então a conexão é
// "conecta 1x e funciona pra sempre": não há mais popup ao renovar o token, e a
// sincronização continua mesmo depois de fechar e reabrir o app.
//
// O popup só aparece UMA vez, no clique de "Conectar" (consentimento do Google).
// ───────────────────────────────────────────────────────────────────────────

async function chamar(action, payload = {}) {
  const { data, error } = await supabase.functions.invoke('google-oauth', {
    body: { action, ...payload },
  })
  if (error) {
    let detalhe = ''
    try { const corpo = await error.context?.json(); detalhe = corpo?.error || '' } catch { /* ignora */ }
    throw new Error(detalhe || error.message || 'Falha na integração com o Google')
  }
  return data
}

// Abre o consentimento do Google numa janela e resolve quando o servidor avisa
// que guardou a chave-mestra (postMessage vindo do callback) ou a janela fecha.
export function conectarGoogle() {
  return new Promise(async (resolve, reject) => {
    try {
      const { url } = await chamar('auth-url')
      if (!url) { reject(new Error('Não foi possível iniciar a conexão')); return }

      const w = 500, h = 640
      const left = window.screenX + (window.outerWidth - w) / 2
      const top = window.screenY + (window.outerHeight - h) / 2
      const popup = window.open(url, 'google-oauth', `width=${w},height=${h},left=${left},top=${top}`)
      if (!popup) { reject(new Error('Permita pop-ups para conectar o Google')); return }

      let resolvido = false
      const finalizar = (ok) => {
        if (resolvido) return
        resolvido = true
        window.removeEventListener('message', onMsg)
        clearInterval(timer)
        ok ? resolve(true) : reject(new Error('Conexão não concluída'))
      }
      const onMsg = (ev) => {
        if (ev.data?.tipo === 'google-oauth') finalizar(!!ev.data.ok)
      }
      window.addEventListener('message', onMsg)

      // Se o usuário fechar a janela sem concluir, confere o status no servidor.
      const timer = setInterval(async () => {
        if (popup.closed) {
          clearInterval(timer)
          try { const st = await statusGoogle(); finalizar(!!st.conectado) }
          catch { finalizar(false) }
        }
      }, 600)
    } catch (e) { reject(e) }
  })
}

export async function desconectarGoogle() {
  try { await chamar('disconnect') } catch (e) { console.error('Falha ao desconectar Google:', e) }
}

export async function statusGoogle() {
  try { return await chamar('status') } catch { return { conectado: false } }
}

// Cria evento no Google. Retorna { id } ou null se a conta não estiver conectada.
export async function criarEvento(ag, clienteNome, duracao = 60) {
  const r = await chamar('criar-evento', { ag, clienteNome, duracao })
  if (r?.conectado === false) return null
  return r?.id ? { id: r.id } : null
}

// Atualiza o evento de um agendamento editado (NOVO — antes não existia).
export async function atualizarEvento(eventId, ag, clienteNome, duracao = 60) {
  const r = await chamar('atualizar-evento', { eventId, ag, clienteNome, duracao })
  if (r?.conectado === false) return null
  return r?.id ? { id: r.id } : null
}

export async function excluirEvento(eventId) {
  await chamar('excluir-evento', { eventId })
}
