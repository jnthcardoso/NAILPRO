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

  return (
    <div style={styles.root}>
      <header style={styles.header}>
        <div>
          <div style={styles.logo}>nail<span style={{ color: '#F48FB1' }}>pro</span></div>
          <div style={styles.headerSub}>Olá, {firstName}! 💅</div>
        </div>
        <div style={styles.headerDate}>
          {new Date().toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })}
        </div>
      </header>
      <main style={styles.main}>
        <Outlet />
      </main>
      <nav style={styles.nav}>
        {navItems.map(({ to, icon: Icon, label, exact }) => {
          const active = exact ? location.pathname === to : location.pathname.startsWith(to)
          return (
            <NavLink key={to} to={to} style={{ ...styles.navItem, ...(active ? styles.navItemActive : {}) }}>
              <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
              <span style={styles.navLabel}>{label}</span>
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}

const styles = {
  root: { maxWidth: 480, margin: '0 auto', minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', position: 'relative' },
  header: { background: 'var(--pink)', padding: '16px 20px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'white', flexShrink: 0 },
  logo: { fontSize: 22, fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '-0.5px', lineHeight: 1, marginBottom: 3 },
  headerSub: { fontSize: 12, opacity: 0.8 },
  headerDate: { fontSize: 12, background: 'rgba(255,255,255,0.18)', padding: '5px 12px', borderRadius: 'var(--radius-pill)', textTransform: 'capitalize' },
  main: { flex: 1, overflowY: 'auto', paddingBottom: 'calc(var(--nav-height) + 8px)' },
  nav: { position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, height: 'var(--nav-height)', background: 'var(--surface)', borderTop: '1px solid var(--border)', display: 'flex', zIndex: 100 },
  navItem: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, color: 'var(--text3)', borderTop: '2px solid transparent', transition: 'all 0.15s', textDecoration: 'none' },
  navItemActive: { color: 'var(--pink)', borderTopColor: 'var(--pink)', background: 'rgba(194,24,91,0.03)' },
  navLabel: { fontSize: 10, fontWeight: 500 },
}