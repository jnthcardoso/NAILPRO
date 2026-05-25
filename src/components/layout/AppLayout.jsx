import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { Home, Calendar, Users, DollarSign } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

const navItems = [
  { to: '/', icon: Home, label: 'Início', exact: true },
  { to: '/agenda', icon: Calendar, label: 'Agenda' },
  { to: '/clientes', icon: Users, label: 'Clientes' },
  { to: '/financeiro', icon: DollarSign, label: 'Financeiro' },
]

export default function AppLayout() {
  const { user } = useAuth()
  const location = useLocation()
  const firstName = user?.user_metadata?.full_name?.split(' ')[0] ?? 'você'

  const isActive = (to, exact) =>
    exact ? location.pathname === to : location.pathname.startsWith(to)

  return (
    <div className="app-root">

      {/* ── Sidebar (desktop only) ───────────── */}
      <aside className="app-sidebar">
        <div style={sb.logoArea}>
          <div style={sb.logo}>nail<span style={{ color: 'var(--pink)' }}>pro</span></div>
          <div style={sb.logoTagline}>gestão para nail designers</div>
        </div>

        <div style={sb.userCard}>
          <div style={sb.userAvatar}>{firstName[0]?.toUpperCase()}</div>
          <div>
            <div style={sb.userName}>Olá, {firstName}! 💅</div>
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
              <NavLink
                key={to}
                to={to}
                style={{ ...sb.navItem, ...(active ? sb.navItemActive : {}) }}
              >
                <Icon size={19} strokeWidth={active ? 2.5 : 1.8} />
                <span>{label}</span>
              </NavLink>
            )
          })}
        </nav>
      </aside>

      {/* ── Content wrapper ───────────────────── */}
      <div className="app-content-wrapper">

        {/* Mobile header */}
        <header className="app-mobile-header">
          <div>
            <div style={mh.logo}>nail<span style={{ color: '#F9A8D4' }}>pro</span></div>
            <div style={mh.sub}>Olá, {firstName}! 💅</div>
          </div>
          <div style={mh.date}>
            {new Date().toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })}
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
  logoArea: { padding: '28px 22px 16px' },
  logo: { fontSize: 26, fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '-0.5px', lineHeight: 1, color: 'var(--text)', marginBottom: 3 },
  logoTagline: { fontSize: 11, color: 'var(--text3)', fontWeight: 400 },
  userCard: { display: 'flex', alignItems: 'center', gap: 11, margin: '4px 14px 14px', background: 'var(--pink-light)', borderRadius: 12, padding: '10px 12px' },
  userAvatar: { width: 36, height: 36, borderRadius: '50%', background: 'var(--pink)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, flexShrink: 0 },
  userName: { fontSize: 13, fontWeight: 600, color: 'var(--pink-dark)', lineHeight: 1.3 },
  userDate: { fontSize: 11, color: 'var(--text3)', marginTop: 2, textTransform: 'capitalize', lineHeight: 1.2 },
  divider: { height: 1, background: 'var(--border)', margin: '0 14px 10px' },
  nav: { display: 'flex', flexDirection: 'column', gap: 2, padding: '0 10px' },
  navItem: { display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 10, fontSize: 14, fontWeight: 400, color: 'var(--text2)', textDecoration: 'none', transition: 'all 0.15s', cursor: 'pointer' },
  navItemActive: { background: 'var(--pink-light)', color: 'var(--pink)', fontWeight: 600, boxShadow: 'inset 0 0 0 1px rgba(190,24,93,0.1)' },
}

/* Mobile header styles */
const mh = {
  logo: { fontSize: 22, fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '-0.5px', lineHeight: 1, marginBottom: 3 },
  sub: { fontSize: 12, opacity: 0.82 },
  date: { fontSize: 12, background: 'rgba(255,255,255,0.18)', padding: '5px 12px', borderRadius: 'var(--radius-pill)', textTransform: 'capitalize' },
}

/* Bottom nav styles */
const bn = {
  item: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, color: 'var(--text3)', borderTop: '2px solid transparent', transition: 'all 0.15s', textDecoration: 'none' },
  itemActive: { color: 'var(--pink)', borderTopColor: 'var(--pink)', background: 'rgba(190,24,93,0.03)' },
  label: { fontSize: 10, fontWeight: 500 },
}
