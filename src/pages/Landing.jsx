import { useNavigate, Link } from 'react-router-dom'
import { Calendar, DollarSign, Users, Bell, Check, Sparkles, ArrowRight, Star, ShieldCheck } from 'lucide-react'
import { LumenLogo } from '../components/common/Brand'
import { PLANOS, formatPreco, PRECO_USUARIO_ADICIONAL } from '../contexts/AssinaturaContext'

const BENEFICIOS = [
  { icon: Calendar, titulo: 'Agenda que organiza seu dia', texto: 'Veja seus atendimentos por dia, semana ou mês. Sem caderninho, sem esquecer horário.' },
  { icon: DollarSign, titulo: 'Financeiro de verdade', texto: 'Receita, despesas, lucro e metas. Saiba quanto você ganha — e quanto pode ganhar.' },
  { icon: Users, titulo: 'Clientes na palma da mão', texto: 'Histórico, preferências, aniversários e quem sumiu. Atendimento que fideliza.' },
  { icon: Bell, titulo: 'Lembretes no WhatsApp', texto: 'Reduza faltas com lembretes automáticos. Um clique e a cliente confirma.' },
]

export default function Landing() {
  const navigate = useNavigate()
  const ir = () => navigate('/login')

  const precoMes = (p) => formatPreco(p.precoAnual / 12)

  return (
    <div style={s.page}>
      {/* Topo */}
      <header style={s.topbar}>
        <LumenLogo size={22} variant="reverso" />
        <button style={s.entrarBtn} onClick={ir}>Entrar</button>
      </header>

      {/* Hero */}
      <section style={s.hero}>
        <div style={s.heroBadge}><Sparkles size={13} /> 14 dias grátis · sem cartão</div>
        <h1 style={s.heroTitle}>você não é só manicure.<br /><em style={s.heroEm}>é dona.</em></h1>
        <p style={s.heroSub}>
          A Lumen ilumina a gestão do seu salão — agenda, financeiro e clientes
          num só lugar. Para você tratar o seu talento como o negócio sério que ele é.
        </p>
        <div style={s.heroCtas}>
          <button style={s.ctaPrimary} onClick={ir}>Começar grátis <ArrowRight size={16} /></button>
          <a href="#planos" style={s.ctaGhost}>Ver planos</a>
        </div>
        <div style={s.heroNota}>“+18% de receita média em 30 dias.” — Carol, autônoma</div>
      </section>

      {/* Benefícios */}
      <section style={s.secao}>
        <div style={s.secaoLabel}>tudo o que o seu salão precisa</div>
        <div style={s.benGrid}>
          {BENEFICIOS.map(b => {
            const Ico = b.icon
            return (
              <div key={b.titulo} style={s.benCard}>
                <div style={s.benIcon}><Ico size={20} color="var(--pink)" /></div>
                <div style={s.benTitulo}>{b.titulo}</div>
                <div style={s.benTexto}>{b.texto}</div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Equipe */}
      <section style={s.secaoEquipe}>
        <div style={s.equipeInner}>
          <div style={s.secaoLabelLight}>para salões com equipe</div>
          <h2 style={s.equipeTitulo}>Cada manicure com o próprio login.</h2>
          <p style={s.equipeTexto}>
            No plano Pro, dê acesso individual à sua equipe — cada profissional vê só a própria
            agenda e o próprio faturamento. A recepção gerencia tudo pelo login de administradora.
            Por apenas <strong>R$ {formatPreco(PRECO_USUARIO_ADICIONAL)}/mês por usuário</strong>.
          </p>
        </div>
      </section>

      {/* Planos */}
      <section id="planos" style={s.secao}>
        <div style={s.secaoLabel}>planos anuais · fidelidade de 12 meses</div>
        <h2 style={s.planosTitulo}>Escolha o plano do seu momento</h2>
        <div style={s.planosGrid}>
          {/* Starter */}
          <div style={s.planoCard}>
            <div style={s.planoNome}>{PLANOS.starter.nome}</div>
            <div style={s.planoPreco}><span style={s.moeda}>R$</span><span style={s.valor}>{precoMes(PLANOS.starter)}</span><span style={s.ciclo}>/mês</span></div>
            <div style={s.planoNota}>cobrado anualmente · 1 login</div>
            <button style={s.planoBtn} onClick={ir}>Começar grátis</button>
            <div style={s.feats}>
              {PLANOS.starter.features.slice(0, 8).map((f, i) => (
                <Feat key={i} f={f} />
              ))}
            </div>
          </div>

          {/* Pro */}
          <div style={{ ...s.planoCard, ...s.planoCardPro }}>
            <div style={s.popular}>⭐ Mais popular</div>
            <div style={s.planoNome}>{PLANOS.pro.nome}</div>
            <div style={s.planoPreco}><span style={s.moeda}>R$</span><span style={s.valor}>{precoMes(PLANOS.pro)}</span><span style={s.ciclo}>/mês</span></div>
            <div style={s.planoNota}>cobrado anualmente · + usuários por R$ {formatPreco(PRECO_USUARIO_ADICIONAL)}</div>
            <button style={{ ...s.planoBtn, ...s.planoBtnPro }} onClick={ir}>Começar grátis</button>
            <div style={s.feats}>
              {PLANOS.pro.features.slice(0, 9).map((f, i) => (
                <Feat key={i} f={f} />
              ))}
            </div>
          </div>
        </div>
        <div style={s.garantia}>
          <ShieldCheck size={16} color="var(--green)" />
          <span><strong>Garantia de 7 dias.</strong> Não curtiu? Devolvemos 100% do valor.</span>
        </div>
      </section>

      {/* CTA final */}
      <section style={s.ctaFinal}>
        <h2 style={s.ctaFinalTitulo}>a gestão que a manicure faltava ter.</h2>
        <p style={s.ctaFinalSub}>Comece grátis hoje. Leva menos de 1 minuto.</p>
        <button style={s.ctaPrimary} onClick={ir}>Criar minha conta <ArrowRight size={16} /></button>
      </section>

      {/* Footer */}
      <footer style={s.footer}>
        <LumenLogo size={18} variant="reverso" />
        <div style={s.footerSlogan}>iluminando a gestão, impulsionando o seu talento.</div>
        <div style={s.footerLinks}>
          <Link to="/termos" style={s.footerLink}>Termos</Link>
          <span style={{ opacity: 0.4 }}>·</span>
          <Link to="/privacidade" style={s.footerLink}>Privacidade</Link>
          <span style={{ opacity: 0.4 }}>·</span>
          <button style={s.footerLinkBtn} onClick={ir}>Entrar</button>
        </div>
      </footer>
    </div>
  )
}

function Feat({ f }) {
  const incluso = f.startsWith('✓')
  const texto = f.replace(/^[✓✗]\s/, '')
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: incluso ? 'var(--text)' : 'var(--text3)', opacity: incluso ? 1 : 0.6 }}>
      {incluso ? <Check size={14} color="#15803D" style={{ flexShrink: 0 }} /> : <span style={{ width: 14, textAlign: 'center', flexShrink: 0 }}>✗</span>}
      <span style={{ textDecoration: incluso ? 'none' : 'line-through' }}>{texto}</span>
    </div>
  )
}

