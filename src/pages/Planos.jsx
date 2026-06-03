import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, X, Sparkles, ArrowLeft, CreditCard, Star, FileText, Zap, MessageCircle, AlertCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useAssinatura, PLANOS, formatPreco, whatsappAssinarLink, PRECO_USUARIO_ADICIONAL } from '../contexts/AssinaturaContext'
import { supabase } from '../lib/supabase'
import { trackInicioAssinatura, trackVerPlanos } from '../lib/analytics'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default function Planos() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [ciclo, setCiclo] = useState('anual') // 'anual' | 'mensal'
  const [planoDestaque, setPlanoDestaque] = useState(null) // plano pré-selecionado da landing
  const [assinarLoading, setAssinarLoading] = useState(null)
  const [assinarErro, setAssinarErro] = useState('')

  // Dispara evento de analytics ao entrar na página de planos
  useEffect(() => { trackVerPlanos() }, [])

  // Lê intenção de plano salva na landing
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('lumen_plano_intencao')
      if (!raw) return
      const { plano, ciclo: cicloSalvo } = JSON.parse(raw)
      if (plano) setPlanoDestaque(plano)
      if (cicloSalvo) setCiclo(cicloSalvo)
      sessionStorage.removeItem('lumen_plano_intencao')
    } catch { /* ignora */ }
  }, [])

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

  async function handleAssinar(planoId) {
    setAssinarErro('')
    setAssinarLoading(planoId)
    // Dispara evento de inicio de checkout
    const precos = { solo_mensal: 127, solo_anual: 97, pro_mensal: 229, pro_anual: 179, salao_mensal: 249, salao_anual: 199 }
    trackInicioAssinatura(planoId, ciclo, precos[`${planoId}_${ciclo}`] ?? 0)
    try {
      const { data, error } = await supabase.functions.invoke('asaas-criar-checkout', {
        body: { plano: planoId, ciclo },
      })
      if (error) throw error
      if (!data?.url) throw new Error('URL de pagamento não recebida')
      // Redireciona para o checkout do Asaas
      window.location.href = data.url
    } catch (err) {
      console.error('Erro ao criar assinatura:', err)
      setAssinarErro('Erro ao abrir o checkout. Tente novamente ou fale pelo WhatsApp.')
      setAssinarLoading(null)
    }
  }

  function handleAssinarWhatsapp(planoId) {
    const link = whatsappAssinarLink({ nomeUsuario, emailUsuario, planoId, ciclo })
    window.open(link, '_blank')
  }

  const isSoloAtual  = isActive && (assinatura?.plano === 'solo' || assinatura?.plano === 'starter')
  const isProAtual   = isActive && assinatura?.plano === 'pro'
  const isSalaoAtual = isActive && assinatura?.plano === 'salao'

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
          <div style={s.anualNota}>📅 Pago 1× no cartão · renova automaticamente a cada ano · cancele quando quiser</div>
        )}
        {ciclo === 'mensal' && (
          <div style={s.mensalNota}>📆 Cobrança mensal · cancele quando quiser</div>
        )}
      </div>

      {/* Contrato atual */}
      {isActive && contrato && (
        <div style={s.contratoCard}>
          <div style={s.contratoHeader}>
            <FileText size={16} color="var(--pink)" />
            <span style={s.contratoTitulo}>Sua assinatura — {planoAtual?.nome}</span>
          </div>
          <div style={{ ...s.contratoGrid, gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <div>
              <div style={s.contratoLabel}>Início</div>
              <div style={s.contratoValor}>{fmtData(contrato.inicio)}</div>
            </div>
            <div>
              <div style={s.contratoLabel}>Próxima renovação</div>
              <div style={s.contratoValor}>{fmtData(contrato.fim)}</div>
            </div>
          </div>
          <div style={{ ...s.contratoMulta, background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid #86EFAC' }}>
            ✓ Cancele quando quiser, sem multa. Você fica com acesso até {fmtData(contrato.fim)} e não é cobrada de novo.
          </div>
        </div>
      )}

      {/* Erro ao assinar */}
      {assinarErro && (
        <div style={s.erroCard}>
          <AlertCircle size={16} />
          <span>{assinarErro}</span>
          <button style={s.erroWpp} onClick={() => handleAssinarWhatsapp(assinarLoading || 'pro')}>
            <MessageCircle size={13} /> Assinar via WhatsApp
          </button>
        </div>
      )}

      {/* Cards de planos */}
      <div style={s.planosGrid}>
        <PlanoCard
          plano={PLANOS.solo}
          ciclo={ciclo}
          isAtual={isSoloAtual}
          isPopular={false}
          isDestaque={planoDestaque === 'solo'}
          loading={assinarLoading === 'solo'}
          onAssinar={() => handleAssinar('solo')}
        />
        <PlanoCard
          plano={PLANOS.pro}
          ciclo={ciclo}
          isAtual={isProAtual}
          isPopular={true}
          isDestaque={planoDestaque === 'pro'}
          loading={assinarLoading === 'pro'}
          onAssinar={() => handleAssinar('pro')}
        />
        <PlanoCard
          plano={PLANOS.salao}
          ciclo={ciclo}
          isAtual={isSalaoAtual}
          isPopular={false}
          isDestaque={planoDestaque === 'salao'}
          loading={assinarLoading === 'salao'}
          onAssinar={() => handleAssinar('salao')}
        />
      </div>

      {/* Segurança */}
      <div style={s.segurancaRow}>
        <span>🔒 Pagamento seguro via</span>
        <strong>Asaas</strong>
        <span>· Cartão de crédito com renovação automática</span>
      </div>

      {/* Salão — equipe */}
      <div style={s.studioBanner}>
        <div style={s.studioHeader}>
          <Zap size={18} color="var(--gold, #E6C260)" />
          <span style={s.studioTitulo}>Salão — para equipes</span>
        </div>
        <p style={s.studioTexto}>
          O plano <strong>Salão</strong> já inclui o login da <strong>dona</strong> e da <strong>recepcionista</strong>.
          Cada <strong>manicure</strong> a mais (com a própria agenda e financeiro) custa apenas
          <strong> R$ {formatPreco(PRECO_USUARIO_ADICIONAL)}/mês</strong>.
        </p>
        <div style={s.studioExemplos}>
          {[
            { label: 'Dona + recepção', valor: PLANOS.salao.precoMensalAnual },
            { label: '+ 1 manicure', valor: PLANOS.salao.precoMensalAnual + PRECO_USUARIO_ADICIONAL },
            { label: '+ 3 manicures', valor: PLANOS.salao.precoMensalAnual + 3 * PRECO_USUARIO_ADICIONAL },
          ].map(ex => (
            <div key={ex.label} style={s.studioExemplo}>
              <div style={s.studioExemploLabel}>{ex.label}</div>
              <div style={s.studioExemploValor}>R$ {formatPreco(ex.valor)}<span style={{ fontSize: 11, fontWeight: 500 }}>/mês</span></div>
            </div>
          ))}
        </div>
        <button style={s.studioBtn} onClick={() => handleAssinar('salao')}>
          <MessageCircle size={14} /> Assinar o plano Salão ({ciclo === 'anual' ? 'anual' : 'mensal'})
        </button>
      </div>

      {/* FAQ */}
      <div style={s.faq}>
        <h3 style={s.faqTitle}>Dúvidas frequentes</h3>
        <FaqItem
          q="Como funciona o pagamento?"
          a="Ao clicar em 'Assinar com cartão', você é redirecionada para o checkout seguro do Asaas. Informe seus dados e o cartão, e o plano é ativado automaticamente. No mensal, a cobrança se repete todo mês; no anual, é cobrada uma vez por ano (e renova sozinha no ano seguinte)."
        />
        <FaqItem
          q="Qual a diferença entre mensal e anual?"
          a={`No anual você economiza ~${economiaSolo}% e paga o ano de uma vez (1× no cartão). No mensal, paga mês a mês (um pouco mais caro). Nos dois, você cancela quando quiser — sem multa.`}
        />
        <FaqItem
          q="Tem fidelidade ou multa?"
          a="Não. Você cancela quando quiser, sem multa. No anual, como já pagou o ano, você continua com acesso até o fim do período e simplesmente não é cobrada de novo. E tem garantia de 7 dias: cancelou em até 7 dias da compra, devolvemos 100%."
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
          a={`O plano Salão já inclui o login da dona e da recepcionista. Cada manicure a mais (que vê só a própria agenda e o próprio financeiro) custa R$ ${formatPreco(PRECO_USUARIO_ADICIONAL)}/mês. Ex.: salão com dona + recepcionista + 3 manicures = R$ ${formatPreco(PLANOS.salao.precoMensalAnual)} + 3 × R$ ${formatPreco(PRECO_USUARIO_ADICIONAL)} = R$ ${formatPreco(PLANOS.salao.precoMensalAnual + 3 * PRECO_USUARIO_ADICIONAL)}/mês.`}
        />
        <FaqItem
          q="Qual a diferença entre o Pro e o Salão?"
          a="O Pro é individual: 1 login, ideal pra quem atende sozinha, com todas as funcionalidades avançadas (agenda online, lembretes WhatsApp, Google Calendar, relatórios PDF). O Salão é multiusuário: inclui dona + recepcionista e permite adicionar manicures com login próprio, cada uma com papel e acesso definidos."
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

function PlanoCard({ plano, ciclo = 'anual', isAtual, isPopular, isDestaque, loading, onAssinar }) {
  const precoMes = ciclo === 'anual' ? plano.precoMensalAnual : plano.precoMensalMensal
  const economiaPorc = Math.round(((plano.precoMensalMensal - plano.precoMensalAnual) / plano.precoMensalMensal) * 100)

  return (
    <div style={{ ...s.planoCard, ...(isPopular ? s.planoCardPro : {}), ...(isDestaque && !isPopular ? s.planoCardDestaque : {}) }}>
      {isPopular && <div style={s.popularBadge}>⭐ Mais popular</div>}
      {isDestaque && !isPopular && <div style={s.destaqueBadge}>👆 Você selecionou este</div>}
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
            <div style={s.fidelidadeTag}>📅 1× ao ano · economize {economiaPorc}%</div>
          </>
        ) : (
          <>
            <div style={s.precoNota}>Sem fidelidade · cancele quando quiser</div>
            <div style={s.mensalTag}>📆 Cobrança mensal</div>
          </>
        )}
        {plano.limites?.usuariosAdicionais
          ? <div style={s.usuarioNota}>Dona + recepcionista inclusas · manicure +R$ {formatPreco(PRECO_USUARIO_ADICIONAL)}/mês</div>
          : <div style={s.usuarioNota}>Inclui 1 login</div>}
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
          : loading ? '⏳ Abrindo checkout...'
          : <><CreditCard size={15} /> Assinar com cartão</>}
      </button>

      {plano.subtitulo && <div style={s.planoSubtitulo}>{plano.subtitulo}</div>}
      {plano.heranca && (
        <div style={s.heranca}>✨ Tudo do <strong>{plano.heranca}</strong>, e mais:</div>
      )}
      <div style={s.featuresList}>
        {(plano.diferenciais || []).map((texto, i) => (
          <div key={i} style={s.featureItem}>
            <Check size={14} color="#15803D" style={{ flexShrink: 0 }} />
            <span>{texto}</span>
          </div>
        ))}
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
  planoSubtitulo: { fontSize: 12.5, fontWeight: 600, color: 'var(--text3)', marginBottom: 12 },
  heranca: { fontSize: 13, color: 'var(--text)', background: 'var(--pink-light)', border: '1px solid var(--border2)', borderRadius: 10, padding: '8px 12px', marginBottom: 12 },
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
  erroCard: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#B91C1C' },
  erroWpp: { display: 'inline-flex', alignItems: 'center', gap: 5, background: '#25D366', color: 'white', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginLeft: 'auto' },
  segurancaRow: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, color: 'var(--text3)', marginBottom: 24, flexWrap: 'wrap', textAlign: 'center' },
  planoCardDestaque: { border: '2px solid #D4AF37', boxShadow: '0 12px 32px rgba(212,175,55,0.2)' },
  destaqueBadge: { position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg, #D4AF37, #E6C260)', color: '#180712', fontSize: 11, fontWeight: 800, padding: '5px 14px', borderRadius: 'var(--radius-pill)', whiteSpace: 'nowrap' },
}
