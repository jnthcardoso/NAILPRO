import { useEffect, useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import AdminCRM from './admin/AdminCRM'

export default function DevCRM() {
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.rpc('admin_listar_usuarios').then(({ data }) => {
      setUsuarios(data || [])
      setLoading(false)
    })
  }, [])

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.iconBox}><MessageCircle size={20} color="white" /></div>
        <div>
          <h1 style={s.title}>CRM</h1>
          <p style={s.sub}>Histórico de contatos e follow-ups</p>
        </div>
      </div>
      {loading
        ? <div style={s.loading}>Carregando…</div>
        : <AdminCRM usuarios={usuarios} />}
    </div>
  )
}

const s = {
  page:   { padding: 20, paddingBottom: 80 },
  header: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 },
  iconBox:{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg,#0369A1,#38BDF8)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  title:  { fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 20, fontWeight: 800, color: 'var(--text)', margin: 0 },
  sub:    { fontSize: 12, color: 'var(--text3)', margin: '2px 0 0' },
  loading:{ textAlign: 'center', padding: 48, color: 'var(--text3)', fontSize: 13 },
}
