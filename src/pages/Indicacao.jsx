import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Gift, Copy, Check, ArrowRight, ChevronLeft } from 'lucide-react'
import WaIcon from '../components/common/WaIcon'
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

        {/* Cabeçalho */}
        <div style={s.head}>
          <div style={s.headTop}>
            <LumenLogo size={26} variant="reverso" layout="horizontal" />
            <div style={s.iconWrap}><Gift size={20} color="#180712" /></div>
          </div>
          <h1 style={s.titulo}>Indique e ganhe dinheiro</h1>
          <p style={s.intro}>
            Conhece outras nail designers? Indique a Lumen: a cada amiga que assinar um plano,
            <strong> você ganha 50% da 1ª mensalidade dela no seu PIX</strong> — e ela entra pagando
            metade no primeiro mês. <strong>Sem limite de indicações.</strong>
          </p>
        </div>

        {/* Conteúdo em 2 colunas (lado a lado no desktop, empilha no celular) */}
        <div style={s.cols}>
          {/* Coluna 1 — recompensa + exemplo */}
          <div style={s.col}>
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
            <div style={s.exemplo}>
              💡 <strong>Exemplo:</strong> indicou uma amiga no plano Pro (R$ 179/mês)? Ela paga
              só <strong>R$ 89,50</strong> no 1º mês e você recebe <strong>R$ 89,50</strong> no seu PIX.
            </div>
          </div>

          {/* Coluna 2 — como funciona */}
          <div style={s.col}>
            <div style={s.comoTitulo}>Como funciona</div>
            <div style={s.passo}><span style={s.passoNum}>1</span> Compartilhe seu link com amigas nail designers.</div>
            <div style={s.passo}><span style={s.passoNum}>2</span> Ela se cadastra (seu nome já vai preenchido) e assina um plano.</div>
            <div style={s.passo}><span style={s.passoNum}>3</span> Você recebe os 50% no PIX e ela ganha o desconto. 🎉</div>
          </div>
        </div>

        {/* Ação */}
        {user ? (
          <div style={s.acaoWrap}>
            <div style={s.linkLabel}>Seu link de indicação</div>
            <div style={s.linkRow}>
              <span style={s.linkTxt}>{linkIndicacao}</span>
              <button style={s.btnCopiar} onClick={copiar}>
                {copiado ? <><Check size={15} /> Copiado!</> : <><Copy size={15} /> Copiar</>}
              </button>
              <a style={s.btnWhats} href={linkWhatsApp('', msgWhats)} target="_blank" rel="noreferrer">
                <WaIcon size={15} /> Compartilhar
              </a>
            </div>
            <p style={s.obs}>Depois que a indicada assinar, fale com o suporte no WhatsApp para receber sua comissão.</p>
          </div>
        ) : (
          <div style={s.acaoWrap}>
            <button style={s.btnPrincipal} onClick={() => navigate('/login?modo=cadastro')}>
              Criar minha conta grátis <ArrowRight size={16} />
            </button>
            <p style={s.obs}>
              Já é cliente? <Link to="/login" style={s.linkInline}>Entre na sua conta</Link> para pegar seu link de indicação.
            </p>
          </div>
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
    padding: 16,
  },
  card: {
    background: 'rgba(255, 255, 255, 0.03)', borderRadius: 24, padding: '18px 26px 22px',
    width: '100%', maxWidth: 720, margin: 'auto',
    border: '1px solid rgba(255, 255, 255, 0.07)',
    boxShadow: '0 24px 64px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
  },
  voltar: { display: 'inline-flex', alignItems: 'center', gap: 3, background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.55)', fontSize: 12, cursor: 'pointer', padding: '0 0 6px', fontFamily: 'inherit' },
  head: { textAlign: 'center', marginBottom: 16 },
  headTop: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 8 },
  iconWrap: { width: 38, height: 38, borderRadius: '50%', background: 'var(--gold, #E6C260)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 16px rgba(230,194,96,0.3)' },
  titulo: { fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontSize: 28, fontWeight: 400, color: '#fff', margin: 0 },
  intro: { fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5, maxWidth: 600, margin: '8px auto 0' },
  cols: { display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 16 },
  col: { flex: '1 1 280px', display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 },
  premios: { display: 'flex', alignItems: 'stretch', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '12px 10px' },
  premio: { flex: 1, textAlign: 'center', padding: '0 8px' },
  premioDiv: { width: 1, background: 'rgba(255,255,255,0.1)' },
  premioValor: { fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 28, fontWeight: 800, color: 'var(--gold, #E6C260)', lineHeight: 1 },
  premioTxt: { fontSize: 11.5, color: 'rgba(255,255,255,0.75)', marginTop: 4, lineHeight: 1.35 },
  exemplo: { fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5, background: 'rgba(230,194,96,0.08)', border: '1px solid rgba(230,194,96,0.2)', borderRadius: 12, padding: '10px 12px' },
  comoTitulo: { fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.5px' },
  passo: { display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 12.5, color: 'rgba(255,255,255,0.8)', lineHeight: 1.4 },
  passoNum: { flexShrink: 0, width: 22, height: 22, borderRadius: '50%', background: 'rgba(230,194,96,0.18)', color: 'var(--gold, #E6C260)', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  acaoWrap: { borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 14 },
  linkLabel: { fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginBottom: 6 },
  linkRow: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  linkTxt: { flex: '1 1 240px', fontSize: 12.5, color: '#fff', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 12px', wordBreak: 'break-all' },
  btnCopiar: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: '11px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  btnWhats: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'var(--whatsapp)', color: '#fff', border: 'none', borderRadius: 12, padding: '11px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', fontFamily: 'inherit' },
  btnPrincipal: { width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'var(--gold, #E6C260)', color: 'var(--brand-dark-bg, #170D14)', border: 'none', borderRadius: 14, padding: '13px', fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: "'Bricolage Grotesque', sans-serif", boxShadow: '0 8px 24px rgba(0,0,0,0.18)' },
  obs: { fontSize: 11.5, color: 'rgba(255,255,255,0.55)', textAlign: 'center', marginTop: 10, lineHeight: 1.45 },
  linkInline: { color: 'var(--gold, #E6C260)', textDecoration: 'underline', fontWeight: 600 },
}
