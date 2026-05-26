import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, UserX, Cake, ChevronRight, Plus, UserPlus, Calendar, Sparkles, Bell } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { format, addDays, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import TrialBanner from '../components/common/TrialBanner'

export default function Home() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const firstName = user?.user_metadata?.full_name?.split(' ')[0] ?? 'você'

  const [stats, setStats] = useState({ hoje: 0, receitaHoje: 0, pendente: 0, metaMes: 4000, receitaMes: 0 })
  const [semConfirmacao, setSemConfirmacao] = useState([])
  const [clientesSumidas, setClientesSumidas] = useState([])
  const [aniversarios, setAniversarios] = useState([])
  const [agendamentosData, setAgendamentosData] = useState([])
  const [dataFiltro, setDataFiltro] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [diasAlerta, setDiasAlerta] = useState(30)
  const [nomeSalao, setNomeSalao] = useState('')
  const [totalClientes, setTotalClientes] = useState(null)
  const [totalAgendamentos, setTotalAgendamentos] = useState(null)
  const [lembretesPendentes, setLembretesPendentes] = useState(0)

  useEffect(() => { if (user) loadDashboard() }, [user])
  useEffect(() => { if (user) loadAgendamentosData() }, [user, dataFiltro])

  async function loadDashboard() {
    const hoje = format(new Date(), 'yyyy-MM-dd')

    const { data: config } = await supabase.from('configuracoes')
      .select('meta_mensal, dias_retorno_alerta, nome_salao').eq('user_id', user.id).single()
    if (config?.meta_mensal) setStats(s => ({ ...s, metaMes: config.meta_mensal }))
    if (config?.nome_salao) setNomeSalao(config.nome_salao)
    const limiteAlerta = config?.dias_retorno_alerta ?? 30
    setDiasAlerta(limiteAlerta)

    const { data: agendHoje } = await supabase.from('agendamentos')
      .select('*, clientes(nome)').eq('user_id', user.id).eq('data', hoje).order('horario')
    if (agendHoje) {
      const receita = agendHoje.reduce((s, a) => s + (a.valor || 0), 0)
      setStats(s => ({ ...s, hoje: agendHoje.length, receitaHoje: receita }))
      setSemConfirmacao(agendHoje.filter(a => a.status === 'pendente'))
    }

    const { data: pagPendentes } = await supabase.from('pagamentos')
      .select('valor').eq('user_id', user.id).eq('status', 'pendente')
    if (pagPendentes) setStats(s => ({ ...s, pendente: pagPendentes.reduce((s, p) => s + (p.valor || 0), 0) }))

    const inicioMes = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd')
    const { data: pagMes } = await supabase.from('pagamentos')
      .select('valor').eq('user_id', user.id).eq('status', 'pago').gte('data', inicioMes)
    if (pagMes) setStats(s => ({ ...s, receitaMes: pagMes.reduce((s, p) => s + (p.valor || 0), 0) }))

    const { data: clientes } = await supabase.from('clientes')
      .select('id, nome, ultimo_atendimento').eq('user_id', user.id).not('ultimo_atendimento', 'is', null)
    if (clientes)
      setClientesSumidas(clientes.filter(c => differenceInDays(new Date(), new Date(c.ultimo_atendimento)) >= limiteAlerta).slice(0, 3))

    // Conta total de clientes e agendamentos para detectar conta nova
    const { count: countClientes } = await supabase.from('clientes')
      .select('*', { count: 'exact', head: true }).eq('user_id', user.id)
    setTotalClientes(countClientes ?? 0)

    const { count: countAgendamentos } = await supabase.from('agendamentos')
      .select('*', { count: 'exact', head: true }).eq('user_id', user.id)
    setTotalAgendamentos(countAgendamentos ?? 0)

    // Conta lembretes pendentes pra amanhã (apenas clientes com telefone)
    const amanha = format(addDays(new Date(), 1), 'yyyy-MM-dd')
    const { data: ags } = await supabase.from('agendamentos')
      .select('lembrete_enviado_em, clientes(telefone)')
      .eq('user_id', user.id)
      .eq('data', amanha)
      .in('status', ['pendente', 'confirmado'])
    if (ags) {
      const pend = ags.filter(a => !a.lembrete_enviado_em && a.clientes?.telefone).length
      setLembretesPendentes(pend)
    }

    const { data: todosClientes } = await supabase.from('clientes')
      .select('id, nome, data_nascimento').eq('user_id', user.id).not('data_nascimento', 'is', null)
    if (todosClientes) {
      const hj = new Date()
      setAniversarios(todosClientes.filter(c => {
        const nasc = new Date(c.data_nascimento)
        const aniv = new Date(hj.getFullYear(), nasc.getMonth(), nasc.getDate())
        const diff = differenceInDays(aniv, hj)
        return diff >= 0 && diff <= 3
      }))
    }
  }

  async function loadAgendamentosData() {
    const { data } = await supabase.from('agendamentos')
      .select('*, clientes(nome)').eq('user_id', user.id).eq('data', dataFiltro)
      .neq('status', 'cancelado').order('horario')
    setAgendamentosData(data || [])
  }

  const progressoMeta = Math.min(100, Math.round((stats.receitaMes / stats.metaMes) * 100))
  const isHoje = dataFiltro === format(new Date(), 'yyyy-MM-dd')
  const contaNova = totalClientes === 0 && totalAgendamentos === 0

  return (
    <div style={s.page}>

      <div style={s.greetingRow}>
        <span style={s.greetingText}>{nomeSalao || `oi ${firstName},`}</span>
        <span style={s.greetingDate}>{format(new Date(), "EEEE", { locale: ptBR })}</span>
      </div>

      <TrialBanner />

      {!contaNova && lembretesPendentes > 0 && (
        <div style={s.lembreteChip} onClick={() => navigate('/lembretes')}>
          <div style={s.lembreteChipIcon}><Bell size={16} color="white" /></div>
          <div style={{ flex: 1 }}>
            <div style={s.lembreteChipTitle}>
              {lembretesPendentes} lembrete{lembretesPendentes > 1 ? 's' : ''} pra enviar
            </div>
            <div style={s.lembreteChipSub}>Agendamentos de amanhã · toque para enviar</div>
          </div>
          <ChevronRight size={18} color="#7C2D12" />
        </div>
      )}

      {contaNova && (
        <div style={s.welcomeCard}>
          <div style={s.welcomeHeader}>
            <Sparkles size={20} color="var(--pink)" />
            <div style={s.welcomeTitle}>Bem-vinda ao nailpro! 🎉</div>
          </div>
          <div style={s.welcomeSub}>Comece dando os primeiros passos abaixo:</div>
          <div style={s.welcomeSteps}>
            <button style={s.welcomeStep} onClick={() => navigate('/clientes')}>
              <div style={s.welcomeStepIcon}><UserPlus size={18} color="var(--pink)" /></div>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={s.welcomeStepTitle}>1. Cadastre sua primeira cliente</div>
                <div style={s.welcomeStepSub}>Nome, WhatsApp e aniversário</div>
              </div>
              <ChevronRight size={16} color="var(--text3)" />
            </button>
            <button style={s.welcomeStep} onClick={() => navigate('/agenda')}>
              <div style={s.welcomeStepIcon}><Calendar size={18} color="var(--pink)" /></div>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={s.welcomeStepTitle}>2. Crie seu primeiro agendamento</div>
                <div style={s.welcomeStepSub}>Data, horário e valor</div>
              </div>
              <ChevronRight size={16} color="var(--text3)" />
            </button>
            <button style={s.welcomeStep} onClick={() => navigate('/lembretes')}>
              <div style={s.welcomeStepIcon}><Bell size={18} color="var(--pink)" /></div>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={s.welcomeStepTitle}>3. Envie lembretes pelo WhatsApp</div>
                <div style={s.welcomeStepSub}>1 dia antes do atendimento, com 1 clique</div>
              </div>
              <ChevronRight size={16} color="var(--text3)" />
            </button>
            <button style={s.welcomeStep} onClick={() => navigate('/configuracoes')}>
              <div style={s.welcomeStepIcon}><Sparkles size={18} color="var(--pink)" /></div>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={s.welcomeStepTitle}>4. Ative sua agenda online</div>
                <div style={s.welcomeStepSub}>Clientes agendam pelo link sem te chamar</div>
              </div>
              <ChevronRight size={16} color="var(--text3)" />
            </button>
          </div>
        </div>
      )}

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
            <div style={s.alertTitle}>{clientesSumidas.length} cliente(s) sem visita há +{diasAlerta} dias</div>
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

      <div style={s.sectionHeader}>
        <div style={s.sectionTitle}>{isHoje ? 'atendimentos hoje' : 'atendimentos do dia'}</div>
        <input type="date" style={s.datePicker} value={dataFiltro} onChange={e => setDataFiltro(e.target.value)} />
      </div>

      {agendamentosData.length === 0 ? (
        <div style={s.emptyDay}>
          <span style={{ color: 'var(--text3)', fontSize: 13 }}>Nenhum atendimento</span>
          <button style={s.emptyBtn} onClick={() => navigate('/agenda')}>+ Agendar</button>
        </div>
      ) : (
        agendamentosData.map(ag => {
          const ST = {
            confirmado: { bg: 'var(--green-bg)', color: 'var(--green)', border: 'var(--green)', label: 'Confirmada' },
            realizado:  { bg: '#EDE9FE', color: '#5B21B6', border: '#A78BFA', label: 'Realizado' },
            pendente:   { bg: '#FEF3C7', color: '#92400E', border: '#FCD34D', label: 'Aguardando' },
          }
          const st = ST[ag.status] || ST.pendente
          return (
            <div key={ag.id} style={{ ...s.apptCard, borderLeftColor: st.border }} onClick={() => navigate('/agenda')}>
              <div style={s.apptTimeBadge}>{ag.horario?.slice(0, 5)}</div>
              <div style={{ flex: 1 }}>
                <div style={s.apptName}>{ag.clientes?.nome}</div>
                <div style={s.apptService}>{ag.servico}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <span style={{ ...s.badge, background: st.bg, color: st.color }}>{st.label}</span>
                {ag.valor > 0 && <span style={{ ...s.mono, fontSize: 12, color: 'var(--pink)' }}>R$ {ag.valor.toFixed(0)}</span>}
              </div>
            </div>
          )
        })
      )}

      <button className="fab-btn" onClick={() => navigate('/agenda')} aria-label="Novo agendamento">
        <Plus size={22} color="white" />
      </button>
    </div>
  )
}

