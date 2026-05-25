import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, UserX, Cake, ChevronRight, Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { format, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default function Home() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const firstName = user?.user_metadata?.full_name?.split(' ')[0] ?? 'você'
  const [stats, setStats] = useState({ hoje: 0, receitaHoje: 0, pendente: 0, metaMes: 4000, receitaMes: 0 })
  const [proximoAtend, setProximoAtend] = useState(null)
  const [semConfirmacao, setSemConfirmacao] = useState([])
  const [clientesSumidas, setClientesSumidas] = useState([])
  const [aniversarios, setAniversarios] = useState([])

  useEffect(() => { if (user) loadDashboard() }, [user])

  async function loadDashboard() {
    const hoje = format(new Date(), 'yyyy-MM-dd')
    const { data: agendHoje } = await supabase.from('agendamentos').select('*, clientes(nome)').eq('user_id', user.id).eq('data', hoje).order('horario')
    if (agendHoje) {
      const receita = agendHoje.reduce((s, a) => s + (a.valor || 0), 0)
      setStats(s => ({ ...s, hoje: agendHoje.length, receitaHoje: receita }))
      setSemConfirmacao(agendHoje.filter(a => a.status === 'pendente'))
      setProximoAtend(agendHoje.find(a => a.status !== 'realizado'))
    }
    const { data: pagPendentes } = await supabase.from('pagamentos').select('valor').eq('user_id', user.id).eq('status', 'pendente')
    if (pagPendentes) setStats(s => ({ ...s, pendente: pagPendentes.reduce((s, p) => s + (p.valor || 0), 0) }))
    const inicioMes = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd')
    const { data: pagMes } = await supabase.from('pagamentos').select('valor').eq('user_id', user.id).eq('status', 'pago').gte('data', inicioMes)
    if (pagMes) setStats(s => ({ ...s, receitaMes: pagMes.reduce((s, p) => s + (p.valor || 0), 0) }))
    const { data: clientes } = await supabase.from('clientes').select('id, nome, ultimo_atendimento').eq('user_id', user.id).not('ultimo_atendimento', 'is', null)
    if (clientes) setClientesSumidas(clientes.filter(c => differenceInDays(new Date(), new Date(c.ultimo_atendimento)) >= 35).slice(0, 3))
    const { data: todosClientes } = await supabase.from('clientes').select('id, nome, data_nascimento').eq('user_id', user.id).not('data_nascimento', 'is', null)
    if (todosClientes) {
      const hoje2 = new Date()
      setAniversarios(todosClientes.filter(c => {
        const nasc = new Date(c.data_nascimento)
        const aniv = new Date(hoje2.getFullYear(), nasc.getMonth(), nasc.getDate())
        const diff = differenceInDays(aniv, hoje2)
        return diff >= 0 && diff <= 3
      }))
    }
  }

  const progressoMeta = Math.min(100, Math.round((stats.receitaMes / stats.metaMes) * 100))

  return (
    <div style={s.page}>

      {/* Saudação humana */}
      <div style={s.greetingRow}>
        <span style={s.greetingText}>oi {firstName},</span>
        <span style={s.greetingDate}>
          {format(new Date(), "EEEE", { locale: ptBR })}
        </span>
      </div>

      <div style={s.grid}>
        <div style={s.card}>
          <div style={s.cardLabel}>Hoje</div>
          <div style={{ ...s.cardValue, color: 'var(--pink)' }}>{stats.hoje}</div>
          <div style={s.cardSub}>atendimentos</div>
        </div>
        <div style={s.card}>
          <div style={s.cardLabel}>Receita hoje</div>
          <div style={{ ...s.cardValue, ...s.mono, color: 'var(--green)', fontSize: 17 }}>
            R$ {stats.receitaHoje.toFixed(2).replace('.', ',')}
          </div>
          <div style={s.cardSub}>{stats.hoje} serviço{stats.hoje !== 1 ? 's' : ''}</div>
        </div>
        <div style={s.card}>
          <div style={s.cardLabel}>A receber</div>
          <div style={{ ...s.cardValue, ...s.mono, color: stats.pendente > 0 ? 'var(--amber)' : 'var(--green)', fontSize: 17 }}>
            R$ {stats.pendente.toFixed(2).replace('.', ',')}
          </div>
          <div style={s.cardSub}>em aberto</div>
        </div>
        <div style={s.card}>
          <div style={s.cardLabel}>Meta do mês</div>
          <div style={{ ...s.cardValue, ...s.mono, color: 'var(--pink)', fontSize: 17 }}>
            R$ {stats.receitaMes.toFixed(0)}
          </div>
          <div style={s.progressBar}><div style={{ ...s.progressFill, width: `${progressoMeta}%` }} /></div>
          <div style={s.cardSub}>{progressoMeta}% da meta</div>
        </div>
      </div>

      {semConfirmacao.length > 0 && (
        <div style={{ ...s.alert, ...s.alertWarning }}>
          <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={s.alertTitle}>{semConfirmacao.length} cliente(s) sem confirmação hoje</div>
            <div style={s.alertSub}>{semConfirmacao.map(a => a.clientes?.nome).join(' · ')}</div>
          </div>
        </div>
      )}

      {clientesSumidas.length > 0 && (
        <div style={{ ...s.alert, ...s.alertDanger }} onClick={() => navigate('/clientes')}>
          <UserX size={18} style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ flex: 1 }}>
            <div style={s.alertTitle}>{clientesSumidas.length} cliente(s) sumida(s) (+35 dias)</div>
            <div style={s.alertSub}>{clientesSumidas.map(c => c.nome).join(' · ')}</div>
          </div>
          <ChevronRight size={16} style={{ opacity: 0.5 }} />
        </div>
      )}

      {aniversarios.map(c => (
        <div key={c.id} style={{ ...s.alert, ...s.alertSuccess }}>
          <Cake size={18} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={s.alertTitle}>{c.nome} faz aniversário em breve 🎂</div>
            <div style={s.alertSub}>Ótimo momento para entrar em contato!</div>
          </div>
        </div>
      ))}

      {proximoAtend && (
        <>
          <div style={s.sectionTitle}>próximo atendimento</div>
          <div style={s.apptCard} onClick={() => navigate('/agenda')}>
            <div style={s.apptTimeBadge}>{proximoAtend.horario?.slice(0, 5)}</div>
            <div style={{ flex: 1 }}>
              <div style={s.apptName}>{proximoAtend.clientes?.nome}</div>
              <div style={s.apptService}>{proximoAtend.servico}</div>
            </div>
            <span style={{ ...s.badge, ...s.badgeConfirmado }}>Confirmada</span>
          </div>
        </>
      )}

      <button className="fab-btn" onClick={() => navigate('/agenda')} aria-label="Novo agendamento">
        <Plus size={22} color="white" />
      </button>
    </div>
  )
}

