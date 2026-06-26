import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle, ChevronRight, Plus, UserPlus, Calendar, Sparkles, Bell,
  TrendingUp, TrendingDown, DollarSign, Target, Clock, Award, Users, MessageCircle, ArrowUpRight
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useSalao } from '../contexts/SalaoContext'
import { formatBRL, validarTelefone } from '../lib/formatters'
import {
  format, addDays, subDays, differenceInDays, startOfDay, endOfDay,
  startOfMonth, endOfMonth, subMonths, subWeeks, eachDayOfInterval, getDay,
  startOfWeek, endOfWeek,
  endOfDay as endOfDayFn
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import TrialBanner from '../components/common/TrialBanner'
import Skeleton from '../components/common/Skeleton'
import OportunidadesSemana from '../components/common/OportunidadesSemana'
import { notificarUmaVezPorDia } from '../lib/notificacoes'
import BarChart from '../components/charts/BarChart'
import FounderDash from './FounderDash'

const EMAIL_DEV = 'vagasjonathancardoso@gmail.com'
const DIAS_SEMANA_LABEL = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export default function Home() {
  const { user } = useAuth()

  if (user?.email === EMAIL_DEV) return <FounderDash />
  const { salaoId, isProfissional, membroId, gerenciaTudo } = useSalao()
  const navigate = useNavigate()
  const firstName = user?.user_metadata?.full_name?.split(' ')[0] ?? 'você'

  // Banner de sucesso apos pagamento (retorno do checkout Asaas)
  const [pagamentoSucesso, setPagamentoSucesso] = useState(() => {
    const p = new URLSearchParams(window.location.search).get('pagamento')
    if (p === 'sucesso') {
      window.history.replaceState({}, '', window.location.pathname)
      // A conversao de compra (Purchase) NAO e disparada aqui: ela vai pelo
      // servidor (Conversions API, no webhook do Asaas) com o valor real e de
      // forma confiavel — mesmo que a cliente feche a aba sem voltar pro app.
      // Disparar tambem aqui contaria a venda 2x. Aqui so mostramos o banner.
      return true
    }
    return false
  })

  // Stats principais
  const [stats, setStats] = useState({
    hoje: 0, receitaHoje: 0, realizadosHoje: 0, pendentesHoje: 0,
    aReceber: 0, qtdAReceber: 0,
    metaMes: 4000, receitaMes: 0,
    receitaOntem: 0, atendimentosOntem: 0,
  })
  const [agendamentosData, setAgendamentosData] = useState([])
  const [dataFiltro, setDataFiltro] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [nomeSalao, setNomeSalao] = useState('')
  const [totalClientes, setTotalClientes] = useState(null)
  const [totalAgendamentos, setTotalAgendamentos] = useState(null)
  const [lembretesPendentes, setLembretesPendentes] = useState(0)
  const [contasAPagar, setContasAPagar] = useState({ qtd: 0, total: 0, vencidas: 0 })
  const [pedidosPublicos, setPedidosPublicos] = useState(0)
  const [receita7Dias, setReceita7Dias] = useState([])
  const [diaTop, setDiaTop] = useState(null) // { dia: 4 (qui), valor: 1200 }
  const [diasFuncionamento, setDiasFuncionamento] = useState([1, 2, 3, 4, 5]) // dias úteis do salão (p/ a meta bater com o módulo Metas)
  const [loading, setLoading] = useState(true)
  const [erroDashboard, setErroDashboard] = useState(false)

  useEffect(() => { if (salaoId) loadDashboard() }, [salaoId])
  useEffect(() => { if (salaoId) loadAgendamentosData() }, [salaoId, dataFiltro])

  async function loadDashboard() {
    setErroDashboard(false)
    try {
      await carregarDashboard()
    } catch (e) {
      // Rede de proteção: se alguma consulta falhar, mostra aviso amigável
      // com "tentar de novo" em vez de deixar o painel em branco.
      console.error('Erro ao carregar o início:', e)
      setErroDashboard(true)
    } finally {
      setLoading(false)
    }
  }

  async function carregarDashboard() {
    const hoje = format(new Date(), 'yyyy-MM-dd')
    const ontem = format(subDays(new Date(), 1), 'yyyy-MM-dd')
    const periodoAtual = format(new Date(), 'yyyy-MM')
    const inicioMes = format(startOfMonth(new Date()), 'yyyy-MM-dd')
    const fimMes = format(endOfMonth(new Date()), 'yyyy-MM-dd')
    const inicioSemana = startOfWeek(new Date(), { weekStartsOn: 1 })
    const fimSemana = endOfWeek(new Date(), { weekStartsOn: 1 })
    const inicioStr = format(inicioSemana, 'yyyy-MM-dd')
    const fimStr = format(fimSemana, 'yyyy-MM-dd')
    const inicio90d = format(subDays(new Date(), 90), 'yyyy-MM-dd')
    const amanha = format(addDays(new Date(), 1), 'yyyy-MM-dd')

    // Todas as consultas são independentes (só dependem do salaoId), então
    // disparamos em paralelo — o tempo passa a ser o da query mais lenta,
    // não o somatório de todas.
    let [
      { data: config },
      { data: metaAtual },
      { data: agendHoje },
      { data: agendOntem },
      { data: pagPendentes },
      { data: pagMes },
      { data: pag7d },
      { data: pag90d },
      { count: countClientes },
      { count: countAgendamentos },
      { data: ags },
      { count: countPedidos },
      { data: pagDia },
    ] = await Promise.all([
      supabase.from('configuracoes')
        .select('meta_mensal, nome_salao, lembretes_ativos, dias_semana').eq('salao_id', salaoId).maybeSingle(),
      supabase.from('metas')
        .select('valor_meta')
        .eq('salao_id', salaoId).eq('tipo', 'mes').eq('periodo', periodoAtual)
        .maybeSingle(),
      supabase.from('agendamentos')
        .select('*, clientes(nome)')
        .eq('salao_id', salaoId).eq('data', hoje)
        .neq('status', 'cancelado').order('horario'),
      supabase.from('agendamentos')
        .select('valor, status')
        .eq('salao_id', salaoId).eq('data', ontem)
        .neq('status', 'cancelado'),
      supabase.from('pagamentos')
        .select('valor, agendamentos(status)').eq('salao_id', salaoId).eq('status', 'pendente')
        .gte('data', inicioMes).lte('data', fimMes).limit(1000),
      supabase.from('pagamentos')
        .select('data, valor, agendamentos(status)').eq('salao_id', salaoId).eq('status', 'pago').gte('data', inicioMes).lte('data', fimMes).limit(1000),
      supabase.from('pagamentos')
        .select('data, valor, agendamentos(status)').eq('salao_id', salaoId).eq('status', 'pago').gte('data', inicioStr).lte('data', fimStr).limit(1000),
      supabase.from('pagamentos')
        .select('data, valor, agendamentos(status)').eq('salao_id', salaoId).eq('status', 'pago').gte('data', inicio90d).limit(2000),
      supabase.from('clientes')
        .select('*', { count: 'exact', head: true }).eq('salao_id', salaoId),
      supabase.from('agendamentos')
        .select('*', { count: 'exact', head: true }).eq('salao_id', salaoId),
      supabase.from('agendamentos')
        .select('lembrete_enviado_em, clientes(telefone)')
        .eq('salao_id', salaoId).eq('data', amanha)
        .in('status', ['pendente', 'confirmado']),
      // Pedidos que chegaram pelo link público e ainda aguardam confirmação
      // (de hoje em diante). É o "loop" do agendamento online: sem isso, um
      // pedido que cai sozinho pode passar batido se a dona não abrir a Agenda.
      // Profissional vê só os pedidos atribuídos a ela; dona/recepção veem os do salão.
      (isProfissional && membroId
        ? supabase.from('agendamentos')
            .select('*', { count: 'exact', head: true })
            .eq('salao_id', salaoId).eq('profissional_id', membroId)
            .eq('origem', 'publica').eq('status', 'pendente').gte('data', hoje)
        : supabase.from('agendamentos')
            .select('*', { count: 'exact', head: true })
            .eq('salao_id', salaoId)
            .eq('origem', 'publica').eq('status', 'pendente').gte('data', hoje)),
      // Receita do dia (hoje e ontem) = só dinheiro recebido (pagamentos pagos).
      supabase.from('pagamentos')
        .select('data, valor, agendamentos(status)').eq('salao_id', salaoId).eq('status', 'pago')
        .gte('data', ontem).lte('data', hoje),
    ])

    // Pagamento de atendimento cancelado não é receita (mesma regra do Financeiro
    // e do perfil da cliente). Avulso, sem agendamento, continua contando.
    const semCancelado = (arr) => (arr || []).filter(p => p.agendamentos?.status !== 'cancelado')
    pagPendentes = semCancelado(pagPendentes)
    pagMes = semCancelado(pagMes)
    pag7d = semCancelado(pag7d)
    pag90d = semCancelado(pag90d)
    pagDia = semCancelado(pagDia)

    // Config
    if (config?.nome_salao) setNomeSalao(config.nome_salao)
    if (config?.dias_semana?.length) setDiasFuncionamento(config.dias_semana)

    // Meta do mês: prioriza tabela metas, fallback pra config.meta_mensal
    const valorMeta = metaAtual?.valor_meta || config?.meta_mensal || 4000
    setStats(s => ({ ...s, metaMes: valorMeta }))

    // Atendimentos hoje (não cancelados)
    if (agendHoje) {
      const realizados = agendHoje.filter(a => a.status === 'realizado').length
      const pendentes = agendHoje.filter(a => a.status === 'pendente' || a.status === 'confirmado').length
      setStats(s => ({
        ...s,
        hoje: agendHoje.length,
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

    // Atendimentos ontem (comparativo) — só a contagem; receita vem dos pagamentos.
    if (agendOntem) {
      setStats(s => ({ ...s, atendimentosOntem: agendOntem.length }))
    }

    // Receita do dia = só o que foi efetivamente RECEBIDO (pagamentos pagos),
    // excluindo cancelados e agendamentos apenas marcados/pendentes. Mesma
    // definição de receita do Financeiro e das Metas.
    setStats(s => ({
      ...s,
      receitaHoje: (pagDia || []).filter(p => p.data === hoje).reduce((acc, p) => acc + (p.valor || 0), 0),
      receitaOntem: (pagDia || []).filter(p => p.data === ontem).reduce((acc, p) => acc + (p.valor || 0), 0),
    }))

    // A receber (todo o mês corrente)
    if (pagPendentes) {
      const total = pagPendentes.reduce((s, p) => s + (p.valor || 0), 0)
      setStats(s => ({ ...s, aReceber: total, qtdAReceber: pagPendentes.length }))
    }

    // Receita do mês (pagamentos pagos)
    if (pagMes) setStats(s => ({ ...s, receitaMes: pagMes.reduce((s, p) => s + (p.valor || 0), 0) }))

    // Receita da semana (Segunda → Domingo)
    const dias = eachDayOfInterval({ start: inicioSemana, end: fimSemana })
    const ABREV = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
    const receitaDias = dias.map(d => {
      const dStr = format(d, 'yyyy-MM-dd')
      const total = (pag7d || []).filter(p => p.data === dStr).reduce((s, p) => s + (p.valor || 0), 0)
      return { label: ABREV[getDay(d)], valor: total, data: dStr }
    })
    setReceita7Dias(receitaDias)

    // Dia da semana mais RENTÁVEL (insight) - últimos 90 dias.
    // Usa MÉDIA por dia trabalhado (total ÷ nº de dias daquele dia-da-semana com
    // faturamento), não o total — senão o dia em que se trabalha mais "ganha" só
    // por aparecer mais vezes. Só considera dias com histórico suficiente
    // (>= MIN_OCORRENCIAS), pra não concluir de 1-2 dias.
    const MIN_OCORRENCIAS = 3
    if (pag90d?.length) {
      const totalPorDia = [0, 0, 0, 0, 0, 0, 0]
      const datasPorDia = [new Set(), new Set(), new Set(), new Set(), new Set(), new Set(), new Set()]
      pag90d.forEach(p => {
        const dia = getDay(new Date(p.data + 'T12:00:00'))
        const v = p.valor || 0
        totalPorDia[dia] += v
        if (v > 0) datasPorDia[dia].add(p.data)
      })
      let melhor = null
      for (let d = 0; d < 7; d++) {
        const ocorrencias = datasPorDia[d].size
        if (ocorrencias < MIN_OCORRENCIAS) continue
        const media = totalPorDia[d] / ocorrencias
        if (!melhor || media > melhor.valor) melhor = { dia: d, valor: media, ocorrencias }
      }
      setDiaTop(melhor)
    } else {
      setDiaTop(null)
    }

    // Counts pra conta nova
    setTotalClientes(countClientes ?? 0)
    setTotalAgendamentos(countAgendamentos ?? 0)

    // Lembretes pendentes amanhã — sempre ativos no Dashboard, pra todo mundo.
    if (ags) {
      const pend = ags.filter(a => !a.lembrete_enviado_em && validarTelefone(a.clientes?.telefone)).length
      setLembretesPendentes(pend)
      if (pend > 0) {
        notificarUmaVezPorDia('lembretes-pendentes', `${pend} ${pend === 1 ? 'lembrete' : 'lembretes'} pra enviar`, {
          body: `${pend === 1 ? 'Você tem 1 cliente' : `Você tem ${pend} clientes`} com agendamento amanhã.`,
          tag: 'lembretes-pendentes',
        })
      }
    }

    // Contas a pagar vencendo até o fim da semana (inclui vencidas) — pago = false.
    // Mesma regra de visibilidade do Financeiro: dona vê o salão; profissional, as dela.
    let despQ = supabase.from('despesas').select('valor, data').eq('pago', false).lte('data', fimStr).limit(200)
    despQ = gerenciaTudo ? despQ.eq('salao_id', salaoId) : despQ.eq('user_id', user.id)
    const { data: contas } = await despQ
    const totalAPagar = (contas || []).reduce((sum, d) => sum + (d.valor || 0), 0)
    const vencidas = (contas || []).filter(d => d.data < hoje).length
    setContasAPagar({ qtd: (contas || []).length, total: totalAPagar, vencidas })

    // Pedidos do link público aguardando confirmação
    const qtdPedidos = countPedidos ?? 0
    setPedidosPublicos(qtdPedidos)
    if (qtdPedidos > 0) {
      notificarUmaVezPorDia('pedidos-publicos', `${qtdPedidos} ${qtdPedidos === 1 ? 'novo pedido' : 'novos pedidos'} de agendamento`, {
        body: `${qtdPedidos === 1 ? 'Uma cliente agendou' : `${qtdPedidos} clientes agendaram`} pelo seu link e aguarda${qtdPedidos === 1 ? '' : 'm'} confirmação.`,
        tag: 'pedidos-publicos',
      })
    }

  }

  async function loadAgendamentosData() {
    const { data } = await supabase.from('agendamentos')
      .select('*, clientes(nome)').eq('salao_id', salaoId).eq('data', dataFiltro)
      .neq('status', 'cancelado').order('horario')
    setAgendamentosData(data || [])
  }

  // Computeds
  const progressoMeta = Math.min(100, Math.round((stats.receitaMes / stats.metaMes) * 100))
  const faltaMeta = Math.max(0, stats.metaMes - stats.receitaMes)
  // Dias ÚTEIS restantes no mês — MESMA lógica do módulo Metas, pra os dois baterem:
  // total de dias de funcionamento do mês menos os que já passaram (hoje incluso).
  const _hojeMeta = new Date()
  const _uteisNoIntervalo = (ini, fim) =>
    eachDayOfInterval({ start: ini, end: fim }).filter(d => diasFuncionamento.includes(getDay(d))).length
  const diasUteisRestantes = Math.max(0,
    _uteisNoIntervalo(startOfMonth(_hojeMeta), endOfMonth(_hojeMeta)) - _uteisNoIntervalo(startOfMonth(_hojeMeta), _hojeMeta))
  const necessarioPorDia = diasUteisRestantes > 0 ? faltaMeta / diasUteisRestantes : 0
  const isHoje = dataFiltro === format(new Date(), 'yyyy-MM-dd')
  const contaNova = totalClientes === 0 && totalAgendamentos === 0

  // Comparativo hoje vs ontem
  const variacaoReceita = stats.receitaOntem > 0
    ? Math.round(((stats.receitaHoje - stats.receitaOntem) / stats.receitaOntem) * 100)
    : null

  return (
    <div style={s.page}>

      {/* Banner de sucesso apos pagamento MP */}
      {pagamentoSucesso && (
        <div style={{
          background: 'linear-gradient(135deg, #15803D, #16A34A)',
          color: 'white',
          borderRadius: 14,
          padding: '14px 18px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: 14,
          fontWeight: 600,
          boxShadow: '0 4px 16px rgba(21,128,61,0.3)',
        }}>
          <span style={{ fontSize: 22 }}>🎉</span>
          <div>
            <div>Pagamento confirmado! Bem-vinda ao plano Lumen.</div>
            <div style={{ fontSize: 12, fontWeight: 400, opacity: 0.9, marginTop: 2 }}>
              Seu acesso completo já está ativo. Aproveite!
            </div>
          </div>
          <button
            onClick={() => setPagamentoSucesso(false)}
            style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0 }}
          >×</button>
        </div>
      )}

      <div style={s.greetingRow}>
        <span style={s.greetingText}>{nomeSalao || `oi ${firstName},`}</span>
        <span style={s.greetingDate}>{format(new Date(), "EEEE, dd 'de' MMM", { locale: ptBR })}</span>
      </div>

      <TrialBanner />

      {/* Rede de proteção: se o carregamento falhar, aviso amigável com "tentar de novo" */}
      {!loading && erroDashboard && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '12px 14px', marginBottom: 14 }}>
          <AlertTriangle size={18} color="#B91C1C" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: '#7F1D1D', fontSize: 13 }}>Não consegui carregar tudo agora</div>
            <div style={{ fontSize: 12, color: '#991B1B' }}>Verifique sua conexão e toque pra tentar de novo.</div>
          </div>
          <button onClick={() => { setLoading(true); loadDashboard() }}
            style={{ background: '#B91C1C', color: 'white', border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
            Tentar de novo
          </button>
        </div>
      )}

      {/* Skeleton enquanto o dashboard carrega */}
      {loading && <HomeSkeleton />}

      {/* Chip de pedidos do link público aguardando confirmação */}
      {!loading && pedidosPublicos > 0 && (
        <div style={s.pedidoChip} onClick={() => navigate('/app/agenda')}>
          <div style={s.pedidoChipIcon}><Calendar size={16} color="white" /></div>
          <div style={{ flex: 1 }}>
            <div style={s.pedidoChipTitle}>
              {pedidosPublicos} {pedidosPublicos === 1 ? 'novo pedido' : 'novos pedidos'} pelo seu link
            </div>
            <div style={s.pedidoChipSub}>Aguardando sua confirmação · toque para ver na agenda</div>
          </div>
          <ChevronRight size={18} color="white" />
        </div>
      )}

      {/* Chip de lembretes pendentes */}
      {!loading && !contaNova && lembretesPendentes > 0 && (
        <div style={s.lembreteChip} onClick={() => navigate('/app/lembretes')}>
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

      {/* Chip de contas a pagar (vencendo até o fim da semana + vencidas) */}
      {!loading && !contaNova && contasAPagar.qtd > 0 && (
        <div style={s.contaChip} onClick={() => navigate('/app/financeiro?ver=apagar')}>
          <div style={s.contaChipIcon}><DollarSign size={16} color="white" /></div>
          <div style={{ flex: 1 }}>
            <div style={s.contaChipTitle}>
              {contasAPagar.qtd} conta{contasAPagar.qtd > 1 ? 's' : ''} a pagar
            </div>
            <div style={s.contaChipSub}>
              {contasAPagar.vencidas > 0
                ? `${contasAPagar.vencidas} vencida${contasAPagar.vencidas > 1 ? 's' : ''} · ${formatBRL(contasAPagar.total)} · toque para ver`
                : `${formatBRL(contasAPagar.total)} · vence até domingo · toque para ver`}
            </div>
          </div>
          <ChevronRight size={18} color="#7F1D1D" />
        </div>
      )}

      {/* Onboarding pra conta nova */}
      {!loading && contaNova && (
        <div style={s.welcomeCard}>
          <div style={s.welcomeHeader}>
            <Sparkles size={20} color="var(--pink)" />
            <div style={s.welcomeTitle}>Bem-vinda à Lumen! 🎉</div>
          </div>
          <div style={s.welcomeSub}>Comece dando os primeiros passos abaixo:</div>
          <div style={s.welcomeSteps}>
            <button style={s.welcomeStep} onClick={() => navigate('/app/clientes')}>
              <div style={s.welcomeStepIcon}><UserPlus size={18} color="var(--pink)" /></div>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={s.welcomeStepTitle}>1. Cadastre sua primeira cliente</div>
                <div style={s.welcomeStepSub}>Nome, WhatsApp e aniversário</div>
              </div>
              <ChevronRight size={16} color="var(--text3)" />
            </button>
            <button style={s.welcomeStep} onClick={() => navigate('/app/agenda')}>
              <div style={s.welcomeStepIcon}><Calendar size={18} color="var(--pink)" /></div>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={s.welcomeStepTitle}>2. Crie seu primeiro agendamento</div>
                <div style={s.welcomeStepSub}>Data, horário e valor</div>
              </div>
              <ChevronRight size={16} color="var(--text3)" />
            </button>
            <button style={s.welcomeStep} onClick={() => navigate('/app/lembretes')}>
              <div style={s.welcomeStepIcon}><Bell size={18} color="var(--pink)" /></div>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={s.welcomeStepTitle}>3. Envie lembretes pelo WhatsApp</div>
                <div style={s.welcomeStepSub}>1 dia antes do atendimento, com 1 clique</div>
              </div>
              <ChevronRight size={16} color="var(--text3)" />
            </button>
            <button style={s.welcomeStep} onClick={() => navigate('/app/configuracoes')}>
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
      {!loading && (
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

            {agendamentosData.length === 0 ? (
              <div style={s.emptyDay}>
                <span style={{ color: 'var(--text3)', fontSize: 13 }}>Nenhum atendimento</span>
                <button style={s.emptyBtn} onClick={() => navigate('/app/agenda')}>+ Agendar</button>
              </div>
            ) : (
              agendamentosData.slice(0, 5).map(ag => {
                const ST = {
                  confirmado: { bg: 'var(--green-bg)', color: 'var(--green)', border: 'var(--green)', label: 'Confirmada' },
                  realizado:  { bg: '#EDE9FE', color: '#5B21B6', border: '#A78BFA', label: 'Realizado' },
                  pendente:   { bg: '#FEF3C7', color: '#92400E', border: '#FCD34D', label: 'Aguardando' },
                }
                const st = ST[ag.status] || ST.pendente
                return (
                  <div key={ag.id} style={{ ...s.apptCard, borderLeftColor: st.border }} onClick={() => navigate('/app/agenda')}>
                    <div style={s.apptTimeBadge}>{ag.horario?.slice(0, 5)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={s.apptName}>{ag.clientes?.nome}</div>
                      <div style={s.apptService}>{ag.servico}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                      <span style={{ ...s.badge, background: st.bg, color: st.color }}>{st.label}</span>
                      {ag.valor > 0 && <span style={{ ...s.mono, fontSize: 12, color: 'var(--pink)' }}>{formatBRL(ag.valor)}</span>}
                    </div>
                  </div>
                )
              })
            )}
            {agendamentosData.length > 5 && (
              <button style={s.verTodosBtn} onClick={() => navigate('/app/agenda')}>
                Ver todos os {agendamentosData.length} atendimentos →
              </button>
            )}
          </div>

          {/* ─── INSIGHTS ─── */}
          {/* Com "dia mais lucrativo": a Home renderiza o cabeçalho + esse card + as oportunidades.
              Sem ele: o próprio componente cuida do cabeçalho e se esconde se não houver nada. */}
          {!contaNova && diaTop && (
            <div style={s.insights}>
              <div style={s.sectionTitle}>💡 insights pra você</div>

              <div style={{ ...s.insight, background: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)', borderColor: '#93C5FD' }}>
                <Award size={18} color="#1E40AF" />
                <div style={{ flex: 1 }}>
                  <div style={{ ...s.insightTitle, color: '#1E3A8A' }}>
                    Seu dia mais rentável é <strong>{DIAS_SEMANA_LABEL[diaTop.dia]}</strong>
                  </div>
                  <div style={{ ...s.insightSub, color: '#1E40AF' }}>
                    Média de {formatBRL(diaTop.valor)} por {DIAS_SEMANA_LABEL[diaTop.dia]} · últimos 90 dias
                  </div>
                </div>
              </div>

              {/* Aniversários, clientes sumindo e dias livres — acionáveis (WhatsApp / copiar link) */}
              <OportunidadesSemana variant="insights" />
            </div>
          )}
          {!contaNova && !diaTop && <OportunidadesSemana variant="insights" withHeader />}
        </div>

        {/* ═══════ COLUNA DIREITA (KPIs + chart + ações) ═══════ */}
        <div className="home-col-side">

      {/* KPIs */}
      <div style={s.grid}>
        {/* Atendimentos hoje */}
        <div style={s.kpi} onClick={() => navigate('/app/agenda')}>
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
        <div style={s.kpi} onClick={() => navigate('/app/financeiro')}>
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
            {formatBRL(stats.receitaHoje)}
          </div>
          <div style={s.kpiSub}>
            {variacaoReceita !== null
              ? `vs ${formatBRL(stats.receitaOntem)} ontem`
              : `${stats.hoje} ${stats.hoje === 1 ? 'serviço' : 'serviços'}`}
          </div>
        </div>

        {/* A receber */}
        <div style={s.kpi} onClick={() => navigate('/app/financeiro?ver=pendentes')}>
          <div style={s.kpiHeader}>
            <div style={{ ...s.kpiIcon, background: stats.aReceber > 0 ? '#FEF3C7' : 'var(--surface2)', color: stats.aReceber > 0 ? '#92400E' : 'var(--text3)' }}>
              <Clock size={16} />
            </div>
          </div>
          <div style={s.kpiLabel}>A receber este mês</div>
          <div style={{ ...s.kpiValue, ...s.mono, color: stats.aReceber > 0 ? 'var(--amber, #D97706)' : 'var(--text3)', fontSize: 17 }}>
            {formatBRL(stats.aReceber)}
          </div>
          <div style={s.kpiSub}>
            {stats.qtdAReceber > 0 ? `${stats.qtdAReceber} ${stats.qtdAReceber === 1 ? 'pagamento' : 'pagamentos'}` : 'nada pendente'}
          </div>
        </div>

        {/* Meta */}
        <div style={s.kpi} onClick={() => navigate('/app/metas')}>
          <div style={s.kpiHeader}>
            <div style={{ ...s.kpiIcon, background: 'var(--pink-light)', color: 'var(--pink)' }}>
              <Target size={16} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: progressoMeta >= 100 ? 'var(--green)' : 'var(--pink)' }}>
              {progressoMeta}%
            </span>
          </div>
          <div style={s.kpiLabel}>Receita do mês</div>
          <div style={{ ...s.kpiValue, ...s.mono, color: 'var(--pink)', fontSize: 17 }}>
            {formatBRL(stats.receitaMes)}
          </div>
          <div style={s.progressBar}>
            <div style={{ ...s.progressFill, width: `${progressoMeta}%` }} />
          </div>
          <div style={s.kpiSub}>
            {faltaMeta > 0
              ? (diasUteisRestantes > 0
                  ? `${formatBRL(necessarioPorDia)}/dia em ${diasUteisRestantes}d`
                  : `falta ${formatBRL(faltaMeta)}`)
              : 'meta batida! 🎉'}
          </div>
        </div>
      </div>

      {/* ═══════ GRÁFICO 7 DIAS ═══════ */}
      {!contaNova && (
        <div style={s.chartCard}>
          <div style={s.chartHeader}>
            <div>
              <div style={s.chartTitle}>📈 Receita da semana</div>
              <div style={s.chartSub}>
                Total: <strong>{formatBRL(receita7Dias.reduce((s, d) => s + d.valor, 0))}</strong>
              </div>
            </div>
          </div>
          <BarChart data={receita7Dias} cor="#15803D" prefixo="R$ " height={90} />
        </div>
      )}

        </div>
        {/* Fim coluna 2 (KPIs + chart) */}

        {/* ═══════ COLUNA 3 - AÇÕES RÁPIDAS ═══════ */}
        {!contaNova && (
          <div className="home-col-actions">
            <div style={s.quickActions}>
              <div style={s.sectionTitle}>⚡ ações rápidas</div>
              <button style={{ ...s.qaBtn, ...s.qaBtnPink }} onClick={() => navigate('/app/agenda')}>
                <div style={{ ...s.qaIcon, background: 'rgba(255,255,255,0.2)' }}><Plus size={16} color="white" /></div>
                <span>Novo agendamento</span>
                <ChevronRight size={16} style={{ marginLeft: 'auto', opacity: 0.7 }} />
              </button>
              <button style={{ ...s.qaBtn, ...s.qaBtnLight }} onClick={() => navigate('/app/clientes')}>
                <div style={{ ...s.qaIcon, background: 'var(--pink-light)' }}><UserPlus size={16} color="var(--pink)" /></div>
                <span>Nova cliente</span>
                <ChevronRight size={16} style={{ marginLeft: 'auto', opacity: 0.5 }} />
              </button>
              <button style={{ ...s.qaBtn, ...s.qaBtnLight }} onClick={() => navigate('/app/lembretes')}>
                <div style={{ ...s.qaIcon, background: '#DCFCE7' }}><MessageCircle size={16} color="#15803D" /></div>
                <span>Enviar lembretes</span>
                <ChevronRight size={16} style={{ marginLeft: 'auto', opacity: 0.5 }} />
              </button>
              <button style={{ ...s.qaBtn, ...s.qaBtnLight }} onClick={() => navigate('/app/financeiro')}>
                <div style={{ ...s.qaIcon, background: '#FEF3C7' }}><DollarSign size={16} color="#D97706" /></div>
                <span>Ver financeiro</span>
                <ChevronRight size={16} style={{ marginLeft: 'auto', opacity: 0.5 }} />
              </button>
            </div>
          </div>
        )}

      </div>
      )}
      {/* ════ Fim do grid 3 colunas ════ */}

      <button className="fab-btn" onClick={() => navigate('/app/agenda')} aria-label="Novo agendamento">
        <Plus size={22} color="white" />
      </button>
    </div>
  )
}

// Placeholder visual enquanto o dashboard carrega — espelha o layout real
// (lista de atendimentos + KPIs + gráfico) pra evitar "pulo" de conteúdo.
function HomeSkeleton() {
  return (
    <div className="home-grid">
      <div className="home-col-main">
        <Skeleton width={160} height={12} style={{ marginBottom: 12 }} />
        {[0, 1, 2].map(i => (
          <div key={i} style={{ ...s.apptCard, borderLeftColor: 'var(--border)', cursor: 'default' }}>
            <Skeleton width={44} height={28} borderRadius={7} />
            <div style={{ flex: 1 }}>
              <Skeleton width="55%" height={13} />
              <div style={{ height: 6 }} />
              <Skeleton width="35%" height={10} />
            </div>
            <Skeleton width={64} height={20} borderRadius={10} />
          </div>
        ))}
      </div>

      <div className="home-col-side">
        <div style={s.grid}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{ ...s.kpi, cursor: 'default' }}>
              <Skeleton width={26} height={26} borderRadius={8} style={{ marginBottom: 8 }} />
              <Skeleton width="50%" height={10} style={{ marginBottom: 6 }} />
              <Skeleton width="70%" height={18} />
            </div>
          ))}
        </div>
        <div style={{ ...s.chartCard, marginTop: 12 }}>
          <Skeleton width={140} height={13} style={{ marginBottom: 12 }} />
          <Skeleton width="100%" height={90} borderRadius={8} />
        </div>
      </div>

      <div className="home-col-actions">
        <div style={s.quickActions}>
          <Skeleton width={110} height={12} style={{ marginBottom: 4 }} />
          {[0, 1, 2, 3].map(i => (
            <Skeleton key={i} width="100%" height={42} borderRadius={12} />
          ))}
        </div>
      </div>
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
  qaBtnPink: { background: 'linear-gradient(135deg, var(--pink) 0%, var(--pink-bright) 100%)', color: 'white', boxShadow: 'var(--shadow-pink)' },
  qaBtnLight: { background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' },

  /* ─── Insights ─── */
  insights: { display: 'flex', flexDirection: 'column', gap: 8 },
  insight: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid', boxShadow: 'var(--shadow-xs)' },
  insightTitle: { fontSize: 13, fontWeight: 600 },
  insightSub: { fontSize: 11, marginTop: 2, opacity: 0.85 },

  /* ─── Atendimentos ─── */
  verTodosBtn: { width: '100%', background: 'transparent', border: '1px dashed var(--border2)', borderRadius: 'var(--radius-sm)', padding: '10px', fontSize: 12, color: 'var(--text2)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginTop: 4 },
  apptCard: { background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: '4px solid var(--green)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', boxShadow: 'var(--shadow-sm)', marginBottom: 7 },
  apptTimeBadge: { fontFamily: "'JetBrains Mono', monospace", fontWeight: 500, fontSize: 13, color: 'var(--text)', minWidth: 44, background: 'var(--surface2)', borderRadius: 7, padding: '4px 7px', textAlign: 'center', flexShrink: 0 },
  apptName: { fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  apptService: { fontSize: 11, color: 'var(--text3)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  badge: { fontSize: 11, padding: '3px 10px', borderRadius: 'var(--radius-pill)', fontWeight: 600 },
  emptyDay: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' },
  emptyBtn: { background: 'var(--pink)', color: 'white', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' },

  /* ─── Chip pedidos do link público ─── */
  pedidoChip: { display: 'flex', alignItems: 'center', gap: 12, background: 'linear-gradient(135deg, var(--pink) 0%, var(--pink-bright) 100%)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', marginBottom: 14, cursor: 'pointer', boxShadow: 'var(--shadow-pink)' },
  pedidoChipIcon: { width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  pedidoChipTitle: { fontSize: 13, fontWeight: 700, color: 'white' },
  pedidoChipSub: { fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 1 },

  /* ─── Chip lembretes ─── */
  lembreteChip: { display: 'flex', alignItems: 'center', gap: 12, background: 'linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%)', border: '1px solid #FCD34D', borderRadius: 'var(--radius-sm)', padding: '12px 14px', marginBottom: 14, cursor: 'pointer', boxShadow: 'var(--shadow-sm)' },
  lembreteChipIcon: { width: 34, height: 34, borderRadius: '50%', background: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  lembreteChipTitle: { fontSize: 13, fontWeight: 700, color: '#7C2D12' },
  lembreteChipSub: { fontSize: 11, color: '#9A3412', marginTop: 1 },

  /* ─── Chip contas a pagar ─── */
  contaChip: { display: 'flex', alignItems: 'center', gap: 12, background: 'linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%)', border: '1px solid #FCA5A5', borderRadius: 'var(--radius-sm)', padding: '12px 14px', marginBottom: 14, cursor: 'pointer', boxShadow: 'var(--shadow-sm)' },
  contaChipIcon: { width: 34, height: 34, borderRadius: '50%', background: '#B91C1C', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  contaChipTitle: { fontSize: 13, fontWeight: 700, color: '#7F1D1D' },
  contaChipSub: { fontSize: 11, color: '#991B1B', marginTop: 1 },

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