const BERRY = '#8B2655'
const NOIR = '#180712'

const s = {
  page: { background: 'var(--cream, #FBF6F8)', color: 'var(--text, #180712)', minHeight: '100vh', height: '100vh', overflowX: 'hidden', overflowY: 'auto' },
  topbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', maxWidth: 1080, margin: '0 auto' },
  entrarBtn: { background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 'var(--radius-pill)', padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },

  hero: { background: `linear-gradient(160deg, ${BERRY} 0%, #5E1839 100%)`, color: '#fff', padding: '20px 20px 56px', textAlign: 'center', marginTop: -64, paddingTop: 90, position: 'relative' },
  heroBadge: { display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.14)', color: '#fff', borderRadius: 'var(--radius-pill)', padding: '6px 14px', fontSize: 12, fontWeight: 700, marginBottom: 20 },
  heroTitle: { fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 40, lineHeight: 1.05, letterSpacing: '-0.04em', margin: '0 auto 16px', maxWidth: 620 },
  heroEm: { fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontWeight: 400, color: 'var(--gold, #E8C66A)' },
  heroSub: { fontSize: 16, lineHeight: 1.6, color: 'rgba(255,255,255,0.85)', maxWidth: 540, margin: '0 auto 28px' },
  heroCtas: { display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 18 },
  ctaPrimary: { display: 'inline-flex', alignItems: 'center', gap: 8, background: '#fff', color: BERRY, border: 'none', borderRadius: 14, padding: '14px 26px', fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 8px 24px rgba(0,0,0,0.18)' },
  ctaGhost: { display: 'inline-flex', alignItems: 'center', padding: '14px 22px', fontSize: 15, fontWeight: 700, color: '#fff', textDecoration: 'none', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 14 },
  heroNota: { fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontSize: 15, color: 'rgba(255,255,255,0.75)' },

  secao: { maxWidth: 1080, margin: '0 auto', padding: '56px 20px' },
  secaoLabel: { fontSize: 11, fontWeight: 700, color: 'var(--pink)', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'center', marginBottom: 28 },
  secaoLabelLight: { fontSize: 11, fontWeight: 700, color: 'var(--gold, #E8C66A)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 14 },
  benGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 18 },
  benCard: { background: '#fff', border: '1px solid var(--border, #Eadfe4)', borderRadius: 16, padding: '22px 20px', boxShadow: '0 2px 10px rgba(139,38,85,0.05)' },
  benIcon: { width: 44, height: 44, borderRadius: 12, background: 'var(--pink-light, #FAF0F4)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  benTitulo: { fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 17, fontWeight: 700, marginBottom: 6 },
  benTexto: { fontSize: 14, color: 'var(--text2, #6b5560)', lineHeight: 1.55 },

  secaoEquipe: { background: NOIR, color: '#fff' },
  equipeInner: { maxWidth: 760, margin: '0 auto', padding: '56px 20px', textAlign: 'center' },
  equipeTitulo: { fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em', margin: '0 0 14px' },
  equipeTexto: { fontSize: 16, lineHeight: 1.65, color: 'rgba(255,255,255,0.8)' },

  planosTitulo: { fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 28, fontWeight: 800, textAlign: 'center', letterSpacing: '-0.03em', margin: '0 0 28px' },
  planosGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18, maxWidth: 760, margin: '0 auto' },
  planoCard: { position: 'relative', background: '#fff', border: '1px solid var(--border, #Eadfe4)', borderRadius: 18, padding: '26px 22px', boxShadow: '0 2px 12px rgba(139,38,85,0.06)' },
  planoCardPro: { border: `2px solid ${BERRY}`, boxShadow: '0 14px 36px rgba(139,38,85,0.18)' },
  popular: { position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: `linear-gradient(135deg, ${BERRY}, #C73B6F)`, color: '#fff', fontSize: 11, fontWeight: 800, padding: '5px 14px', borderRadius: 'var(--radius-pill)', whiteSpace: 'nowrap' },
  planoNome: { fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 22, fontWeight: 800, marginBottom: 10 },
  planoPreco: { display: 'flex', alignItems: 'baseline', gap: 4 },
  moeda: { fontSize: 14, fontWeight: 600, color: 'var(--text2, #6b5560)' },
  valor: { fontFamily: "'JetBrains Mono', monospace", fontSize: 38, fontWeight: 700, lineHeight: 1 },
  ciclo: { fontSize: 13, color: 'var(--text3, #9b8690)', fontWeight: 500 },
  planoNota: { fontSize: 12, color: 'var(--text3, #9b8690)', margin: '6px 0 16px' },
  planoBtn: { width: '100%', background: 'var(--surface2, #F6EEF1)', color: 'var(--text)', border: '1.5px solid var(--border2, #E2d3da)', borderRadius: 12, padding: '13px', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 18 },
  planoBtnPro: { background: `linear-gradient(135deg, ${BERRY}, #C73B6F)`, color: '#fff', border: 'none', boxShadow: '0 6px 16px rgba(139,38,85,0.3)' },
  feats: { display: 'flex', flexDirection: 'column', gap: 10 },
  garantia: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 28, fontSize: 14, color: 'var(--text2, #6b5560)' },

  ctaFinal: { textAlign: 'center', padding: '64px 20px', maxWidth: 640, margin: '0 auto' },
  ctaFinalTitulo: { fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontSize: 32, fontWeight: 400, margin: '0 0 10px', color: BERRY },
  ctaFinalSub: { fontSize: 15, color: 'var(--text2, #6b5560)', marginBottom: 26 },

  footer: { background: NOIR, color: '#fff', textAlign: 'center', padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 },
  footerSlogan: { fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontSize: 14, color: 'rgba(255,255,255,0.7)' },
  footerLinks: { display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 },
  footerLink: { color: 'rgba(255,255,255,0.8)', textDecoration: 'none' },
  footerLinkBtn: { background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', padding: 0 },
}
