import { Component } from 'react'

// Falha ao baixar um "pedaço" (chunk) de uma tela carregada sob demanda.
// Acontece quando um deploy novo troca os nomes dos arquivos e o app aberto
// (ou o app instalado/PWA no celular) ainda aponta para os antigos, que já não
// existem no servidor — e a Vercel devolve o index.html (HTML) no lugar do .js.
// O regex cobre as variações de mensagem entre navegadores (inclui iPhone/Safari,
// que diz "Load failed" / "Importing a module script failed" / "MIME type").
function isChunkLoadError(error) {
  const msg = `${error?.name || ''} ${error?.message || ''}`
  return /ChunkLoadError|Loading chunk|dynamically imported module|module script|importing a module|valid JavaScript MIME|MIME type|Failed to fetch|Load failed/i.test(msg)
}

// Para o erro de "pedaço antigo": apaga os caches do PWA e desregistra o service
// worker antes de recarregar, garantindo que o app busque os arquivos NOVOS do
// servidor (um reload simples poderia servir o cache velho de novo).
async function limparCacheERecarregar() {
  try {
    if ('caches' in window) {
      const chaves = await caches.keys()
      await Promise.all(chaves.map(k => caches.delete(k)))
    }
    if (navigator.serviceWorker) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map(r => r.unregister()))
    }
  } catch { /* segue para o reload de qualquer forma */ }
  window.location.reload()
}

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error) {
    if (isChunkLoadError(error)) {
      // Evita loop: só recarrega se não recarregou nos últimos 10s.
      const agora = Date.now()
      const ultimo = Number(sessionStorage.getItem('chunk_reload_ts') || 0)
      if (agora - ultimo > 10000) {
        sessionStorage.setItem('chunk_reload_ts', String(agora))
        limparCacheERecarregar()
      }
    }
  }

  render() {
    if (!this.state.error) return this.props.children

    // Enquanto o reload automático do chunk acontece, não pisca tela de erro.
    if (isChunkLoadError(this.state.error)) {
      return (
        <div style={s.wrap}>
          <div style={s.msg}>Atualizando…</div>
        </div>
      )
    }

    // Erro de verdade: tela amigável com botão de recarregar.
    return (
      <div style={s.wrap}>
        <div style={s.card}>
          <div style={s.titulo}>Algo deu errado por aqui</div>
          <div style={s.sub}>Recarregue a página para continuar. Se persistir, fale com o suporte.</div>
          <button style={s.btn} onClick={() => window.location.reload()}>Recarregar</button>
        </div>
      </div>
    )
  }
}

const s = {
  wrap: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg, #FAF6F6)', padding: 24 },
  msg: { fontSize: 14, color: 'var(--text3, #8B6070)', fontFamily: "'Plus Jakarta Sans', sans-serif" },
  card: { textAlign: 'center', maxWidth: 360, background: 'var(--surface, #fff)', border: '1px solid var(--border, #EAD5E2)', borderRadius: 16, padding: '28px 24px', boxShadow: '0 2px 8px rgba(24,7,18,0.07)' },
  titulo: { fontSize: 17, fontWeight: 700, color: 'var(--text, #180712)', marginBottom: 8, fontFamily: "'Plus Jakarta Sans', sans-serif" },
  sub: { fontSize: 13, color: 'var(--text3, #8B6070)', lineHeight: 1.6, marginBottom: 18, fontFamily: "'Plus Jakarta Sans', sans-serif" },
  btn: { background: 'var(--pink, #8B2655)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 22px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
}
