import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Gift, Copy, Check, MessageCircle, ArrowRight, ChevronLeft } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { LumenLogo } from '../components/common/Brand'
import { linkWhatsApp } from '../lib/formatters'

export default function Indicacao() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [copiado, setCopiado] = useState(false)

  // Nome que identifica quem indicou (vai no campo "Quem te indicou?" do cadastro).
  const nome = (user?.user_metadata?.full_name || user?.email?.split('@')[0] || '').trim()
  const origem = typeof window !== 'undefined' ? window.location.origin : 'https://lumengestaoempresarial.com.br'
  const linkIndicacao = `${origem}/login?modo=cadastro&indicacao=${encodeURIComponent(nome)}`

  const msgWhats = `Oi! Eu uso a Lumen pra organizar minha agenda, clientes e financeiro 💅\n\nSe você se cadastrar pelo meu link, ganha 50% de desconto no primeiro mês:\n${linkIndicacao}`

  function copiar() {
    navigator.clipboard?.writeText(linkIndicacao).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    }).catch(() => {})
  }

  return (
    <div style={s.root}>
      <div className="fade-in" style={s.card}>
        <button style={s.voltar} onClick={() => navigate(user ? '/app' : '/')}>
          <ChevronLeft size={14} /> Voltar
        </button>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
          <LumenLogo size={30} variant="reverso" layout="horizontal" />
        </div>

        <div style={s.iconWrap}><Gift size={26} color="#180712" /></div>
        <h1 style={s.titulo}>Indique e ganhe</h1>
        <p style={s.sub}>indique a Lumen pra outras nail designers</p>

        {/* Recompensa */}
        <div style={s.premios}>
          <div style={s.premio}>
            <div style={s.premioValor}>50%</div>
            <div style={s.premioTxt}>da 1ª mensalidade <strong>pra você</strong>, via PIX</div>
          </div>
          <div style={s.premioDiv} />
          <div style={s.premio}>
            <div style={s.premioValor}>50%</div>
            <div style={s.premioTxt}>de desconto no 1º mês <strong>pra ela</strong></div>
          </div>
        </div>

        {/* Como funciona */}
        <div style={s.passos}>
          <div style={s.passo}><span style={s.passoNum}>1</span> Compartilhe seu link com amigas nail designers.</div>
          <div style={s.passo}><span style={s.passoNum}>2</span> Ela se cadastra (seu nome já vai preenchido) e assina um plano.</div>
          <div style={s.passo}><span style={s.passoNum}>3</span> Você recebe os 50% no PIX e ela ganha o desconto. 🎉</div>
        </div>

        {user ? (
          <>
            <div style={s.linkLabel}>Seu link de indicação</div>
            <div style={s.linkBox}>
              <span style={s.linkTxt}>{linkIndicacao}</span>
            </div>
            <div style={s.botoes}>
              <button style={s.btnCopiar} onClick={copiar}>
                {copiado ? <><Check size={15} /> Copiado!</> : <><Copy size={15} /> Copiar link</>}
              </button>
              <a style={s.btnWhats} href={linkWhatsApp('', msgWhats)} target="_blank" rel="noreferrer">
                <MessageCircle size={15} /> Compartilhar
              </a>
            </div>
            <p style={s.obs}>Depois que a indicada assinar, fale com a gente pelo WhatsApp do suporte para receber sua comissão.</p>
          </>
        ) : (
          <>
            <button style={s.btnPrincipal} onClick={() => navigate('/login?modo=cadastro')}>
              Criar minha conta grátis <ArrowRight size={16} />
            </button>
            <p style={s.obs}>
              Já é cliente? <Link to="/login" style={s.linkInline}>Entre na sua conta</Link> para pegar seu link de indicação.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

const s = {
  root: {
    minHeight: '100vh', height: '100%', overflowY: 'auto',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'radial-gradient(circle at top, #2C1422 0%, var(--brand-dark-bg, #170D14) 100%)',
    padding: 20,
  },
  card: {
    background: 'rgba(255, 255, 255, 0.03)', borderRadius: 24, padding: '24px 28px',
    width: '100%', maxWidth: 420, margin: 'auto',
    border: '1px solid rgba(255, 255, 255, 0.07)',
    boxShadow: '0 24px 64px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
  },
  voltar: { display: 'inline-flex', alignItems: 'center', gap: 3, background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.55)', fontSize: 12, cursor: 'pointer', padding: '0 0 10px', fontFamily: 'inherit' },
  iconWrap: { width: 52, height: 52, borderRadius: '50%', background: 'var(--gold, #E6C260)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '10px auto 12px', boxShadow: '0 8px 20px rgba(230,194,96,0.3)' },
  titulo: { fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontSize: 30, fontWeight: 400, color: '#fff', textAlign: 'center', margin: 0 },
  sub: { textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 4, marginBottom: 20, fontFamily: "'Instrument Serif', serif", fontStyle: 'italic' },
  premios: { display: 'flex', alignItems: 'stretch', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '16px 12px', marginBottom: 18 },
  premio: { flex: 1, textAlign: 'center', padding: '0 8px' },
  premioDiv: { width: 1, background: 'rgba(255,255,255,0.1)' },
  premioValor: { fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 30, fontWeight: 800, color: 'var(--gold, #E6C260)', lineHeight: 1 },
  premioTxt: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 6, lineHeight: 1.4 },
  passos: { display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 },
  passo: { display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 1.45 },
  passoNum: { flexShrink: 0, width: 22, height: 22, borderRadius: '50%', background: 'rgba(230,194,96,0.18)', color: 'var(--gold, #E6C260)', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  linkLabel: { fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginBottom: 6 },
  linkBox: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '11px 13px', marginBottom: 10 },
  linkTxt: { fontSize: 12.5, color: '#fff', wordBreak: 'break-all', lineHeight: 1.4 },
  botoes: { display: 'flex', gap: 8 },
  btnCopiar: { flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: '12px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  btnWhats: { flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#25D366', color: '#fff', border: 'none', borderRadius: 12, padding: '12px', fontSize: 13, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', fontFamily: 'inherit' },
  btnPrincipal: { width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'var(--gold, #E6C260)', color: 'var(--brand-dark-bg, #170D14)', border: 'none', borderRadius: 14, padding: '14px', fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: "'Bricolage Grotesque', sans-serif", boxShadow: '0 8px 24px rgba(0,0,0,0.18)' },
  obs: { fontSize: 12, color: 'rgba(255,255,255,0.55)', textAlign: 'center', marginTop: 14, lineHeight: 1.5 },
  linkInline: { color: 'var(--gold, #E6C260)', textDecoration: 'underline', fontWeight: 600 },
}
