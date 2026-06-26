import { BarChart3 } from 'lucide-react'
import AdminRelatorios from './AdminRelatorios'

export default function DevRelatorios() {
  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.iconBox}><BarChart3 size={20} color="white" /></div>
        <div>
          <h1 style={s.title}>Relatórios</h1>
          <p style={s.sub}>Adoção, MRR e saúde do SaaS</p>
        </div>
      </div>
      <AdminRelatorios />
    </div>
  )
}

const s = {
  page:   { padding: 20, paddingBottom: 80 },
  header: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 },
  iconBox:{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg,#7C3AED,#A78BFA)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  title:  { fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 20, fontWeight: 800, color: 'var(--text)', margin: 0 },
  sub:    { fontSize: 12, color: 'var(--text3)', margin: '2px 0 0' },
}
