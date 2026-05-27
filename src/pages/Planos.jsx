import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, X, Sparkles, ArrowLeft, MessageCircle, Star } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useAssinatura, PLANOS, formatPreco, whatsappAssinarLink } from '../contexts/AssinaturaContext'

export default function Planos() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { assinatura, plano: planoAtual, isTrialing, diasRestantesTrial, trialAcabou, isActive } = useAssinatura()
  const [ciclo, setCiclo] = useState('mensal')
  const [assinarLoading, setAssinarLoading] = useState(null)

  const nomeUsuario = user?.user_metadata?.full_name || ''
  const emailUsuario = user?.email || ''

  function handleAssinar(planoId) {
    setAssinarLoading(planoId)
    const link = whatsappAssinarLink({ nomeUsuario, emailUsuario, planoId, ciclo })
    window.open(link, '_blank')
    setTimeout(() => setAssinarLoading(null), 1500)
  }

  return (
    <div style={s.page}>

      <button style={s.voltarBtn} onClick={() => navigate(-1)}>
        <ArrowLeft size={14} /> Voltar
      </button>

      {/* Header */}
      <div style={s.hero}>
        <div style={s.heroBadge}>
          <Sparkles size={14} /> Escolha seu plano
        </div>
        <h1 style={s.heroTitle}>
          {isTrialing && !trialAcabou && diasRestantesTrial > 0
            ? `Você tem ${diasRestantesTrial} ${diasRestantesTrial === 1 ? 'dia' : 'dias'} de teste grátis`
            : trialAcabou
              ? 'Seu período de teste acabou'
              : 'Continue crescendo com o NailPro'}
        </h1>
        <p style={s.heroSub}>
          {trialAcabou
            ? 'Assine pra continuar usando todas as funcionalidades.'
            : 'Escolha o plano ideal pro seu momento. No mensal, cancela quando quiser.'}
        </p>
      </div>

      {/* Toggle Mensal/Anual */}
      <div style={s.toggleWrap}>
        <div style={s.toggleCard}>
          <button
            style={{ ...s.toggleBtn, ...(ciclo === 'mensal' ? s.toggleBtnActive : {}) }}
            onClick={() => setCiclo('mensal')}
          >
            Mensal
          </button>
          <button
            style={{ ...s.toggleBtn, ...(ciclo === 'anual' ? s.toggleBtnActive : {}) }}
            onClick={() => setCiclo('anual')}
          >
            Anual <span style={s.economiaBadge}>até 37% off</span>
          </button>
        </div>
      </div>

      {/* Cards de planos */}
      <div style={s.planosGrid}>
        {/* STARTER */}
        <PlanoCard
          plano={PLANOS.starter}
          ciclo={ciclo}
          isAtual={isActive && assinatura?.plano === 'starter'}
          isPopular={false}
          loading={assinarLoading === 'starter'}
          onAssinar={() => handleAssinar('starter')}
        />

        {/* PRO */}
        <PlanoCard
          plano={PLANOS.pro}
          ciclo={ciclo}
          isAtual={isActive && assinatura?.plano === 'pro'}
          isPopular={true}
          loading={assinarLoading === 'pro'}
          onAssinar={() => handleAssinar('pro')}
        />
      </div>

      {/* FAQ rápido */}
      <div style={s.faq}>
        <h3 style={s.faqTitle}>Dúvidas frequentes</h3>
        <FaqItem
          q="Como funciona o pagamento?"
          a="Após clicar em 'Assinar', você é direcionada pro WhatsApp pra escolher entre PIX, cartão ou boleto. Liberamos seu acesso em até 1 hora."
        />
        <FaqItem
          q="Tem fidelidade?"
          a="Depende do ciclo. No plano mensal não tem fidelidade — você cancela quando quiser, sem multa. No plano anual há fidelidade de 12 meses, por isso o valor é bem mais barato."
        />
        <FaqItem
          q="Meus dados ficam guardados se eu cancelar?"
          a="Sim! Mantemos seu histórico por 90 dias após cancelamento. Você pode reativar a qualquer momento sem perder nada."
        />
        <FaqItem
          q="Posso mudar de plano depois?"
          a="Pode. Faz upgrade ou downgrade quando quiser, é só falar com a gente no WhatsApp."
        />
      </div>

      {/* Garantia */}
      <div style={s.garantia}>
        <Star size={16} color="#D4AF37" />
        <span><strong>Garantia de 7 dias.</strong> Se não curtir, devolvemos 100% do seu dinheiro.</span>
      </div>

    </div>
  )
}

