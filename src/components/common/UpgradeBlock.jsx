import { useNavigate } from 'react-router-dom'
import { Crown, Sparkles, X, ArrowRight, Lock } from 'lucide-react'

/**
 * Bloqueio de página inteira para features que não estão no plano atual.
 * Use como early return quando o usuário não tem acesso à página.
 */
export function UpgradeBlock({ titulo, descricao, feature, icon: Icon = Lock }) {
  const navigate = useNavigate()
  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.iconBox}><Icon size={32} color="white" /></div>
        <div style={s.proBadge}><Crown size={12} /> Recurso Premium</div>
        <h1 style={s.titulo}>{titulo || 'Esta funcionalidade é exclusiva do Pro e do Salão'}</h1>
        <p style={s.descricao}>
          {descricao || 'Faça upgrade pro plano Pro ou Salão pra desbloquear esta e outras funcionalidades.'}
        </p>
        {feature && <div style={s.featureName}>🔓 {feature}</div>}
        <button style={s.btn} onClick={() => navigate('/planos')}>
          <Sparkles size={15} /> Ver planos <ArrowRight size={15} />
        </button>
        <button style={s.btnGhost} onClick={() => navigate(-1)}>Voltar</button>
      </div>
    </div>
  )
}

/**
 * Modal de upgrade — usar inline quando uma AÇÃO específica é bloqueada.
 * Ex: clicar em "Conectar Google" no plano Starter.
 */
export function UpgradeModal({ aberto, onClose, titulo, descricao }) {
  const navigate = useNavigate()
  if (!aberto) return null

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <button style={s.closeBtn} onClick={onClose}><X size={18} /></button>
        <div style={s.iconBox}><Crown size={32} color="white" /></div>
        <div style={s.proBadge}><Crown size={12} /> Recurso Premium</div>
        <h2 style={s.modalTitulo}>{titulo || 'Disponível no Pro e no Salão'}</h2>
        <p style={s.descricao}>
          {descricao || 'Faça upgrade pra desbloquear esta funcionalidade agora mesmo.'}
        </p>
        <button style={s.btn} onClick={() => navigate('/planos')}>
          <Sparkles size={15} /> Ver planos <ArrowRight size={15} />
        </button>
        <button style={s.btnGhost} onClick={onClose}>Agora não</button>
      </div>
    </div>
  )
}

/**
 * Badge inline para mostrar "Pro" em features bloqueadas.
 */
export function ProBadge() {
  return (
    <span style={s.inlineBadge}>
      <Crown size={10} /> Pro
    </span>
  )
}

const s = {
  page: { padding: 20, paddingBottom: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '70vh' },
  card: {
    maxWidth: 460,
    width: '100%',
    background: 'linear-gradient(135deg, var(--surface) 0%, #FFF0F5 100%)',
    border: '1px solid var(--pink-mid)',
    borderRadius: 20,
    padding: '32px 26px',
    textAlign: 'center',
    boxShadow: '0 12px 40px rgba(139,38,85,0.12)',
  },
  iconBox: {
    width: 70, height: 70, borderRadius: '50%',
    background: 'linear-gradient(135deg, var(--pink) 0%, #C73B6F 100%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '0 auto 16px',
    boxShadow: '0 8px 24px rgba(139,38,85,0.35)',
  },
  proBadge: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    background: 'var(--gold, #D4AF37)', color: '#170D14',
    fontSize: 11, fontWeight: 800, padding: '4px 12px',
    borderRadius: 'var(--radius-pill)', letterSpacing: '0.5px',
    marginBottom: 14,
  },
  titulo: {
    fontFamily: "'Instrument Serif', serif", fontStyle: 'italic',
    fontSize: 24, fontWeight: 400, color: 'var(--text)',
    margin: 0, lineHeight: 1.2,
  },
  modalTitulo: {
    fontFamily: "'Bricolage Grotesque', sans-serif",
    fontSize: 19, fontWeight: 700, color: 'var(--text)',
    margin: 0,
  },
  descricao: { fontSize: 13, color: 'var(--text2)', margin: '10px 0 18px', lineHeight: 1.5 },
  featureName: {
    display: 'inline-block', background: 'var(--surface2)',
    padding: '6px 14px', borderRadius: 'var(--radius-pill)',
    fontSize: 13, fontWeight: 600, color: 'var(--pink)',
    marginBottom: 18,
  },
  btn: {
    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    background: 'linear-gradient(135deg, var(--pink) 0%, #C73B6F 100%)',
    color: 'white', border: 'none', borderRadius: 12,
    padding: '13px', fontSize: 14, fontWeight: 700,
    cursor: 'pointer', fontFamily: 'inherit',
    boxShadow: '0 6px 16px rgba(139,38,85,0.3)',
    marginBottom: 8,
  },
  btnGhost: {
    width: '100%', background: 'transparent',
    color: 'var(--text3)', border: 'none',
    padding: '10px', fontSize: 13, fontWeight: 500,
    cursor: 'pointer', fontFamily: 'inherit',
  },
  /* Modal */
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(24,7,18,0.65)',
    zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 20, backdropFilter: 'blur(4px)',
  },
  modal: {
    background: 'var(--surface)', borderRadius: 20, padding: '28px 26px',
    maxWidth: 420, width: '100%', textAlign: 'center', position: 'relative',
    boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
  },
  closeBtn: {
    position: 'absolute', top: 12, right: 12,
    background: 'transparent', border: 'none', cursor: 'pointer',
    color: 'var(--text3)', padding: 6,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: '50%',
  },
  inlineBadge: {
    display: 'inline-flex', alignItems: 'center', gap: 3,
    background: 'var(--gold, #D4AF37)', color: '#170D14',
    fontSize: 9, fontWeight: 800, padding: '2px 7px',
    borderRadius: 'var(--radius-pill)', letterSpacing: '0.3px',
    verticalAlign: 'middle',
  },
}
