import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { Check, X, AlertCircle, Info, Undo2 } from 'lucide-react'

const ToastContext = createContext({})

let _id = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const [confirm, setConfirm] = useState(null)

  // Confirma uma ação destrutiva — retorna Promise<boolean>
  const confirmar = useCallback((opts) => new Promise((resolve) => {
    setConfirm({
      ...opts,
      onConfirm: () => { setConfirm(null); resolve(true) },
      onCancel: () => { setConfirm(null); resolve(false) },
    })
  }), [])

  // Mostra toast e retorna função para "desfazer"
  const toast = useCallback((opts) => {
    const id = ++_id
    const item = { id, tipo: 'info', duracao: 3500, ...opts }
    setToasts(t => [...t, item])

    if (item.duracao !== Infinity) {
      setTimeout(() => {
        setToasts(t => t.filter(x => x.id !== id))
      }, item.duracao)
    }
    return id
  }, [])

  const removerToast = useCallback((id) => {
    setToasts(t => t.filter(x => x.id !== id))
  }, [])

  // Atalhos
  const sucesso = (mensagem, opts = {}) => toast({ tipo: 'sucesso', mensagem, ...opts })
  const erro    = (mensagem, opts = {}) => toast({ tipo: 'erro',   mensagem, duracao: 5000, ...opts })
  const info    = (mensagem, opts = {}) => toast({ tipo: 'info',   mensagem, ...opts })
  const aviso   = (mensagem, opts = {}) => toast({ tipo: 'aviso',  mensagem, duracao: 5000, ...opts })

  return (
    <ToastContext.Provider value={{ toast, sucesso, erro, info, aviso, confirmar, removerToast }}>
      {children}
      <ToastsView toasts={toasts} onClose={removerToast} />
      {confirm && <ConfirmDialog {...confirm} />}
    </ToastContext.Provider>
  )
}

function ToastsView({ toasts, onClose }) {
  return (
    <div style={s.toastContainer}>
      {toasts.map(t => <ToastItem key={t.id} toast={t} onClose={() => onClose(t.id)} />)}
    </div>
  )
}

function ToastItem({ toast, onClose }) {
  const TIPOS = {
    sucesso: { icon: Check,        bg: '#DCFCE7', border: '#86EFAC', color: '#15803D' },
    erro:    { icon: AlertCircle,  bg: '#FEE2E2', border: '#FCA5A5', color: '#B91C1C' },
    info:    { icon: Info,         bg: '#DBEAFE', border: '#93C5FD', color: '#1E40AF' },
    aviso:   { icon: AlertCircle,  bg: '#FEF3C7', border: '#FCD34D', color: '#92400E' },
  }
  const cfg = TIPOS[toast.tipo] || TIPOS.info
  const Icon = cfg.icon

  return (
    <div style={{ ...s.toast, background: cfg.bg, borderColor: cfg.border, color: cfg.color }}>
      <Icon size={16} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{toast.mensagem}</div>
      {toast.acaoLabel && toast.acao && (
        <button
          style={{ ...s.undoBtn, color: cfg.color }}
          onClick={() => { toast.acao(); onClose() }}
        >
          <Undo2 size={13} /> {toast.acaoLabel}
        </button>
      )}
      <button style={s.closeBtn} onClick={onClose}><X size={14} /></button>
    </div>
  )
}

function ConfirmDialog({ titulo, mensagem, confirmarLabel = 'Confirmar', cancelarLabel = 'Cancelar', tipo = 'aviso', onConfirm, onCancel }) {
  const isPerigo = tipo === 'perigo'

  return (
    <div style={s.overlay} onClick={onCancel}>
      <div style={s.dialog} onClick={e => e.stopPropagation()}>
        <div style={{ ...s.dialogIcon, background: isPerigo ? '#FEE2E2' : '#FEF3C7' }}>
          <AlertCircle size={26} color={isPerigo ? '#B91C1C' : '#D97706'} />
        </div>
        <h2 style={s.dialogTitulo}>{titulo || 'Tem certeza?'}</h2>
        {mensagem && <p style={s.dialogMensagem}>{mensagem}</p>}
        <div style={s.dialogBotoes}>
          <button style={s.btnCancelar} onClick={onCancel}>
            {cancelarLabel}
          </button>
          <button
            style={{ ...s.btnConfirmar, background: isPerigo ? '#B91C1C' : '#D97706' }}
            onClick={onConfirm}
          >
            {confirmarLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export const useToast = () => useContext(ToastContext)

const s = {
  toastContainer: {
    position: 'fixed',
    bottom: 90,
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    flexDirection: 'column-reverse',
    gap: 8,
    zIndex: 400,
    width: '100%',
    maxWidth: 480,
    padding: '0 16px',
    pointerEvents: 'none',
  },
  toast: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '11px 14px',
    border: '1px solid',
    borderRadius: 'var(--radius-sm)',
    boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
    pointerEvents: 'auto',
    animation: 'slideUp 0.25s ease',
  },
  undoBtn: {
    display: 'flex', alignItems: 'center', gap: 4,
    background: 'rgba(0,0,0,0.08)', border: 'none',
    padding: '5px 11px', borderRadius: 'var(--radius-pill)',
    fontSize: 11, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'inherit', whiteSpace: 'nowrap',
  },
  closeBtn: {
    background: 'transparent', border: 'none', cursor: 'pointer',
    color: 'inherit', opacity: 0.6, padding: 2,
    display: 'flex', alignItems: 'center',
  },
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(24,7,18,0.65)',
    zIndex: 500,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 20, backdropFilter: 'blur(4px)',
  },
  dialog: {
    background: 'var(--surface)',
    borderRadius: 18, padding: '26px 24px',
    maxWidth: 400, width: '100%', textAlign: 'center',
    boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
  },
  dialogIcon: {
    width: 56, height: 56, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '0 auto 14px',
  },
  dialogTitulo: {
    fontFamily: "'Bricolage Grotesque', sans-serif",
    fontSize: 18, fontWeight: 700, color: 'var(--text)',
    margin: '0 0 8px',
  },
  dialogMensagem: {
    fontSize: 13, color: 'var(--text2)',
    lineHeight: 1.5, margin: '0 0 20px',
  },
  dialogBotoes: {
    display: 'flex', gap: 8,
  },
  btnCancelar: {
    flex: 1, background: 'var(--surface2)',
    color: 'var(--text2)', border: '1px solid var(--border2)',
    borderRadius: 'var(--radius-sm)', padding: '11px',
    fontSize: 13, fontWeight: 600, cursor: 'pointer',
    fontFamily: 'inherit',
  },
  btnConfirmar: {
    flex: 1, color: 'white', border: 'none',
    borderRadius: 'var(--radius-sm)', padding: '11px',
    fontSize: 13, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'inherit',
  },
}