const s = {
  page: { padding: 16, paddingBottom: 80 },
  /* Saudação */
  greetingRow: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18 },
  greetingText: {
    fontFamily: "'Instrument Serif', serif",
    fontStyle: 'italic',
    fontSize: 24,
    fontWeight: 400,
    color: 'var(--text)',
    letterSpacing: '-0.3px',
  },
  greetingDate: { fontSize: 12, color: 'var(--text3)', fontWeight: 500, textTransform: 'capitalize' },
  /* Mono helper */
  mono: { fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 },
  /* Stats grid */
  sectionTitle: { fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px', margin: '16px 0 8px' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 },
  card: { background: 'var(--surface)', borderRadius: 'var(--radius-sm)', padding: '14px 15px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)' },
  cardLabel: { fontSize: 11, color: 'var(--text3)', marginBottom: 5, fontWeight: 500 },
  cardValue: { fontSize: 22, fontWeight: 700, lineHeight: 1 },
  cardSub: { fontSize: 11, color: 'var(--text3)', marginTop: 5 },
  progressBar: { height: 5, borderRadius: 3, background: 'var(--border)', marginTop: 7, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3, background: 'var(--pink)', transition: 'width 0.6s ease' },
  /* Alerts */
  alert: { borderRadius: 'var(--radius-sm)', padding: '11px 14px', marginBottom: 9, display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', boxShadow: 'var(--shadow-xs)' },
  alertTitle: { fontSize: 13, fontWeight: 600 },
  alertSub: { fontSize: 12, opacity: 0.78, marginTop: 2 },
  alertWarning: { background: '#FFFBEB', color: '#78350F', border: '1px solid #FCD34D' },
  alertDanger: { background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid #FECACA' },
  alertSuccess: { background: 'var(--green-bg)', color: '#14532D', border: '1px solid #86EFAC' },
  /* Appointment card */
  apptCard: { background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: '4px solid var(--green)', borderRadius: 'var(--radius-sm)', padding: '13px 14px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', boxShadow: 'var(--shadow-sm)' },
  apptTimeBadge: { fontFamily: "'JetBrains Mono', monospace", fontWeight: 500, fontSize: 14, color: 'var(--text)', minWidth: 44, background: 'var(--surface2)', borderRadius: 8, padding: '4px 8px', textAlign: 'center' },
  apptName: { fontSize: 14, fontWeight: 600 },
  apptService: { fontSize: 12, color: 'var(--text3)', marginTop: 2 },
  badge: { fontSize: 11, padding: '3px 10px', borderRadius: 'var(--radius-pill)', fontWeight: 600 },
  badgeConfirmado: { background: 'var(--green-bg)', color: 'var(--green)' },
}
