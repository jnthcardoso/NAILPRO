import { useEffect, useState, useRef } from 'react'
import { Plus, ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useSalao } from '../contexts/SalaoContext'
import { initTokenClient, criarEvento, excluirEvento, conectarGoogle } from '../lib/googleCalendar'
import { useToast } from '../contexts/ToastContext'
import { CardSkeleton } from '../components/common/Skeleton'
import { s } from './Agenda.styles'
import { VIEWS } from './Agenda.constants'
import NovoAgendamentoModal from '../components/agenda/NovoAgendamentoModal'
import EditarAgendamentoModal from '../components/agenda/EditarAgendamentoModal'
import PagamentoModal from '../components/agenda/PagamentoModal'
import { ViewDia, ViewSemana, ViewMes, ViewBusca } from '../components/agenda/views'
import DetalheAgendamentoDrawer from '../components/agenda/DetalheAgendamentoDrawer'
import {
  format, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth
} from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default function Agenda() {
  const { user } = useAuth()
  const { salaoId, membroId, gerenciaTudo, isProfissional, isDona } = useSalao()
  const { sucesso, erro, aviso, confirmar } = useToast()
  const [view, setView] = useState('Semana')
  const [dataSel, setDataSel] = useState(new Date())
  const [agendamentos, setAgendamentos] = useState([])
  const [loadingAgenda, setLoadingAgenda] = useState(true)
  const [clientes, setClientes] = useState([])
  const [profissionais, setProfissionais] = useState([])
  const [filtroProf, setFiltroProf] = useState('') // '' = todas
  const [filtroPag, setFiltroPag] = useState('todos') // todos | pago | receber
  const [showModal, setShowModal] = useState(false)
  const [showNovaCliente, setShowNovaCliente] = useState(false)
  const [showPagModal, setShowPagModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [agSelecionado, setAgSelecionado] = useState(null)
  const [formPag, setFormPag] = useState({ forma: 'pix', status: 'pago', valor: '', modo: 'simples', forma2: 'cartao_credito', valor2: '' })
  const [pagModalObrigatorio, setPagModalObrigatorio] = useState(false) // true quando veio de 'realizado'
  const [form, setForm] = useState({ cliente_id: '', servico: '', horario: '', valor: '', status: 'pendente', observacoes: '', data: format(new Date(), 'yyyy-MM-dd'), profissional_id: '' })
  const [formEdit, setFormEdit] = useState({ cliente_id: '', servico: '', horario: '', valor: '', status: 'pendente', observacoes: '', data: '', profissional_id: '' })
  const [formCliente, setFormCliente] = useState({ nome: '', telefone: '' })
  const [saving, setSaving] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [savingPag, setSavingPag] = useState(false)
  const [savingCliente, setSavingCliente] = useState(false)
  const [servicosPadrao, setServicosPadrao] = useState([])
  const [googleConectado, setGoogleConectado] = useState(false)
  const [duracaoAtend, setDuracaoAtend] = useState(60)
  const [googleMsg, setGoogleMsg] = useState(null)
  const [googlePronto, setGooglePronto] = useState(false)
  const [agDetalhe, setAgDetalhe] = useState(null)
  const [diaSelecionadoMes, setDiaSelecionadoMes] = useState(null)
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState([])
  const [buscando, setBuscando] = useState(false)

  const buscaAtiva = busca.trim().length >= 2

  // Controle do auto-sync com Google (evita repetir/loopar tentativas)
  const sincronizandoRef = useRef(false)
  const tentadosGoogleRef = useRef(new Set())

  useEffect(() => { if (salaoId) loadAgendamentos() }, [salaoId, dataSel, view, filtroProf])

  // Auto-sync: empurra para o Google Agenda os agendamentos ainda sem evento
  // (inclui os vindos da agenda pública). Cada pessoa sincroniza só os atendimentos
  // DELA, no Google DELA: a profissional os que são dela (profissional_id), e a dona
  // os dela + os do salão sem profissional definido (link público do salão). Assim
  // evitamos jogar o atendimento da manicure no Google errado.
  useEffect(() => {
    if (!googleConectado || !agendamentos.length) return
    const meus = agendamentos.filter(a =>
      a.profissional_id === membroId || (isDona && a.profissional_id == null)
    )
    if (meus.length) sincronizarGoogle(meus)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agendamentos, googleConectado, isDona, membroId, googlePronto])

  // ── Busca por cliente/serviço (todas as datas) ──
  useEffect(() => {
    const termo = busca.trim().replace(/[,()*\\]/g, ' ').trim()
    if (!salaoId || termo.length < 2) { setResultados([]); setBuscando(false); return }
    let cancel = false
    setBuscando(true)
    const t = setTimeout(async () => {
      // clientes cujo nome bate
      const { data: cls } = await supabase.from('clientes')
        .select('id').eq('salao_id', salaoId).ilike('nome', `%${termo}%`)
      const ids = (cls || []).map(c => c.id)
      const orParts = [`servico.ilike.%${termo}%`]
      if (ids.length) orParts.push(`cliente_id.in.(${ids.join(',')})`)
      let q = supabase.from('agendamentos')
        .select('*, clientes(id, nome, telefone), pagamentos(id, status, forma, valor), profissional:salao_membros(id, nome)')
        .eq('salao_id', salaoId)
        .or(orParts.join(','))
      if (filtroProf) q = q.eq('profissional_id', filtroProf)
      const { data } = await q.order('data', { ascending: false }).order('horario').limit(100)
      if (!cancel) { setResultados(data || []); setBuscando(false) }
    }, 300)
    return () => { cancel = true; clearTimeout(t) }
  }, [busca, salaoId, filtroProf])
  useEffect(() => { if (salaoId) { loadClientes(); loadServicosPadrao(); loadGoogleConfig(); loadProfissionais() } }, [salaoId])

  // ── Fechar modais com Escape ───────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (e.key !== 'Escape') return
      if (agDetalhe) { setAgDetalhe(null); return }
      if (editando) { setEditando(null); return }
      if (showPagModal) { setShowPagModal(false); return }
      if (showModal) { setShowModal(false); return }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [agDetalhe, editando, showPagModal, showModal])

  async function loadAgendamentos() {
    let inicio, fim
    if (view === 'Dia') { inicio = fim = format(dataSel, 'yyyy-MM-dd') }
    else if (view === 'Semana') {
      // Domingo–sábado (locale ptBR) — igual às colunas exibidas na view de semana.
      inicio = format(startOfWeek(dataSel, { locale: ptBR }), 'yyyy-MM-dd')
      fim = format(endOfWeek(dataSel, { locale: ptBR }), 'yyyy-MM-dd')
    } else {
      inicio = format(startOfMonth(dataSel), 'yyyy-MM-dd')
      fim = format(endOfMonth(dataSel), 'yyyy-MM-dd')
    }
    let q = supabase
      .from('agendamentos')
      .select('*, clientes(id, nome, telefone), pagamentos(id, status, forma, valor), profissional:salao_membros(id, nome)')
      .eq('salao_id', salaoId)
      .gte('data', inicio).lte('data', fim)
    if (filtroProf) q = q.eq('profissional_id', filtroProf)
    const { data, error } = await q.order('data').order('horario')
    setLoadingAgenda(false)
    if (error) { erro('Erro ao carregar a agenda: ' + error.message); return }
    setAgendamentos(data || [])
  }

  async function loadClientes() {
    const { data } = await supabase.from('clientes').select('id, nome, telefone').eq('salao_id', salaoId).order('nome')
    setClientes(data || [])
  }

  async function loadProfissionais() {
    const { data } = await supabase.from('salao_membros')
      .select('id, nome, papel').eq('salao_id', salaoId).eq('ativo', true).order('nome')
    setProfissionais(data || [])
  }

  async function loadServicosPadrao() {
    const { data } = await supabase.from('configuracoes').select('servicos_padrao').eq('salao_id', salaoId).maybeSingle()
    if (data?.servicos_padrao?.length) setServicosPadrao(data.servicos_padrao)
  }

  function showGoogleMsg(msg, tipo = 'info') {
    setGoogleMsg({ msg, tipo })
    setTimeout(() => setGoogleMsg(null), 4000)
  }

  // Empurra para o Google Agenda os agendamentos futuros sem google_event_id.
  // Best-effort: se o token não estiver disponível, para sem incomodar.
  async function sincronizarGoogle(lista) {
    if (sincronizandoRef.current) return
    const hoje = format(new Date(), 'yyyy-MM-dd')
    const pendentes = lista.filter(a =>
      !a.google_event_id &&
      a.status !== 'cancelado' &&
      a.data >= hoje &&
      !tentadosGoogleRef.current.has(a.id)
    )
    if (pendentes.length === 0) return

    sincronizandoRef.current = true
    let ok = 0
    for (let i = 0; i < pendentes.length; i++) {
      const ag = pendentes[i]
      tentadosGoogleRef.current.add(ag.id)
      try {
        const evento = await criarEvento(ag, ag.clientes?.nome || '', duracaoAtend)
        // Sem token em memória (sessão nova) → para sem abrir popup; sincroniza
        // quando a dona reconectar o Google nas Integrações.
        if (!evento) { pendentes.slice(i).forEach(x => tentadosGoogleRef.current.add(x.id)); break }
        await supabase.from('agendamentos').update({ google_event_id: evento.id }).eq('id', ag.id)
        setAgendamentos(prev => prev.map(x => x.id === ag.id ? { ...x, google_event_id: evento.id } : x))
        ok++
      } catch (e) {
        console.error('Auto-sync Google falhou:', e)
        // Marca o restante como "tentado" para não martelar a API nesta sessão.
        pendentes.slice(i + 1).forEach(x => tentadosGoogleRef.current.add(x.id))
        break
      }
    }
    sincronizandoRef.current = false
    if (ok > 0) showGoogleMsg(`${ok} agendamento(s) enviados ao Google Agenda ✓`, 'success')
  }

  async function loadGoogleConfig() {
    // Manicure usa o Google Agenda DELA (agenda_profissional); dona/recepção, o do salão.
    const { data } = isProfissional && membroId
      ? await supabase.from('agenda_profissional').select('google_conectado, duracao_atendimento').eq('membro_id', membroId).maybeSingle()
      : await supabase.from('configuracoes').select('google_conectado, duracao_atendimento').eq('salao_id', salaoId).maybeSingle()
    if (data?.duracao_atendimento) setDuracaoAtend(data.duracao_atendimento)
    if (data?.google_conectado) {
      setGoogleConectado(true)
      const tryInit = (tentativas = 0) => {
        if (window.google?.accounts?.oauth2) {
          initTokenClient((ok) => setGooglePronto(ok))
        } else if (tentativas < 20) {
          setTimeout(() => tryInit(tentativas + 1), 300)
        }
      }
      tryInit()
    }
  }

  async function handleReconectarGoogle() {
    try {
      initTokenClient((ok) => setGooglePronto(ok))
      await conectarGoogle()
      tentadosGoogleRef.current = new Set() // token novo: permite retentar os que falharam
      setGooglePronto(true)
      showGoogleMsg('Google Agenda reconectado ✓', 'success')
      sincronizarGoogle(agendamentos)
    } catch (e) {
      showGoogleMsg('Falha ao reconectar Google Agenda', 'error')
    }
  }

  async function salvarAgendamento() {
    if (!form.cliente_id || !form.horario || !form.servico || !form.data) return

    // profissional que vai realizar (profissional só agenda pra si)
    const profId = isProfissional ? membroId : (form.profissional_id || membroId)

    // ── Detecção de conflito de horário (por profissional) ──
    let cq = supabase
      .from('agendamentos')
      .select('id, clientes(nome)')
      .eq('salao_id', salaoId)
      .eq('data', form.data)
      .eq('horario', form.horario + ':00')
      .neq('status', 'cancelado')
    if (profId) cq = cq.eq('profissional_id', profId)
    const { data: conflito } = await cq.maybeSingle()
    if (conflito) {
      erro(`Horário já ocupado — ${conflito.clientes?.nome || 'outra cliente'}`)
      return
    }

    setSaving(true)
    try {
      const { profissional_id: _pf, ...formRest } = form
      const { data: ag, error: insertError } = await supabase
        .from('agendamentos')
        .insert({ ...formRest, user_id: user.id, salao_id: salaoId, profissional_id: profId || null, valor: parseFloat(form.valor) || 0 })
        .select('*, clientes(nome)')
        .single()
      if (insertError) {
        erro('Erro ao salvar agendamento. Tente novamente.')
        return
      }
      if (ag && googleConectado) {
        try {
          // Sem popup: só sincroniza se já houver token em memória (evento != null).
          const evento = await criarEvento(ag, ag.clientes?.nome || '', duracaoAtend)
          if (evento) {
            await supabase.from('agendamentos').update({ google_event_id: evento.id }).eq('id', ag.id)
            showGoogleMsg('Evento criado no Google Agenda ✓', 'success')
          }
        } catch (e) {
          console.error('Google Agenda sync erro:', e)
        }
      }
      setShowModal(false)
      setForm({ cliente_id: '', servico: '', horario: '', valor: '', status: 'pendente', observacoes: '', data: format(dataSel, 'yyyy-MM-dd'), profissional_id: '' })
      loadAgendamentos()
    } finally {
      setSaving(false)
    }
  }

  function abrirEdicao(ag) {
    setFormEdit({
      cliente_id: ag.clientes?.id || ag.cliente_id || '',
      servico: ag.servico || '',
      data: ag.data || '',
      horario: ag.horario?.slice(0, 5) || '',
      valor: ag.valor != null ? String(ag.valor) : '',
      status: ag.status || 'pendente',
      observacoes: ag.observacoes || '',
      profissional_id: ag.profissional_id || '',
    })
    setEditando(ag)
  }

  async function atualizarAgendamento() {
    if (!editando) return

    // ── Detecção de conflito de horário (excluindo o próprio) ─
    const profIdEdit = isProfissional ? membroId : (formEdit.profissional_id || editando.profissional_id || null)
    let cqe = supabase
      .from('agendamentos')
      .select('id, clientes(nome)')
      .eq('salao_id', salaoId)
      .eq('data', formEdit.data)
      .eq('horario', formEdit.horario + ':00')
      .neq('status', 'cancelado')
      .neq('id', editando.id)
    if (profIdEdit) cqe = cqe.eq('profissional_id', profIdEdit)
    const { data: conflito } = await cqe.maybeSingle()
    if (conflito) {
      erro(`Horário já ocupado — ${conflito.clientes?.nome || 'outra cliente'}`)
      return
    }

    setSavingEdit(true)
    try {
      const { error: updateError } = await supabase.from('agendamentos').update({
        cliente_id: formEdit.cliente_id,
        servico: formEdit.servico,
        data: formEdit.data,
        horario: formEdit.horario,
        valor: parseFloat(formEdit.valor) || 0,
        status: formEdit.status,
        observacoes: formEdit.observacoes,
        profissional_id: profIdEdit,
      }).eq('id', editando.id)
      if (updateError) { erro('Erro ao atualizar agendamento. Tente novamente.'); return }
      setEditando(null)
      loadAgendamentos()
    } finally {
      setSavingEdit(false)
    }
  }

  async function salvarNovaCliente() {
    if (!formCliente.nome) return
    setSavingCliente(true)
    const { data } = await supabase.from('clientes').insert({ ...formCliente, user_id: user.id, salao_id: salaoId }).select().single()
    setSavingCliente(false)
    if (data) {
      setClientes(prev => [...prev, data].sort((a, b) => a.nome.localeCompare(b.nome)))
      setForm(f => ({ ...f, cliente_id: data.id }))
      setShowNovaCliente(false)
      setFormCliente({ nome: '', telefone: '' })
    }
  }

  async function atualizarStatus(ag, novoStatus) {
    // 🛡️ Confirmação para cancelamento
    if (novoStatus === 'cancelado') {
      const ok = await confirmar({
        titulo: 'Cancelar agendamento?',
        mensagem: `${ag.clientes?.nome} - ${ag.servico} em ${ag.data?.split('-').reverse().slice(0, 2).join('/')} às ${ag.horario?.slice(0, 5)}`,
        confirmarLabel: 'Sim, cancelar',
        cancelarLabel: 'Voltar',
        tipo: 'perigo',
      })
      if (!ok) return
    }

    const statusAnterior = ag.status
    const { error: statusError } = await supabase.from('agendamentos').update({ status: novoStatus }).eq('id', ag.id).eq('salao_id', salaoId)
    if (statusError) { erro('Erro ao atualizar status. Tente novamente.'); return }

    if (novoStatus === 'cancelado') {
      if (ag.google_event_id && googleConectado) {
        try { await excluirEvento(ag.google_event_id) } catch (e) { console.error(e) }
      }
      // Toast com undo
      sucesso('Agendamento cancelado', {
        duracao: 5000,
        acaoLabel: 'Desfazer',
        acao: async () => {
          await supabase.from('agendamentos').update({ status: statusAnterior }).eq('id', ag.id).eq('salao_id', salaoId)
          loadAgendamentos()
        },
      })
    }

    if (novoStatus === 'realizado') {
      setAgSelecionado(ag)
      setFormPag({ forma: 'pix', status: 'pago', valor: String(ag.valor || ''), modo: 'simples', forma2: 'cartao_credito', valor2: '' })
      setPagModalObrigatorio(true)
      setShowPagModal(true)
    }
    loadAgendamentos()
  }

  async function salvarPagamento() {
    if (!agSelecionado) return

    const v1 = parseFloat(formPag.valor) || 0
    const v2 = formPag.modo === 'duplo' ? (parseFloat(formPag.valor2) || 0) : 0

    if (v1 <= 0) { erro('Informe o valor do pagamento.'); return }
    if (formPag.modo === 'duplo' && v2 <= 0) { erro('Informe o valor da 2ª forma de pagamento.'); return }

    setSavingPag(true)
    try {
      // Remove pagamentos anteriores desse agendamento antes de inserir novos
      const idsExistentes = (agSelecionado.pagamentos || []).map(p => p.id)
      if (idsExistentes.length > 0) {
        await supabase.from('pagamentos').delete().in('id', idsExistentes)
      }

      // Monta os registros a inserir
      const base = { user_id: user.id, salao_id: salaoId, agendamento_id: agSelecionado.id, data: agSelecionado.data, status: formPag.status }

      if (formPag.modo === 'duplo') {
        const { error } = await supabase.from('pagamentos').insert([
          { ...base, valor: v1, forma: formPag.forma },
          { ...base, valor: v2, forma: formPag.forma2 },
        ])
        if (error) { erro('Erro ao registrar pagamento. Tente novamente.'); return }
      } else {
        const { error } = await supabase.from('pagamentos').insert({ ...base, valor: v1, forma: formPag.forma })
        if (error) { erro('Erro ao registrar pagamento. Tente novamente.'); return }
      }

      if (formPag.status === 'pendente') {
        aviso('⏳ Pagamento pendente registrado — aparece em "A receber" no financeiro')
      } else {
        sucesso(formPag.modo === 'duplo' ? '✓ Pagamento em 2 formas confirmado' : '✓ Pagamento confirmado')
      }
      setShowPagModal(false)
      setPagModalObrigatorio(false)
      setAgSelecionado(null)
      loadAgendamentos()
    } finally {
      setSavingPag(false)
    }
  }

  function fecharPagModal() {
    if (pagModalObrigatorio) {
      erro('⚠️ Agendamento marcado como realizado sem pagamento. Registre depois em "💳 Pagamento" no card.')
    }
    setShowPagModal(false)
    setPagModalObrigatorio(false)
    setAgSelecionado(null)
    setFormPag({ forma: 'pix', status: 'pago', valor: '', modo: 'simples', forma2: 'cartao_credito', valor2: '' })
  }

  function navegar(dir) {
    if (view === 'Dia') setDataSel(dir > 0 ? addDays(dataSel, 1) : subDays(dataSel, 1))
    else if (view === 'Semana') setDataSel(dir > 0 ? addWeeks(dataSel, 1) : subWeeks(dataSel, 1))
    else setDataSel(dir > 0 ? addMonths(dataSel, 1) : subMonths(dataSel, 1))
  }

  function labelNavegacao() {
    if (view === 'Dia') return format(dataSel, "EEE, dd 'de' MMM", { locale: ptBR })
    if (view === 'Semana') {
      const ini = startOfWeek(dataSel, { locale: ptBR })
      const fim = endOfWeek(dataSel, { locale: ptBR })
      return `${format(ini, 'dd MMM', { locale: ptBR })} – ${format(fim, 'dd MMM', { locale: ptBR })}`
    }
    return format(dataSel, "MMMM 'de' yyyy", { locale: ptBR })
  }

  // Estado de pagamento de um agendamento (para o filtro)
  function pagState(a) {
    const p = a.pagamentos?.[0]
    if (p?.status === 'pago') return 'pago'
    if (p?.status === 'pendente') return 'receber'
    if (a.status === 'realizado' && (a.valor || 0) > 0) return 'receber'
    return 'sem'
  }

  // Lista base já filtrada por status de pagamento (alimenta as views de calendário)
  const agendamentosBase = filtroPag === 'todos'
    ? agendamentos
    : agendamentos.filter(a => pagState(a) === filtroPag)

  return (
    <div style={s.page}>
      <div style={s.viewTabs}>
        {VIEWS.map(v => (
          <button key={v} style={{ ...s.viewTab, ...(view === v ? s.viewTabActive : {}) }} onClick={() => setView(v)}>{v}</button>
        ))}
      </div>

      <div style={s.buscaWrap}>
        <Search size={16} color="var(--text3)" style={{ flexShrink: 0 }} />
        <input
          style={s.buscaInput}
          placeholder="Buscar por cliente ou serviço..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
        {busca && (
          <button style={s.buscaClear} onClick={() => setBusca('')} aria-label="Limpar busca">
            <X size={15} />
          </button>
        )}
      </div>

      {!buscaAtiva && (
        <div style={s.nav}>
          <button style={s.navBtn} onClick={() => navegar(-1)}><ChevronLeft size={18} /></button>
          <div style={s.navLabel}>{labelNavegacao()}</div>
          <button style={s.navBtn} onClick={() => navegar(1)}><ChevronRight size={18} /></button>
        </div>
      )}
      {gerenciaTudo && profissionais.length > 1 && (
        <div style={s.profFiltro}>
          <button style={{ ...s.profChip, ...(filtroProf === '' ? s.profChipAtivo : {}) }} onClick={() => setFiltroProf('')}>Todas</button>
          {profissionais.map(p => (
            <button key={p.id} style={{ ...s.profChip, ...(filtroProf === p.id ? s.profChipAtivo : {}) }} onClick={() => setFiltroProf(p.id)}>
              {p.nome.split(' ')[0]}
            </button>
          ))}
        </div>
      )}
      {!buscaAtiva && (
        <div style={s.profFiltro}>
          {[
            { id: 'todos', label: 'Todos' },
            { id: 'pago', label: '✓ Pagos' },
            { id: 'receber', label: '⏳ A receber' },
          ].map(f => (
            <button key={f.id} style={{ ...s.profChip, ...(filtroPag === f.id ? s.profChipAtivo : {}) }} onClick={() => setFiltroPag(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
      )}

      {loadingAgenda && !buscaAtiva ? <CardSkeleton count={4} /> : buscaAtiva ? (
        <ViewBusca buscando={buscando} resultados={resultados} busca={busca} onSelect={setAgDetalhe} />
      ) : (
        <>
          {view === 'Dia' && (
            <ViewDia
              agendamentosBase={agendamentosBase}
              dataSel={dataSel}
              onSelect={setAgDetalhe}
              onAddDia={() => { setForm(f => ({ ...f, data: format(dataSel, 'yyyy-MM-dd') })); setShowModal(true) }}
            />
          )}
          {view === 'Semana' && (
            <ViewSemana agendamentosBase={agendamentosBase} dataSel={dataSel} onSelect={setAgDetalhe} />
          )}
          {view === 'Mês' && (
            <ViewMes
              agendamentosBase={agendamentosBase}
              dataSel={dataSel}
              diaSelecionadoMes={diaSelecionadoMes}
              setDiaSelecionadoMes={setDiaSelecionadoMes}
              onSelect={setAgDetalhe}
            />
          )}
        </>
      )}

      {/* ── Drawer de detalhe do agendamento ── */}
      {agDetalhe && (
        <DetalheAgendamentoDrawer
          ag={agDetalhe}
          onClose={() => setAgDetalhe(null)}
          onConfirmar={() => { atualizarStatus(agDetalhe, 'confirmado'); setAgDetalhe(null) }}
          onRealizar={() => { atualizarStatus(agDetalhe, 'realizado'); setAgDetalhe(null) }}
          onCancelar={() => { setAgDetalhe(null); atualizarStatus(agDetalhe, 'cancelado') }}
          onEditar={() => { setAgDetalhe(null); abrirEdicao(agDetalhe) }}
          onRegistrarPagamento={() => {
            const pag = agDetalhe.pagamentos?.[0]
            setAgDetalhe(null)
            setAgSelecionado(agDetalhe)
            setFormPag({ forma: pag?.forma || 'pix', status: pag?.status || 'pago', valor: String(pag?.valor || agDetalhe.valor || ''), modo: 'simples', forma2: 'cartao_credito', valor2: '' })
            setShowPagModal(true)
          }}
        />
      )}

      {googleMsg && (
        <div style={{
          position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
          background: googleMsg.tipo === 'success' ? '#DCFCE7' : googleMsg.tipo === 'error' ? '#FEE2E2' : '#EFF6FF',
          color: googleMsg.tipo === 'success' ? '#15803D' : googleMsg.tipo === 'error' ? '#B91C1C' : '#1D4ED8',
          border: `1px solid ${googleMsg.tipo === 'success' ? '#4ADE80' : googleMsg.tipo === 'error' ? '#FCA5A5' : '#93C5FD'}`,
          borderRadius: 'var(--radius-pill)', padding: '9px 18px', fontSize: 13, fontWeight: 600,
          zIndex: 300, whiteSpace: 'nowrap', boxShadow: 'var(--shadow-md)',
        }}>
          {googleMsg.msg}
        </div>
      )}

      <button className="fab-btn" onClick={() => { setForm(f => ({ ...f, data: format(dataSel, 'yyyy-MM-dd') })); setShowModal(true) }} aria-label="Novo agendamento">
        <Plus size={22} color="white" />
      </button>

      {/* ── Modal de edição ────────────────────── */}
      {editando && (
        <EditarAgendamentoModal
          formEdit={formEdit}
          setFormEdit={setFormEdit}
          clientes={clientes}
          servicosPadrao={servicosPadrao}
          profissionais={profissionais}
          gerenciaTudo={gerenciaTudo}
          savingEdit={savingEdit}
          onSalvar={atualizarAgendamento}
          onCancelar={() => setEditando(null)}
        />
      )}

      {/* ── Modal de pagamento ──────────────── */}
      {showPagModal && agSelecionado && (
        <PagamentoModal
          agSelecionado={agSelecionado}
          formPag={formPag}
          setFormPag={setFormPag}
          savingPag={savingPag}
          pagModalObrigatorio={pagModalObrigatorio}
          onSalvar={salvarPagamento}
          onFechar={fecharPagModal}
        />
      )}

      {/* ── Modal novo agendamento ──────────── */}
      {showModal && (
        <NovoAgendamentoModal
          form={form}
          setForm={setForm}
          clientes={clientes}
          servicosPadrao={servicosPadrao}
          profissionais={profissionais}
          gerenciaTudo={gerenciaTudo}
          showNovaCliente={showNovaCliente}
          setShowNovaCliente={setShowNovaCliente}
          formCliente={formCliente}
          setFormCliente={setFormCliente}
          savingCliente={savingCliente}
          salvarNovaCliente={salvarNovaCliente}
          saving={saving}
          onSalvar={salvarAgendamento}
          onCancelar={() => setShowModal(false)}
        />
      )}
    </div>
  )
}
