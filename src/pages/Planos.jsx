import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, X, Sparkles, ArrowLeft, MessageCircle, Star, FileText, Zap } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useAssinatura, PLANOS, formatPreco, whatsappAssinarLink, PRECO_USUARIO_ADICIONAL } from '../contexts/AssinaturaContext'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default function Planos() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [ciclo, setCiclo] = useState('anual') // 'anual' | 'mensal'
  const [assinarLoading, setAssinarLoading] = useState(null)

  async function sair() {
    await signOut()
    navigate('/login', { replace: true })
  }

  const {
    assinatura, plano: planoAtual, isTrialing, diasRestantesTrial,
    trialAcabou, isActive, contrato,
  } = useAssinatura()

  const fmtData = (d) => d ? format(new Date(d), "dd 'de' MMM 'de' yyyy", { locale: ptBR }) : '—'
  const nomeUsuario = user?.user_metadata?.full_name || ''
  const emailUsuario = user?.email || ''

  function handleAssinar(planoId) {
    setAssinarLoading(planoId)
    const link = whatsappAssinarLink({ nomeUsuario, emailUsuario, planoId, ciclo })
    window.open(link, '_blank')
    setTimeout(() => setAssinarLoading(null), 1500)
  }

  const isSoloAtual = isActive && (assinatura?.plano === 'solo' || assinatura?.plano === 'starter')
  const isProAtual  = isActive && assinatura?.plano === 'pro'

  // Economia anual vs mensal
  const economiaSolo = Math.round(((PLANOS.solo.precoMensalMensal - PLANOS.solo.precoMensalAnual) / PLANOS.solo.precoMensalMensal) * 100)
  const economiaPro  = Math.round(((PLANOS.pro.precoMensalMensal - PLANOS.pro.precoMensalAnual) / PLANOS.pro.precoMensalMensal) * 100)

  return (
    <div style={s.page}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button style={s.voltarBtn} onClick={() => navigate(-1)}>
          <ArrowLeft size={14} /> Voltar
        </button>
        <button style={s.voltarBtn} onClick={sair}>Sair</button>
      </div>

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
              : 'Continue crescendo com a Lumen'}
        </h1>
        <p style={s.heroSub}>
          {trialAcabou
            ? 'Assine pra continuar usando todas as funcionalidades.'
            : 'Planos para autônomas e salões. Sem taxa de setup, sem surpresas.'}
        </p>
      </div>

      {/* Toggle mensal / anual */}
      <div style={s.toggleWrap}>
        <div style={s.toggleCard}>
          <button
            style={{ ...s.toggleBtn, ...(ciclo === 'anual' ? s.toggleBtnActive : {}) }}
            onClick={() => setCiclo('anual')}
          >
            Anual
            <span style={s.economiaBadge}>Economize ~{economiaSolo}%</span>
          </button>
          <button
            style={{ ...s.toggleBtn, ...(ciclo === 'mensal' ? s.toggleBtnActive : {}) }}
            onClick={() => setCiclo('mensal')}
          >
            Mensal
          </button>
        </div>
        {ciclo === 'anual' && (
          <div style={s.anualNota}>📅 Fidelidade de 12 meses · multa de 50% em caso de cancelamento antecipado</div>
        )}
        {ciclo === 'mensal' && (
          <div style={s.mensalNota}>📆 Sem fidelidade · cancele quando quiser</div>
        )}
      </div>

      {/* Contrato atual */}
      {isActive && contrato && (
        <div style={s.contratoCard}>
          <div style={s.contratoHeader}>
            <FileText size={16} color="var(--pink)" />
            <span style={s.contratoTitulo}>Seu contrato — {planoAtual?.nome}</span>
          </div>
          <div style={s.contratoGrid}>
            <div>
              <div style={s.contratoLabel}>Início</div>
              <div style={s.contratoValor}>{fmtData(contrato.inicio)}</div>
            </div>
            <div>
              <div style={s.contratoLabel}>Fim da fidelidade</div>
              <div style={s.contratoValor}>{fmtData(contrato.fim)}</div>
            </div>
            <div>
              <div style={s.contratoLabel}>Tempo restante</div>
              <div style={s.contratoValor}>{contrato.mesesRestantes} {contrato.mesesRestantes === 1 ? 'mês' : 'meses'}</div>
            </div>
          </div>
          {contrato.dentroFidelidade ? (
            <div style={s.contratoMulta}>
              ⚠️ Cancelamento antes de {fmtData(contrato.fim)} tem multa de <strong>50% do valor restante</strong> —
              hoje, aproximadamente <strong>R$ {formatPreco(contrato.multaCentavos)}</strong>.
            </div>
          ) : (
            <div style={{ ...s.contratoMulta, background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid #86EFAC' }}>
              ✓ Fidelidade cumprida — você pode cancelar sem multa.
            </div>
          )}
        </div>
      )}

      {/* Cards de planos */}
      <div style={s.planosGrid}>
        <PlanoCard
          plano={PLANOS.solo}
          ciclo={ciclo}
          isAtual={isSoloAtual}
          isPopular={false}
          loading={assinarLoading === 'solo'}
          onAssinar={() => handleAssinar('solo')}
        />
        <PlanoCard
          plano={PLANOS.pro}
          ciclo={ciclo}
          isAtual={isProAtual}
          isPopular={true}
          loading={assinarLoading === 'pro'}
          onAssinar={() => handleAssinar('pro')}
        />
      </div>

      {/* Studio — equipe */}
      <div style={s.studioBanner}>
        <div style={s.studioHeader}>
          <Zap size={18} color="var(--gold, #E6C260)" />
          <span style={s.studioTitulo}>Studio — para salões com equipe</span>
        </div>
        <p style={s.studioTexto}>
          No plano <strong>Pro</strong>, dê um <strong>login próprio</strong> para cada profissional por
          apenas <strong>R$ {formatPreco(PRECO_USUARIO_ADICIONAL)}/mês por usuário</strong>.
          A dona/admin não paga login adicional.
        </p>
        <div style={s.studioExemplos}>
          {[
            { label: 'Você sozinha', valor: PLANOS.pro.precoMensalAnual },
            { label: '+ 1 profissional', valor: PLANOS.pro.precoMensalAnual + PRECO_USUARIO_ADICIONAL },
            { label: '+ 3 profissionais', valor: PLANOS.pro.precoMensalAnual + 3 * PRECO_USUARIO_ADICIONAL },
          ].map(ex => (
            <div key={ex.label} style={s.studioExemplo}>
              <div style={s.studioExemploLabel}>{ex.label}</div>
              <div style={s.studioExemploValor}>R$ {formatPreco(ex.valor)}<span style={{ fontSize: 11, fontWeight: 500 }}>/mês</span></div>
            </div>
          ))}
        </div>
        <button style={s.studioBtn} onClick={() => handleAssinar('pro')}>
          <MessageCircle size={14} /> Falar sobre plano Studio
        </button>
      </div>

      {/* FAQ */}
      <div style={s.faq}>
        <h3 style={s.faqTitle}>Dúvidas frequentes</h3>
        <FaqItem
          q="Como funciona o pagamento?"
          a="Após clicar em 'Assinar', você é direcionada pro WhatsApp pra escolher entre PIX, cartão ou boleto. Liberamos seu acesso em até 1 hora."
        />
        <FaqItem
          q="Qual a diferença entre mensal e anual?"
          a={`No plano anual você economiza ~${economiaSolo}% e trava o preço por 12 meses — mas há fidelidade com multa de 50% em cancelamento antecipado. O mensal é mais caro, porém sem compromisso: cancela quando quiser.`}
        />
        <FaqItem
          q="Tem fidelidade no plano anual?"
          a="Sim. Os planos anuais têm fidelidade de 12 meses. Em caso de cancelamento antes do fim do contrato, há multa de 50% sobre o valor restante."
        />
        <FaqItem
          q="Meus dados ficam guardados se eu cancelar?"
          a="Sim! Mantemos seu histórico por 90 dias após cancelamento. Você pode reativar a qualquer momento sem perder nada."
        />
        <FaqItem
          q="Posso mudar de plano depois?"
          a="Pode. Faz upgrade ou downgrade quando quiser, é só falar com a gente no WhatsApp."
        />
        <FaqItem
          q="Como funciona pra salão com várias manicures?"
          a={`No plano Pro você pode dar login individual para cada profissional (cada uma vê só a própria agenda e o próprio financeiro) por R$ ${formatPreco(PRECO_USUARIO_ADICIONAL)}/mês por usuário. A dona/admin não paga login adicional. Ex.: salão com 3 manicures = R$ ${formatPreco(PLANOS.pro.precoMensalAnual)} + 2 × R$ ${formatPreco(PRECO_USUARIO_ADICIONAL)} = R$ ${formatPreco(PLANOS.pro.precoMensalAnual + 2 * PRECO_USUARIO_ADICIONAL)}/mês.`}
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

function PlanoCard({ plano, ciclo = 'anual', isAtual, isPopular, loading, onAssinar }) {
  const precoMes = ciclo === 'anual' ? plano.precoMensalAnual : plano.precoMensalMensal
  const economiaPorc = Math.round(((plano.precoMensalMensal - plano.precoMensalAnual) / plano.precoMensalMensal) * 100)

  return (
    <div style={{ ...s.planoCard, ...(isPopular ? s.planoCardPro : {}) }}>
      {isPopular && <div style={s.popularBadge}>⭐ Mais popular</div>}
      {isAtual && <div style={s.atualBadge}>Seu plano atual</div>}

      <div style={s.planoNome}>{plano.nome}</div>
      <div style={s.planoPreco}>
        <span style={s.precoMoeda}>R$</span>
        <span style={s.precoValor}>{formatPreco(precoMes)}</span>
        <span style={s.precoCiclo}>/mês</span>
      </div>

      <div style={{ marginBottom: 14 }}>
        {ciclo === 'anual' ? (
          <>
            <div style={s.precoNota}>R$ {formatPreco(plano.precoAnual)} cobrados anualmente</div>
            <div style={s.fidelidadeTag}>📅 Fidelidade 12 meses · economize {economiaPorc}%</div>
          </>
        ) : (
          <>
            <div style={s.precoNota}>Sem fidelidade · cancele quando quiser</div>
            <div style={s.mensalTag}>📆 Cobrança mensal</div>
          </>
        )}
        {plano.limites?.usuariosAdicionais
          ? <div style={s.usuarioNota}>+ usuários adicionais por R$ {formatPreco(PRECO_USUARIO_ADICIONAL)}/mês</div>
          : <div style={s.usuarioNota}>Inclui 1 login de administrador</div>}
      </div>

      <button
        style={{
          ...s.btnAssinar,
          ...(isPopular ? s.btnAssinarPro : {}),
          ...(isAtual ? s.btnAssinarAtual : {}),
          ...(loading ? { opacity: 0.75 } : {}),
        }}
        onClick={onAssinar}
        disabled={isAtual || loading}
      >
        {isAtual ? 'Seu plano atual'
          : loading ? '⏳ Abrindo WhatsApp...'
          : <><MessageCircle size={15} /> Assinar via WhatsApp</>}
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
        <span style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>▼</span>
      </button>
      {open && <div style={s.faqA}>{a}</div>}
    </div>
  )
}

const s = {
  page: { height: '100vh', overflowY: 'auto', padding: '20px 20px 80px', maxWidth: 980, margin: '0 auto' },
  voltarBtn: { display: 'inline-flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', color: 'var(--text3)', fontSize: 13, cursor: 'pointer', padding: '6px 0', marginBottom: 18, fontFamily: 'inherit' },

  hero: { textAlign: 'center', marginBottom: 24 },
  heroBadge: { display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--pink-light)', color: 'var(--pink)', borderRadius: 'var(--radius-pill)', padding: '5px 14px', fontSize: 11, fontWeight: 700, marginBottom: 14, letterSpacing: '0.3px' },
  heroTitle: { fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontSize: 32, fontWeight: 400, color: 'var(--text)', margin: 0, lineHeight: 1.15 },
  heroSub: { fontSize: 14, color: 'var(--text2)', margin: '10px 0 0', lineHeight: 1.5 },

  toggleWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 28 },
  toggleCard: { display: 'inline-flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', padding: 4, boxShadow: 'var(--shadow-xs)', gap: 4 },
  toggleBtn: { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 20px', borderRadius: 'var(--radius-pill)', background: 'transparent', border: 'none', fontSize: 13, fontWeight: 600, color: 'var(--text3)', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' },
  toggleBtnActive: { background: 'var(--pink)', color: 'white', boxShadow: 'var(--shadow-pink)' },
  economiaBadge: { background: 'var(--gold, #E6C260)', color: '#170D14', borderRadius: 'var(--radius-pill)', padding: '2px 8px', fontSize: 10, fontWeight: 800 },
  anualNota: { fontSize: 11, color: 'var(--text3)', textAlign: 'center' },
  mensalNota: { fontSize: 11, color: '#15803D', fontWeight: 600, textAlign: 'center' },

  contratoCard: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px', marginBottom: 24, boxShadow: 'var(--shadow-sm)', maxWidth: 620, margin: '0 auto 24px' },
  contratoHeader: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 },
  contratoTitulo: { fontSize: 14, fontWeight: 700, color: 'var(--text)' },
  contratoGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 },
  contratoLabel: { fontSize: 10, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px' },
  contratoValor: { fontSize: 13, fontWeight: 700, color: 'var(--text)', marginTop: 3 },
  contratoMulta: { fontSize: 12, color: '#92400E', background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 8, padding: '10px 12px', lineHeight: 1.5 },

  planosGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18, marginBottom: 24 },
  planoCard: { position: 'relative', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: '28px 22px', boxShadow: 'var(--shadow-sm)' },
  planoCardPro: { border: '2px solid var(--pink)', boxShadow: '0 12px 32px rgba(139,38,85,0.18)' },
  popularBadge: { position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg, var(--pink) 0%, #C73B6F 100%)', color: 'white', fontSize: 11, fontWeight: 800, padding: '5px 14px', borderRadius: 'var(--radius-pill)', boxShadow: 'var(--shadow-pink)', whiteSpace: 'nowrap' },
  atualBadge: { position: 'absolute', top: 12, right: 12, background: 'var(--green-bg)', color: 'var(--green)', fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 'var(--radius-pill)' },
  planoNome: { fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 8 },
  planoPreco: { display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6 },
  precoMoeda: { fontSize: 14, fontWeight: 600, color: 'var(--text2)' },
  precoValor: { fontFamily: "'JetBrains Mono', monospace", fontSize: 38, fontWeight: 700, color: 'var(--text)', lineHeight: 1 },
  precoCiclo: { fontSize: 13, color: 'var(--text3)', fontWeight: 500 },
  precoNota: { fontSize: 11, color: 'var(--text3)', marginBottom: 4 },
  fidelidadeTag: { fontSize: 11, fontWeight: 600, color: '#92400E', background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 6, padding: '3px 8px', display: 'inline-block', marginBottom: 6 },
  mensalTag: { fontSize: 11, fontWeight: 600, color: '#15803D', background: '#DCFCE7', border: '1px solid #4ADE80', borderRadius: 6, padding: '3px 8px', display: 'inline-block', marginBottom: 6 },
  usuarioNota: { fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginTop: 2 },

  btnAssinar: { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'var(--surface2)', color: 'var(--text)', border: '1.5px solid var(--border2)', borderRadius: 12, padding: '13px', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 18, fontFamily: 'inherit', transition: 'all 0.15s' },
  btnAssinarPro: { background: 'linear-gradient(135deg, var(--pink) 0%, #C73B6F 100%)', color: 'white', border: 'none', boxShadow: '0 6px 16px rgba(139,38,85,0.3)' },
  btnAssinarAtual: { background: 'var(--green-bg)', color: 'var(--green)', border: '1.5px solid var(--green)', cursor: 'default', boxShadow: 'none' },
  featuresList: { display: 'flex', flexDirection: 'column', gap: 9, marginTop: 4 },
  featureItem: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)', lineHeight: 1.4 },

  studioBanner: { background: 'linear-gradient(135deg, #1D0A18 0%, #0E030C 100%)', borderRadius: 16, padding: '22px 24px', marginBottom: 24, color: '#fff' },
  studioHeader: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 },
  studioTitulo: { fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 16, fontWeight: 800, color: '#fff' },
  studioTexto: { fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.55, marginBottom: 16 },
  studioExemplos: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 },
  studioExemplo: { background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 12px', border: '1px solid rgba(255,255,255,0.08)' },
  studioExemploLabel: { fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.3px' },
  studioExemploValor: { fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 700, color: 'var(--gold, #E6C260)' },
  studioBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 'var(--radius-pill)', color: '#fff', fontSize: 13, fontWeight: 700, padding: '9px 18px', cursor: 'pointer', fontFamily: 'inherit' },

  faq: { marginTop: 8, marginBottom: 18 },
  faqTitle: { fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 12, textAlign: 'center' },
  faqItem: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 8, overflow: 'hidden' },
  faqQ: { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'transparent', border: 'none', padding: '14px 16px', fontSize: 13, fontWeight: 600, color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', gap: 12 },
  faqA: { padding: '0 16px 14px', fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 },

  garantia: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', fontSize: 13, color: 'var(--text2)' },
}
