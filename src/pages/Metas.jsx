import { useEffect, useState } from 'react'
import { TrendingUp, Plus, X, Target, Pencil, DollarSign, Zap, Users, BarChart2, Ban, UserCheck, Gauge, Award, Calendar, Info, ChevronRight, Sparkles, CalendarCheck, Banknote } from 'lucide-react'
import WaIcon from '../components/common/WaIcon'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useSalao } from '../contexts/SalaoContext'
import { useToast } from '../contexts/ToastContext'
import { useAssinatura } from '../contexts/AssinaturaContext'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ProBadge } from '../components/common/UpgradeBlock'
import Modal from '../components/common/Modal'
import { inputBase, labelBase, btnPrimaryBase, btnSecondaryBase } from '../lib/ui'
import { formatBRL, linkWhatsApp } from '../lib/formatters'
import { MSG_RETORNO_PADRAO, MSG_REAGENDAR_PADRAO, MSG_SINAL_PADRAO, aplicarVariaveis } from '../lib/mensagens'
import { DIAS_RETORNO_PADRAO } from '../lib/constants'
import { carregarRecap } from '../lib/recapMensal'
import { traduzErro } from '../lib/erros'
import {
  format, endOfMonth, startOfMonth, subMonths, subDays, addMonths, eachDayOfInterval, getDay, parseISO, differenceInDays
} from 'date-fns'
import { ptBR } from 'date-fns/locale'

const DIAS_UTEIS_PADRAO = [1, 2, 3, 4, 5]

// Textos das explicações dos indicadores (abrem no ⓘ ao lado de cada título).
const INFO_INDICADORES = {
  ativas: {
    titulo: 'Ativas vs. retorno pendente',
    oque: 'Quantas das suas clientes ainda estão voltando (ativas) e quantas estão com o retorno pendente (passaram do prazo de voltar).',
    como: 'Olhamos a última visita de cada cliente. Voltou dentro do ciclo de retorno dela (individual ou o padrão do salão) → ativa. Passou do prazo → retorno pendente. Quem nunca foi atendida fica de fora. Taxa = ativas ÷ (ativas + pendentes).',
    fazer: 'Muita gente com retorno pendente é dinheiro andando na rua — toque no número pra ver quem e chamar de volta no WhatsApp.',
  },
  novas: {
    titulo: 'Novas clientes',
    oque: 'Quantas clientes novas entraram, mês a mês, nos últimos 6 meses.',
    como: 'Contamos quantas clientes foram cadastradas em cada mês.',
    fazer: 'Veja se sua divulgação e o link de agendamento estão trazendo gente nova; meses em queda pedem reforço.',
    nota: 'Esse não muda com o seletor de período — é sempre os últimos 6 meses.',
  },
  cancelamentos: {
    titulo: 'Cancelamentos',
    oque: 'Dos horários que aconteceram ou foram cancelados, quantos % foram cancelados.',
    como: 'Cancelados ÷ (realizados + cancelados) no período.',
    fazer: 'Acima de uns 15%, vale reforçar o lembrete e a confirmação por link.',
    nota: 'Só conta o que você marca como "cancelado" na agenda.',
  },
  ocupacao: {
    titulo: 'Ocupação da agenda',
    oque: 'O quanto da sua agenda disponível foi realmente usada no período.',
    como: 'Sua jornada (início até o fim) ÷ duração padrão do atendimento = vagas por dia. Multiplicamos pelos seus dias de trabalho no período. "Usados" são os atendimentos realizados. Ocupação = usados ÷ vagas.',
    fazer: 'Abaixo de 60%, tem espaço — hora de puxar cliente. Acima de 85%, quase lotada — pense em preço ou equipe.',
    aviso: 'É uma estimativa: usa uma duração só e não desconta folgas nem bloqueios.',
  },
  profissional: {
    titulo: 'Atendimentos por profissional',
    oque: 'Quanto cada profissional faturou e quantos atendimentos fez no período.',
    como: 'Somamos o dinheiro recebido (pagamentos pagos) e contamos os atendimentos realizados de cada uma. Sem profissional definido aparece como "Não atribuído".',
    fazer: 'Enxergar quem puxa o faturamento — base pra escala e pra comissão no futuro.',
  },
}

// 'HH:MM:SS' → minutos desde a meia-noite
function horaParaMin(h) {
  if (!h) return 0
  const [hh, mm] = h.split(':')
  return parseInt(hh) * 60 + (parseInt(mm) || 0)
}

