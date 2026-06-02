import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Calendar, DollarSign, Users, Bell, Check, Sparkles, ArrowRight, ShieldCheck, Menu, X, MessageCircle, Mail, Phone, Instagram, Facebook } from 'lucide-react'
import { LumenLogo } from '../components/common/Brand'
import { PLANOS, formatPreco, PRECO_USUARIO_ADICIONAL, SUPORTE_WHATSAPP } from '../contexts/AssinaturaContext'
import { trackFaleConosco, trackVerPlanos } from '../lib/analytics'
import { linkWhatsAppCompleto } from '../lib/formatters'

const BENEFICIOS = [
  { icon: Calendar, titulo: 'Agenda sem confusão', texto: 'Veja todos os atendimentos por dia, semana ou mês. Chega de caderninho, borracha e horário esquecido.' },
  { icon: DollarSign, titulo: 'Financeiro que você entende', texto: 'Saiba exatamente quanto entrou, quanto saiu e quanto sobrou. Com metas e projeção de receita futura.' },
  { icon: Users, titulo: 'Nunca perca uma cliente', texto: 'Histórico completo, preferências, aniversários e alerta automático de clientes que sumiram há tempo.' },
  { icon: Bell, titulo: 'Lembretes no WhatsApp', texto: 'Reduza faltas com lembretes automáticos no WhatsApp. A cliente confirma com um clique — sem trabalho extra.' },
]

const FAQ_ITEMS = [
  { p: 'Preciso instalar alguma coisa?', r: 'Não. A Lumen funciona direto no navegador e no celular — sem download, sem instalação. É só entrar e usar.' },
  { p: 'Preciso de cartão de crédito para testar?', r: 'Não. Os 14 dias de teste são 100% grátis e sem necessidade de cartão. Você só paga se quiser continuar.' },
  { p: 'Posso cancelar quando quiser?', r: 'Sim. No plano mensal, você cancela a qualquer momento sem multa. No plano anual, há fidelidade de 12 meses.' },
  { p: 'Funciona bem no celular?', r: 'Perfeitamente. A Lumen foi feita pensando em quem trabalha com as mãos e usa o celular para tudo — é rápida e fácil de usar na tela pequena.' },
  { p: 'O que acontece quando os 14 dias acabam?', r: 'Você escolhe um plano e continua usando normalmente. Se não quiser continuar, seus dados ficam salvos por 30 dias.' },
  { p: 'Como funciona o suporte?', r: 'Atendimento direto pelo WhatsApp, de segunda a sábado. Sem robô, sem espera interminável — você fala com a equipe da Lumen.' },
  { p: 'Meus dados ficam seguros?', r: 'Sim. Seus dados ficam salvos na nuvem com backup automático e criptografia. Você nunca perde nada — mesmo que troque de celular.' },
]

const NAV_LINKS = [
  { label: 'Início', id: 'inicio' },
  { label: 'Funcionalidades', id: 'funcionalidades' },
  { label: 'Depoimentos', id: 'depoimentos' },
  { label: 'Planos', id: 'planos' },
  { label: 'Contato', id: 'contato' },
]

const DEPOIMENTOS = [
  {
    nome: 'Queléen Bauer',
    cargo: 'Nail designer autônoma · Caxias do Sul',
    texto: 'Antes eu não sabia nem quanto ganhava no mês. Hoje vejo tudo no celular em segundos. A Lumen mudou como eu me vejo como profissional.',
    iniciais: 'QB',
  },
  {
    nome: 'Camila Rossato',
    cargo: 'Proprietária · Studio CR Nails',
    texto: 'Minha equipe tem login próprio e cada uma vê só a própria agenda. Acabou a confusão e a falta de profissionalismo. Vale cada centavo.',
    iniciais: 'CR',
  },
  {
    nome: 'Fernanda Oliveira',
    cargo: 'Nail designer · São Paulo',
    texto: 'Tentei planilha, tentei caderninho, tentei outros apps. A Lumen é a única que foi feita de verdade pra quem faz unhas. Simples e completa.',
    iniciais: 'FO',
  },
]

