import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle, UserX, Cake, ChevronRight, Plus, UserPlus, Calendar, Sparkles, Bell,
  TrendingUp, TrendingDown, DollarSign, Target, Clock, Award, Users, MessageCircle, ArrowUpRight
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  format, addDays, subDays, differenceInDays, startOfDay, endOfDay,
  startOfMonth, endOfMonth, subMonths, subWeeks, eachDayOfInterval, getDay,
  endOfDay as endOfDayFn
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import TrialBanner from '../components/common/TrialBanner'
import { notificarUmaVezPorDia } from '../lib/notificacoes'
import BarChart from '../components/charts/BarChart'

const DIAS_SEMANA_LABEL = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export default function Home() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const firstName = user?.user_metadata?.full_name?.split(' ')[0] ?? 'você'

  // Stats principais
  const [stats, setStats] = useState({
    hoje: 0, receitaHoje: 0, realizadosHoje: 0, pendentesHoje: 0,
    aReceber: 0, qtdAReceber: 0,
    metaMes: 4000, receitaMes: 0,
    receitaOntem: 0, atendimentosOntem: 0,
  })
  const [clientesSumidas, setClientesSumidas] = useState([])
  const [aniversarios, setAniversarios] = useState([])
  const [agendamentosData, setAgendamentosData] = useState([])
  const [dataFiltro, setDataFiltro] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [diasAlerta, setDiasAlerta] = useState(30)
  const [nomeSalao, setNomeSalao] = useState('')
  const [totalClientes, setTotalClientes] = useState(null)
  const [totalAgendamentos, setTotalAgendamentos] = useState(null)
  const [lembretesPendentes, setLembretesPendentes] = useState(0)
  const [receita7Dias, setReceita7Dias] = useState([])
  const [diaTop, setDiaTop] = useState(null) // { dia: 4 (qui), valor: 1200 }

  useEffect(() => { if (user) loadDashboard() }, [user])
  useEffect(() => { if (user) loadAgendamentosData() }, [user, dataFiltro])

  async function loadDashboard() {
    const hoje = format(new Date(), 'yyyy-MM-dd')
    const ontem = format(subDays(new Date(), 1), 'yyyy-MM-dd')

    // Config
    const { data: config } = await supabase.from('configuracoes')
      .select('meta_mensal, dias_retorno_alerta, nome_salao').eq('user_id', user.id).single()
    if (config?.meta_mensal) setStats(s => ({ ...s, metaMes: config.meta_mensal }))
    if (config?.nome_salao) setNomeSalao(config.nome_salao)
    const limiteAlerta = config?.dias_retorno_alerta ?? 30
    setDiasAlerta(limiteAlerta)

    // Atendimentos hoje (não cancelados)
    const { data: agendHoje } = await supabase.from('agendamentos')
      .select('*, clientes(nome)')
      .eq('user_id', user.id).eq('data', hoje)
      .neq('status', 'cancelado').order('horario')
    if (agendHoje) {
      const receita = agendHoje.reduce((s, a) => s + (a.valor || 0), 0)
      const realizados = agendHoje.filter(a => a.status === 'realizado').length
      const pendentes = agendHoje.filter(a => a.status === 'pendente' || a.status === 'confirmado').length
      setStats(s => ({
        ...s,
        hoje: agendHoje.length,
        receitaHoje: receita,
        realizadosHoje: realizados,
        pendentesHoje: pendentes,
      }))

      // 🔔 Notifica sobre atendimentos do dia (1x por dia)
      if (agendHoje.length > 0) {
        const primeiro = agendHoje[0]
        notificarUmaVezPorDia('atendimentos-hoje', `Bom dia! ${agendHoje.length} ${agendHoje.length === 1 ? 'atendimento' : 'atendimentos'} hoje ☀️`, {
          body: `Primeiro: ${primeiro.clientes?.nome} às ${primeiro.horario?.slice(0, 5)} - ${primeiro.servico}`,
          tag: 'atendimentos-hoje',
        })
      }
    }

    // Atendimentos ontem (comparativo)
    const { data: agendOntem } = await supabase.from('agendamentos')
      .select('valor, status')
      .eq('user_id', user.id).eq('data', ontem)
      .neq('status', 'cancelado')
    if (agendOntem) {
      const receitaOntem = agendOntem.reduce((s, a) => s + (a.valor || 0), 0)
      setStats(s => ({ ...s, receitaOntem, atendimentosOntem: agendOntem.length }))
    }

    // A receber (todo o mês corrente)
    const inicioMes = format(startOfMonth(new Date()), 'yyyy-MM-dd')
    const fimMes = format(endOfMonth(new Date()), 'yyyy-MM-dd')
    const { data: pagPendentes } = await supabase.from('pagamentos')
      .select('valor').eq('user_id', user.id).eq('status', 'pendente')
      .gte('data', inicioMes).lte('data', fimMes)
    if (pagPendentes) {
      const total = pagPendentes.reduce((s, p) => s + (p.valor || 0), 0)
      setStats(s => ({ ...s, aReceber: total, qtdAReceber: pagPendentes.length }))
    }

    // Receita do mês (pagamentos pagos)
    const { data: pagMes } = await supabase.from('pagamentos')
      .select('data, valor').eq('user_id', user.id).eq('status', 'pago').gte('data', inicioMes)
    if (pagMes) setStats(s => ({ ...s, receitaMes: pagMes.reduce((s, p) => s + (p.valor || 0), 0) }))

    // Receita últimos 7 dias (chart)
    const inicio7d = format(subDays(new Date(), 6), 'yyyy-MM-dd')
    const { data: pag7d } = await supabase.from('pagamentos')
      .select('data, valor').eq('user_id', user.id).eq('status', 'pago').gte('data', inicio7d).lte('data', hoje)
    const dias = eachDayOfInterval({ start: subDays(new Date(), 6), end: new Date() })
    const ABREV = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
    const receitaDias = dias.map(d => {
      const dStr = format(d, 'yyyy-MM-dd')
      const total = (pag7d || []).filter(p => p.data === dStr).reduce((s, p) => s + (p.valor || 0), 0)
      return { label: ABREV[getDay(d)], valor: total, data: dStr }
    })
    setReceita7Dias(receitaDias)

    // Dia da semana mais lucrativo (insight) - últimos 90 dias
    const inicio90d = format(subDays(new Date(), 90), 'yyyy-MM-dd')
    const { data: pag90d } = await supabase.from('pagamentos')
      .select('data, valor').eq('user_id', user.id).eq('status', 'pago').gte('data', inicio90d)
    if (pag90d?.length) {
      const porDiaSemana = [0, 0, 0, 0, 0, 0, 0]
      pag90d.forEach(p => {
        const dia = getDay(new Date(p.data + 'T12:00:00'))
        porDiaSemana[dia] += p.valor || 0
      })
      const max = Math.max(...porDiaSemana)
      if (max > 0) {
        const idxMax = porDiaSemana.indexOf(max)
        setDiaTop({ dia: idxMax, valor: max })
      }
    }

    // Counts pra conta nova
    const { count: countClientes } = await supabase.from('clientes')
      .select('*', { count: 'exact', head: true }).eq('user_id', user.id)
    setTotalClientes(countClientes ?? 0)
    const { count: countAgendamentos } = await supabase.from('agendamentos')
      .select('*', { count: 'exact', head: true }).eq('user_id', user.id)
    setTotalAgendamentos(countAgendamentos ?? 0)

    // Lembretes pendentes amanhã
    const amanha = format(addDays(new Date(), 1), 'yyyy-MM-dd')
    const { data: ags } = await supabase.from('agendamentos')
      .select('lembrete_enviado_em, clientes(telefone)')
      .eq('user_id', user.id).eq('data', amanha)
      .in('status', ['pendente', 'confirmado'])
    if (ags) {
      const pend = ags.filter(a => !a.lembrete_enviado_em && a.clientes?.telefone).length
      setLembretesPendentes(pend)
      if (pend > 0) {
        notificarUmaVezPorDia('lembretes-pendentes', `${pend} ${pend === 1 ? 'lembrete' : 'lembretes'} pra enviar`, {
          body: `${pend === 1 ? 'Você tem 1 cliente' : `Você tem ${pend} clientes`} com agendamento amanhã.`,
          tag: 'lembretes-pendentes',
        })
      }
    }

    // Clientes sumidas + aniversários
    const { data: clientes } = await supabase.from('clientes')
      .select('id, nome, ultimo_atendimento, data_nascimento').eq('user_id', user.id)
    if (clientes) {
      setClientesSumidas(clientes
        .filter(c => c.ultimo_atendimento && differenceInDays(new Date(), new Date(c.ultimo_atendimento)) >= limiteAlerta)
        .slice(0, 3))
      const hj = new Date()
      setAniversarios(clientes.filter(c => {
        if (!c.data_nascimento) return false
        const nasc = new Date(c.data_nascimento + 'T12:00:00')
        const aniv = new Date(hj.getFullYear(), nasc.getMonth(), nasc.getDate())
        const diff = differenceInDays(aniv, hj)
        return diff >= 0 && diff <= 7
      }).slice(0, 3))
    }
  }

  async function loadAgendamentosData() {
    const { data } = await supabase.from('agendamentos')
      .select('*, clientes(nome)').eq('user_id', user.id).eq('data', dataFiltro)
      .neq('status', 'cancelado').order('horario')
    setAgendamentosData(data || [])
  }

  // Computeds
  const progressoMeta = Math.min(100, Math.round((stats.receitaMes / stats.metaMes) * 100))
  const diaAtual = new Date().getDate()
  const diasNoMes = endOfMonth(new Date()).getDate()
  const diasRestantesMes = diasNoMes - diaAtual + 1
  const faltaMeta = Math.max(0, stats.metaMes - stats.receitaMes)
  const necessarioPorDia = diasRestantesMes > 0 ? faltaMeta / diasRestantesMes : 0
  const isHoje = dataFiltro === format(new Date(), 'yyyy-MM-dd')
  const contaNova = totalClientes === 0 && totalAgendamentos === 0

  // Comparativo hoje vs ontem
  const variacaoReceita = stats.receitaOntem > 0
    ? Math.round(((stats.receitaHoje - stats.receitaOntem) / stats.receitaOntem) * 100)
    : null

  return (
    <div style={s.page}>

      <div style={s.greetingRow}>
        <span style={s.greetingText}>{nomeSalao || `oi ${firstName},`}</span>
        <span style={s.greetingDate}>{format(new Date(), "EEEE, dd 'de' MMM", { locale: ptBR })}</span>
      </div>

      <TrialBanner />

      {/* Chip de lembretes pendentes */}
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

      {/* Onboarding pra conta nova */}
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

      {/* ════ GRID 2 COLUNAS (desktop) ════ */}
      <div className="home-grid">

        {/* ═══════ COLUNA ESQUERDA (principal) ═══════ */}
        <div className="home-col-main">

          {/* ─── ATENDIMENTOS DO DIA ─── */}
          <div>
            <div style={s.sectionHeader}>
              <div style={s.sectionTitle}>
                {isHoje ? '📋 atendimentos hoje' : '📋 atendimentos do dia'}
              </div>
              <input type="date" style={s.datePicker} value={dataFiltro} onChange={e => setDataFiltro(e.target.value)} />
            </div>

            <div style={s.apptList}>
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
                    <div style={{ flex: 1, minWidth: 0 }}>
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
            </div>
          </div>

          {/* ─── INSIGHTS ─── */}
          {!contaNova && (diaTop || aniversarios.length > 0 || clientesSumidas.length > 0) && (
            <div style={s.insights}>
              <div style={s.sectionTitle}>💡 insights pra você</div>

              {diaTop && (
                <div style={{ ...s.insight, background: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)', borderColor: '#93C5FD' }}>
                  <Award size={18} color="#1E40AF" />
                  <div style={{ flex: 1 }}>
                    <div style={{ ...s.insightTitle, color: '#1E3A8A' }}>
                      Seu dia mais lucrativo é <strong>{DIAS_SEMANA_LABEL[diaTop.dia]}</strong>
                    </div>
                    <div style={{ ...s.insightSub, color: '#1E40AF' }}>
                      R$ {diaTop.valor.toFixed(0)} acumulado nos últimos 90 dias
                    </div>
                  </div>
                </div>
              )}

              {aniversarios.map(c => {
                const nasc = new Date(c.data_nascimento + 'T12:00:00')
                const aniv = new Date(new Date().getFullYear(), nasc.getMonth(), nasc.getDate())
                const diff = differenceInDays(aniv, new Date())
                return (
                  <div key={c.id} style={{ ...s.insight, background: 'linear-gradient(135deg, #FDF4FF, #FAE8FF)', borderColor: '#E9D5FF' }}>
                    <Cake size={18} color="#86198F" />
                    <div style={{ flex: 1 }}>
                      <div style={{ ...s.insightTitle, color: '#701A75' }}>
                        {c.nome} faz aniversário {diff === 0 ? 'hoje 🎂' : diff === 1 ? 'amanhã 🎂' : `em ${diff} dias`}
                      </div>
                      <div style={{ ...s.insightSub, color: '#86198F' }}>
                        Que tal mandar uma mensagem carinhosa?
                      </div>
                    </div>
                  </div>
                )
              })}

              {clientesSumidas.length > 0 && (
                <div
                  style={{ ...s.insight, background: 'linear-gradient(135deg, #FEF2F2, #FEE2E2)', borderColor: '#FCA5A5', cursor: 'pointer' }}
                  onClick={() => navigate('/clientes')}
                >
                  <UserX size={18} color="#B91C1C" />
                  <div style={{ flex: 1 }}>
                    <div style={{ ...s.insightTitle, color: '#7F1D1D' }}>
                      {clientesSumidas.length} {clientesSumidas.length === 1 ? 'cliente sumida há' : 'clientes sumidas há'} +{diasAlerta} dias
                    </div>
                    <div style={{ ...s.insightSub, color: '#991B1B' }}>
                      {clientesSumidas.map(c => c.nome.split(' ')[0]).join(' · ')}
                    </div>
                  </div>
                  <ChevronRight size={16} color="#7F1D1D" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* ═══════ COLUNA DIREITA (KPIs + chart + ações) ═══════ */}
        <div className="home-col-side">

      {/* KPIs */}
      <div style={s.grid}>
        {/* Atendimentos hoje */}
        <div style={s.kpi} onClick={() => navigate('/agenda')}>
          <div style={s.kpiHeader}>
            <div style={{ ...s.kpiIcon, background: 'var(--pink-light)', color: 'var(--pink)' }}>
              <Calendar size={16} />
            </div>
            <ArrowUpRight size={14} color="var(--text3)" />
          </div>
          <div style={s.kpiLabel}>Hoje</div>
          <div style={{ ...s.kpiValue, color: 'var(--pink)' }}>{stats.hoje}</div>
          <div style={s.kpiSub}>
            {stats.realizadosHoje > 0 && <span>{stats.realizadosHoje} realizados</span>}
            {stats.realizadosHoje > 0 && stats.pendentesHoje > 0 && ' · '}
            {stats.pendentesHoje > 0 && <span>{stats.pendentesHoje} pendentes</span>}
            {stats.hoje === 0 && 'nenhum atendimento'}
          </div>
        </div>

        {/* Receita hoje */}
        <div style={s.kpi} onClick={() => navigate('/financeiro')}>
          <div style={s.kpiHeader}>
            <div style={{ ...s.kpiIcon, background: '#DCFCE7', color: '#15803D' }}>
              <DollarSign size={16} />
            </div>
            {variacaoReceita !== null && variacaoReceita !== 0 && (
              <span style={{
                ...s.varBadge,
                background: variacaoReceita >= 0 ? '#DCFCE7' : '#FEE2E2',
                color: variacaoReceita >= 0 ? '#15803D' : '#B91C1C',
              }}>
                {variacaoReceita >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                {Math.abs(variacaoReceita)}%
              </span>
            )}
          </div>
          <div style={s.kpiLabel}>Receita hoje</div>
          <div style={{ ...s.kpiValue, ...s.mono, color: 'var(--green)', fontSize: 17 }}>
            R$ {stats.receitaHoje.toFixed(2).replace('.', ',')}
          </div>
          <div style={s.kpiSub}>
            {variacaoReceita !== null
              ? `vs R$ ${stats.receitaOntem.toFixed(0)} ontem`
              : `${stats.hoje} ${stats.hoje === 1 ? 'serviço' : 'serviços'}`}
          </div>
        </div>

        {/* A receber */}
        <div style={s.kpi} onClick={() => navigate('/financeiro')}>
          <div style={s.kpiHeader}>
            <div style={{ ...s.kpiIcon, background: stats.aReceber > 0 ? '#FEF3C7' : 'var(--surface2)', color: stats.aReceber > 0 ? '#92400E' : 'var(--text3)' }}>
              <Clock size={16} />
            </div>
          </div>
          <div style={s.kpiLabel}>A receber este mês</div>
          <div style={{ ...s.kpiValue, ...s.mono, color: stats.aReceber > 0 ? 'var(--amber, #D97706)' : 'var(--text3)', fontSize: 17 }}>
            R$ {stats.aReceber.toFixed(2).replace('.', ',')}
          </div>
          <div style={s.kpiSub}>
            {stats.qtdAReceber > 0 ? `${stats.qtdAReceber} ${stats.qtdAReceber === 1 ? 'pagamento' : 'pagamentos'}` : 'nada pendente'}
          </div>
        </div>

        {/* Meta */}
        <div style={s.kpi} onClick={() => navigate('/metas')}>
          <div style={s.kpiHeader}>
            <div style={{ ...s.kpiIcon, background: 'var(--pink-light)', color: 'var(--pink)' }}>
              <Target size={16} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: progressoMeta >= 100 ? 'var(--green)' : 'var(--pink)' }}>
              {progressoMeta}%
            </span>
          </div>
          <div style={s.kpiLabel}>Meta do mês</div>
          <div style={{ ...s.kpiValue, ...s.mono, color: 'var(--pink)', fontSize: 17 }}>
            R$ {stats.receitaMes.toFixed(0)}
          </div>
          <div style={s.progressBar}>
            <div style={{ ...s.progressFill, width: `${progressoMeta}%` }} />
          </div>
          <div style={s.kpiSub}>
            {faltaMeta > 0
              ? `R$ ${necessarioPorDia.toFixed(0)}/dia em ${diasRestantesMes}d`
              : 'meta batida! 🎉'}
          </div>
        </div>
      </div>

      {/* ═══════ GRÁFICO 7 DIAS ═══════ */}
      {!contaNova && (
        <div style={s.chartCard}>
          <div style={s.chartHeader}>
            <div>
              <div style={s.chartTitle}>📈 Receita dos últimos 7 dias</div>
              <div style={s.chartSub}>
                Total: <strong>R$ {receita7Dias.reduce((s, d) => s + d.valor, 0).toFixed(0)}</strong>
              </div>
            </div>
          </div>
          <BarChart data={receita7Dias} cor="#15803D" prefixo="R$ " height={120} />
        </div>
      )}

        </div>
        {/* Fim coluna 2 (KPIs + chart) */}

        {/* ═══════ COLUNA 3 - AÇÕES RÁPIDAS ═══════ */}
        {!contaNova && (
          <div className="home-col-actions">
            <div style={s.quickActions}>
              <div style={s.sectionTitle}>⚡ ações rápidas</div>
              <button style={{ ...s.qaBtn, ...s.qaBtnPink }} onClick={() => navigate('/agenda')}>
                <div style={{ ...s.qaIcon, background: 'rgba(255,255,255,0.2)' }}><Plus size={16} color="white" /></div>
                <span>Novo agendamento</span>
                <ChevronRight size={16} style={{ marginLeft: 'auto', opacity: 0.7 }} />
              </button>
              <button style={{ ...s.qaBtn, ...s.qaBtnLight }} onClick={() => navigate('/clientes')}>
                <div style={{ ...s.qaIcon, background: 'var(--pink-light)' }}><UserPlus size={16} color="var(--pink)" /></div>
                <span>Nova cliente</span>
                <ChevronRight size={16} style={{ marginLeft: 'auto', opacity: 0.5 }} />
              </button>
              <button style={{ ...s.qaBtn, ...s.qaBtnLight }} onClick={() => navigate('/lembretes')}>
                <div style={{ ...s.qaIcon, background: '#DCFCE7' }}><MessageCircle size={16} color="#15803D" /></div>
                <span>Enviar lembretes</span>
                <ChevronRight size={16} style={{ marginLeft: 'auto', opacity: 0.5 }} />
              </button>
              <button style={{ ...s.qaBtn, ...s.qaBtnLight }} onClick={() => navigate('/financeiro')}>
                <div style={{ ...s.qaIcon, background: '#FEF3C7' }}><DollarSign size={16} color="#D97706" /></div>
                <span>Ver financeiro</span>
                <ChevronRight size={16} style={{ marginLeft: 'auto', opacity: 0.5 }} />
              </button>
            </div>
          </div>
        )}

      </div>
      {/* ════ Fim do grid 3 colunas ════ */}

      <button className="fab-btn" onClick={() => navigate('/agenda')} aria-label="Novo agendamento">
        <Plus size={22} color="white" />
      </button>
    </div>
  )
}

const s = {
  page: { padding: 16, paddingBottom: 80 },
  greetingRow: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 4 },
  greetingText: { fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontSize: 26, fontWeight: 400, color: 'var(--text)', letterSpacing: '-0.3px' },
  greetingDate: { fontSize: 12, color: 'var(--text3)', fontWeight: 500, textTransform: 'capitalize' },
  mono: { fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 },
  sectionTitle: { fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px' },
  sectionHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  datePicker: { fontSize: 12, padding: '5px 9px', border: '1px solid var(--border2)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit' },

  /* ─── KPIs ─── */
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, minWidth: 0 },
  kpi: { background: 'var(--surface)', borderRadius: 'var(--radius-sm)', padding: '12px 12px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)', cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s', minWidth: 0, overflow: 'hidden' },
  kpiHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 6 },
  kpiIcon: { width: 26, height: 26, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  kpiLabel: { fontSize: 11, color: 'var(--text3)', fontWeight: 500, marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  kpiValue: { fontSize: 19, fontWeight: 700, lineHeight: 1.1 },
  kpiSub: { fontSize: 10, color: 'var(--text3)', marginTop: 5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  varBadge: { display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 'var(--radius-pill)' },
  progressBar: { height: 5, borderRadius: 3, background: 'var(--border)', marginTop: 6, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3, background: 'var(--pink)', transition: 'width 0.6s ease' },

  /* ─── Chart ─── */
  chartCard: { background: 'var(--surface)', borderRadius: 'var(--radius-sm)', padding: '14px 14px 8px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' },
  chartHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 },
  chartTitle: { fontSize: 13, fontWeight: 700, color: 'var(--text)' },
  chartSub: { fontSize: 11, color: 'var(--text3)', marginTop: 2 },

  /* ─── Ações rápidas ─── */
  quickActions: { display: 'flex', flexDirection: 'column', gap: 8 },
  qaBtn: { display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', borderRadius: 12, border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', textAlign: 'left', width: '100%', whiteSpace: 'nowrap', overflow: 'hidden' },
  qaIcon: { width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  qaBtnPink: { background: 'linear-gradient(135deg, var(--pink) 0%, #C73B6F 100%)', color: 'white', boxShadow: 'var(--shadow-pink)' },
  qaBtnLight: { background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' },

  /* ─── Insights ─── */
  insights: { display: 'flex', flexDirection: 'column', gap: 8 },
  insight: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid', boxShadow: 'var(--shadow-xs)' },
  insightTitle: { fontSize: 13, fontWeight: 600 },
  insightSub: { fontSize: 11, marginTop: 2, opacity: 0.85 },

  /* ─── Atendimentos ─── */
  apptList: { maxHeight: 'min(70vh, 560px)', overflowY: 'auto', paddingRight: 4 },
  apptCard: { background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: '4px solid var(--green)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', boxShadow: 'var(--shadow-sm)', marginBottom: 7 },
  apptTimeBadge: { fontFamily: "'JetBrains Mono', monospace", fontWeight: 500, fontSize: 13, color: 'var(--text)', minWidth: 44, background: 'var(--surface2)', borderRadius: 7, padding: '4px 7px', textAlign: 'center', flexShrink: 0 },
  apptName: { fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  apptService: { fontSize: 11, color: 'var(--text3)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  badge: { fontSize: 11, padding: '3px 10px', borderRadius: 'var(--radius-pill)', fontWeight: 600 },
  emptyDay: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' },
  emptyBtn: { background: 'var(--pink)', color: 'white', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' },

  /* ─── Chip lembretes ─── */
  lembreteChip: { display: 'flex', alignItems: 'center', gap: 12, background: 'linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%)', border: '1px solid #FCD34D', borderRadius: 'var(--radius-sm)', padding: '12px 14px', marginBottom: 14, cursor: 'pointer', boxShadow: 'var(--shadow-sm)' },
  lembreteChipIcon: { width: 34, height: 34, borderRadius: '50%', background: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  lembreteChipTitle: { fontSize: 13, fontWeight: 700, color: '#7C2D12' },
  lembreteChipSub: { fontSize: 11, color: '#9A3412', marginTop: 1 },

  /* ─── Welcome (conta nova) ─── */
  welcomeCard: { background: 'linear-gradient(135deg, var(--pink-light) 0%, #FFF0F5 100%)', border: '1px solid var(--pink-mid)', borderRadius: 'var(--radius-sm)', padding: '16px', marginBottom: 18, boxShadow: 'var(--shadow-sm)' },
  welcomeHeader: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 },
  welcomeTitle: { fontSize: 15, fontWeight: 700, color: 'var(--pink)' },
  welcomeSub: { fontSize: 12, color: 'var(--text2)', marginBottom: 12 },
  welcomeSteps: { display: 'flex', flexDirection: 'column', gap: 8 },
  welcomeStep: { display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' },
  welcomeStepIcon: { width: 36, height: 36, borderRadius: '50%', background: 'var(--pink-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  welcomeStepTitle: { fontSize: 13, fontWeight: 700, color: 'var(--text)' },
  welcomeStepSub: { fontSize: 11, color: 'var(--text3)', marginTop: 2 },
}
