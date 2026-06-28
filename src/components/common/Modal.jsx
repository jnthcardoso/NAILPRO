import { useEffect } from 'react'

/**
 * Modal reutilizável: encapsula o overlay, o fechar-ao-clicar-fora, o
 * stopPropagation no conteúdo e o fechar com a tecla Esc.
 *
 * O estilo da CAIXA continua vindo de cada página (prop `boxStyle`), para
 * preservar layouts/animações específicos — aqui padronizamos só o overlay.
 *
 * @param {() => void} onClose  - handler de fechamento (clique fora / Esc).
 * @param {'center'|'sheet'} variant - 'center' (diálogo centralizado) ou
 *        'sheet' (bottom-sheet colado embaixo). Default: 'center'.
 * @param {object} boxStyle - estilo da caixa interna (o antigo `s.modal`).
 * @param {number} zIndex - z-index do overlay. Default: 200.
 * @param {object} overlayStyle - sobrescritas pontuais do overlay (ex.: cor).
 */
export default function Modal({ onClose, children, variant = 'center', boxStyle, zIndex = 200, overlayStyle }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const isSheet = variant === 'sheet'
  const isResponsive = variant === 'responsive'

  const overlay = {
    position: 'fixed', inset: 0, background: 'rgba(24,7,18,0.52)', zIndex,
    display: 'flex', justifyContent: 'center',
    alignItems: isSheet ? 'flex-end' : 'center',
    padding: isSheet ? 0 : (isResponsive ? 0 : 16),
    ...overlayStyle,
  }

  return (
    <div style={overlay} className={isResponsive ? 'modal-overlay-resp' : ''} onClick={() => onClose?.()}>
      <div style={boxStyle} className={isResponsive ? 'modal-box-resp' : ''} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}