function scrollTo(id) {
  const el = document.getElementById(id)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export default function Landing() {
  const navigate = useNavigate()
  const [ciclo, setCiclo] = useState('anual')

  // Navega para login salvando a intenção de plano no sessionStorage
  // Login simples (botão "Login" da navbar)
  const ir = () => navigate('/login')
  // Cadastro com plano pré-selecionado (botões "Começar grátis" dos cards)
  const irComPlano = (planoId) => {
    sessionStorage.setItem('lumen_plano_intencao', JSON.stringify({ plano: planoId, ciclo }))
    navigate('/login?modo=cadastro')
  }
  // Cadastro sem plano (CTAs genéricos da landing)
  const irCadastro = () => navigate('/login?modo=cadastro')
  const [menuAberto, setMenuAberto] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  const precoMes = (p) => ciclo === 'anual'
    ? formatPreco(p.precoMensalAnual)
    : formatPreco(p.precoMensalMensal)

  // Libera scroll do body/html/#root (o CSS do app bloqueia no desktop)
  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const root = document.getElementById('root')

    html.style.cssText += ';overflow:auto!important;height:auto!important'
    body.style.cssText += ';overflow:auto!important;height:auto!important'
    if (root) root.style.cssText += ';overflow:auto!important;height:auto!important'

    return () => {
      // Restaura ao sair da landing
      ;[html, body, root].forEach(el => {
        if (!el) return
        el.style.overflow = ''
        el.style.height = ''
      })
    }
  }, [])

  // Efeito de sombra ao rolar
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const whatsappContato = linkWhatsAppCompleto(SUPORTE_WHATSAPP, 'Olá! Quero saber mais sobre a Lumen 💅')

  const abrirWhatsapp = (e) => { trackFaleConosco(); window.open(whatsappContato, '_blank') }
  const irPlanos = () => { trackVerPlanos(); scrollTo('planos') }

  return (
    <div style={s.page}>
      {/* CSS responsivo */}
      <style>{`
        .lp-nav-links { display: flex; }
        .lp-nav-btns { display: flex; }
        .lp-hamburger { display: none; }
        .hero-inner { display: flex; align-items: center; justify-content: space-between; gap: 40px; max-width: 1100px; margin: 0 auto; text-align: left; padding: 0 24px; }
        .hero-text { flex: 1; min-width: 0; }
        .hero-mock { flex-shrink: 0; }
        .hero-ctas-inner { justify-content: flex-start !important; }
        @media (max-width: 860px) {
          .hero-inner { flex-direction: column; text-align: center; padding: 0 16px; }
          .hero-mock { display: none; }
          .hero-ctas-inner { justify-content: center !important; }
        }
        @media (max-width: 768px) {
          .lp-nav-links { display: none !important; }
          .lp-nav-btns { display: none !important; }
          .lp-hamburger { display: block !important; }
        }
      `}</style>

      {/* ── Navbar ─────────────────────────────────── */}
      <header style={{ ...s.navbar, ...(scrolled ? s.navbarScrolled : {}) }}>
        <div style={s.navInner}>
          {/* Logo */}
          <button style={s.logoBtn} onClick={() => scrollTo('inicio')}>
            <LumenLogo size={20} variant="reverso" />
          </button>

          {/* Links — desktop */}
          <nav style={s.navLinks} className="lp-nav-links">
            {NAV_LINKS.map(l => (
              <button key={l.label} style={s.navLink} onClick={() => scrollTo(l.id)}>{l.label}</button>
            ))}
          </nav>

          {/* Botões — desktop */}
          <div style={s.navBtns} className="lp-nav-btns">
            <a href={whatsappContato} target="_blank" rel="noreferrer" style={s.navBtnWhats}>
              <MessageCircle size={14} />
              Fale conosco
            </a>
            <button style={s.navBtnLogin} onClick={ir}>Login</button>
          </div>

          {/* Hamburger — mobile */}
          <button style={s.hamburger} className="lp-hamburger" onClick={() => setMenuAberto(v => !v)}>
            {menuAberto ? <X size={22} color="white" /> : <Menu size={22} color="white" />}
          </button>
        </div>

        {/* Menu mobile */}
        {menuAberto && (
          <div style={s.mobileMenu}>
            {NAV_LINKS.map(l => (
              <button key={l.label} style={s.mobileLink} onClick={() => { scrollTo(l.id); setMenuAberto(false) }}>
                {l.label}
              </button>
            ))}
            <div style={s.mobileDivider} />
            <a href={whatsappContato} target="_blank" rel="noreferrer" style={s.mobileBtnWhats}>
              <MessageCircle size={14} /> Fale conosco
            </a>
            <button style={s.mobileBtnLogin} onClick={() => { setMenuAberto(false); ir() }}>
              Login
            </button>
          </div>
        )}
      </header>

      {/* Hero */}
      <section id="inicio" style={s.hero}>
        <div className="hero-inner">
          {/* Texto */}
          <div className="hero-text">
            <div style={{ ...s.heroBadge, display: 'inline-flex' }}><Sparkles size={13} /> 14 dias grátis · sem cartão</div>
            <h1 style={{ ...s.heroTitle, textAlign: 'left', maxWidth: 520 }}>
              você não é só manicure.<br /><em style={s.heroEm}>é dona.</em>
            </h1>
            <p style={{ ...s.heroSub, textAlign: 'left', margin: '0 0 28px' }}>
              Chega de caderninho, esquecimento e dinheiro sem controle.
              A Lumen cuida da gestão enquanto você cuida das unhas.
            </p>
            <div className="hero-ctas-inner" style={{ ...s.heroCtas, justifyContent: 'flex-start' }}>
              <button style={s.ctaPrimary} onClick={irCadastro}>Começar grátis <ArrowRight size={16} /></button>
              <button style={s.ctaGhost} onClick={() => scrollTo('planos')}>Ver planos</button>
            </div>
            <div className="hero-nota-inner" style={{ ...s.heroNota, marginTop: 20 }}>
              "Finalmente sei quanto ganho de verdade." — Queléen, nail designer
            </div>
          </div>

          {/* Mockup do app */}
          <div className="hero-mock">
            <AppMockup />
          </div>
        </div>
      </section>

      {/* Benefícios */}
      <section id="funcionalidades" style={s.secao}>
        <div style={s.secaoLabel}>funcionalidades</div>
        <h2 style={s.secaoTitulo}>Tudo que você precisa, num só app</h2>
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

      {/* Depoimentos */}
      <section id="depoimentos" style={{ background: 'var(--cream, #FBF6F8)', padding: '56px 20px' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <div style={s.secaoLabel}>quem já usa a lumen</div>
          <h2 style={s.secaoTitulo}>Nail designers reais. Resultados reais.</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
            {DEPOIMENTOS.map((d, i) => (
              <div key={i} style={dep.card}>
                <div style={dep.aspas}>"</div>
                <p style={dep.texto}>{d.texto}</p>
                <div style={dep.perfil}>
                  <div style={dep.avatar}>{d.iniciais}</div>
                  <div>
                    <div style={dep.nome}>{d.nome}</div>
                    <div style={dep.cargo}>{d.cargo}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Equipe */}
      <section style={s.secaoEquipe}>
        <div style={s.equipeInner}>
          <div style={s.secaoLabelLight}>para salões com equipe</div>
          <h2 style={s.equipeTitulo}>Sua equipe organizada, sem bagunça.</h2>
          <p style={s.equipeTexto}>
            No plano Salão, cada profissional tem o próprio acesso — vê só a própria agenda e o próprio financeiro.
            Sua recepcionista gerencia tudo. Você controla todo o salão.
            Dona e recepcionista inclusas; cada <strong>manicure a mais por R$ {formatPreco(PRECO_USUARIO_ADICIONAL)}/mês</strong>.
          </p>
        </div>
      </section>

      {/* Planos */}
      <section id="planos" style={s.secao}>
        <div style={s.secaoLabel}>planos</div>
        <h2 style={s.planosTitulo}>Simples, justo e sem surpresa</h2>
        <p style={{ textAlign: 'center', color: 'var(--text2)', fontSize: 15, marginBottom: 28, marginTop: -12 }}>Para autônomas e salões com equipe. Comece grátis, cancele quando quiser.</p>

        {/* Toggle mensal/anual */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 28 }}>
          <div style={s.toggleCard}>
            <button
              style={{ ...s.toggleBtn, ...(ciclo === 'anual' ? s.toggleBtnActive : {}) }}
              onClick={() => setCiclo('anual')}
            >
              Anual <span style={s.economiaBadge}>até -24%</span>
            </button>
            <button
              style={{ ...s.toggleBtn, ...(ciclo === 'mensal' ? s.toggleBtnActive : {}) }}
              onClick={() => setCiclo('mensal')}
            >
              Mensal
            </button>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>
            {ciclo === 'anual' ? '📅 Fidelidade de 12 meses' : '📆 Sem fidelidade · cancele quando quiser'}
          </div>
        </div>

        <div style={s.planosGrid}>
          {/* Solo */}
          <div style={s.planoCard}>
            <div style={s.planoNome}>{PLANOS.solo.nome}</div>
            <div style={s.planoPreco}>
              <span style={s.moeda}>R$</span>
              <span style={s.valor}>{precoMes(PLANOS.solo)}</span>
              <span style={s.ciclo}>/mês</span>
            </div>
            <div style={s.planoNota}>{ciclo === 'anual' ? `R$ ${formatPreco(PLANOS.solo.precoAnual)}/ano · 1 login` : 'sem fidelidade · 1 login'}</div>
            <button style={s.planoBtn} onClick={() => irComPlano('solo')}>Começar grátis</button>
            <div style={s.feats}>
              {PLANOS.solo.features.slice(0, 9).map((f, i) => <Feat key={i} f={f} />)}
            </div>
          </div>

          {/* Pro */}
          <div style={{ ...s.planoCard, ...s.planoCardPro }}>
            <div style={s.popular}>⭐ Mais popular</div>
            <div style={s.planoNome}>{PLANOS.pro.nome}</div>
            <div style={s.planoPreco}>
              <span style={s.moeda}>R$</span>
              <span style={s.valor}>{precoMes(PLANOS.pro)}</span>
              <span style={s.ciclo}>/mês</span>
            </div>
            <div style={s.planoNota}>{ciclo === 'anual' ? `R$ ${formatPreco(PLANOS.pro.precoAnual)}/ano · 1 login` : 'sem fidelidade · 1 login'}</div>
            <button style={{ ...s.planoBtn, ...s.planoBtnPro }} onClick={() => irComPlano('pro')}>Começar grátis</button>
            <div style={s.feats}>
              {PLANOS.pro.features.slice(0, 9).map((f, i) => <Feat key={i} f={f} />)}
            </div>
          </div>

          {/* Salão */}
          <div style={s.planoCard}>
            <div style={s.planoNome}>{PLANOS.salao.nome}</div>
            <div style={s.planoPreco}>
              <span style={s.moeda}>R$</span>
              <span style={s.valor}>{precoMes(PLANOS.salao)}</span>
              <span style={s.ciclo}>/mês</span>
            </div>
            <div style={s.planoNota}>{ciclo === 'anual' ? `R$ ${formatPreco(PLANOS.salao.precoAnual)}/ano · + manicure R$ ${formatPreco(PRECO_USUARIO_ADICIONAL)}` : `sem fidelidade · + manicure R$ ${formatPreco(PRECO_USUARIO_ADICIONAL)}`}</div>
            <button style={s.planoBtn} onClick={() => irComPlano('salao')}>Começar grátis</button>
            <div style={s.feats}>
              {PLANOS.salao.features.slice(0, 9).map((f, i) => <Feat key={i} f={f} />)}
            </div>
          </div>
        </div>
        <div style={s.garantia}>
          <ShieldCheck size={16} color="var(--green)" />
          <span><strong>Garantia de 7 dias.</strong> Não curtiu? Devolvemos 100% do valor.</span>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ ...s.secao, maxWidth: 720 }}>
        <div style={s.secaoLabel}>dúvidas frequentes</div>
        <h2 style={{ ...s.planosTitulo, marginBottom: 32 }}>Perguntas frequentes</h2>
        <FaqList />
      </section>

      {/* CTA final */}
      <section style={s.ctaFinal}>
        <h2 style={s.ctaFinalTitulo}>comece hoje. veja a diferença em 14 dias.</h2>
        <p style={s.ctaFinalSub}>Sem cartão de crédito. Sem instalação. Cancele quando quiser.</p>
        <button style={s.ctaPrimary} onClick={ir}>Criar minha conta grátis <ArrowRight size={16} /></button>
      </section>

      {/* Footer / Contato */}
      <footer id="contato" style={s.footer}>
        <div style={s.footerInner}>

          {/* Col 1 — Logo + descrição + redes */}
          <div style={s.footerCol}>
            <LumenLogo size={20} variant="reverso" style={{ marginBottom: 12 }} />
            <p style={s.footerDesc}>
              O app de gestão feito para nail designers — agenda, financeiro e clientes num só lugar.
            </p>
            <div style={s.footerSocial}>
              <a href="https://instagram.com" target="_blank" rel="noreferrer" style={s.socialIcon} title="Instagram">
                <Instagram size={18} />
              </a>
              <a href="https://facebook.com" target="_blank" rel="noreferrer" style={s.socialIcon} title="Facebook">
                <Facebook size={18} />
              </a>
            </div>
          </div>

          {/* Col 2 — Navegação */}
          <div style={s.footerCol}>
            <div style={s.footerColTitulo}>Navegação</div>
            {NAV_LINKS.map(l => (
              <button key={l.label} style={s.footerNavLink} onClick={() => scrollTo(l.id)}>
                {l.label}
              </button>
            ))}
          </div>

          {/* Col 3 — Contato */}
          <div style={s.footerCol}>
            <div style={s.footerColTitulo}>Contato</div>
            <div style={s.footerContato}>
              <Mail size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              <a href="mailto:suporte@lumengestaoempresarial.com.br" style={s.footerContatoLink}>
                suporte@lumengestaoempresarial.com.br
              </a>
            </div>
            <div style={s.footerContato}>
              <Phone size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              <a href={linkWhatsAppCompleto(SUPORTE_WHATSAPP)} target="_blank" rel="noreferrer" style={s.footerContatoLink}>
                WhatsApp de suporte
              </a>
            </div>
            <a
              href={whatsappContato}
              target="_blank"
              rel="noreferrer"
              style={s.footerBtnWhats}
            >
              <MessageCircle size={15} /> Fale conosco
            </a>
          </div>
        </div>

        {/* Barra inferior */}
        <div style={s.footerBottom}>
          <span>© {new Date().getFullYear()} Lumen. Todos os direitos reservados.</span>
          <div style={s.footerBottomLinks}>
            <Link to="/termos" style={s.footerBottomLink}>Termos de uso</Link>
            <Link to="/privacidade" style={s.footerBottomLink}>Privacidade</Link>
            <button style={s.footerBottomBtn} onClick={() => scrollTo('inicio')}>Voltar ao topo ↑</button>
          </div>
        </div>
      </footer>
    </div>
  )
}

