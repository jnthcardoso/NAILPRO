import { useState, useEffect } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { Home, Calendar, Users, DollarSign, Settings, Target, Bell, ChevronLeft, ChevronRight, Shield, LogOut, UsersRound, Gift, Menu, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useIsAdmin, useAssinatura } from '../../contexts/AssinaturaContext'
import { useSalao } from '../../contexts/SalaoContext'
import { LumenLogo, LumenFlameIcon } from '../common/Brand'
import { useAvisos } from '../../hooks/useAvisos'

const AVISOS_VISTOS_KEY = 'avisos_vistos'
function lerAvisosVistos() {
  try { return JSON.parse(localStorage.getItem(AVISOS_VISTOS_KEY) || '[]') } catch { return [] }
}

// Itens completos (dona / recepcionista — gerenciam tudo)
// `primary` = aparece fixo na barra inferior do celular; o resto vai pro menu "Mais".
const navItemsCompleto = [
  { to: '/app', icon: Home, label: 'Início', exact: true, primary: true },
  { to: '/app/agenda', icon: Calendar, label: 'Agenda', primary: true },
  { to: '/app/lembretes', icon: Bell, label: 'Lembretes' },
  { to: '/app/clientes', icon: Users, label: 'Clientes', primary: true },
  { to: '/app/financeiro', icon: DollarSign, label: 'Financeiro', primary: true },
  { to: '/app/metas', icon: Target, label: 'Metas' },
  { to: '/app/avisos', icon: Bell, label: 'Avisos' },
  { to: '/indicacao', icon: Gift, label: 'Indique e ganhe' },
]

// Profissional: só a própria agenda + o próprio financeiro + suas configurações
const navItemsProfissional = [
  { to: '/app', icon: Home, label: 'Início', exact: true, primary: true },
  { to: '/app/agenda', icon: Calendar, label: 'Agenda', primary: true },
  { to: '/app/financeiro', icon: DollarSign, label: 'Financeiro', primary: true },
  { to: '/app/minhas-configuracoes', icon: Settings, label: 'Configurações' },
  { to: '/indicacao', icon: Gift, label: 'Indique e ganhe', primary: true },
]


