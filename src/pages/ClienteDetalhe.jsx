import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Phone, Calendar, DollarSign } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default function ClienteDetalhe() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [cliente, setCliente] = useState(null)
  const [historico, setHistorico] = useState([])

  useEffect(() => { if (user && id) { loadCliente(); loadHistorico() } }, [user, id])

  async function loadCliente() {
    const { data } = await supabase.from('clientes').select('*').eq('id', id).eq('user_id', user.id).single()
    setCliente(data)
  }

  async function loadHistorico() {
    const { data } = await supabase.from('agendamentos').select('*, pagamentos(status, valor)').eq('cliente_id', id).eq('user_id', user.id).order('data', { ascending: false }).limit(20)
    setHistorico(data || [])
  }

  function getInitials(nome) {
    return nome?.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase() || '??'
  }

  if (!cliente) return <div style={{ padding: 24, color: 'var(--text3)' }}>Carregando...</div>

  return (
    <div style={s.page}>
      <div style={s.topBar}>
        <button style={s.backBtn} onClick={() => navigate(-1)}><ArrowLeft size={20} /></button>
        <span style={s.topTitle}>Perfil da cliente</span>
        <div style={{ width: 32 }} />
      </div>

      <div style={s.profile}>
        <div style={s.avatar}>{getInitials(cliente.nome)}</div>
        <div style={s.profileName}>{cliente.nome}</div>
        {(cliente.total_visitas || 0) >= 10 && (
          <span style={s.vipBadge}>✨ VIP</span>
        )}
        {cliente.telefone && (
          <a href={`https://wa.me/55${cliente.telefone.replace(/\D/g, '')}`} style={s.wppBtn} target="_blank" rel="noopener noreferrer">
            <Phone size={14} /> {cliente.telefone}
          </a>
        )}
      </div>

      <div style={s.statsGrid}>
        <div style={s.statCard}>
          <Calendar size={18} color="var(--pink)" />
          <div style={s.statValue}>{cliente.total_visitas || 0}</div>
          <div style={s.statLabel}>visitas</div>
        </div>
        <div style={s.statCard}>
          <DollarSign size={18} color="var(--green)" />
          <div style={s.statValue}>R$ {(cliente.total_gasto || 0).toFixed(0)}</div>
          <div style={s.statLabel}>total gasto</div>
        </div>
        <div style={s.statCard}>
          <Calendar size={18} color="var(--text3)" />
          <div style={s.statValue}>{cliente.ultimo_atendimento ? format(new Date(cliente.ultimo_atendimento), 'dd/MM') : '—'}</div>
          <div style={s.statLabel}>última vez</div>
        </div>
      </div>

      {cliente.observacoes && (
        <div style={s.obs}>
          <div style={s.obsTitle}>Observações</div>
          <div style={s.obsText}>{cliente.observacoes}</div>
        </div>
      )}

      <div style={s.sectionTitle}>histórico de atendimentos</div>

      {historico.length === 0
        ? <div style={s.empty}>Nenhum atendimento registrado</div>
        : historico.map(h => {
          const pago = h.pagamentos?.[0]?.status === 'pago'
          return (
            <div key={h.id} style={s.histCard}>
              <div style={{ flex: 1 }}>
                <div style={s.histService}>{h.servico}</div>
                <div style={s.histDate}>{format(new Date(h.data), "dd 'de' MMM yyyy", { locale: ptBR })}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={s.histValor}>R$ {(h.valor || 0).toFixed(2).replace('.', ',')}</div>
                <span style={{ ...s.badge, ...(pago ? s.badgePago : s.badgePendente) }}>{pago ? '✓ Pago' : '⏳ Pendente'}</span>
              </div>
            </div>
          )
        })
      }
    </div>
  )
}

const s = {
  page: { padding: 16, paddingBottom: 80 },
  topBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  backBtn: { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 9, cursor: 'pointer', color: 'var(--text)', display: 'flex', padding: '6px 8px' },
  topTitle: { fontSize: 15, fontWeight: 700 },
  profile: { display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 20, gap: 6 },
  avatar: { width: 76, height: 76, borderRadius: '50%', background: 'linear-gradient(135deg, var(--pink-light), var(--pink-mid))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800, color: 'var(--pink)', marginBottom: 4, boxShadow: '0 4px 16px rgba(190,24,93,0.18)' },
  profileName: { fontSize: 20, fontWeight: 700 },
  vipBadge: { fontSize: 12, padding: '3px 12px', borderRadius: 'var(--radius-pill)', background: 'var(--purple-bg)', color: 'var(--purple)', fontWeight: 700 },
  wppBtn: { display: 'flex', alignItems: 'center', gap: 5, background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid #86EFAC', borderRadius: 'var(--radius-pill)', padding: '7px 15px', fontSize: 13, fontWeight: 600 },
  statsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 },
  statCard: { background: 'var(--surface)', borderRadius: 'var(--radius-sm)', padding: '13px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)' },
  statValue: { fontSize: 16, fontWeight: 700, color: 'var(--text)' },
  statLabel: { fontSize: 11, color: 'var(--text3)', fontWeight: 500 },
  obs: { background: 'var(--surface)', borderRadius: 'var(--radius-sm)', padding: '13px 15px', marginBottom: 16, boxShadow: 'var(--shadow-xs)', border: '1px solid var(--border)' },
  obsTitle: { fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 },
  obsText: { fontSize: 13, color: 'var(--text2)', lineHeight: 1.55 },
  sectionTitle: { fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px', margin: '0 0 10px' },
  histCard: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '11px 14px', marginBottom: 9, display: 'flex', alignItems: 'center', gap: 10, boxShadow: 'var(--shadow-xs)' },
  histService: { fontSize: 14, fontWeight: 600 },
  histDate: { fontSize: 12, color: 'var(--text3)', marginTop: 2 },
  histValor: { fontSize: 13, fontWeight: 700, color: 'var(--pink)', marginBottom: 3 },
  badge: { fontSize: 11, padding: '2px 9px', borderRadius: 'var(--radius-pill)', fontWeight: 600 },
  badgePago: { background: 'var(--green-bg)', color: 'var(--green)' },
  badgePendente: { background: 'var(--amber-bg)', color: 'var(--amber)' },
  empty: { color: 'var(--text3)', fontSize: 14, textAlign: 'center', padding: '24px 0' },
}
