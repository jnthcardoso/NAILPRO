import { useState, useEffect } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { Home, Calendar, Users, DollarSign, Settings, Target, Bell, ChevronLeft, ChevronRight } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { NailProLogo, NailDropIcon } from '../common/Brand'

const navItems = [
  { to: '/', icon: Home, label: 'Início', exact: true },
  { to: '/agenda', icon: Calendar, label: 'Agenda' },
  { to: '/lembretes', icon: Bell, label: 'Lembretes' },
  { to: '/clientes', icon: Users, label: 'Clientes' },
  { to: '/financeiro', icon: DollarSign, label: 'Financeiro' },
  { to: '/metas', icon: Target, label: 'Metas' },
]


export default function AppLayout() {
  const { user } = useAuth()
  const location = useLocation()
  const firstName = user?.user_metadata?.full_name?.split(' ')[0] ?? 'você'
  const avatarUrl = user?.user_metadata?.avatar_url

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebar-collapsed') === 'true'
  })

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', isSidebarCollapsed)
  }, [isSidebarCollapsed])

  const isActive = (to, exact) =>
    exact ? location.pathname === to : location.pathname.startsWith(to)

  return (
    <div className="app-root" style={{ '--sidebar-width': isSidebarCollapsed ? '72px' : '244px' }}>

      {/* ── Sidebar (desktop only) ───────────── */}
      <aside className="app-sidebar">
        <NavLink to="/" style={{ ...sb.logoArea, textDecoration: 'none', display: 'block', cursor: 'pointer', ...(isSidebarCollapsed ? { padding: '24px 0', display: 'flex', justifyContent: 'center' } : {}) }}>
          {isSidebarCollapsed ? (
            <NailDropIcon size={24} variant="reverso" />
          ) : (
            <>
              <NailProLogo size={24} variant="reverso" style={{ marginBottom: 4 }} />
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
                  ...(active ? sb.navItemActive : {}),
                  ...(isSidebarCollapsed ? { justifyContent: 'center', padding: '11px 0' } : {})
                }}
                title={isSidebarCollapsed ? label : undefined}
              >
                <Icon size={19} strokeWidth={active ? 2.5 : 1.8} />
                {!isSidebarCollapsed && <span>{label}</span>}
              </NavLink>
            )
          })}
        </nav>

        <div style={{ flex: 1 }} />
        
        <div style={{ padding: isSidebarCollapsed ? '0 12px 12px' : '0 10px 12px' }}>
          <NavLink 
            to="/configuracoes" 
            style={{ 
              ...sb.navItem, 
              ...(isActive('/configuracoes') ? sb.navItemActive : {}),
              ...(isSidebarCollapsed ? { justifyContent: 'center', padding: '11px 0' } : {})
            }}
            title={isSidebarCollapsed ? "Configurações" : undefined}
          >
            <Settings size={19} strokeWidth={isActive('/configuracoes') ? 2.5 : 1.8} />
            {!isSidebarCollapsed && <span>Configurações</span>}
          </NavLink>
        </div>

        {/* Botão de Alternância (Toggle) */}
        <div style={{ ...sb.toggleArea, ...(isSidebarCollapsed ? { justifyContent: 'center' } : {}) }}>
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            style={sb.toggleBtn}
            title={isSidebarCollapsed ? "Expandir Menu" : "Recolher Menu"}
          >
            {isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>
      </aside>

      {/* ── Content wrapper ───────────────────── */}
      <div className="app-content-wrapper">

        {/* Mobile header */}
        <header className="app-mobile-header">
          <div style={mh.left}>
            <NavLink to="/" style={{ ...mh.logoRow, textDecoration: 'none' }}>
              <NailProLogo size={18} variant="reverso" />
            </NavLink>
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
  logoArea: { padding: '26px 20px 14px', transition: 'padding 0.28s' },
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
  userCard: { display: 'flex', alignItems: 'center', gap: 11, margin: '4px 14px 14px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: 12, padding: '10px 12px', border: '1px solid rgba(255, 255, 255, 0.04)', transition: 'all 0.28s' },
  userCardCollapsed: { background: 'transparent', margin: '4px 0 14px', padding: '10px 0', justifyContent: 'center', border: '1px solid transparent' },
  userAvatar: { width: 36, height: 36, borderRadius: '50%', background: 'var(--pink)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, flexShrink: 0, overflow: 'hidden', border: '1.5px solid rgba(255, 255, 255, 0.15)' },
  userName: {
    fontFamily: "var(--font-display)",
    fontStyle: 'italic',
    fontSize: 16,
    color: '#FFFFFF',
    lineHeight: 1.3,
  },
  userDate: { fontSize: 10, color: 'rgba(255, 255, 255, 0.4)', marginTop: 3, textTransform: 'capitalize', lineHeight: 1.2 },
  divider: { height: 1, background: 'rgba(255, 255, 255, 0.06)', margin: '0 14px 10px', transition: 'margin 0.28s' },
  nav: { display: 'flex', flexDirection: 'column', gap: 3, padding: '0 10px' },
  navItem: { display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 10, fontSize: 14, fontWeight: 500, color: 'rgba(255, 255, 255, 0.65)', textDecoration: 'none', transition: 'all 0.2s', cursor: 'pointer' },
  navItemActive: { background: 'var(--pink)', color: '#FFFFFF', fontWeight: 700, boxShadow: '0 4px 14px rgba(139, 38, 85, 0.4)' },
  toggleArea: { padding: '10px 14px', borderTop: '1px solid rgba(255, 255, 255, 0.06)', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', transition: 'all 0.28s' },
  toggleBtn: { background: 'rgba(255, 255, 255, 0.06)', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255, 255, 255, 0.7)', cursor: 'pointer', transition: 'all 0.2s', outline: 'none' },
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
