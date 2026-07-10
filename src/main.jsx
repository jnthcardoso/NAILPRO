import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { registrarErro } from './lib/registrarErro'

// Pega erros que acontecem fora do render do React (ex.: dentro de um setTimeout,
// handler de evento, ou uma Promise rejeitada sem .catch) — o ErrorBoundary só cobre erros
// de render.
window.addEventListener('error', e => {
  registrarErro(e?.message, e?.error?.stack, window.location.pathname)
})
window.addEventListener('unhandledrejection', e => {
  registrarErro(e?.reason?.message || String(e?.reason), e?.reason?.stack, window.location.pathname)
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)