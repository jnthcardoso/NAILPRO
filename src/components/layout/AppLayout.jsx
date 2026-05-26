import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { Home, Calendar, Users, DollarSign, Settings, Target } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { NailProLogo } from '../common/Brand'

const navItems = [
  { to: '/', icon: Home, label: 'Início', exact: true },
  { to: '/metas', icon: Target, label: 'Metas' },
  { to: '/agenda', icon: Calendar, label: 'Agenda' },
  { to: '/clientes', icon: Users, label: 'Clientes' },
  { to: '/financeiro', icon: DollarSign, label: 'Financeiro' },
]


export default function AppLayout() {
  const { user } = useAuth()
  const location = useLocation()
  const firstName = user?.user_metadata?.full_name?.split(' ')[0] ?? 'você'
  const avatarUrl = user?.user_metadata?.avatar_url

  const isActive = (to, exact) =>
    exact ? location.pathname === to : location.pathname.startsWith(to)

  return (
    <div className="app-root">

      {/* ── Sidebar (desktop only) ───────────── */}
      <aside className="app-sidebar">
        <div style={sb.logoArea}>
          <NailProLogo size={24} style={{ marginBottom: 4 }} />
          <div style={sb.logoTagline}>gestão para nail designers</div>
        </div>

        <div style={sb.userCard}>
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
          <div>
            <div style={sb.userName}>
              <em>oi {firstName},</em>
            </div>
            <div style={sb.userDate}>
              {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
          </div>
        </div>

        <div style={sb.divider} />

        <nav style={sb.nav}>
          {navItems.map(({ to, icon: Icon, label, exact }) => {
            const active = isActive(to, exact)
            return (
              <NavLink key={to} to={to} style={{ ...sb.navItem, ...(active ? sb.navItemActive : {}) }}>
                <Icon size={19} strokeWidth={active ? 2.5 : 1.8} />
                <span>{label}</span>
              </NavLink>
            )
          })}
        </nav>

        <div style={{ flex: 1 }} />
        <div style={{ padding: '0 10px 16px' }}>
          <NavLink to="/configuracoes" style={{ ...sb.navItem, ...(isActive('/configuracoes') ? sb.navItemActive : {}) }}>
            <Settings size={19} strokeWidth={isActive('/configuracoes') ? 2.5 : 1.8} />
            <span>Configurações</span>
          </NavLink>
        </div>
      </aside>

      {/* ── Content wrapper ───────────────────── */}
      <div className="app-content-wrapper">

        {/* Mobile header */}
        <header className="app-mobile-header">
          <div style={mh.left}>
            <div style={mh.logoRow}>
              <NailProLogo size={18} variant="reverso" />
            </div>
            <div style={mh.sub}>
              <em>oi {firstName},</em>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={mh.date}>
              {new Date().toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })}
            </div>
            <NavLink to="/configuracoes" style={{ color: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center' }}>
              <Settings size={18} />
            </NavLink>
          </div>
        </header>

        <main className="app-main">
          <Outlet />
        </main>
      </div>

      {/* ── Bottom nav (mobile only) ──────────── */}
      <nav className="app-bottom-nav">
        {navItems.map(({ to, icon: Icon, label, exact }) => {
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
      </nav>
    </div>
  )
}

/* Sidebar styles */
const sb = {
  logoArea: { padding: '26px 20px 14px' },
  logoRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 },
  logoText: {
    fontFamily: "'Bricolage Grotesque', sans-serif",
    fontWeight: 800,
    fontSize: 22,
    letterSpacing: '-0.5px',
    color: 'var(--text)',
    lineHeight: 1,
  },
  logoTagline: { fontSize: 11, color: 'var(--text3)', fontWeight: 400, marginLeft: 2 },
  userCard: { display: 'flex', alignItems: 'center', gap: 11, margin: '4px 14px 14px', background: 'var(--pink-light)', borderRadius: 12, padding: '10px 12px' },
  userAvatar: { width: 36, height: 36, borderRadius: '50%', background: 'var(--pink)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, flexShrink: 0, overflow: 'hidden' },
  userName: {
    fontFamily: "'Instrument Serif', serif",
    fontStyle: 'italic',
    fontSize: 15,
    color: 'var(--pink)',
    lineHeight: 1.3,
  },
  userDate: { fontSize: 11, color: 'var(--text3)', marginTop: 3, textTransform: 'capitalize', lineHeight: 1.2 },
  divider: { height: 1, background: 'var(--border)', margin: '0 14px 10px' },
  nav: { display: 'flex', flexDirection: 'column', gap: 2, padding: '0 10px' },
  navItem: { display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 10, fontSize: 14, fontWeight: 400, color: 'var(--text2)', textDecoration: 'none', transition: 'all 0.15s', cursor: 'pointer' },
  navItemActive: { background: 'var(--pink-light)', color: 'var(--pink)', fontWeight: 700, boxShadow: 'inset 0 0 0 1px rgba(139,38,85,0.12)' },
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
}

/* Bottom nav styles */
const bn = {
  item: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, color: 'var(--text3)', borderTop: '2px solid transparent', transition: 'all 0.15s', textDecoration: 'none' },
  itemActive: { color: 'var(--pink)', borderTopColor: 'var(--pink)', background: 'rgba(139,38,85,0.04)' },
  label: { fontSize: 10, fontWeight: 600 },
}