const s = {
  page: { padding: 16, paddingBottom: 80 },
  greetingRow: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18 },
  greetingText: { fontFamily: "var(--font-display)", fontStyle: 'italic', fontSize: 32, fontWeight: 400, color: 'var(--text)', letterSpacing: '0.2px' },
  greetingDate: { fontSize: 12, color: 'var(--text3)', fontWeight: 500, textTransform: 'capitalize' },
  mono: { fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 },
  sectionTitle: { fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px' },
  sectionHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '18px 0 10px' },
  datePicker: { fontSize: 12, padding: '5px 9px', border: '1px solid var(--border2)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 },
  card: { background: 'var(--surface)', borderRadius: 'var(--radius-sm)', padding: '14px 15px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)' },
  cardLabel: { fontSize: 11, color: 'var(--text3)', marginBottom: 5, fontWeight: 500 },
  cardValue: { fontSize: 22, fontWeight: 700, lineHeight: 1 },
  cardSub: { fontSize: 11, color: 'var(--text3)', marginTop: 5 },
  progressBar: { height: 5, borderRadius: 3, background: 'var(--border)', marginTop: 7, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3, background: 'var(--pink)', transition: 'width 0.6s ease' },
  alert: { borderRadius: 'var(--radius-sm)', padding: '11px 14px', marginBottom: 9, display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', boxShadow: 'var(--shadow-xs)' },
  alertTitle: { fontSize: 13, fontWeight: 600 },
  alertSub: { fontSize: 12, opacity: 0.78, marginTop: 2 },
  alertWarning: { background: '#FFFBEB', color: '#78350F', border: '1px solid #FCD34D' },
  alertDanger: { background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid #FECACA' },
  alertSuccess: { background: 'var(--green-bg)', color: '#14532D', border: '1px solid #86EFAC' },
  apptCard: { background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: '4px solid var(--green)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', boxShadow: 'var(--shadow-sm)', marginBottom: 8 },
  apptTimeBadge: { fontFamily: "'JetBrains Mono', monospace", fontWeight: 500, fontSize: 14, color: 'var(--text)', minWidth: 44, background: 'var(--surface2)', borderRadius: 8, padding: '4px 8px', textAlign: 'center' },
  apptName: { fontSize: 14, fontWeight: 600 },
  apptService: { fontSize: 12, color: 'var(--text3)', marginTop: 2 },
  badge: { fontSize: 11, padding: '3px 10px', borderRadius: 'var(--radius-pill)', fontWeight: 600 },
  emptyDay: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' },
  emptyBtn: { background: 'var(--pink)', color: 'white', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  welcomeCard: { background: 'linear-gradient(135deg, var(--pink-light) 0%, #FFF0F5 100%)', border: '1px solid var(--pink-mid)', borderRadius: 'var(--radius-sm)', padding: '16px', marginBottom: 18, boxShadow: 'var(--shadow-sm)' },
  welcomeHeader: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 },
  welcomeTitle: { fontSize: 15, fontWeight: 700, color: 'var(--pink)' },
  welcomeSub: { fontSize: 12, color: 'var(--text2)', marginBottom: 12 },
  welcomeSteps: { display: 'flex', flexDirection: 'column', gap: 8 },
  welcomeStep: { display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' },
  welcomeStepIcon: { width: 36, height: 36, borderRadius: '50%', background: 'var(--pink-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  welcomeStepTitle: { fontSize: 13, fontWeight: 700, color: 'var(--text)' },
  welcomeStepSub: { fontSize: 11, color: 'var(--text3)', marginTop: 2 },
  lembreteChip: { display: 'flex', alignItems: 'center', gap: 12, background: 'linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%)', border: '1px solid #FCD34D', borderRadius: 'var(--radius-sm)', padding: '12px 14px', marginBottom: 14, cursor: 'pointer', boxShadow: 'var(--shadow-sm)' },
  lembreteChipIcon: { width: 34, height: 34, borderRadius: '50%', background: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  lembreteChipTitle: { fontSize: 13, fontWeight: 700, color: '#7C2D12' },
  lembreteChipSub: { fontSize: 11, color: '#9A3412', marginTop: 1 },
}
