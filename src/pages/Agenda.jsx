import { useEffect, useState, useRef } from 'react'
import { Plus, CheckCircle, XCircle, ChevronLeft, ChevronRight, Calendar, CreditCard, MessageCircle, Pencil, Search, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useSalao } from '../contexts/SalaoContext'
import { initTokenClient, criarEvento, excluirEvento, conectarGoogle } from '../lib/googleCalendar'
import { useToast } from '../contexts/ToastContext'
import Modal from '../components/common/Modal'
import { CardSkeleton } from '../components/common/Skeleton'
import { s } from './Agenda.styles'
import { STATUS, FORMAS, VIEWS } from './Agenda.constants'
import NovoAgendamentoModal from '../components/agenda/NovoAgendamentoModal'
import EditarAgendamentoModal from '../components/agenda/EditarAgendamentoModal'
import PagamentoModal from '../components/agenda/PagamentoModal'
import { formatBRL, linkWhatsApp, dataBR } from '../lib/formatters'
import {
  format, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameMonth, isToday
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
  // (inclui os vindos da agenda pública). Só a dona sincroniza — a integração
  // é single-account, então evitamos duplicar em contas diferentes.
  useEffect(() => {
    if (isDona && googleConectado && agendamentos.length) sincronizarGoogle(agendamentos)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agendamentos, googleConectado, isDona, googlePronto])

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
      inicio = format(startOfWeek(dataSel, { weekStartsOn: 1 }), 'yyyy-MM-dd')
      fim = format(endOfWeek(dataSel, { weekStartsOn: 1 }), 'yyyy-MM-dd')
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
    const { data } = await supabase.from('configuracoes').select('google_conectado, duracao_atendimento').eq('salao_id', salaoId).maybeSingle()
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
          const evento = await criarEvento(ag, ag.clientes?.nome || '', duracaoAtend)
          await supabase.from('agendamentos').update({ google_event_id: evento.id }).eq('id', ag.id)
          showGoogleMsg('Evento criado no Google Agenda ✓', 'success')
        } catch (e) {
          console.error('Google Agenda sync erro:', e)
          showGoogleMsg(`Google Agenda: ${e.message}`, 'error')
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

  function buildWhatsAppConfirm(ag) {
    const nome = ag.clientes?.nome || ''
    const telefone = (ag.clientes?.telefone || '').replace(/\D/g, '')
    if (!telefone) return null
    const [y, m, d] = ag.data.split('-')
    const dataFmt = `${d}/${m}`
    const horario = ag.horario?.slice(0, 5)
    const msg = `Olá ${nome}! Confirmando seu horário para ${dataFmt} às ${horario} - ${ag.servico}. Pode confirmar presença? 💅`
    return linkWhatsApp(telefone, msg)
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

  // Card compacto para view Semana
  function CardCompacto({ ag }) {
    const st = STATUS[ag.status] || STATUS.pendente
    return (
      <div style={{ ...s.cardCompacto, borderLeftColor: st.border }} onClick={() => setAgDetalhe(ag)}>
        <div style={s.cardCompactoHora}>{ag.horario?.slice(0, 5)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={s.cardCompactoNome}>{ag.clientes?.nome?.split(' ')[0]}</div>
          <div style={s.cardCompactoServ}>{ag.servico}</div>
        </div>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: st.border, flexShrink: 0 }} />
      </div>
    )
  }

  // Card completo para view Dia
  function CardDia({ ag }) {
    const st = STATUS[ag.status] || STATUS.pendente
    const pag = ag.pagamentos?.[0]
    return (
      <div style={{ ...s.card, borderLeftColor: st.border, cursor: 'pointer' }} onClick={() => setAgDetalhe(ag)}>
        <div style={s.cardHeader}>
          <div style={s.cardTime}>{ag.horario?.slice(0, 5)}</div>
          <div style={{ flex: 1 }}>
            <div style={s.cardName}>{ag.clientes?.nome}</div>
            <div style={s.cardService}>{ag.servico}</div>
          </div>
          <span style={{ ...s.badge, background: st.bg, color: st.color }}>{st.label}</span>
        </div>
        {ag.valor > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={s.cardValor}>{formatBRL(ag.valor)}</div>
            {pag && (
              <span style={{ ...s.badge, background: pag.status === 'pago' ? '#DCFCE7' : '#FEF3C7', color: pag.status === 'pago' ? '#15803D' : '#92400E', fontSize: 10 }}>
                {pag.status === 'pago' ? '✓ Pago' : '⏳ Pendente'} · {FORMAS.find(f => f.value === pag.forma)?.label.split(' ')[1] || pag.forma}
              </span>
            )}
          </div>
        )}
      </div>
    )
  }

  function ViewDia() {
    const dia = agendamentosBase.filter(a => a.data === format(dataSel, 'yyyy-MM-dd'))
    if (dia.length === 0) return (
      <div style={s.empty}>
        <Calendar size={34} color="var(--text3)" style={{ marginBottom: 10 }} />
        <p style={{ color: 'var(--text3)', fontSize: 14 }}>Nenhum agendamento neste dia</p>
        <button style={s.emptyBtn} onClick={() => { setForm(f => ({ ...f, data: format(dataSel, 'yyyy-MM-dd') })); setShowModal(true) }}>
          + Adicionar agendamento
        </button>
      </div>
    )
    return dia.map(ag => <CardDia key={ag.id} ag={ag} />)
  }

  function ViewSemana() {
    const dias = eachDayOfInterval({ start: startOfWeek(dataSel, { locale: ptBR }), end: endOfWeek(dataSel, { locale: ptBR }) })
    return (
      <div style={s.weekColunas}>
        {dias.map(dia => {
          const agsDia = agendamentosBase.filter(a => a.data === format(dia, 'yyyy-MM-dd'))
          const hoje = isToday(dia)
          return (
            <div key={dia.toISOString()} style={s.weekColuna}>
              <div style={{ ...s.weekColunaHeader, ...(hoje ? s.weekColunaHeaderHoje : {}) }}>
                <span style={{ ...s.weekColunaDia, ...(hoje ? { color: 'var(--pink)' } : {}) }}>
                  {format(dia, 'EEE', { locale: ptBR })}
                </span>
                <span style={{ ...s.weekColunaNum, ...(hoje ? { color: 'var(--pink)', fontWeight: 700 } : {}) }}>
                  {format(dia, 'd')}
                </span>
                {agsDia.length > 0 && (
                  <span style={{ fontSize: 9, fontWeight: 700, color: hoje ? 'var(--pink)' : 'var(--text3)' }}>
                    {agsDia.length}
                  </span>
                )}
              </div>
              {agsDia.length === 0
                ? <div style={s.weekColunaSemAg}>—</div>
                : agsDia.map(ag => <CardCompacto key={ag.id} ag={ag} />)
              }
            </div>
          )
        })}
      </div>
    )
  }

  function ViewMes() {
    const isMobile = window.innerWidth < 769
    const inicio = startOfMonth(dataSel)
    const fim = endOfMonth(dataSel)
    const dias = eachDayOfInterval({ start: startOfWeek(inicio, { locale: ptBR }), end: endOfWeek(fim, { locale: ptBR }) })
    const semanas = []
    for (let i = 0; i < dias.length; i += 7) semanas.push(dias.slice(i, i + 7))
    const agsDiaSel = diaSelecionadoMes ? agendamentosBase.filter(a => a.data === diaSelecionadoMes) : []

    // Mobile: initial de cada dia da semana; Desktop: nome curto
    const headerDias = isMobile
      ? ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
      : ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

    return (
      <div>
        <div style={{ ...s.calHeader, gap: isMobile ? 0 : undefined }}>
          {headerDias.map((d, i) => (
            <div key={i} style={{ ...s.calHeaderCell, fontSize: isMobile ? 11 : 10 }}>{d}</div>
          ))}
        </div>
        {semanas.map((semana, si) => (
          <div key={si} style={{ ...s.calRow, gap: isMobile ? 1 : 1 }}>
            {semana.map(dia => {
              const agsDia = agendamentosBase.filter(a => a.data === format(dia, 'yyyy-MM-dd'))
              const hoje = isToday(dia)
              const doMes = isSameMonth(dia, dataSel)
              const datStr = format(dia, 'yyyy-MM-dd')
              const selecionado = diaSelecionadoMes === datStr
              return (
                <div
                  key={dia.toISOString()}
                  style={{
                    ...s.calCell,
                    ...(!doMes ? s.calCellOut : {}),
                    ...(hoje ? s.calCellHoje : {}),
                    ...(selecionado ? s.calCellSel : {}),
                    ...(isMobile ? { minHeight: 52, padding: '4px 3px' } : {}),
                  }}
                  onClick={() => setDiaSelecionadoMes(selecionado ? null : datStr)}
                >
                  {/* Número do dia */}
                  {isMobile ? (
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: hoje ? 700 : 400,
                      background: hoje ? 'var(--pink)' : selecionado ? 'var(--pink-light)' : 'transparent',
                      color: hoje ? '#fff' : selecionado ? 'var(--pink)' : doMes ? 'var(--text)' : 'var(--text3)',
                      margin: '0 auto 3px',
                    }}>
                      {format(dia, 'd')}
                    </div>
                  ) : (
                    <div style={{ ...s.calNum, ...(hoje ? s.calNumHoje : {}) }}>{format(dia, 'd')}</div>
                  )}

                  {/* Mobile: dots coloridos por status */}
                  {isMobile ? (
                    agsDia.length > 0 && (
                      <div style={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                        {agsDia.slice(0, 3).map((ag, i) => {
                          const st = STATUS[ag.status] || STATUS.pendente
                          return <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: st.border, display: 'block', flexShrink: 0 }} />
                        })}
                        {agsDia.length > 3 && (
                          <span style={{ fontSize: 8, color: 'var(--text3)', fontWeight: 700, lineHeight: '6px' }}>+{agsDia.length - 3}</span>
                        )}
                      </div>
                    )
                  ) : (
                    /* Desktop: text cards */
                    <>
                      {agsDia.slice(0, 2).map((ag, i) => {
                        const st = STATUS[ag.status] || STATUS.pendente
                        return <div key={i} style={{ ...s.calEvent, background: st.bg, color: st.color }}>{ag.horario?.slice(0, 5)} {ag.clientes?.nome?.split(' ')[0]}</div>
                      })}
                      {agsDia.length > 2 && <div style={s.calMore}>+{agsDia.length - 2}</div>}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        ))}

        {diaSelecionadoMes && (
          <div style={{ marginTop: 16 }}>
            <div style={s.sectionTitle}>
              {format(new Date(diaSelecionadoMes + 'T12:00'), "EEEE, dd 'de' MMMM", { locale: ptBR })}
              {isToday(new Date(diaSelecionadoMes + 'T12:00')) && <span style={s.hojeChip}>hoje</span>}
            </div>
            {agsDiaSel.length === 0
              ? <div style={s.empty}><p style={{ color: 'var(--text3)', fontSize: 14 }}>Nenhum agendamento</p></div>
              : agsDiaSel.map(ag => <CardDia key={ag.id} ag={ag} />)
            }
          </div>
        )}
      </div>
    )
  }

  function CardBusca({ ag }) {
    const st = STATUS[ag.status] || STATUS.pendente
    const pag = ag.pagamentos?.[0]
    const [y, m, d] = ag.data.split('-')
    return (
      <div style={{ ...s.card, borderLeftColor: st.border, cursor: 'pointer' }} onClick={() => setAgDetalhe(ag)}>
        <div style={s.cardHeader}>
          <div style={s.cardDataBusca}>
            <span style={s.cardDataBuscaDia}>{d}/{m}</span>
            <span style={s.cardDataBuscaHora}>{ag.horario?.slice(0, 5)}</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={s.cardName}>{ag.clientes?.nome}</div>
            <div style={s.cardService}>{ag.servico}</div>
          </div>
          <span style={{ ...s.badge, background: st.bg, color: st.color }}>{st.label}</span>
        </div>
        {ag.valor > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={s.cardValor}>{formatBRL(ag.valor)}</div>
            {pag && (
              <span style={{ ...s.badge, background: pag.status === 'pago' ? '#DCFCE7' : '#FEF3C7', color: pag.status === 'pago' ? '#15803D' : '#92400E', fontSize: 10 }}>
                {pag.status === 'pago' ? '✓ Pago' : '⏳ Pendente'}
              </span>
            )}
          </div>
        )}
      </div>
    )
  }

  function ViewBusca() {
    if (buscando) return <div style={s.empty}><p style={{ color: 'var(--text3)', fontSize: 14 }}>Buscando...</p></div>
    if (resultados.length === 0) return (
      <div style={s.empty}>
        <Search size={34} color="var(--text3)" style={{ marginBottom: 10 }} />
        <p style={{ color: 'var(--text3)', fontSize: 14 }}>Nenhum agendamento encontrado para "{busca.trim()}"</p>
      </div>
    )
    return (
      <div>
        <div style={s.buscaResumo}>{resultados.length} resultado{resultados.length > 1 ? 's' : ''} (todas as datas)</div>
        {resultados.map(ag => <CardBusca key={ag.id} ag={ag} />)}
      </div>
    )
  }

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

      {loadingAgenda && !buscaAtiva ? <CardSkeleton count={4} /> : buscaAtiva ? <ViewBusca /> : (
        <>
          {view === 'Dia' && <ViewDia />}
          {view === 'Semana' && <ViewSemana />}
          {view === 'Mês' && <ViewMes />}
        </>
      )}

      {/* ── Drawer de detalhe do agendamento ── */}
      {agDetalhe && (() => {
        const ag = agDetalhe
        const st = STATUS[ag.status] || STATUS.pendente
        const pag = ag.pagamentos?.[0]
        const waConfirm = buildWhatsAppConfirm(ag)
        const tel = (ag.clientes?.telefone || '').replace(/\D/g, '')
        const waDirectUrl = tel ? linkWhatsApp(tel) : null
        const dataFmt = dataBR(ag.data)
        return (
          <Modal onClose={() => setAgDetalhe(null)} boxStyle={s.modal}>
              {/* Header do drawer */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 700 }}>{ag.clientes?.nome}</div>
                  <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>{ag.servico}</div>
                </div>
                <span style={{ ...s.badge, background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>{st.label}</span>
              </div>

              {/* Infos */}
              <div style={{ background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                  <Calendar size={14} color="var(--text3)" />
                  <span style={{ color: 'var(--text2)', fontWeight: 500 }}>{dataFmt} · {ag.horario?.slice(0, 5)}</span>
                </div>
                {ag.valor > 0 && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                    <CreditCard size={14} color="var(--text3)" />
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: 'var(--pink)' }}>
                      {formatBRL(ag.valor)}
                    </span>
                    {pag && (
                      <span style={{ ...s.badge, background: pag.status === 'pago' ? '#DCFCE7' : '#FEF3C7', color: pag.status === 'pago' ? '#15803D' : '#92400E', fontSize: 10 }}>
                        {pag.status === 'pago' ? '✓ Pago' : '⏳ Pendente'} · {FORMAS.find(f => f.value === pag.forma)?.label.split(' ')[1] || pag.forma}
                      </span>
                    )}
                  </div>
                )}
                {ag.observacoes && (
                  <div style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic' }}>{ag.observacoes}</div>
                )}
              </div>

              {/* Ações de status */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {ag.status === 'pendente' && (
                  <button style={{ ...s.btnPrimary, background: '#15803D', boxShadow: 'none' }} onClick={() => { atualizarStatus(ag, 'confirmado'); setAgDetalhe(null) }}>
                    <CheckCircle size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />Confirmar agendamento
                  </button>
                )}
                {ag.status !== 'realizado' && ag.status !== 'cancelado' && (
                  <button style={{ ...s.btnPrimary, background: '#5B21B6', boxShadow: 'none' }} onClick={() => { atualizarStatus(ag, 'realizado'); setAgDetalhe(null) }}>
                    <CheckCircle size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />Marcar como realizado
                  </button>
                )}
              </div>

              {/* Ações secundárias */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <button style={{ ...s.actionBtn, background: 'var(--surface2)', color: 'var(--text2)', border: '1px solid var(--border2)', flex: '1 1 auto' }}
                  onClick={() => { setAgDetalhe(null); setAgSelecionado(ag); setFormPag({ forma: pag?.forma || 'pix', status: pag?.status || 'pago', valor: String(pag?.valor || ag.valor || ''), modo: 'simples', forma2: 'cartao_credito', valor2: '' }); setShowPagModal(true) }}>
                  <CreditCard size={13} />{pag ? 'Editar pagamento' : 'Registrar pagamento'}
                </button>
                <button style={{ ...s.actionBtn, background: 'var(--surface2)', color: 'var(--text2)', border: '1px solid var(--border2)', flex: '1 1 auto' }}
                  onClick={() => { setAgDetalhe(null); abrirEdicao(ag) }}>
                  <Pencil size={13} />Editar
                </button>
              </div>

              {/* WhatsApp */}
              {(waConfirm || waDirectUrl) && (
                <div style={{ display: 'flex', gap: 8 }}>
                  {waConfirm && (
                    <a href={waConfirm} target="_blank" rel="noopener noreferrer"
                      style={{ ...s.actionBtn, background: '#DCFCE7', color: '#15803D', border: '1px solid #4ADE80', flex: 1, textDecoration: 'none', justifyContent: 'center' }}>
                      <MessageCircle size={13} />Confirmar via WA
                    </a>
                  )}
                  {waDirectUrl && (
                    <a href={waDirectUrl} target="_blank" rel="noopener noreferrer"
                      style={{ ...s.actionBtn, background: 'var(--surface2)', color: 'var(--text2)', border: '1px solid var(--border2)', flex: 1, textDecoration: 'none', justifyContent: 'center' }}>
                      <MessageCircle size={13} />Abrir WA
                    </a>
                  )}
                </div>
              )}

              {/* Cancelar agendamento */}
              {ag.status !== 'cancelado' && (
                <button style={{ ...s.btnSecondary, color: '#B91C1C', borderColor: '#FCA5A5' }}
                  onClick={() => { setAgDetalhe(null); atualizarStatus(ag, 'cancelado') }}>
                  <XCircle size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Cancelar agendamento
                </button>
              )}
              <button style={s.btnSecondary} onClick={() => setAgDetalhe(null)}>Fechar</button>
          </Modal>
        )
      })()}

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