function PlanoCard({ plano, ciclo, isAtual, isPopular, loading, onAssinar }) {
  const precoMensalExibido = ciclo === 'anual' ? plano.precoAnual / 12 : plano.precoMensal
  const totalAnual = plano.precoAnual

  return (
    <div style={{ ...s.planoCard, ...(isPopular ? s.planoCardPro : {}) }}>
      {isPopular && <div style={s.popularBadge}>⭐ Mais popular</div>}
      {isAtual && <div style={s.atualBadge}>Seu plano atual</div>}

      <div style={s.planoNome}>{plano.nome}</div>
      <div style={s.planoPreco}>
        <span style={s.precoMoeda}>R$</span>
        <span style={s.precoValor}>{formatPreco(precoMensalExibido)}</span>
        <span style={s.precoCiclo}>/mês</span>
      </div>
      {ciclo === 'anual' ? (
        <div style={{ marginBottom: 4 }}>
          <div style={s.precoAnualNota}>R$ {formatPreco(totalAnual)} cobrados anualmente</div>
          <div style={s.fidelidadeTag}>📅 Fidelidade de 12 meses</div>
        </div>
      ) : (
        <div style={s.semFidelidadeTag}>✓ Sem fidelidade — cancela quando quiser</div>
      )}

      <button
        style={{ ...s.btnAssinar, ...(isPopular ? s.btnAssinarPro : {}), ...(isAtual ? s.btnAssinarAtual : {}), ...(loading ? { opacity: 0.75 } : {}) }}
        onClick={onAssinar}
        disabled={isAtual || loading}
      >
        {isAtual ? (
          'Seu plano atual'
        ) : loading ? (
          '⏳ Abrindo WhatsApp...'
        ) : (
          <>
            <MessageCircle size={15} /> Assinar via WhatsApp
          </>
        )}
      </button>

      <div style={s.featuresList}>
        {plano.features.map((f, i) => {
          const isIncluso = f.startsWith('✓')
          const texto = f.replace(/^[✓✗]\s/, '')
          return (
            <div key={i} style={{ ...s.featureItem, opacity: isIncluso ? 1 : 0.45 }}>
              {isIncluso
                ? <Check size={14} color="#15803D" style={{ flexShrink: 0 }} />
                : <X size={14} color="var(--text3)" style={{ flexShrink: 0 }} />}
              <span style={{ textDecoration: isIncluso ? 'none' : 'line-through' }}>{texto}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={s.faqItem}>
      <button style={s.faqQ} onClick={() => setOpen(!open)}>
        <span>{q}</span>
        <span style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
      </button>
      {open && <div style={s.faqA}>{a}</div>}
    </div>
  )
}

const s = {
  page: { height: '100vh', overflowY: 'auto', padding: '20px 20px 80px', maxWidth: 980, margin: '0 auto' },
  voltarBtn: { display: 'inline-flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', color: 'var(--text3)', fontSize: 13, cursor: 'pointer', padding: '6px 0', marginBottom: 18, fontFamily: 'inherit' },
  hero: { textAlign: 'center', marginBottom: 28 },
  heroBadge: { display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--pink-light)', color: 'var(--pink)', borderRadius: 'var(--radius-pill)', padding: '5px 14px', fontSize: 11, fontWeight: 700, marginBottom: 14, letterSpacing: '0.3px' },
  heroTitle: { fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontSize: 32, fontWeight: 400, color: 'var(--text)', margin: 0, lineHeight: 1.15 },
  heroSub: { fontSize: 14, color: 'var(--text2)', margin: '10px 0 0', lineHeight: 1.5 },
  toggleWrap: { display: 'flex', justifyContent: 'center', marginBottom: 28 },
  toggleCard: { display: 'inline-flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', padding: 4, boxShadow: 'var(--shadow-xs)' },
  toggleBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 'var(--radius-pill)', background: 'transparent', border: 'none', fontSize: 13, fontWeight: 600, color: 'var(--text3)', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' },
  toggleBtnActive: { background: 'var(--pink)', color: 'white', boxShadow: 'var(--shadow-pink)' },
  economiaBadge: { background: 'var(--gold, #D4AF37)', color: 'var(--brand-dark-bg, #170D14)', borderRadius: 'var(--radius-pill)', padding: '2px 8px', fontSize: 10, fontWeight: 800 },
  planosGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18, marginBottom: 32 },
  planoCard: { position: 'relative', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: '24px 22px', boxShadow: 'var(--shadow-sm)' },
  planoCardPro: { border: '2px solid var(--pink)', boxShadow: '0 12px 32px rgba(139,38,85,0.18)' },
  popularBadge: { position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg, var(--pink) 0%, #C73B6F 100%)', color: 'white', fontSize: 11, fontWeight: 800, padding: '5px 14px', borderRadius: 'var(--radius-pill)', boxShadow: 'var(--shadow-pink)', whiteSpace: 'nowrap' },
  atualBadge: { position: 'absolute', top: 12, right: 12, background: 'var(--green-bg)', color: 'var(--green)', fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 'var(--radius-pill)' },
  planoNome: { fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 8 },
  planoPreco: { display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 },
  precoMoeda: { fontSize: 14, fontWeight: 600, color: 'var(--text2)' },
  precoValor: { fontFamily: "'JetBrains Mono', monospace", fontSize: 38, fontWeight: 700, color: 'var(--text)', lineHeight: 1 },
  precoCiclo: { fontSize: 13, color: 'var(--text3)', fontWeight: 500 },
  precoAnualNota: { fontSize: 11, color: 'var(--text3)', marginBottom: 3 },
  fidelidadeTag: { fontSize: 11, fontWeight: 600, color: '#92400E', background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 6, padding: '3px 8px', display: 'inline-block', marginBottom: 10 },
  semFidelidadeTag: { fontSize: 11, fontWeight: 600, color: '#15803D', background: '#DCFCE7', border: '1px solid #4ADE80', borderRadius: 6, padding: '3px 8px', display: 'inline-block', marginBottom: 10 },
  btnAssinar: { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'var(--surface2)', color: 'var(--text)', border: '1.5px solid var(--border2)', borderRadius: 12, padding: '13px', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 14, marginBottom: 18, fontFamily: 'inherit', transition: 'all 0.15s' },
  btnAssinarPro: { background: 'linear-gradient(135deg, var(--pink) 0%, #C73B6F 100%)', color: 'white', border: 'none', boxShadow: '0 6px 16px rgba(139,38,85,0.3)' },
  btnAssinarAtual: { background: 'var(--green-bg)', color: 'var(--green)', border: '1.5px solid var(--green)', cursor: 'default', boxShadow: 'none' },
  featuresList: { display: 'flex', flexDirection: 'column', gap: 9, marginTop: 4 },
  featureItem: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)', lineHeight: 1.4 },
  faq: { marginTop: 24, marginBottom: 18 },
  faqTitle: { fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 12, textAlign: 'center' },
  faqItem: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 8, overflow: 'hidden' },
  faqQ: { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'transparent', border: 'none', padding: '14px 16px', fontSize: 13, fontWeight: 600, color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' },
  faqA: { padding: '0 16px 14px', fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 },
  garantia: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', fontSize: 13, color: 'var(--text2)' },
}
