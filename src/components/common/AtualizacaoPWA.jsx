import { useRegisterSW } from 'virtual:pwa-register/react'

// Banner fixo que aparece quando há uma versão nova do app no ar.
// Em vez de atualizar "escondido" (e deixar a pessoa na versão velha sem saber),
// mostra "Nova versão disponível" + botão Atualizar. Ao tocar, troca o service
// worker e recarrega na hora — garantindo o código mais novo.
export default function AtualizacaoPWA() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  // Aplica a nova versão e recarrega. O `updateServiceWorker(true)` troca o
  // service worker, mas o reload automático dele depende do evento
  // `controllerchange` — que no desktop às vezes não dispara (botão "não fazia
  // nada"). Então a gente mesmo escuta o controllerchange e, se ele não vier,
  // força o reload por timeout. O guard evita recarregar duas vezes.
  const atualizar = () => {
    let recarregou = false
    const recarregar = () => { if (!recarregou) { recarregou = true; window.location.reload() } }
    navigator.serviceWorker?.addEventListener('controllerchange', recarregar)
    updateServiceWorker(true)
    setTimeout(recarregar, 1500)
  }

  return (
    <div style={s.wrap} role="status">
      <span style={s.txt}>✨ Nova versão disponível</span>
      <button style={s.btn} onClick={atualizar}>Atualizar</button>
      <button style={s.close} onClick={() => setNeedRefresh(false)} aria-label="Atualizar depois">×</button>
    </div>
  )
}

const s = {
  wrap: { position: 'fixed', left: 12, right: 12, bottom: 12, zIndex: 99999, display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center', background: 'var(--pink, #8B2655)', color: 'white', padding: '12px 16px', borderRadius: 14, boxShadow: '0 6px 24px rgba(0,0,0,0.25)', fontSize: 14, fontWeight: 600, maxWidth: 460, margin: '0 auto' },
  txt: { flex: 1, textAlign: 'center' },
  btn: { background: 'white', color: 'var(--pink, #8B2655)', border: 'none', borderRadius: 999, padding: '7px 16px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, flexShrink: 0 },
  close: { background: 'transparent', border: 'none', color: 'white', fontSize: 20, lineHeight: 1, cursor: 'pointer', padding: 0, opacity: 0.85, flexShrink: 0 },
}