export default function Metas() {
  const { user } = useAuth()
  const { salaoId, gerenciaTudo } = useSalao()
  const { confirmar, sucesso, erro: toastErro } = useToast()
  const { temAcesso, plano } = useAssinatura()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const tabInicial = searchParams.get('tab') === 'indicadores' ? 'kpis'
    : searchParams.get('tab') === 'recap' ? 'recap' : 'metas'
  const [tab, setTab] = useState(tabInicial)

  // ── Metas ───────────────────────────────────────────
  const [metas, setMetas] = useState([])
  const [progressos, setProgressos] = useState({})
  const [diasFuncionamento, setDiasFuncionamento] = useState(DIAS_UTEIS_PADRAO)
  const [mesFiltro, setMesFiltro] = useState(format(new Date(), 'yyyy-MM'))
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState({ tipo: 'mes', periodo: format(new Date(), 'yyyy-MM'), valor_meta: '' })
  const [saving, setSaving] = useState(false)

  // ── KPIs ─────────────────────────────────────────────
  // Períodos dos indicadores de agenda/equipe (sem seletor):
  // - Cancelamentos: janela móvel de 45 dias (não "some" quem cancelou no fim do mês).
  // - Ocupação e por profissional: mês-calendário (1º do mês até hoje).
  const DIAS_CANCELAMENTO = 45
  const [cfg, setCfg] = useState(null)
  const [atividade, setAtividade] = useState(null)
  const [novasClientes, setNovasClientes] = useState([])
  const [cancelamento, setCancelamento] = useState(null)
  const [ocupacao, setOcupacao] = useState(null)
  const [porProfissional, setPorProfissional] = useState([])
  const [novasListaPorMes, setNovasListaPorMes] = useState({})
  const [infoAberto, setInfoAberto] = useState(null)    // qual explicação está aberta
  const [drill, setDrill] = useState(null)              // lista detalhada aberta (quem)
  const [loadingKpi, setLoadingKpi] = useState(false)   // carga inicial (todos)
  const [recap, setRecap] = useState(null)              // recap "Meu mês"
  const [loadingRecap, setLoadingRecap] = useState(false)

  useEffect(() => { if (salaoId) { loadConfig(); loadMetas() } }, [salaoId])
  useEffect(() => {
    if (!salaoId || tab !== 'recap') return
    loadRecap()
  }, [salaoId, tab, mesFiltro])
  useEffect(() => {
    if (!salaoId || tab !== 'kpis') return
    if (temAcesso('relatoriosAvancados')) loadKpis()
  }, [salaoId, tab])

  // Abre o modal de cancelamentos automaticamente quando vier da Home com ?modal=cancel
  useEffect(() => {
    if (cancelamento && searchParams.get('modal') === 'cancel') {
      setDrill({ tipo: 'cancel' })
    }
  }, [cancelamento])


  // ── Config ────────────────────────────────────────────
  async function loadConfig() {
    const { data } = await supabase.from('configuracoes')
      .select('dias_semana, dias_retorno_alerta, horario_inicio, horario_fim, duracao_atendimento, nome_salao, msg_retorno, msg_reagendar, msg_sinal, chave_pix')
      .eq('salao_id', salaoId).maybeSingle()
    if (data?.dias_semana?.length) setDiasFuncionamento(data.dias_semana)
    setCfg(data || null)
    return data
  }

  // ── Metas ─────────────────────────────────────────────
  async function loadMetas() {
    const { data, error } = await supabase.from('metas').select('*').eq('salao_id', salaoId).order('created_at', { ascending: false })
    if (error) { toastErro(traduzErro(error, 'Não foi possível carregar as metas.')); return }
    setMetas(data || [])
    if (!data?.length) { setProgressos({}); return }
    // 1 só consulta: busca todos os pagamentos pagos no intervalo que cobre todas as metas
    // (em vez de 1 consulta por meta) e soma cada meta no cliente.
    // Limita ao dia de hoje — não existe faturamento "realizado" no futuro.
    const hojeStr = format(new Date(), 'yyyy-MM-dd')
    let minIni = null, maxFim = null
    data.forEach(meta => {
      const { inicio, fim } = periodoMeta(meta)
      if (!minIni || inicio < minIni) minIni = inicio
      if (!maxFim || fim > maxFim) maxFim = fim
    })
    if (maxFim > hojeStr) maxFim = hojeStr
    const pros = {}
    if (minIni && maxFim && minIni <= maxFim) {
      const { data: pags, error: pagsErr } = await supabase.from('pagamentos')
        .select('valor, data').eq('salao_id', salaoId).eq('status', 'pago')
        .gte('data', minIni).lte('data', maxFim).limit(5000)
      if (pagsErr) { toastErro(traduzErro(pagsErr, 'Não foi possível calcular o progresso das metas.')); return }
      data.forEach(meta => {
        const { inicio, fim } = periodoMeta(meta)
        const fimReal = fim > hojeStr ? hojeStr : fim
        pros[meta.id] = (pags || []).reduce(
          (s, p) => (p.data >= inicio && p.data <= fimReal ? s + (p.valor || 0) : s), 0)
      })
    }
    setProgressos(pros)
  }

  function periodoMeta(meta) {
    if (meta.tipo === 'mes') {
      const [a, m] = meta.periodo.split('-')
      const inicio = `${a}-${m}-01`
      const fim = format(endOfMonth(new Date(parseInt(a), parseInt(m) - 1)), 'yyyy-MM-dd')
      return { inicio, fim, inicioDate: new Date(parseInt(a), parseInt(m) - 1, 1), fimDate: endOfMonth(new Date(parseInt(a), parseInt(m) - 1)) }
    }
    if (meta.tipo === 'ano') {
      return { inicio: `${meta.periodo}-01-01`, fim: `${meta.periodo}-12-31`, inicioDate: new Date(parseInt(meta.periodo), 0, 1), fimDate: new Date(parseInt(meta.periodo), 11, 31) }
    }
    return { inicio: meta.periodo, fim: meta.periodo, inicioDate: new Date(meta.periodo + 'T12:00:00'), fimDate: new Date(meta.periodo + 'T12:00:00') }
  }

  function calcularProjecao(meta, realizado) {
    const { inicioDate, fimDate } = periodoMeta(meta)
    const hoje = new Date()
    const fimReal = hoje > fimDate ? fimDate : hoje
    const todosDias = eachDayOfInterval({ start: inicioDate, end: fimDate })
    const diasUteisTotal = todosDias.filter(d => diasFuncionamento.includes(getDay(d))).length
    if (fimReal < inicioDate) return 0
    const diasAteAgora = eachDayOfInterval({ start: inicioDate, end: fimReal })
    const diasUteisTrabalhados = diasAteAgora.filter(d => diasFuncionamento.includes(getDay(d))).length
    if (diasUteisTrabalhados === 0 || diasUteisTotal === 0) return 0
    return (realizado / diasUteisTrabalhados) * diasUteisTotal
  }

  function dadosPeriodoAtual(meta) {
    const { inicioDate, fimDate } = periodoMeta(meta)
    const hoje = new Date()
    const todosDias = eachDayOfInterval({ start: inicioDate, end: fimDate })
    const diasUteisTotal = todosDias.filter(d => diasFuncionamento.includes(getDay(d))).length
    const fimReal = hoje > fimDate ? fimDate : (hoje < inicioDate ? inicioDate : hoje)
    const diasAteAgora = fimReal >= inicioDate ? eachDayOfInterval({ start: inicioDate, end: fimReal }) : []
    const diasUteisTrabalhados = diasAteAgora.filter(d => diasFuncionamento.includes(getDay(d))).length
    return { diasUteisTotal, diasUteisTrabalhados, diasUteisRestantes: Math.max(0, diasUteisTotal - diasUteisTrabalhados) }
  }

  async function salvarMeta() {
    if (!form.valor_meta || parseFloat(form.valor_meta) <= 0) { toastErro('Informe um valor válido'); return }
    // Evita criar duas metas para o mesmo período (uma só por tipo/período).
    if (!editando && metas.some(m => m.tipo === form.tipo && m.periodo === form.periodo)) {
      toastErro('Já existe uma meta para este período. Edite a meta existente.'); return
    }
    setSaving(true)
    const dados = { user_id: user.id, salao_id: salaoId, tipo: form.tipo, periodo: form.periodo, valor_meta: parseFloat(form.valor_meta) }
    const resp = editando
      ? await supabase.from('metas').update(dados).eq('id', editando.id).eq('salao_id', salaoId)
      : await supabase.from('metas').insert(dados)
    setSaving(false)
    if (resp.error) { toastErro(traduzErro(resp.error, 'Não foi possível salvar a meta.')); return }
    sucesso(editando ? 'Meta atualizada ✓' : 'Meta criada ✓')
    fecharModal(); loadMetas()
  }

  function abrirModalNova() {
    setEditando(null)
    setForm({ tipo: 'mes', periodo: mesFiltro, valor_meta: '' })
    setShowModal(true)
  }

  function abrirModalEdicao(meta) {
    setEditando(meta)
    setForm({ tipo: meta.tipo, periodo: meta.periodo, valor_meta: String(meta.valor_meta) })
    setShowModal(true)
  }

  function fecharModal() {
    setShowModal(false); setEditando(null)
    setForm({ tipo: 'mes', periodo: format(new Date(), 'yyyy-MM'), valor_meta: '' })
  }

  async function excluirMeta(meta) {
    const ok = await confirmar({
      titulo: 'Excluir esta meta?',
      mensagem: `${labelTipo(meta.tipo)} de ${labelPeriodo(meta)} - ${formatBRL(meta.valor_meta)}`,
      confirmarLabel: 'Sim, excluir', cancelarLabel: 'Cancelar', tipo: 'perigo',
    })
    if (!ok) return
    const metaAnterior = meta
    const { error } = await supabase.from('metas').delete().eq('id', meta.id).eq('salao_id', salaoId)
    if (error) { toastErro(traduzErro(error, 'Não foi possível excluir a meta.')); return }
    setMetas(m => m.filter(x => x.id !== meta.id))
    sucesso('Meta excluída', {
      duracao: 5000, acaoLabel: 'Desfazer',
      acao: async () => {
        const { tipo, periodo, valor_meta } = metaAnterior
        await supabase.from('metas').insert({ tipo, periodo, valor_meta, user_id: user.id, salao_id: salaoId })
        loadMetas()
      },
    })
  }

  function labelTipo(tipo) {
    return tipo === 'mes' ? 'Meta mensal' : tipo === 'ano' ? 'Meta anual' : 'Meta semanal'
  }

  function labelPeriodo(meta) {
    if (meta.tipo === 'mes') {
      const [a, m] = meta.periodo.split('-')
      return format(new Date(parseInt(a), parseInt(m) - 1), 'MMMM yyyy', { locale: ptBR })
    }
    if (meta.tipo === 'ano') return meta.periodo
    return `Semana ${meta.periodo}`
  }

  // ── KPIs — funções isoladas ───────────────────────────

  // 1. Clientes ativas vs. sumidas (substitui a antiga "taxa de retenção").
  // Ativa = último atendimento dentro do ciclo de retorno da cliente
  // (clientes.dias_retorno, ou o padrão do salão em configuracoes.dias_retorno_alerta).
  // Clientes nunca atendidas não entram na base.
  async function loadAtividade(cfgParam) {
    const cicloPadrao = (cfgParam ?? cfg)?.dias_retorno_alerta || DIAS_RETORNO_PADRAO
    const hojeStr = format(new Date(), 'yyyy-MM-dd')
    const [{ data: cls }, { data: futuros }] = await Promise.all([
      supabase.from('clientes')
        .select('id, nome, telefone, ultimo_atendimento, dias_retorno')
        .eq('salao_id', salaoId).eq('arquivada', false),
      supabase.from('agendamentos').select('cliente_id')
        .eq('salao_id', salaoId)
        .in('status', ['pendente', 'agendado', 'confirmado'])
        .gte('data', hojeStr),
    ])
    if (!cls) return
    const comFuturo = new Set((futuros || []).map(a => a.cliente_id))
    const hoje = new Date()
    let ativas = 0
    const sumidasLista = []
    cls.forEach(c => {
      if (!c.ultimo_atendimento) return // nunca atendida — fora da base
      const ciclo = c.dias_retorno || cicloPadrao
      const dias = differenceInDays(hoje, parseISO(c.ultimo_atendimento))
      // Pendente quando ATINGE o ciclo (>=), igual à Home (Oportunidades) e à
      // lista de Clientes (estaSumida). "Chegou o dia de voltar = já é retorno".
      if (dias < ciclo || comFuturo.has(c.id)) ativas++
      else sumidasLista.push({ id: c.id, nome: c.nome, telefone: c.telefone, ultimo: c.ultimo_atendimento, dias })
    })
    sumidasLista.sort((a, b) => b.dias - a.dias) // quem sumiu há mais tempo primeiro
    const sumidas = sumidasLista.length
    const base = ativas + sumidas
    setAtividade({ ativas, sumidas, taxa: base > 0 ? Math.round((ativas / base) * 100) : 0, sumidasLista })
  }

  // 4. Taxa de cancelamento (últimos 45 dias — janela móvel — + config). Além do número,
  // separa quem cancelou em dois grupos: "cancelou e sumiu" (passou do ciclo de
  // retorno E sem horário futuro marcado = perda real) vs "cancelou, mas está ok"
  // (voltou depois ou tem horário marcado).
  async function loadCancelamento(cfgParam) {
    const c = cfgParam ?? cfg
    const cicloPadrao = c?.dias_retorno_alerta || DIAS_RETORNO_PADRAO
    const hoje = new Date()
    const hojeStr = format(hoje, 'yyyy-MM-dd')
    const inicio = format(subDays(hoje, DIAS_CANCELAMENTO), 'yyyy-MM-dd')
    const { data } = await supabase
      .from('agendamentos')
      .select('status, data, servico, clientes(id, nome, telefone)')
      .eq('salao_id', salaoId)
      .in('status', ['realizado', 'cancelado'])
      .gte('data', inicio)
    if (!data) return
    let realizados = 0, cancelados = 0
    const porCliente = {}
    data.forEach(a => {
      if (a.status !== 'cancelado') { realizados++; return }
      cancelados++
      const cli = a.clientes
      const key = cli?.id || `s/cad:${a.data}`
      if (!porCliente[key]) porCliente[key] = { id: cli?.id || null, nome: cli?.nome || 'Sem cadastro', telefone: cli?.telefone, qtd: 0, ultima: a.data }
      porCliente[key].qtd += 1
      if (a.data > porCliente[key].ultima) porCliente[key].ultima = a.data
    })
    const cancellers = Object.values(porCliente)
    const total = realizados + cancelados

    // Cruzamento preciso: retorno pendente (último atendimento) + horário futuro
    const ids = cancellers.map(x => x.id).filter(Boolean)
    const clientesById = {}, proximo = {}
    if (ids.length) {
      const [{ data: cls }, { data: fut }] = await Promise.all([
        supabase.from('clientes').select('id, ultimo_atendimento, dias_retorno').in('id', ids),
        supabase.from('agendamentos').select('cliente_id, data, horario').eq('salao_id', salaoId)
          .in('status', ['pendente', 'confirmado']).gte('data', hojeStr).in('cliente_id', ids),
      ])
      ;(cls || []).forEach(cl => { clientesById[cl.id] = cl })
      // guarda o PRÓXIMO horário (mais cedo) de cada cliente
      ;(fut || []).forEach(f => {
        if (!f.cliente_id) return
        const cur = proximo[f.cliente_id]
        if (!cur || f.data < cur.data || (f.data === cur.data && (f.horario || '') < (cur.horario || ''))) {
          proximo[f.cliente_id] = { data: f.data, horario: f.horario }
        }
      })
    }

    const sumiram = [], ok = []
    cancellers.forEach(x => {
      const cl = x.id ? clientesById[x.id] : null
      const ua = cl?.ultimo_atendimento
      const ciclo = cl?.dias_retorno || cicloPadrao
      const dias = ua ? differenceInDays(hoje, parseISO(ua)) : null
      const pendente = dias != null && dias >= ciclo
      const voltouRecente = !!ua && !pendente
      const fut = x.id ? proximo[x.id] : null
      // Perda = sem horário futuro E (passou do ciclo OU nunca foi atendida).
      if (fut) ok.push({ ...x, tipo: 'reagendou', futData: fut.data, futHora: fut.horario })
      else if (voltouRecente) ok.push({ ...x, tipo: 'voltou', ultimo: ua })
      else sumiram.push({ ...x, dias, nunca: !ua })
    })
    sumiram.sort((a, b) => (b.dias ?? -1) - (a.dias ?? -1))
    ok.sort((a, b) => (b.qtd - a.qtd) || (a.ultima < b.ultima ? 1 : -1))

    setCancelamento({ taxa: total > 0 ? Math.round((cancelados / total) * 100) : 0, cancelados, total, sumiram, ok })
  }

  // 5. Ocupação da agenda (mês-calendário atual + config). Estimativa:
  // vagas = dias úteis trabalhados × (jornada ÷ duração média do atendimento).
  async function loadOcupacao(cfgParam) {
    const c = cfgParam ?? cfg
    const inicioDate = startOfMonth(new Date())
    const hoje = new Date()
    const inicio = format(inicioDate, 'yyyy-MM-dd')
    const hojeStr = format(hoje, 'yyyy-MM-dd')
    const dur = c?.duracao_atendimento || 60
    const jornada = horaParaMin(c?.horario_fim || '18:00:00') - horaParaMin(c?.horario_inicio || '09:00:00')
    const slotsDia = Math.max(0, Math.floor(jornada / dur))
    const diasSemana = c?.dias_semana?.length ? c.dias_semana : diasFuncionamento
    // Quantos de cada dia-da-semana há no período (só dias trabalhados)
    const contagemPorDow = {}
    eachDayOfInterval({ start: inicioDate, end: hoje }).forEach(d => {
      const dow = getDay(d)
      if (diasSemana.includes(dow)) contagemPorDow[dow] = (contagemPorDow[dow] || 0) + 1
    })
    const { data: ags } = await supabase
      .from('agendamentos')
      .select('data')
      .eq('salao_id', salaoId)
      .eq('status', 'realizado')
      .gte('data', inicio)
      .lte('data', hojeStr)
    const usadasPorDow = {}
    ;(ags || []).forEach(a => { const dow = getDay(parseISO(a.data)); usadasPorDow[dow] = (usadasPorDow[dow] || 0) + 1 })
    const NOMES_DOW = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
    let vagas = 0, usadas = 0
    const porDia = []
    Object.keys(contagemPorDow).map(Number).forEach(dow => {
      const v = slotsDia * contagemPorDow[dow]
      const u = usadasPorDow[dow] || 0
      vagas += v; usadas += u
      porDia.push({ dow, label: NOMES_DOW[dow], vagas: v, usadas: u, livres: Math.max(0, v - u), taxa: v > 0 ? Math.round((u / v) * 100) : 0 })
    })
    porDia.sort((a, b) => a.taxa - b.taxa) // dia mais vazio primeiro
    setOcupacao({ taxa: vagas > 0 ? Math.round((usadas / vagas) * 100) : 0, usadas, vagas, porDia })
  }

  // 6. Desempenho por profissional (só plano Salão; mês-calendário atual)
  async function loadPorProfissional() {
    if (plano?.id !== 'salao') { setPorProfissional([]); return }
    const inicio = format(startOfMonth(new Date()), 'yyyy-MM-dd')
    const [{ data: ags }, { data: membros }] = await Promise.all([
      supabase.from('agendamentos')
        .select('profissional_id, data, servico, pagamentos(valor, status), clientes(nome)')
        .eq('salao_id', salaoId).eq('status', 'realizado').gte('data', inicio),
      supabase.from('salao_membros').select('id, nome').eq('salao_id', salaoId),
    ])
    if (!ags) return
    const nomePorId = {}
    ;(membros || []).forEach(mb => { nomePorId[mb.id] = mb.nome || 'Sem nome' })
    const grouped = {}
    ags.forEach(a => {
      const pag = a.pagamentos?.find(p => p.status === 'pago')
      const val = pag?.valor || 0
      const key = a.profissional_id || '__sem__'
      if (!grouped[key]) grouped[key] = { valor: 0, qtd: 0, atendimentos: [] }
      grouped[key].valor += val
      grouped[key].qtd += 1
      grouped[key].atendimentos.push({ nome: a.clientes?.nome || 'Cliente', data: a.data, servico: a.servico, valor: val })
    })
    const lista = Object.entries(grouped)
      .map(([id, v]) => ({ id, nome: id === '__sem__' ? 'Não atribuído' : (nomePorId[id] || 'Profissional'), ...v }))
      .sort((a, b) => b.valor - a.valor)
    lista.forEach(p => p.atendimentos.sort((a, b) => (a.data < b.data ? 1 : -1)))
    setPorProfissional(lista)
  }

  // 3. Novas clientes por mês (estático — sempre últimos 6 meses).
  // Guarda também a lista de quem entrou em cada mês (pra abrir ao clicar na barra).
  async function loadNovasKpi() {
    const { data: cls } = await supabase
      .from('clientes')
      .select('id, nome, created_at')
      .eq('salao_id', salaoId)
    if (cls) {
      const byMonth = {}
      const listaPorMes = {}
      cls.forEach(c => {
        const mes = format(new Date(c.created_at), 'yyyy-MM')
        byMonth[mes] = (byMonth[mes] || 0) + 1
        if (!listaPorMes[mes]) listaPorMes[mes] = []
        listaPorMes[mes].push({ id: c.id, nome: c.nome })
      })
      const months = []
      for (let i = 5; i >= 0; i--) {
        const d = subMonths(new Date(), i)
        const key = format(d, 'yyyy-MM')
        months.push({ key, label: format(d, 'MMM/yy', { locale: ptBR }), qtd: byMonth[key] || 0 })
      }
      Object.values(listaPorMes).forEach(l => l.sort((a, b) => (a.nome || '').localeCompare(b.nome || '')))
      setNovasClientes(months)
      setNovasListaPorMes(listaPorMes)
    }
  }

  // Recap "Meu mês" — usa o mês selecionado no seletor.
  async function loadRecap() {
    setLoadingRecap(true)
    try {
      const r = await carregarRecap(supabase, { salaoId, gerenciaTudo, mesDate: new Date(mesFiltro + '-02') })
      setRecap(r)
    } catch (e) {
      toastErro('Não foi possível carregar o resumo do mês.')
    }
    setLoadingRecap(false)
  }

  // Carga completa (entrada na tab)
  async function loadKpis() {
    setLoadingKpi(true)
    const cfgData = await loadConfig()
    await Promise.all([
      loadAtividade(cfgData), loadNovasKpi(),
      loadCancelamento(cfgData), loadOcupacao(cfgData), loadPorProfissional(),
    ])
    setLoadingKpi(false)
  }

  const maxNovas = novasClientes.length > 0 ? Math.max(...novasClientes.map(m => m.qtd), 1) : 1
  const maxProf = porProfissional.length > 0 ? Math.max(porProfissional[0].valor, 1) : 1
  const labelCancelamento = `Últimos ${DIAS_CANCELAMENTO} dias`
  const labelMesAtual = 'Este mês'

  // Botãozinho ⓘ ao lado do título de cada indicador
  const infoBtn = (chave) => (
    <button style={s.infoBtn} onClick={() => setInfoAberto(chave)} aria-label="O que é isso?" title="O que é isso?">
      <Info size={13} />
    </button>
  )

  // Mensagens prontas pra ação no WhatsApp (reaproveitam os textos das Configurações)
  const msgRetorno = (nome) => aplicarVariaveis(cfg?.msg_retorno || MSG_RETORNO_PADRAO, { nome, salao: cfg?.nome_salao || '' })
  const msgReagendar = (nome) => aplicarVariaveis(cfg?.msg_reagendar || MSG_REAGENDAR_PADRAO, { nome, salao: cfg?.nome_salao || '' })
  const msgSinal = (nome) => aplicarVariaveis(cfg?.msg_sinal || MSG_SINAL_PADRAO, { nome, salao: cfg?.nome_salao || '', pix: cfg?.chave_pix || '' })
  const ddMM = (d) => format(new Date(d + 'T12:00:00'), 'dd/MM', { locale: ptBR })

  // Conteúdo do pop-up "quem" — varia conforme o indicador clicado.
  function renderDrill() {
    if (!drill) return null
    if (drill.tipo === 'sumidas') {
      const lista = atividade?.sumidasLista || []
      return (
        <>
          <div style={s.infoTitulo}>Clientes com retorno pendente</div>
          <div style={s.drillSub}>{lista.length} passaram do ciclo · de quem está há mais tempo sem voltar</div>
          <div style={s.drillLista}>
            {lista.map((c, i) => (
              <div key={i} style={s.drillItem}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={s.drillNome}>{c.nome}</div>
                  <div style={s.drillMeta}>Último atendimento em {format(new Date(c.ultimo + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}</div>
                  <div style={{ ...s.drillMeta, color: 'var(--pink)', fontWeight: 600 }}>Sem voltar há {c.dias} dias</div>
                </div>
                {c.telefone
                  ? <a style={s.waBtn} href={linkWhatsApp(c.telefone, msgRetorno(c.nome))} target="_blank" rel="noreferrer"><WaIcon size={13} /> Chamar</a>
                  : <span style={s.semTel}>sem telefone</span>}
              </div>
            ))}
          </div>
          <button style={s.btnSecondary} onClick={() => { setDrill(null); navigate('/app/clientes?filtro=sumidas') }}>Ver todas em Clientes</button>
        </>
      )
    }
    if (drill.tipo === 'cancel') {
      const sumiram = cancelamento?.sumiram || []
      const ok = cancelamento?.ok || []
      const tem = sumiram.length + ok.length
      return (
        <>
          <div style={s.infoTitulo}>Cancelamentos</div>
          {tem === 0 ? (
            <div style={s.drillSub}>Sem cancelamentos no período</div>
          ) : sumiram.length === 0 ? (
            <div style={s.okBanner}>🎉 Nenhuma perda — todas reagendaram ou voltaram</div>
          ) : (
            <div style={s.drillSub}>Das {tem} que cancelaram, {sumiram.length} não voltaram</div>
          )}

          {sumiram.length > 0 && (
            <>
              <div style={s.grupoTitulo}>⚠️ Cancelaram e não voltaram ({sumiram.length})</div>
              <div style={s.drillLista}>
                {sumiram.map((cl, i) => (
                  <div key={i} style={s.drillItem}>
                    <div onClick={() => { if (cl.id) { setDrill(null); navigate(`/app/clientes/${cl.id}`) } }} style={{ flex: 1, minWidth: 0, cursor: cl.id ? 'pointer' : 'default' }}>
                      <div style={s.drillNome}>{cl.nome}{cl.id && <ChevronRight size={12} color="var(--text3)" />}{cl.qtd >= 2 && <span style={s.tagReinc}>cancelou {cl.qtd}×</span>}</div>
                      <div style={s.drillMeta}>cancelou em {ddMM(cl.ultima)}</div>
                      <div style={{ ...s.drillMeta, color: 'var(--pink)', fontWeight: 600 }}>{cl.nunca ? 'não remarcou' : `Sem voltar há ${cl.dias} dias`}</div>
                    </div>
                    {cl.telefone && <a style={s.waBtn} href={linkWhatsApp(cl.telefone, msgReagendar(cl.nome))} target="_blank" rel="noreferrer"><WaIcon size={13} /> Chamar</a>}
                  </div>
                ))}
              </div>
            </>
          )}

          {ok.length > 0 && (
            <>
              <div style={{ ...s.grupoTitulo, marginTop: sumiram.length ? 16 : 4 }}>✅ Cancelaram, mas reagendaram ({ok.length})</div>
              <div style={s.drillLista}>
                {ok.map((cl, i) => (
                  <div key={i} style={s.drillItem}>
                    <div onClick={() => { if (cl.id) { setDrill(null); navigate(`/app/clientes/${cl.id}`) } }} style={{ flex: 1, minWidth: 0, cursor: cl.id ? 'pointer' : 'default' }}>
                      <div style={s.drillNome}>{cl.nome}{cl.id && <ChevronRight size={12} color="var(--text3)" />}{cl.qtd >= 2 && <span style={s.tagReinc}>cancelou {cl.qtd}×</span>}</div>
                      <div style={s.drillMeta}>
                        {cl.tipo === 'reagendou'
                          ? `reagendou: ${ddMM(cl.futData)}${cl.futHora ? ' às ' + cl.futHora.slice(0, 5) : ''}`
                          : cl.ultimo ? `voltou em ${ddMM(cl.ultimo)}` : 'sem retorno pendente'}
                      </div>
                    </div>
                    {cl.qtd >= 2 && cl.telefone && <a style={s.waBtnAmber} href={linkWhatsApp(cl.telefone, msgSinal(cl.nome))} target="_blank" rel="noreferrer"><WaIcon size={13} /> Pedir sinal</a>}
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )
    }
    if (drill.tipo === 'ocupacao') {
      const dias = ocupacao?.porDia || []
      return (
        <>
          <div style={s.infoTitulo}>Horários mais vazios</div>
          <div style={s.drillSub}>{labelMesAtual} · do dia mais vazio pro mais cheio</div>
          <div style={s.drillLista}>
            {dias.map((d, i) => {
              const cor = d.taxa >= 85 ? '#D97706' : d.taxa >= 60 ? 'var(--green)' : 'var(--pink)'
              const bg = d.taxa >= 85 ? '#FEF3C7' : d.taxa >= 60 ? 'var(--green-bg)' : 'var(--pink-light)'
              return (
                <div key={i} style={s.drillItem}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={s.drillNome}>{d.label}</div>
                    <div style={s.drillMeta}>{d.livres} de {d.vagas} vagas livres</div>
                  </div>
                  <span style={{ ...s.taxaPill, background: bg, color: cor }}>{d.taxa}% cheia</span>
                </div>
              )
            })}
          </div>
        </>
      )
    }
    if (drill.tipo === 'novas') {
      const lista = novasListaPorMes[drill.mes] || []
      return (
        <>
          <div style={s.infoTitulo}>Novas clientes</div>
          <div style={s.drillSub}>{drill.label} · {lista.length} cliente(s)</div>
          <div style={s.drillLista}>
            {lista.length === 0
              ? <div style={s.kpiEmpty}>Nenhuma cliente nova nesse mês</div>
              : lista.map(c => (
                <button key={c.id} style={s.drillItemBtn} onClick={() => { setDrill(null); navigate(`/app/clientes/${c.id}`) }}>
                  <span style={s.drillNome}>{c.nome}</span>
                  <ChevronRight size={15} color="var(--text3)" />
                </button>
              ))}
          </div>
        </>
      )
    }
    if (drill.tipo === 'prof') {
      const prof = porProfissional.find(p => p.id === drill.profId)
      const ats = prof?.atendimentos || []
      return (
        <>
          <div style={s.infoTitulo}>{prof?.nome || 'Profissional'}</div>
          <div style={s.drillSub}>{labelMesAtual} · {ats.length} atendimentos · {formatBRL(prof?.valor || 0)}</div>
          <div style={s.drillLista}>
            {ats.map((a, i) => (
              <div key={i} style={s.drillItem}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={s.drillNome}>{a.nome}</div>
                  <div style={s.drillMeta}>{ddMM(a.data)}{a.servico ? ` · ${a.servico}` : ''}</div>
                </div>
                <span style={s.drillValor}>{formatBRL(a.valor)}</span>
              </div>
            ))}
          </div>
        </>
      )
    }
    return null
  }

  // ── Navegação de mês ──────────────────────────────────
  function mesAnterior() {
    setMesFiltro(prev => format(subMonths(new Date(prev + '-02'), 1), 'yyyy-MM'))
  }
  function mesProximo() {
    setMesFiltro(prev => format(addMonths(new Date(prev + '-02'), 1), 'yyyy-MM'))
  }
  const labelMesFiltro = format(new Date(mesFiltro + '-02'), "MMMM 'de' yyyy", { locale: ptBR })
  const ehMesAtual = mesFiltro === format(new Date(), 'yyyy-MM')

  // Filtra metas pelo período selecionado
  const metasFiltradas = metas.filter(m => {
    if (m.tipo === 'mes') return m.periodo === mesFiltro
    if (m.tipo === 'ano') return m.periodo === mesFiltro.slice(0, 4)
    // semana/custom: verifica se o período começa com o ano-mês selecionado
    return (m.periodo || '').startsWith(mesFiltro)
  })

  return (
    <div style={s.page}>
      {/* Tab bar */}
      <div style={tabs.bar}>
        <button style={{ ...tabs.btn, ...(tab === 'metas' ? tabs.btnAtivo : {}) }} onClick={() => setTab('metas')}>
          <Target size={14} /> Metas
        </button>
        <button style={{ ...tabs.btn, ...(tab === 'kpis' ? tabs.btnAtivo : {}) }} onClick={() => setTab('kpis')}>
          <BarChart2 size={14} /> Indicadores
        </button>
        <button style={{ ...tabs.btn, ...(tab === 'recap' ? tabs.btnAtivo : {}) }} onClick={() => setTab('recap')}>
          <Sparkles size={14} /> Meu mês
        </button>
      </div>

      {/* ── TAB: METAS ─────────────────────────────────── */}
      {tab === 'metas' && (
        <>
          {/* Navegação de mês */}
          <div style={s.mesNav}>
            <button style={s.mesNavBtn} onClick={mesAnterior}>‹</button>
            <div style={s.mesNavLabel}>
              {labelMesFiltro}
              {ehMesAtual && <span style={s.mesAtualChip}>atual</span>}
            </div>
            <button style={s.mesNavBtn} onClick={mesProximo}>›</button>
          </div>

          {metasFiltradas.length === 0 && (
            <div style={s.empty}>
              <Target size={32} color="var(--text3)" style={{ marginBottom: 10 }} />
              <p style={{ color: 'var(--text3)', fontSize: 14 }}>Nenhuma meta para {labelMesFiltro}</p>
              <p style={{ color: 'var(--text3)', fontSize: 12, marginTop: 4 }}>Clique em + para criar uma meta para este mês</p>
            </div>
          )}
          {metasFiltradas.map(meta => {
            const realizado = progressos[meta.id] || 0
            const projecao = calcularProjecao(meta, realizado)
            const { diasUteisTotal, diasUteisTrabalhados, diasUteisRestantes } = dadosPeriodoAtual(meta)
            const pct = Math.min(100, Math.round((realizado / meta.valor_meta) * 100))
            const projecaoPct = Math.round((projecao / meta.valor_meta) * 100)
            const cor = pct >= 100 ? 'var(--green)' : pct >= 60 ? '#D97706' : 'var(--pink)'
            const bgCor = pct >= 100 ? 'var(--green-bg)' : pct >= 60 ? '#FEF3C7' : 'var(--pink-light)'
            const txtCor = pct >= 100 ? 'var(--green)' : pct >= 60 ? '#92400E' : 'var(--pink)'
            const projOnTrack = projecao >= meta.valor_meta
            return (
              <div key={meta.id} style={s.metaCard}>
                <div style={s.metaHeader}>
                  <div style={{ flex: 1 }}>
                    <div style={s.metaTipo}>{meta.tipo === 'mes' ? '📅' : meta.tipo === 'semana' ? '🗓' : '🎯'} {labelTipo(meta.tipo)}</div>
                    <div style={s.metaPeriodo}>{labelPeriodo(meta)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button style={s.iconBtn} onClick={() => abrirModalEdicao(meta)}><Pencil size={14} /></button>
                    <button style={s.iconBtn} onClick={() => excluirMeta(meta)}><X size={14} /></button>
                  </div>
                </div>
                <div className="meta-ind-grid" style={s.indicadoresGrid}>
                  <div className="meta-ind" style={s.indicador}>
                    <div className="meta-ind-label" style={s.indicadorLabel}><Target size={11} /> Meta</div>
                    <div style={{ ...s.indicadorValor, color: 'var(--text)' }}>{formatBRL(meta.valor_meta)}</div>
                  </div>
                  <div className="meta-ind" style={s.indicador}>
                    <div className="meta-ind-label" style={s.indicadorLabel}><DollarSign size={11} /> Realizado</div>
                    <div style={{ ...s.indicadorValor, color: cor }}>{formatBRL(realizado)}</div>
                  </div>
                  <div className="meta-ind" style={s.indicador}>
                    <div className="meta-ind-label" style={s.indicadorLabel}><Zap size={11} /> Projeção</div>
                    <div style={{ ...s.indicadorValor, color: projOnTrack ? 'var(--green)' : '#D97706' }}>{formatBRL(projecao)}</div>
                  </div>
                </div>
                <div style={s.metaValores}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--text3)' }}>
                    {diasUteisTrabalhados} de {diasUteisTotal} dias úteis · faltam {diasUteisRestantes}d
                  </span>
                  <span style={{ ...s.pctBadge, background: bgCor, color: txtCor }}>{pct}%</span>
                </div>
                <div style={s.barBg}>
                  <div style={{ ...s.barFill, width: `${pct}%`, background: cor }} />
                  {projecao > realizado && (
                    <div style={{ ...s.barProjFill, width: `${Math.min(100, projecaoPct)}%` }} />
                  )}
                </div>
                <div style={{ ...s.projecaoInsight, color: projOnTrack ? '#15803D' : '#9A3412', background: projOnTrack ? '#F0FDF4' : '#FEF3C7', borderColor: projOnTrack ? '#86EFAC' : '#FCD34D' }}>
                  <TrendingUp size={13} />
                  <span>
                    {projOnTrack
                      ? `📈 Você está no ritmo de bater a meta! Projetado: ${formatBRL(projecao)} (${projecaoPct}%)`
                      : diasUteisRestantes === 0
                        ? `Período encerrado. Faltaram ${formatBRL(Math.max(0, meta.valor_meta - realizado))} pra meta`
                        : `⚠️ Ritmo abaixo. Precisa de ${formatBRL((meta.valor_meta - realizado) / diasUteisRestantes)}/dia útil pra bater`}
                  </span>
                </div>
              </div>
            )
          })}
          <button className="fab-btn" onClick={abrirModalNova} aria-label="Nova meta">
            <Plus size={22} color="white" />
          </button>
        </>
      )}

      {/* ── TAB: INDICADORES ───────────────────────────── */}
      {tab === 'kpis' && (
        <>
          {!temAcesso('relatoriosAvancados') ? (
            <>
              {/* ── Teaser Pro ── */}
              <div style={s.secHead}>
                <span style={s.secHeadIcon}><Zap size={14} /></span>
                <span style={s.secHeadTitle}>Com o Pro você também vê</span>
                <span style={s.secHeadLine} />
              </div>
              <div style={{ ...s.kpiGrid, marginBottom: 16, opacity: 0.45, pointerEvents: 'none', filter: 'blur(1px)' }}>
                {['Clientes com retorno pendente', 'Taxa de cancelamento', 'Ocupação da agenda'].map(titulo => (
                  <div key={titulo} style={s.kpiCard}>
                    <div style={s.kpiCardTitle}><BarChart2 size={15} color="var(--text3)" /> {titulo}</div>
                    <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--text3)', lineHeight: 1, margin: '12px 0 4px' }}>–</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>·····</div>
                  </div>
                ))}
              </div>
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <button
                  onClick={() => navigate('/planos')}
                  style={{ background: 'var(--pink)', color: 'white', border: 'none', borderRadius: 'var(--radius-pill)', padding: '10px 24px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                >Ver plano Pro <ChevronRight size={14} style={{ verticalAlign: -2 }} /></button>
              </div>
            </>
          ) : loadingKpi ? (
            <div style={s.kpiGrid}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ ...s.kpiCard, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={s.skeletonTitle} />
                  <div style={s.skeletonLine} />
                  {[1, 2, 3, 4].map(j => (
                    <div key={j} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ ...s.skeletonLine, width: `${60 + j * 8}%` }} />
                      <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', width: `${80 - j * 10}%` }} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* ── Seção: Suas clientes ── */}
              <div style={s.secHead}>
                <span style={s.secHeadIcon}><Users size={14} /></span>
                <span style={s.secHeadTitle}>Suas clientes</span>
                <span style={s.secHeadLine} />
              </div>
              <div style={{ ...s.kpiGrid, marginBottom: 22 }}>
              {/* Clientes ativas vs. sumidas */}
              <div style={s.kpiCard}>
                <div style={s.kpiCardTitle}><UserCheck size={15} color="var(--pink)" /> Clientes com retorno pendente {infoBtn('ativas')}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 14 }}>Baseado no ciclo de retorno de cada cliente</div>

                {atividade === null ? (
                  <div style={s.kpiEmpty}>Calculando...</div>
                ) : (atividade.ativas + atividade.sumidas === 0) ? (
                  <div style={s.kpiEmpty}>Sem clientes atendidas ainda</div>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
                      <div style={{
                        width: 80, height: 80, borderRadius: '50%',
                        background: `conic-gradient(${atividade.taxa >= 70 ? 'var(--green)' : atividade.taxa >= 40 ? '#D97706' : 'var(--pink)'} ${atividade.taxa * 3.6}deg, var(--border) 0deg)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        boxShadow: 'inset 0 0 0 12px var(--surface)'
                      }}>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{atividade.taxa}%</span>
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                          {atividade.taxa >= 70 ? '😍 Base saudável' : atividade.taxa >= 40 ? '😊 Dá pra melhorar' : '⚠️ Muito retorno pendente'}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>
                          {atividade.ativas} ativas ·{' '}
                          {atividade.sumidas > 0
                            ? <button style={s.verLink} onClick={() => setDrill({ tipo: 'sumidas' })}>{atividade.sumidas} com retorno pendente ›</button>
                            : <>0 com retorno pendente</>}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                          Retorno pendente = passou do ciclo de retorno sem voltar
                        </div>
                      </div>
                    </div>
                    <div style={{ height: 8, borderRadius: 4, background: 'var(--border)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 4,
                        background: atividade.taxa >= 70 ? 'var(--green)' : atividade.taxa >= 40 ? '#D97706' : 'var(--pink)',
                        width: `${atividade.taxa}%`, transition: 'width 0.5s ease'
                      }} />
                    </div>
                  </>
                )}
              </div>

              {/* Novas clientes por mês */}
              <div style={s.kpiCard}>
                <div style={s.kpiCardTitle}><Users size={15} color="var(--pink)" /> Novas clientes {infoBtn('novas')}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 12 }}>Últimos 6 meses</div>
                {novasClientes.every(m => m.qtd === 0) ? (
                  <div style={s.kpiEmpty}>Sem dados suficientes</div>
                ) : (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 80 }}>
                    {novasClientes.map((m, i) => (
                      <button
                        key={i} type="button"
                        onClick={() => { if (m.qtd > 0) setDrill({ tipo: 'novas', mes: m.key, label: m.label }) }}
                        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'none', border: 'none', padding: 0, fontFamily: 'inherit', cursor: m.qtd > 0 ? 'pointer' : 'default' }}
                      >
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, color: m.qtd > 0 ? 'var(--pink)' : 'var(--text3)' }}>
                          {m.qtd > 0 ? m.qtd : '—'}
                        </span>
                        <div style={{ width: '100%', borderRadius: '3px 3px 0 0', background: m.qtd > 0 ? 'var(--pink)' : 'var(--border)', height: `${Math.max(4, (m.qtd / maxNovas) * 52)}px`, transition: 'height 0.4s ease', opacity: i === novasClientes.length - 1 ? 1 : 0.6 + (i * 0.08) }} />
                        <span style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>{m.label}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', background: 'var(--surface2)', borderRadius: 8, padding: '8px 12px' }}>
                  <span style={{ fontSize: 12, color: 'var(--text2)' }}>Total nos últimos 6 meses</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: 'var(--pink)' }}>
                    {novasClientes.reduce((s, m) => s + m.qtd, 0)} clientes
                  </span>
                </div>
              </div>
              </div>

              {/* ── Seção: Sua agenda ── */}
              <div style={s.secHead}>
                <span style={s.secHeadIcon}><Calendar size={14} /></span>
                <span style={s.secHeadTitle}>Sua agenda</span>
                <span style={s.secHeadLine} />
              </div>
              <div style={{ ...s.kpiGrid, marginBottom: 22 }}>
              {/* Cancelamentos */}
              <div style={s.kpiCard}>
                <div style={s.kpiCardTitle}><Ban size={15} color="var(--pink)" /> Cancelamentos {infoBtn('cancelamentos')}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 14 }}>{labelCancelamento}</div>
                {cancelamento === null ? (
                  <div style={s.kpiEmpty}>Calculando...</div>
                ) : cancelamento.total === 0 ? (
                  <div style={s.kpiEmpty}>Sem atendimentos no período</div>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
                      <div style={{
                        width: 80, height: 80, borderRadius: '50%',
                        background: `conic-gradient(${cancelamento.taxa <= 10 ? 'var(--green)' : cancelamento.taxa <= 20 ? '#D97706' : 'var(--pink)'} ${cancelamento.taxa * 3.6}deg, var(--border) 0deg)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        boxShadow: 'inset 0 0 0 12px var(--surface)'
                      }}>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{cancelamento.taxa}%</span>
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                          {cancelamento.taxa <= 10 ? '😍 Quase ninguém cancela' : cancelamento.taxa <= 20 ? '🙂 Cancelamento sob controle' : '⚠️ Muito cancelamento'}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>
                          {cancelamento.cancelados} de {cancelamento.total} horários foram cancelados
                        </div>
                      </div>
                    </div>
                    <div style={{ height: 8, borderRadius: 4, background: 'var(--border)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 4,
                        background: cancelamento.taxa <= 10 ? 'var(--green)' : cancelamento.taxa <= 20 ? '#D97706' : 'var(--pink)',
                        width: `${Math.min(100, cancelamento.taxa)}%`, transition: 'width 0.5s ease'
                      }} />
                    </div>
                    {cancelamento.cancelados > 0 && (
                      <button style={s.verAcao} onClick={() => setDrill({ tipo: 'cancel' })}>Ver quem cancelou <ChevronRight size={13} /></button>
                    )}
                  </>
                )}
              </div>

              {/* 5. Ocupação da agenda */}
              <div style={s.kpiCard}>
                <div style={s.kpiCardTitle}><Gauge size={15} color="var(--pink)" /> Ocupação da agenda {infoBtn('ocupacao')}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 14 }}>{labelMesAtual} · estimativa</div>
                {ocupacao === null ? (
                  <div style={s.kpiEmpty}>Calculando...</div>
                ) : ocupacao.vagas === 0 ? (
                  <div style={s.kpiEmpty}>Configure horário e dias de trabalho</div>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
                      <div style={{
                        width: 80, height: 80, borderRadius: '50%',
                        background: `conic-gradient(${ocupacao.taxa >= 85 ? '#D97706' : ocupacao.taxa >= 60 ? 'var(--green)' : 'var(--pink)'} ${Math.min(100, ocupacao.taxa) * 3.6}deg, var(--border) 0deg)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        boxShadow: 'inset 0 0 0 12px var(--surface)'
                      }}>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{ocupacao.taxa}%</span>
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                          {ocupacao.taxa >= 85 ? '🔥 Quase lotada' : ocupacao.taxa >= 60 ? '😊 Boa ocupação' : '📉 Agenda com espaço'}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>
                          {ocupacao.usadas} de {ocupacao.vagas} horários usados
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                          {ocupacao.taxa >= 85 ? 'Pra crescer, pense em preço ou equipe' : ocupacao.taxa < 60 ? 'Hora de puxar cliente sumida' : ''}
                        </div>
                      </div>
                    </div>
                    <div style={{ height: 8, borderRadius: 4, background: 'var(--border)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 4,
                        background: ocupacao.taxa >= 85 ? '#D97706' : ocupacao.taxa >= 60 ? 'var(--green)' : 'var(--pink)',
                        width: `${Math.min(100, ocupacao.taxa)}%`, transition: 'width 0.5s ease'
                      }} />
                    </div>
                    {ocupacao.porDia?.length > 0 && (
                      <button style={s.verAcao} onClick={() => setDrill({ tipo: 'ocupacao' })}>Ver horários mais vazios <ChevronRight size={13} /></button>
                    )}
                  </>
                )}
              </div>
              </div>

              {/* ── Seção: Sua equipe (só plano Salão) ── */}
              {plano?.id === 'salao' && (
                <>
                <div style={s.secHead}>
                  <span style={s.secHeadIcon}><Award size={14} /></span>
                  <span style={s.secHeadTitle}>Sua equipe</span>
                  <span style={s.secHeadChip}>plano Salão</span>
                  <span style={s.secHeadLine} />
                </div>
                <div style={s.kpiGrid}>
                <div style={s.kpiCard}>
                  <div style={s.kpiCardTitle}><Award size={15} color="var(--pink)" /> Atendimentos por profissional {infoBtn('profissional')}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 14 }}>{labelMesAtual}</div>
                  {porProfissional.length === 0 ? (
                    <div style={s.kpiEmpty}>Sem atendimentos no período</div>
                  ) : porProfissional.map((p, i) => (
                    <button
                      key={i} type="button" onClick={() => setDrill({ tipo: 'prof', profId: p.id })}
                      style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: 0, marginBottom: 10, cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>{p.nome} <ChevronRight size={12} color="var(--text3)" /></span>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--pink)', fontWeight: 600 }}>
                            {formatBRL(p.valor)}
                          </span>
                          <span style={{ fontSize: 10, color: 'var(--text3)', minWidth: 56, textAlign: 'right' }}>{p.qtd} atend.</span>
                        </div>
                      </div>
                      <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 3, background: 'var(--pink)', width: `${(p.valor / maxProf) * 100}%`, transition: 'width 0.4s ease' }} />
                      </div>
                    </button>
                  ))}
                </div>
                </div>
                </>
              )}
            </>
          )}
        </>
      )}

      {/* ── TAB: MEU MÊS (recap) ───────────────────────── */}
      {tab === 'recap' && (
        <>
          <div style={s.mesNav}>
            <button style={s.mesNavBtn} onClick={mesAnterior}>‹</button>
            <div style={s.mesNavLabel}>
              {labelMesFiltro}
              {ehMesAtual && <span style={s.mesAtualChip}>atual</span>}
            </div>
            <button style={s.mesNavBtn} onClick={mesProximo}>›</button>
          </div>

          {(loadingRecap || !recap) ? (
            <div style={s.kpiEmpty}>Calculando…</div>
          ) : !recap.temAlgumDado ? (
            <div style={s.empty}>
              <Sparkles size={32} color="var(--text3)" style={{ marginBottom: 10 }} />
              <p style={{ color: 'var(--text3)', fontSize: 14 }}>Sem movimento em {labelMesFiltro} ainda.</p>
            </div>
          ) : (
            <>
              {/* Destaque: clientes recuperadas */}
              <div style={{ background: 'linear-gradient(135deg, #FBEAF0, var(--surface))', border: '1px solid var(--pink)', borderRadius: 'var(--radius-sm)', padding: '16px 18px', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--pink)', fontWeight: 700 }}>
                  <Sparkles size={15} /> Seu resultado com o Lumen
                </div>
                <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 8 }}>Você recuperou de clientes que tinham sumido</div>
                <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--green)', lineHeight: 1, margin: '6px 0 4px', fontFamily: "'JetBrains Mono', monospace" }}>
                  {formatBRL(recap.recuperadasValor)}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                  {recap.recuperadasQtd === 0 ? 'nenhuma cliente sumida voltou neste mês' : `${recap.recuperadasQtd} cliente${recap.recuperadasQtd !== 1 ? 's' : ''} que sumiram e voltaram`}
                </div>
              </div>

              {/* Números do mês */}
              <div style={s.secHead}>
                <span style={s.secHeadIcon}><BarChart2 size={14} /></span>
                <span style={s.secHeadTitle}>O que rolou no mês</span>
                <span style={s.secHeadLine} />
              </div>
              <div style={{ ...s.kpiGrid, marginBottom: 16 }}>
                {recap.lucro !== null && (
                  <div style={s.kpiCard}>
                    <div style={s.kpiCardTitle}><TrendingUp size={15} color="#15803D" /> Lucro do mês</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: recap.lucro >= 0 ? 'var(--green)' : '#B91C1C', lineHeight: 1, margin: '10px 0 4px', fontFamily: "'JetBrains Mono', monospace" }}>{formatBRL(recap.lucro)}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>depois das despesas</div>
                  </div>
                )}
                <div style={s.kpiCard}>
                  <div style={s.kpiCardTitle}><DollarSign size={15} color="#15803D" /> Faturamento</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', lineHeight: 1, margin: '10px 0 4px', fontFamily: "'JetBrains Mono', monospace" }}>{formatBRL(recap.receita)}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>recebido no mês</div>
                </div>
                <div style={s.kpiCard}>
                  <div style={s.kpiCardTitle}><Calendar size={15} color="var(--pink)" /> Atendimentos</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--pink)', lineHeight: 1, margin: '10px 0 4px' }}>{recap.atendimentos}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>realizados</div>
                </div>
                <div style={s.kpiCard}>
                  <div style={s.kpiCardTitle}><Users size={15} color="#1E40AF" /> Clientes novas</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#1E40AF', lineHeight: 1, margin: '10px 0 4px' }}>{recap.novas}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>entraram no mês</div>
                </div>
                <div style={s.kpiCard}>
                  <div style={s.kpiCardTitle}><Banknote size={15} color="#15803D" /> Recebido de pendências</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#15803D', lineHeight: 1, margin: '10px 0 4px', fontFamily: "'JetBrains Mono', monospace" }}>{formatBRL(recap.pendenciasPagasValor)}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>{recap.pendenciasPagasQtd > 0 ? `de ${recap.pendenciasPagasQtd} pagamento${recap.pendenciasPagasQtd !== 1 ? 's' : ''} que estavam pendentes` : 'nenhuma pendência quitada no mês'}</div>
                </div>
                <div style={s.kpiCard}>
                  <div style={s.kpiCardTitle}><CalendarCheck size={15} color="#1E40AF" /> Faltas evitadas</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', lineHeight: 1, margin: '10px 0 4px' }}>{recap.confirmacoesLink}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>atendimentos confirmados pelo link</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{recap.clientesConfirmadasLink} cliente{recap.clientesConfirmadasLink !== 1 ? 's' : ''} confirmada{recap.clientesConfirmadasLink !== 1 ? 's' : ''} pelo link</div>
                </div>
              </div>

              {ehMesAtual && (
                <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', marginBottom: 8 }}>
                  Mês em andamento — números até hoje.
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── Pop-up "quem" (drill-down de cada indicador) ─ */}
      {drill && (
        <Modal onClose={() => setDrill(null)} variant="sheet" boxStyle={s.modalDrill}>
          {renderDrill()}
          <button style={s.btnPrimary} onClick={() => setDrill(null)}>Fechar</button>
        </Modal>
      )}

      {/* ── Modal de explicação do indicador ───────────── */}
      {infoAberto && INFO_INDICADORES[infoAberto] && (
        <Modal onClose={() => setInfoAberto(null)} variant="sheet" boxStyle={s.modal}>
          <div style={s.infoTitulo}>{INFO_INDICADORES[infoAberto].titulo}</div>
          <div style={s.infoBloco}>
            <div style={s.infoLabel}>O que é</div>
            <div style={s.infoTexto}>{INFO_INDICADORES[infoAberto].oque}</div>
          </div>
          <div style={s.infoBloco}>
            <div style={s.infoLabel}>Como calculamos</div>
            <div style={s.infoTexto}>{INFO_INDICADORES[infoAberto].como}</div>
          </div>
          <div style={s.infoBloco}>
            <div style={s.infoLabel}>O que fazer</div>
            <div style={s.infoTexto}>{INFO_INDICADORES[infoAberto].fazer}</div>
          </div>
          {INFO_INDICADORES[infoAberto].aviso && (
            <div style={s.infoAviso}><Info size={14} style={{ flexShrink: 0, marginTop: 1 }} /><span>{INFO_INDICADORES[infoAberto].aviso}</span></div>
          )}
          {INFO_INDICADORES[infoAberto].nota && (
            <div style={s.infoNota}>{INFO_INDICADORES[infoAberto].nota}</div>
          )}
          <button style={s.btnPrimary} onClick={() => setInfoAberto(null)}>Entendi</button>
        </Modal>
      )}

      {/* ── Modal de meta ──────────────────────────────── */}
      {showModal && (
        <Modal onClose={fecharModal} variant="sheet" boxStyle={s.modal}>
            <div style={s.modalTitle}>{editando ? '✏️ Editar meta' : '🎯 Nova meta'}</div>
            <div style={s.field}>
              <label style={s.label}>Tipo</label>
              <select style={s.input} value={form.tipo} onChange={e => {
                const tipo = e.target.value
                const periodo = tipo === 'ano' ? format(new Date(), 'yyyy') : format(new Date(), 'yyyy-MM')
                setForm(f => ({ ...f, tipo, periodo }))
              }} disabled={!!editando}>
                <option value="mes">Mensal</option>
                <option value="ano">Anual</option>
              </select>
              {editando && <div style={{ fontSize: 11, color: 'var(--text3)' }}>Tipo não pode ser alterado após criação</div>}
            </div>
            <div style={s.field}>
              <label style={s.label}>Período</label>
              {form.tipo === 'ano'
                ? <input style={s.input} type="number" min="2020" max="2099" value={form.periodo} onChange={e => setForm(f => ({ ...f, periodo: e.target.value }))} />
                : <input style={s.input} type="month" value={form.periodo} onChange={e => setForm(f => ({ ...f, periodo: e.target.value }))} />
              }
            </div>
            <div style={s.field}>
              <label style={s.label}>Valor da meta (R$)</label>
              <input style={{ ...s.input, fontFamily: "'JetBrains Mono', monospace" }} type="number" placeholder="5000" value={form.valor_meta} onChange={e => setForm(f => ({ ...f, valor_meta: e.target.value }))} />
            </div>
            <button style={s.btnPrimary} onClick={salvarMeta} disabled={saving}>{saving ? 'Salvando...' : editando ? 'Salvar alterações' : 'Criar meta'}</button>
            <button style={s.btnSecondary} onClick={fecharModal}>Cancelar</button>
        </Modal>
      )}
    </div>
  )
}

const tabs = {
  bar: { display: 'flex', gap: 4, background: 'var(--surface)', borderRadius: 'var(--radius-sm)', padding: 4, marginBottom: 20, boxShadow: 'var(--shadow-xs)', border: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 10 },
  btn: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 12px', borderRadius: 8, background: 'transparent', border: 'none', color: 'var(--text3)', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  btnAtivo: { background: 'var(--pink)', color: 'white', boxShadow: 'var(--shadow-pink)', fontWeight: 700 },
}

const s = {
  page: { padding: 16, paddingBottom: 80 },
  mesNav: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: 16, boxShadow: 'var(--shadow-xs)' },
  mesNavBtn: { background: 'none', border: 'none', fontSize: 22, color: 'var(--text2)', cursor: 'pointer', padding: '0 6px', lineHeight: 1, fontFamily: 'inherit' },
  mesNavLabel: { display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 14, fontWeight: 700, color: 'var(--text)', textTransform: 'capitalize' },
  mesAtualChip: { fontSize: 10, fontWeight: 700, background: 'var(--pink)', color: 'white', borderRadius: 'var(--radius-pill)', padding: '2px 8px' },
  // Metas
  metaCard: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '14px 15px', marginBottom: 10, boxShadow: 'var(--shadow-sm)' },
  metaHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12, gap: 8 },
  metaTipo: { fontSize: 13, fontWeight: 700, color: 'var(--text)' },
  metaPeriodo: { fontSize: 12, color: 'var(--text3)', marginTop: 2, textTransform: 'capitalize' },
  iconBtn: { background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text2)', cursor: 'pointer', padding: 6, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  indicadoresGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 },
  indicador: { background: 'var(--surface2)', borderRadius: 8, padding: '8px 10px' },
  indicadorLabel: { fontSize: 10, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 },
  indicadorValor: { fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 700 },
  metaValores: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  pctBadge: { fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 'var(--radius-pill)' },
  barBg: { position: 'relative', height: 8, borderRadius: 4, background: 'var(--border)', overflow: 'hidden', marginBottom: 10 },
  barFill: { height: '100%', borderRadius: 4, transition: 'width 0.5s ease', position: 'relative', zIndex: 2 },
  barProjFill: { position: 'absolute', top: 0, left: 0, height: '100%', borderRadius: 4, background: 'repeating-linear-gradient(45deg, rgba(217,119,6,0.3) 0px, rgba(217,119,6,0.3) 4px, transparent 4px, transparent 8px)', zIndex: 1 },
  projecaoInsight: { display: 'flex', alignItems: 'center', gap: 7, padding: '8px 10px', borderRadius: 8, border: '1px solid', fontSize: 11, fontWeight: 600, lineHeight: 1.4 },
  // Indicadores
  secHead: { display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 12px' },
  secHeadIcon: { width: 26, height: 26, borderRadius: '50%', background: 'var(--pink-light)', color: 'var(--pink)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  secHeadTitle: { fontSize: 14, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap' },
  secHeadChip: { fontSize: 10, fontWeight: 600, color: 'var(--text3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', padding: '2px 8px', whiteSpace: 'nowrap' },
  secHeadLine: { flex: 1, height: 1, background: 'var(--border)' },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, alignItems: 'stretch' },
  kpiCard: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '15px', boxShadow: 'var(--shadow-sm)' },
  kpiCardTitle: { display: 'flex', alignItems: 'center', gap: 7, fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 },
  kpiEmpty: { textAlign: 'center', color: 'var(--text3)', fontSize: 13, padding: '20px 0' },
  infoBtn: { marginLeft: 'auto', width: 20, height: 20, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text3)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, padding: 0 },
  // Modal de explicação
  infoTitulo: { fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 2 },
  infoBloco: { display: 'flex', flexDirection: 'column', gap: 3 },
  infoLabel: { fontSize: 11, fontWeight: 700, color: 'var(--pink)', textTransform: 'uppercase', letterSpacing: '0.4px' },
  infoTexto: { fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.6 },
  infoAviso: { display: 'flex', gap: 7, fontSize: 12, color: '#92400E', background: '#FEF3C7', borderRadius: 8, padding: '10px 12px', lineHeight: 1.5 },
  infoNota: { fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 },
  // Drill-down "quem"
  verLink: { background: 'none', border: 'none', padding: 0, color: 'var(--pink)', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' },
  verAcao: { marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 3, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', padding: '6px 12px', fontSize: 12, fontWeight: 700, color: 'var(--text2)', cursor: 'pointer', fontFamily: 'inherit' },
  modalDrill: { background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '24px 20px 32px', width: '100%', maxWidth: 520, maxHeight: '82vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 },
  drillSub: { fontSize: 12, color: 'var(--text3)', marginTop: 2, marginBottom: 6 },
  grupoTitulo: { fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginTop: 8, marginBottom: 2 },
  okBanner: { fontSize: 13, fontWeight: 600, color: 'var(--green)', background: 'var(--green-bg)', borderRadius: 8, padding: '10px 12px', marginTop: 2, marginBottom: 8 },
  drillLista: { display: 'flex', flexDirection: 'column' },
  drillItem: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: '1px solid var(--border)' },
  drillItemBtn: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '11px 0', borderTop: '1px solid var(--border)', background: 'none', border: 'none', borderTopWidth: 1, width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' },
  drillNome: { fontSize: 14, fontWeight: 600, color: 'var(--text)' },
  drillMeta: { fontSize: 12, color: 'var(--text3)', marginTop: 2 },
  drillValor: { fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: 'var(--pink)', flexShrink: 0 },
  waBtn: { display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--green)', color: 'white', border: 'none', borderRadius: 8, padding: '7px 12px', fontSize: 12.5, fontWeight: 700, textDecoration: 'none', flexShrink: 0, fontFamily: 'inherit' },
  waBtnAmber: { display: 'inline-flex', alignItems: 'center', gap: 5, background: '#D97706', color: 'white', border: 'none', borderRadius: 8, padding: '7px 12px', fontSize: 12.5, fontWeight: 700, textDecoration: 'none', flexShrink: 0, fontFamily: 'inherit' },
  semTel: { fontSize: 11, color: 'var(--text3)', flexShrink: 0 },
  tagReinc: { marginLeft: 6, fontSize: 10, fontWeight: 700, color: '#92400E', background: '#FEF3C7', borderRadius: 'var(--radius-pill)', padding: '1px 7px' },
  taxaPill: { fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 'var(--radius-pill)', flexShrink: 0 },
  loading: { textAlign: 'center', color: 'var(--text3)', fontSize: 13, padding: '40px 0' },
  skeletonTitle: { height: 16, borderRadius: 6, background: 'var(--border)', width: '60%', animation: 'np-pulse-soft 1.5s ease-in-out infinite' },
  skeletonLine: { height: 12, borderRadius: 6, background: 'var(--border)', width: '80%', animation: 'np-pulse-soft 1.5s ease-in-out infinite' },
  // Modal
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0', textAlign: 'center' },
  modal: { background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 13 },
  modalTitle: { fontSize: 17, fontWeight: 700, marginBottom: 2 },
  field: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: labelBase,
  input: inputBase,
  btnPrimary: { ...btnPrimaryBase, transition: undefined },
  btnSecondary: btnSecondaryBase,
}
