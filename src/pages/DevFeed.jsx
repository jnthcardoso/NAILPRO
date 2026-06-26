import { Rss } from 'lucide-react'
import AdminFeed from './admin/AdminFeed'

export default function DevFeed() {
  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.iconBox}><Rss size={20} color="white" /></div>
        <div>
          <h1 style={s.title}>Feed</h1>
          <p style={s.sub}>Eventos de todos os usuários em tempo real</p>
        </div>
      </div>
      <AdminFeed />
    </div>
  )
}

const s = {
  page:   { padding: 20, paddingBottom: 80 },
  header: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 },
  iconBox:{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg,#7C3AED,#A855F7)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  title:  { fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 20, fontWeight: 800, color: 'var(--text)', margin: 0 },
  sub:    { fontSize: 12, color: 'var(--text3)', margin: '2px 0 0' },
}