export default function AppLayout() {
  const { user, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const { isAdmin } = useIsAdmin()
  const { gerenciaTudo, isProfissional, podeGerenciarEquipe } = useSalao()
  const { podeUsuariosAdicionais } = useAssinatura()
  const { alertas } = useAvisos()
  // Contador do sino: só os avisos AINDA NÃO vistos. A "assinatura" inclui o
  // título (que carrega o número), então se a quantidade muda volta a avisar.
  const [avisosVistos, setAvisosVistos] = useState(lerAvisosVistos)
  const assinaturaAviso = a => `${a.id}:${a.titulo}`
  const naoVistos = alertas.filter(a => !avisosVistos.includes(assinaturaAviso(a))).length
  // "Equipe" só faz sentido no plano Salão (logins de equipe). Solo/Pro não veem.
  const mostraEquipe = podeGerenciarEquipe && podeUsuariosAdicionais
  const navItems = isProfissional ? navItemsProfissional : navItemsCompleto
  const firstName = user?.user_metadata?.full_name?.split(' ')[0] ?? 'você'
  const avatarUrl = user?.user_metadata?.avatar_url

  async function handleSair() {
    await signOut()
    navigate('/login', { replace: true })
  }

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebar-collapsed') === 'true'
  })

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', isSidebarCollapsed)
  }, [isSidebarCollapsed])

  // Painel "Mais" (barra inferior do celular)
  const [maisAberto, setMaisAberto] = useState(false)
  // Fecha o painel sempre que a rota muda (ex: ao tocar num item dele)
  useEffect(() => { setMaisAberto(false) }, [location.pathname])

  // Ao abrir a página de Avisos, marca os atuais como vistos → zera o contador.
  useEffect(() => {
    if (location.pathname === '/app/avisos' && alertas.length) {
      const assinaturas = alertas.map(a => `${a.id}:${a.titulo}`)
      localStorage.setItem(AVISOS_VISTOS_KEY, JSON.stringify(assinaturas))
      setAvisosVistos(assinaturas)
    }
  }, [location.pathname, alertas])

  const isActive = (to, exact) =>
    exact ? location.pathname === to : location.pathname.startsWith(to)

  // Barra inferior: itens fixos + tudo que sobra vai pro menu "Mais"
  const primaryItems = navItems.filter(i => i.primary)
  const maisItems = [
    ...navItems.filter(i => !i.primary),
    ...(isAdmin ? [{ to: '/app/admin', icon: Shield, label: 'Admin' }] : []),
    ...(mostraEquipe ? [{ to: '/app/equipe', icon: UsersRound, label: 'Equipe' }] : []),
    ...(gerenciaTudo ? [{ to: '/app/configuracoes', icon: Settings, label: 'Configurações' }] : []),
  ]
  const maisAtivo = maisItems.some(i => isActive(i.to, i.exact))

  return (
    <div className="app-root" style={{ '--sidebar-width': isSidebarCollapsed ? '72px' : '244px' }}>

      {/* ── Sidebar (desktop only) ───────────── */}
      <aside className="app-sidebar">
        <NavLink to="/app" style={{ ...sb.logoArea, textDecoration: 'none', display: 'block', cursor: 'pointer', ...(isSidebarCollapsed ? { padding: '24px 0', display: 'flex', justifyContent: 'center' } : {}) }}>
          {isSidebarCollapsed ? (
            <LumenFlameIcon size={24} variant="reverso" />
          ) : (
            <>
              <LumenLogo size={24} variant="reverso" style={{ marginBottom: 4 }} />
              <div style={sb.logoTagline}>gestão para nail designers</div>
            </>
          )}
        </NavLink>

        <div style={{ ...sb.userCard, ...(isSidebarCollapsed ? sb.userCardCollapsed : {}) }}>
          <div style={sb.userAvatar}>
            {avatarUrl ? (
              <img 
                src={avatarUrl} 
                alt="Foto de perfil" 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
              />
            ) : (
              firstName[0]?.toUpperCase()
            )}
          </div>
          {!isSidebarCollapsed && (
            <div>
              <div style={sb.userName}>
                <em>oi {firstName},</em>
              </div>
              <div style={sb.userDate}>
                {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </div>
            </div>
          )}
        </div>

        <div style={{ ...sb.divider, ...(isSidebarCollapsed ? { margin: '0 12px 10px' } : {}) }} />

        <nav style={sb.nav}>
          {navItems.map(({ to, icon: Icon, label, exact }) => {
            const active = isActive(to, exact)
            return (
              <NavLink
                key={to}
                to={to}
                style={{
                  ...sb.navItem,
                  position: 'relative',
                  ...(active ? sb.navItemActive : {}),
                  ...(isSidebarCollapsed ? { justifyContent: 'center', padding: '9px 0' } : {})
                }}
                title={isSidebarCollapsed ? label : undefined}
              >
                <Icon size={19} strokeWidth={active ? 2.5 : 1.8} />
                {!isSidebarCollapsed && <span>{label}</span>}
                {to === '/app/avisos' && naoVistos > 0 && (
                  <span style={isSidebarCollapsed ? sb.navBadgeCollapsed : sb.navBadge}>{naoVistos}</span>
                )}
              </NavLink>
            )
          })}
        </nav>

        <div style={{ flex: 1 }} />
        
        <div style={{ padding: isSidebarCollapsed ? '0 12px 12px' : '0 10px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {isAdmin && (
            <NavLink
              to="/app/admin"
              style={{
                ...sb.navItem,
                ...(isActive('/app/admin') ? sb.navItemActive : {}),
                ...(isSidebarCollapsed ? { justifyContent: 'center', padding: '9px 0' } : {})
              }}
              title={isSidebarCollapsed ? "Admin" : undefined}
            >
              <Shield size={19} strokeWidth={isActive('/app/admin') ? 2.5 : 1.8} />
              {!isSidebarCollapsed && <span>Admin</span>}
            </NavLink>
          )}
          {mostraEquipe && (
            <NavLink
              to="/app/equipe"
              style={{
                ...sb.navItem,
                ...(isActive('/app/equipe') ? sb.navItemActive : {}),
                ...(isSidebarCollapsed ? { justifyContent: 'center', padding: '9px 0' } : {})
              }}
              title={isSidebarCollapsed ? "Equipe" : undefined}
            >
              <UsersRound size={19} strokeWidth={isActive('/app/equipe') ? 2.5 : 1.8} />
              {!isSidebarCollapsed && <span>Equipe</span>}
            </NavLink>
          )}
          {gerenciaTudo && (
            <NavLink
              to="/app/configuracoes"
              style={{
                ...sb.navItem,
                ...(isActive('/app/configuracoes') ? sb.navItemActive : {}),
                ...(isSidebarCollapsed ? { justifyContent: 'center', padding: '9px 0' } : {})
              }}
              title={isSidebarCollapsed ? "Configurações" : undefined}
            >
              <Settings size={19} strokeWidth={isActive('/app/configuracoes') ? 2.5 : 1.8} />
              {!isSidebarCollapsed && <span>Configurações</span>}
            </NavLink>
          )}

          <button
            onClick={handleSair}
            style={{
              ...sb.navItem,
              ...sb.sairBtn,
              ...(isSidebarCollapsed ? { justifyContent: 'center', padding: '9px 0' } : {})
            }}
            title={isSidebarCollapsed ? "Sair" : undefined}
          >
            <LogOut size={19} strokeWidth={1.8} />
            {!isSidebarCollapsed && <span>Sair</span>}
          </button>
        </div>

      </aside>

      {/* Botão de recolher/expandir — flutua na borda externa do sidebar (desktop) */}
      <button
        className="sidebar-toggle-float"
        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        style={sb.toggleFloatBtn}
        title={isSidebarCollapsed ? "Expandir Menu" : "Recolher Menu"}
        aria-label={isSidebarCollapsed ? "Expandir Menu" : "Recolher Menu"}
      >
        {isSidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      {/* ── Content wrapper ───────────────────── */}
      <div className="app-content-wrapper">

        {/* Mobile header */}
        <header className="app-mobile-header">
          <div style={mh.left}>
            <NavLink to="/app" style={{ ...mh.logoRow, textDecoration: 'none' }}>
              <LumenLogo size={18} variant="reverso" />
            </NavLink>
            <div style={mh.sub}>
              <em>oi {firstName},</em>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={mh.date}>
              {new Date().toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })}
            </div>
            <NavLink to="/app/avisos" style={{ color: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', position: 'relative' }} aria-label={`Avisos${naoVistos ? ` (${naoVistos})` : ''}`}>
                <Bell size={18} />
                {naoVistos > 0 && <span style={mh.badge}>{naoVistos}</span>}
              </NavLink>
            {gerenciaTudo && (
              <NavLink to="/app/configuracoes" style={{ color: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center' }}>
                <Settings size={18} />
              </NavLink>
            )}
          </div>
        </header>

        <main className="app-main">
          <Outlet />
        </main>
      </div>

      {/* ── Bottom nav (mobile only) — abas fixas + "Mais" ──────────── */}
      <nav className="app-bottom-nav">
        {primaryItems.map(({ to, icon: Icon, label, exact }) => {
          const active = isActive(to, exact)
          return (
            <NavLink
              key={to}
              to={to}
              style={{ ...bn.item, ...(active ? bn.itemActive : {}) }}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
              <span style={bn.label}>{label}</span>
            </NavLink>
          )
        })}
        {/* "Mais" também precisa aparecer quando não há itens extras (ex.: profissional),
            pois é por ele que se chega ao botão Sair no celular — senão a pessoa fica presa. */}
        {(maisItems.length > 0 || isProfissional) && (
          <button
            type="button"
            onClick={() => setMaisAberto(v => !v)}
            style={{ ...bn.item, ...bn.maisBtn, ...(maisAtivo || maisAberto ? bn.itemActive : {}) }}
            aria-label="Mais opções"
            aria-expanded={maisAberto}
          >
            <Menu size={20} strokeWidth={maisAtivo || maisAberto ? 2.5 : 1.8} />
            <span style={bn.label}>Mais</span>
          </button>
        )}
      </nav>

      {/* ── Painel "Mais" (mobile only) ──────────── */}
      {maisAberto && (
        <div className="mais-sheet-overlay" onClick={() => setMaisAberto(false)}>
          <div className="mais-sheet" onClick={e => e.stopPropagation()}>
            <div style={ms.handle} />
            <div style={ms.header}>
              <span style={ms.title}>Mais opções</span>
              <button type="button" onClick={() => setMaisAberto(false)} style={ms.closeBtn} aria-label="Fechar">
                <X size={20} />
              </button>
            </div>
            <div style={ms.grid}>
              {maisItems.map(({ to, icon: Icon, label, exact }) => {
                const active = isActive(to, exact)
                return (
                  <NavLink
                    key={to}
                    to={to}
                    style={{ ...ms.gridItem, ...(active ? ms.gridItemActive : {}) }}
                  >
                    <Icon size={22} strokeWidth={active ? 2.4 : 1.8} />
                    <span style={ms.gridLabel}>{label}</span>
                  </NavLink>
                )
              })}
            </div>
            <button onClick={handleSair} style={ms.sairBtn}>
              <LogOut size={18} strokeWidth={2} />
              <span>Sair</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* Sidebar styles */
const sb = {
  logoArea: { padding: '18px 20px 10px', transition: 'padding 0.28s' },
  logoRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 },
  logoText: {
    fontFamily: "var(--font)",
    fontWeight: 800,
    fontSize: 22,
    letterSpacing: '-0.5px',
    color: '#FFFFFF',
    lineHeight: 1,
  },
  logoTagline: { fontSize: 10, color: 'rgba(255, 255, 255, 0.45)', fontWeight: 400, marginLeft: 2, textTransform: 'uppercase', letterSpacing: '0.4px' },
  userCard: { display: 'flex', alignItems: 'center', gap: 11, margin: '2px 14px 10px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: 12, padding: '9px 12px', border: '1px solid rgba(255, 255, 255, 0.04)', transition: 'all 0.28s' },
  userCardCollapsed: { background: 'transparent', margin: '2px 0 8px', padding: '8px 0', justifyContent: 'center', border: '1px solid transparent' },
  userAvatar: { width: 36, height: 36, borderRadius: '50%', background: 'var(--pink)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, flexShrink: 0, overflow: 'hidden', border: '1.5px solid rgba(255, 255, 255, 0.15)' },
  userName: {
    fontFamily: "var(--font-display)",
    fontStyle: 'italic',
    fontSize: 16,
    color: '#FFFFFF',
    lineHeight: 1.3,
  },
  userDate: { fontSize: 10, color: 'rgba(255, 255, 255, 0.4)', marginTop: 3, textTransform: 'capitalize', lineHeight: 1.2 },
  divider: { height: 1, background: 'rgba(255, 255, 255, 0.06)', margin: '0 14px 8px', transition: 'margin 0.28s' },
  nav: { display: 'flex', flexDirection: 'column', gap: 2, padding: '0 10px' },
  navItem: { display: 'flex', alignItems: 'center', gap: 12, padding: '9px 14px', borderRadius: 10, fontSize: 14, fontWeight: 500, color: 'rgba(255, 255, 255, 0.65)', textDecoration: 'none', transition: 'all 0.2s', cursor: 'pointer' },
  navItemActive: { background: 'var(--pink)', color: '#FFFFFF', fontWeight: 700, boxShadow: '0 4px 14px rgba(139, 38, 85, 0.4)' },
  navBadge: { marginLeft: 'auto', minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9, background: '#EF4444', color: 'white', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  navBadgeCollapsed: { position: 'absolute', top: 2, right: 8, minWidth: 15, height: 15, padding: '0 4px', borderRadius: 8, background: '#EF4444', color: 'white', fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  sairBtn: { background: 'transparent', border: 'none', width: '100%', fontFamily: 'inherit', textAlign: 'left', color: 'rgba(255, 100, 100, 0.75)' },
  // Sem `display` aqui de propósito: quem controla é o CSS (.sidebar-toggle-float),
  // que esconde no celular (display:none) e mostra no desktop (display:flex).
  // Se puser display:flex inline, ele vence o CSS e o botão vaza pro celular.
  toggleFloatBtn: { width: 30, height: 30, borderRadius: 9, background: 'var(--pink)', border: '2px solid var(--bg, #FBF6F8)', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', cursor: 'pointer', boxShadow: '0 3px 12px rgba(139, 38, 85, 0.45)', outline: 'none', padding: 0 },
}

/* Mobile header styles */
const mh = {
  left: { display: 'flex', flexDirection: 'column', gap: 3 },
  logoRow: { display: 'flex', alignItems: 'center', gap: 7 },
  logoText: {
    fontFamily: "'Bricolage Grotesque', sans-serif",
    fontWeight: 800,
    fontSize: 18,
    color: 'white',
    letterSpacing: '-0.3px',
    lineHeight: 1,
  },
  sub: {
    fontFamily: "'Instrument Serif', serif",
    fontStyle: 'italic',
    fontSize: 13,
    opacity: 0.85,
    lineHeight: 1,
  },
  date: { fontSize: 12, background: 'rgba(255,255,255,0.16)', padding: '5px 12px', borderRadius: 'var(--radius-pill)', textTransform: 'capitalize', flexShrink: 0 },
  badge: { position: 'absolute', top: -6, right: -7, minWidth: 15, height: 15, padding: '0 4px', borderRadius: 8, background: '#EF4444', color: 'white', fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #170D14' },
}

/* Bottom nav styles */
const bn = {
  item: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, color: 'var(--text3)', borderTop: '2px solid transparent', transition: 'all 0.15s', textDecoration: 'none' },
  itemActive: { color: 'var(--pink)', borderTopColor: 'var(--pink)', background: 'rgba(139,38,85,0.04)' },
  label: { fontSize: 10, fontWeight: 600 },
  maisBtn: { background: 'transparent', border: 'none', fontFamily: 'inherit', cursor: 'pointer', padding: 0 },
}

/* "Mais" sheet styles (mobile) */
const ms = {
  handle: { width: 38, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 12px' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  title: { fontSize: 15, fontWeight: 700, color: 'var(--text)' },
  closeBtn: { background: 'var(--surface2, rgba(0,0,0,0.04))', border: 'none', borderRadius: '50%', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text2, var(--text3))', cursor: 'pointer' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 },
  gridItem: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '16px 6px', borderRadius: 14, background: 'var(--surface2, rgba(0,0,0,0.03))', color: 'var(--text2, var(--text))', textDecoration: 'none', textAlign: 'center', border: '1px solid var(--border)' },
  gridItemActive: { background: 'var(--pink)', color: '#FFFFFF', borderColor: 'var(--pink)', boxShadow: '0 4px 14px rgba(139,38,85,0.35)' },
  gridLabel: { fontSize: 11.5, fontWeight: 600, lineHeight: 1.2 },
  sairBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', marginTop: 14, padding: '13px 0', borderRadius: 12, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.18)', color: '#DC2626', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' },
}
