import { Component } from 'react'

// Falha ao baixar um "pedaço" (chunk) de uma tela carregada sob demanda.
// Acontece quando um deploy novo troca os nomes dos arquivos e a aba aberta
// ainda aponta para os antigos (que já não existem no servidor).
// Nesses casos, recarregar a página uma vez resolve.
function isChunkLoadError(error) {
  const msg = `${error?.name || ''} ${error?.message || ''}`
  return /ChunkLoadError|Loading chunk|dynamically imported module|module script failed|Failed to fetch dynamically/i.test(msg)
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
        window.location.reload()
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