// Mockup visual do app no hero
function AppMockup() {
  return (
    <div style={mock.phone}>
      {/* Header do app */}
      <div style={mock.header}>
        <div style={mock.headerDot} />
        <div style={{ fontSize: 11, fontWeight: 700, color: 'white' }}>lumen.</div>
        <div style={mock.headerDot} />
      </div>

      {/* Saudação */}
      <div style={mock.body}>
        <div style={{ fontSize: 10, color: '#999', marginBottom: 2 }}>Sábado, 31 de Maio</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#180712', marginBottom: 12 }}>
          <em style={{ fontFamily: 'serif', fontStyle: 'italic' }}>oi Queléen,</em>
        </div>

        {/* Cards de resumo */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          <div style={mock.card}>
            <div style={{ fontSize: 9, color: '#999', marginBottom: 2 }}>Recebido hoje</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#8B2655' }}>R$ 420</div>
          </div>
          <div style={mock.card}>
            <div style={{ fontSize: 9, color: '#999', marginBottom: 2 }}>Este mês</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#15803D' }}>R$ 3.810</div>
          </div>
        </div>

        {/* Próximos atendimentos */}
        <div style={{ fontSize: 10, fontWeight: 700, color: '#555', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Hoje</div>
        {[
          { hora: '09:00', nome: 'Ana Paula', servico: 'Gel francês' },
          { hora: '11:00', nome: 'Mariana', servico: 'Alongamento gel' },
          { hora: '14:00', nome: 'Carla', servico: 'Manutenção' },
        ].map((ag, i) => (
          <div key={i} style={mock.ag}>
            <div style={mock.agHora}>{ag.hora}</div>
            <div style={mock.agBar} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#180712' }}>{ag.nome}</div>
              <div style={{ fontSize: 10, color: '#888' }}>{ag.servico}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom nav */}
      <div style={mock.nav}>
        {['🏠','📅','💰','👥'].map((ic, i) => (
          <div key={i} style={{ ...mock.navItem, ...(i === 0 ? { color: '#8B2655' } : {}) }}>{ic}</div>
        ))}
      </div>
    </div>
  )
}

const mock = {
  phone: { width: 220, background: '#F8F4F6', borderRadius: 24, boxShadow: '0 24px 64px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.15)', overflow: 'hidden', border: '6px solid rgba(255,255,255,0.1)' },
  header: { background: '#8B2655', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  headerDot: { width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.3)' },
  body: { padding: '12px 14px 8px' },
  card: { background: 'white', borderRadius: 10, padding: '8px 10px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  ag: { display: 'flex', alignItems: 'center', gap: 8, background: 'white', borderRadius: 8, padding: '7px 9px', marginBottom: 5, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  agHora: { fontSize: 10, fontWeight: 700, color: '#8B2655', minWidth: 30 },
  agBar: { width: 2, height: 24, background: '#8B2655', borderRadius: 2, flexShrink: 0 },
  nav: { display: 'flex', borderTop: '1px solid #eee', background: 'white', padding: '8px 0' },
  navItem: { flex: 1, textAlign: 'center', fontSize: 16, color: '#ccc' },
}

const dep = {
  card: { background: 'white', border: '1px solid var(--border)', borderRadius: 18, padding: '24px 22px', boxShadow: '0 2px 12px rgba(139,38,85,0.06)', display: 'flex', flexDirection: 'column', gap: 14 },
  aspas: { fontSize: 48, lineHeight: 1, color: 'var(--pink)', fontFamily: 'Georgia, serif', marginTop: -10 },
  texto: { fontSize: 14, lineHeight: 1.7, color: 'var(--text2)', margin: 0, flex: 1 },
  perfil: { display: 'flex', alignItems: 'center', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #8B2655, #C73B6F)', color: 'white', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  nome: { fontSize: 13, fontWeight: 700, color: 'var(--text)' },
  cargo: { fontSize: 11, color: 'var(--text3)', marginTop: 1 },
}

function FaqList() {
  const [aberto, setAberto] = useState(null)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {FAQ_ITEMS.map((item, i) => (
        <div key={i} style={faq.card}>
          <button style={faq.pergunta} onClick={() => setAberto(aberto === i ? null : i)}>
            <span>{item.p}</span>
            <span style={{ ...faq.icone, transform: aberto === i ? 'rotate(45deg)' : 'none' }}>+</span>
          </button>
          {aberto === i && (
            <div style={faq.resposta}>{item.r}</div>
          )}
        </div>
      ))}
    </div>
  )
}

const faq = {
  card: { background: '#fff', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 6px rgba(139,38,85,0.05)' },
  pergunta: { width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '18px 20px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 600, color: 'var(--text)', textAlign: 'left', fontFamily: 'inherit' },
  icone: { fontSize: 22, fontWeight: 300, color: 'var(--pink)', flexShrink: 0, transition: 'transform 0.2s', lineHeight: 1 },
  resposta: { padding: '0 20px 18px', fontSize: 14, color: 'var(--text2)', lineHeight: 1.7, borderTop: '1px solid var(--border)' },
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
  page: { background: 'var(--cream, #FBF6F8)', color: 'var(--text, #180712)', minHeight: '100vh', overflowX: 'hidden' },

  /* ── Navbar ── */
  navbar: { position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: BERRY, transition: 'box-shadow 0.2s' },
  navbarScrolled: { boxShadow: '0 4px 24px rgba(0,0,0,0.25)' },
  navInner: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', height: 64, maxWidth: 1100, margin: '0 auto' },
  navLinks: { display: 'flex', gap: 8, '@media(max-width:768px)': { display: 'none' } },
  logoBtn: { background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', padding: 0 },
  navLink: { background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.82)', fontSize: 14, fontWeight: 500, padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' },
  navBtns: { display: 'flex', gap: 8, alignItems: 'center' },
  navBtnWhats: { display: 'flex', alignItems: 'center', gap: 6, background: '#25D366', color: '#fff', border: 'none', borderRadius: 'var(--radius-pill)', padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none' },
  navBtnLogin: { background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 'var(--radius-pill)', padding: '8px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  hamburger: { display: 'none', background: 'transparent', border: 'none', cursor: 'pointer', padding: 4 },
  mobileMenu: { background: BERRY, borderTop: '1px solid rgba(255,255,255,0.1)', padding: '12px 24px 20px', display: 'flex', flexDirection: 'column', gap: 4 },
  mobileLink: { background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.9)', fontSize: 15, fontWeight: 500, padding: '10px 0', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', width: '100%' },
  mobileDivider: { height: 1, background: 'rgba(255,255,255,0.1)', margin: '8px 0' },
  mobileBtnWhats: { display: 'flex', alignItems: 'center', gap: 8, background: '#25D366', color: '#fff', borderRadius: 'var(--radius-pill)', padding: '11px 18px', fontSize: 14, fontWeight: 700, textDecoration: 'none', justifyContent: 'center', marginBottom: 8 },
  mobileBtnLogin: { background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 'var(--radius-pill)', padding: '11px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },

  hero: { background: `linear-gradient(160deg, ${BERRY} 0%, #5E1839 100%)`, color: '#fff', padding: '100px 20px 56px', textAlign: 'center', position: 'relative' },
  heroBadge: { display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.14)', color: '#fff', borderRadius: 'var(--radius-pill)', padding: '6px 14px', fontSize: 12, fontWeight: 700, marginBottom: 20 },
  heroTitle: { fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 40, lineHeight: 1.05, letterSpacing: '-0.04em', margin: '0 auto 16px', maxWidth: 620 },
  heroEm: { fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontWeight: 400, color: 'var(--gold, #E8C66A)' },
  heroSub: { fontSize: 16, lineHeight: 1.6, color: 'rgba(255,255,255,0.85)', maxWidth: 540, margin: '0 auto 28px' },
  heroCtas: { display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 18 },
  ctaPrimary: { display: 'inline-flex', alignItems: 'center', gap: 8, background: '#fff', color: BERRY, border: 'none', borderRadius: 14, padding: '14px 26px', fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 8px 24px rgba(0,0,0,0.18)' },
  ctaGhost: { display: 'inline-flex', alignItems: 'center', padding: '14px 22px', fontSize: 15, fontWeight: 700, color: '#fff', background: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.7)', borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit' },
  heroNota: { fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontSize: 15, color: 'rgba(255,255,255,0.75)' },

  secao: { maxWidth: 1080, margin: '0 auto', padding: '56px 20px' },
  secaoLabel: { fontSize: 11, fontWeight: 700, color: 'var(--pink)', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'center', marginBottom: 12 },
  secaoTitulo: { fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 28, fontWeight: 800, textAlign: 'center', letterSpacing: '-0.03em', margin: '0 0 32px', color: 'var(--text)' },
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

  planosTitulo: { fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 28, fontWeight: 800, textAlign: 'center', letterSpacing: '-0.03em', margin: '0 0 20px' },
  toggleCard: { display: 'inline-flex', background: '#fff', border: '1px solid var(--border, #EAD5E2)', borderRadius: 'var(--radius-pill)', padding: 4, gap: 4, boxShadow: '0 1px 4px rgba(24,7,18,0.07)' },
  toggleBtn: { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 18px', borderRadius: 'var(--radius-pill)', background: 'transparent', border: 'none', fontSize: 13, fontWeight: 600, color: 'var(--text3, #8B6070)', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' },
  toggleBtnActive: { background: 'var(--pink, #8B2655)', color: '#fff', boxShadow: '0 3px 10px rgba(139,38,85,0.25)' },
  economiaBadge: { background: 'var(--gold, #E6C260)', color: '#170D14', borderRadius: 'var(--radius-pill)', padding: '1px 7px', fontSize: 10, fontWeight: 800 },
  planosGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18, maxWidth: 1100, margin: '0 auto' },
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

  /* Footer */
  footer: { background: NOIR, color: '#fff' },
  footerInner: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 40, padding: '56px 40px 40px', maxWidth: 1100, margin: '0 auto' },
  footerCol: { display: 'flex', flexDirection: 'column', gap: 10 },
  footerDesc: { fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6, margin: '8px 0 0' },
  footerSocial: { display: 'flex', gap: 10, marginTop: 4 },
  socialIcon: { width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.75)', textDecoration: 'none', transition: 'background 0.15s' },
  footerColTitulo: { fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' },
  footerNavLink: { background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.65)', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', padding: '3px 0', lineHeight: 1.6 },
  footerContato: { display: 'flex', alignItems: 'flex-start', gap: 9, color: 'rgba(255,255,255,0.65)', fontSize: 13, lineHeight: 1.5 },
  footerContatoLink: { color: 'rgba(255,255,255,0.75)', textDecoration: 'none', wordBreak: 'break-all' },
  footerBtnWhats: { display: 'inline-flex', alignItems: 'center', gap: 7, background: '#25D366', color: '#fff', borderRadius: 'var(--radius-pill)', padding: '9px 16px', fontSize: 13, fontWeight: 700, textDecoration: 'none', marginTop: 6, width: 'fit-content' },
  footerBottom: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, padding: '18px 40px', borderTop: '1px solid rgba(255,255,255,0.08)', fontSize: 12, color: 'rgba(255,255,255,0.45)', maxWidth: 1100, margin: '0 auto' },
  footerBottomLinks: { display: 'flex', gap: 16, alignItems: 'center' },
  footerBottomLink: { color: 'rgba(255,255,255,0.55)', textDecoration: 'none', fontSize: 12 },
  footerBottomBtn: { background: 'none', border: 'none', color: 'rgba(255,255,255,0.55)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', padding: 0 },
}
