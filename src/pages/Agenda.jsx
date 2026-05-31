import { useEffect, useState } from 'react'
import { Plus, CheckCircle, XCircle, ChevronLeft, ChevronRight, UserPlus, Calendar, CreditCard, MessageCircle, Pencil, Search, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useSalao } from '../contexts/SalaoContext'
import { initTokenClient, criarEvento, excluirEvento, conectarGoogle } from '../lib/googleCalendar'
import { useToast } from '../contexts/ToastContext'
import { formatTelefone, unformatTelefone } from '../lib/formatters'
import {
  format, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameMonth, isToday
} from 'date-fns'
import { ptBR } from 'date-fns/locale'

const STATUS = {
  confirmado: { label: 'Confirmada', bg: '#DCFCE7', color: '#15803D', border: '#4ADE80' },
  pendente:   { label: 'Aguardando', bg: '#FEF3C7', color: '#92400E', border: '#FCD34D' },
  realizado:  { label: 'Realizado',  bg: '#EDE9FE', color: '#5B21B6', border: '#A78BFA' },
  cancelado:  { label: 'Cancelado',  bg: '#FEE2E2', color: '#B91C1C', border: '#FCA5A5' },
}

const FORMAS = [
  { value: 'pix',            label: '💠 Pix' },
  { value: 'dinheiro',       label: '💵 Dinheiro' },
  { value: 'cartao_debito',  label: '💳 Débito' },
  { value: 'cartao_credito', label: '💳 Crédito' },
]

const VIEWS = ['Dia', 'Semana', 'Mês']

export default function Agenda() {
  const { user } = useAuth()
  const { salaoId, membroId, gerenciaTudo, isProfissional } = useSalao()
  const { sucesso, erro, aviso, confirmar } = useToast()
  const [view, setView] = useState('Semana')
  const [dataSel, setDataSel] = useState(new Date())
  const [agendamentos, setAgendamentos] = useState([])
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

  useEffect(() => { if (salaoId) loadAgendamentos() }, [salaoId, dataSel, view, filtroProf])

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
    const { data } = await q.order('data').order('horario')
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
      setGooglePronto(true)
      showGoogleMsg('Google Agenda reconectado ✓', 'success')
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
    await supabase.from('agendamentos').update({ status: novoStatus }).eq('id', ag.id)

    if (novoStatus === 'cancelado') {
      if (ag.google_event_id && googleConectado) {
        try { await excluirEvento(ag.google_event_id) } catch (e) { console.error(e) }
      }
      // Toast com undo
      sucesso('Agendamento cancelado', {
        duracao: 5000,
        acaoLabel: 'Desfazer',
        acao: async () => {
          await supabase.from('agendamentos').update({ status: statusAnterior }).eq('id', ag.id)
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
      // Avisa que o agendamento ficará sem pagamento registrado
      erro('⚠️ Agendamento marcado como realizado sem pagamento. Registre depois em "💳 Pagamento" no card.')
    }
    setShowPagModal(false)
    setPagModalObrigatorio(false)
    setAgSelecionado(null)
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
    return `https://wa.me/55${telefone}?text=${encodeURIComponent(msg)}`
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
            <div style={s.cardValor}>R$ {ag.valor.toFixed(2).replace('.', ',')}</div>
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
            <div style={s.cardValor}>R$ {ag.valor.toFixed(2).replace('.', ',')}</div>
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

      {buscaAtiva ? <ViewBusca /> : (
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
        const waDirectUrl = tel ? `https://wa.me/55${tel}` : null
        const [y, m, d] = ag.data.split('-')
        const dataFmt = `${d}/${m}/${y}`
        return (
          <div style={s.overlay} onClick={() => setAgDetalhe(null)}>
            <div style={s.modal} onClick={e => e.stopPropagation()}>
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
                      R$ {ag.valor.toFixed(2).replace('.', ',')}
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
                  onClick={() => { setAgDetalhe(null); setAgSelecionado(ag); setFormPag({ forma: pag?.forma || 'pix', status: pag?.status || 'pago', valor: String(pag?.valor || ag.valor || '') }); setShowPagModal(true) }}>
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
            </div>
          </div>
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
        <div style={s.overlay} onClick={() => setEditando(null)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalTitle}>✏️ Editar agendamento</div>

            <div style={s.field}>
              <label style={s.label}>Cliente</label>
              <select style={s.input} value={formEdit.cliente_id} onChange={e => setFormEdit({ ...formEdit, cliente_id: e.target.value })}>
                <option value="">Selecionar cliente</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>

            <div style={s.field}>
              <label style={s.label}>Serviço</label>
              <input style={s.input} placeholder="Ex: Gel francês, Manutenção..." value={formEdit.servico} onChange={e => setFormEdit({ ...formEdit, servico: e.target.value })} />
              {servicosPadrao.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 5 }}>
                  {servicosPadrao.map(sv => (
                    <button key={sv} style={{ ...s.actionBtn, flexShrink: 0, background: formEdit.servico === sv ? 'var(--pink-light)' : 'var(--surface2)', color: formEdit.servico === sv ? 'var(--pink)' : 'var(--text2)', border: '1px solid ' + (formEdit.servico === sv ? 'var(--pink-mid)' : 'var(--border2)') }} onClick={() => setFormEdit({ ...formEdit, servico: sv })}>
                      {sv}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={s.row}>
              <div style={{ ...s.field, flex: 1 }}>
                <label style={s.label}>Data</label>
                <input style={s.input} type="date" value={formEdit.data} onChange={e => setFormEdit({ ...formEdit, data: e.target.value })} />
              </div>
              <div style={{ ...s.field, flex: 1 }}>
                <label style={s.label}>Horário</label>
                <input style={s.input} type="time" value={formEdit.horario} onChange={e => setFormEdit({ ...formEdit, horario: e.target.value })} />
              </div>
            </div>

            <div style={s.row}>
              <div style={{ ...s.field, flex: 1 }}>
                <label style={s.label}>Valor (R$)</label>
                <input style={{ ...s.input, fontFamily: "'JetBrains Mono', monospace" }} type="number" placeholder="0,00" value={formEdit.valor} onChange={e => setFormEdit({ ...formEdit, valor: e.target.value })} />
              </div>
              <div style={{ ...s.field, flex: 1 }}>
                <label style={s.label}>Status</label>
                <select style={s.input} value={formEdit.status} onChange={e => setFormEdit({ ...formEdit, status: e.target.value })}>
                  <option value="pendente">Aguardando</option>
                  <option value="confirmado">Confirmada</option>
                  <option value="realizado">Realizado</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
            </div>

            {gerenciaTudo && profissionais.length > 1 && (
              <div style={s.field}>
                <label style={s.label}>Profissional</label>
                <select style={s.input} value={formEdit.profissional_id} onChange={e => setFormEdit({ ...formEdit, profissional_id: e.target.value })}>
                  <option value="">Selecionar profissional</option>
                  {profissionais.map(p => <option key={p.id} value={p.id}>{p.nome}{p.papel === 'dona' ? ' (dona)' : p.papel === 'recepcionista' ? ' (recepção)' : ''}</option>)}
                </select>
              </div>
            )}

            <div style={s.field}>
              <label style={s.label}>Observações</label>
              <input style={s.input} placeholder="Opcional..." value={formEdit.observacoes} onChange={e => setFormEdit({ ...formEdit, observacoes: e.target.value })} />
            </div>

            <button style={s.btnPrimary} onClick={atualizarAgendamento} disabled={savingEdit}>{savingEdit ? 'Salvando...' : 'Salvar alterações'}</button>
            <button style={s.btnSecondary} onClick={() => setEditando(null)}>Cancelar</button>
          </div>
        </div>
      )}

      {/* ── Modal de pagamento ──────────────── */}
      {showPagModal && agSelecionado && (
        <div style={s.overlay} onClick={fecharPagModal}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalTitle}>💳 Registrar pagamento</div>

            <div style={s.pagInfo}>
              <div style={s.pagCliente}>{agSelecionado.clientes?.nome}</div>
              <div style={s.pagServico}>{agSelecionado.servico} · {agSelecionado.data}</div>
            </div>

            {/* Toggle: 1 forma ou 2 formas */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <button
                style={{ ...s.statusBtn2, flex: 1, ...(formPag.modo === 'simples' ? s.statusPagoActive : {}) }}
                onClick={() => setFormPag({ ...formPag, modo: 'simples', valor2: '' })}
              >
                1 forma
              </button>
              <button
                style={{ ...s.statusBtn2, flex: 1, ...(formPag.modo === 'duplo' ? { background: '#EDE9FE', color: '#5B21B6', border: '1.5px solid #A78BFA' } : {}) }}
                onClick={() => {
                  const totalAtual = parseFloat(formPag.valor) || 0
                  const metade = totalAtual > 0 ? (totalAtual / 2).toFixed(2) : ''
                  setFormPag({ ...formPag, modo: 'duplo', valor: metade, valor2: metade })
                }}
              >
                2 formas
              </button>
            </div>

            {/* Forma 1 */}
            <div style={s.field}>
              <label style={s.label}>{formPag.modo === 'duplo' ? '1ª forma — Valor (R$)' : 'Valor (R$)'}</label>
              <input
                style={{ ...s.input, fontFamily: "'JetBrains Mono', monospace" }}
                type="number" placeholder="0,00"
                value={formPag.valor}
                onChange={e => setFormPag({ ...formPag, valor: e.target.value })}
              />
            </div>
            <div style={s.field}>
              <label style={s.label}>{formPag.modo === 'duplo' ? '1ª forma de pagamento' : 'Forma de pagamento'}</label>
              <div style={s.formasGrid}>
                {FORMAS.map(f => (
                  <button key={f.value}
                    style={{ ...s.formaBtn, ...(formPag.forma === f.value ? s.formaBtnActive : {}) }}
                    onClick={() => setFormPag({ ...formPag, forma: f.value })}
                  >{f.label}</button>
                ))}
              </div>
            </div>

            {/* Forma 2 (só no modo duplo) */}
            {formPag.modo === 'duplo' && (
              <>
                <div style={{ height: 1, background: 'var(--border)', margin: '4px 0 12px' }} />
                <div style={s.field}>
                  <label style={s.label}>2ª forma — Valor (R$)</label>
                  <input
                    style={{ ...s.input, fontFamily: "'JetBrains Mono', monospace" }}
                    type="number" placeholder="0,00"
                    value={formPag.valor2}
                    onChange={e => setFormPag({ ...formPag, valor2: e.target.value })}
                  />
                </div>
                <div style={s.field}>
                  <label style={s.label}>2ª forma de pagamento</label>
                  <div style={s.formasGrid}>
                    {FORMAS.map(f => (
                      <button key={f.value}
                        style={{ ...s.formaBtn, ...(formPag.forma2 === f.value ? s.formaBtnActive : {}) }}
                        onClick={() => setFormPag({ ...formPag, forma2: f.value })}
                      >{f.label}</button>
                    ))}
                  </div>
                </div>
                {/* Total */}
                {(parseFloat(formPag.valor) || 0) + (parseFloat(formPag.valor2) || 0) > 0 && (
                  <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>
                    Total: <strong style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      R$ {((parseFloat(formPag.valor) || 0) + (parseFloat(formPag.valor2) || 0)).toFixed(2)}
                    </strong>
                  </div>
                )}
              </>
            )}

            <div style={s.field}>
              <label style={s.label}>Status</label>
              <div style={s.statusGrid}>
                <button style={{ ...s.statusBtn2, ...(formPag.status === 'pago' ? s.statusPagoActive : {}) }}
                  onClick={() => setFormPag({ ...formPag, status: 'pago' })}>✓ Pago</button>
                <button style={{ ...s.statusBtn2, ...(formPag.status === 'pendente' ? s.statusPendenteActive : {}) }}
                  onClick={() => setFormPag({ ...formPag, status: 'pendente' })}>⏳ Pendente</button>
              </div>
            </div>

            <button style={s.btnPrimary} onClick={salvarPagamento} disabled={savingPag}>
              {savingPag ? 'Salvando...' : 'Confirmar pagamento'}
            </button>
            <button style={s.btnSecondary} onClick={fecharPagModal}>
              {pagModalObrigatorio ? 'Registrar depois' : 'Fechar'}
            </button>
          </div>
        </div>
      )}

      {/* ── Modal novo agendamento ──────────── */}
      {showModal && (
        <div style={s.overlay} onClick={() => setShowModal(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalTitle}>Novo agendamento</div>

            <div style={s.field}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <label style={s.label}>Cliente</label>
                <button style={s.linkBtn} onClick={() => setShowNovaCliente(true)}><UserPlus size={13} /> Nova cliente</button>
              </div>
              <select style={s.input} value={form.cliente_id} onChange={e => setForm({ ...form, cliente_id: e.target.value })}>
                <option value="">Selecionar cliente</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>

            {showNovaCliente && (
              <div style={s.miniForm}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--pink)', marginBottom: 8 }}>Nova cliente rápida</div>
                <input style={s.input} placeholder="Nome *" value={formCliente.nome} onChange={e => setFormCliente({ ...formCliente, nome: e.target.value })} />
                <input style={{ ...s.input, marginTop: 8 }} placeholder="(51) 99999-9999" value={formatTelefone(formCliente.telefone)} onChange={e => setFormCliente({ ...formCliente, telefone: unformatTelefone(e.target.value) })} inputMode="numeric" />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button style={{ ...s.btnPrimary, flex: 1, padding: '9px' }} onClick={salvarNovaCliente} disabled={savingCliente}>{savingCliente ? '...' : 'Salvar'}</button>
                  <button style={{ ...s.btnSecondary, flex: 1, padding: '9px' }} onClick={() => setShowNovaCliente(false)}>Cancelar</button>
                </div>
              </div>
            )}

            <div style={s.field}>
              <label style={s.label}>Serviço</label>
              <input style={s.input} placeholder="Ex: Gel francês, Manutenção..." value={form.servico} onChange={e => setForm({ ...form, servico: e.target.value })} />
              {servicosPadrao.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 5 }}>
                  {servicosPadrao.map(sv => (
                    <button key={sv} style={{ ...s.actionBtn, flexShrink: 0, background: form.servico === sv ? 'var(--pink-light)' : 'var(--surface2)', color: form.servico === sv ? 'var(--pink)' : 'var(--text2)', border: '1px solid ' + (form.servico === sv ? 'var(--pink-mid)' : 'var(--border2)') }} onClick={() => setForm({ ...form, servico: sv })}>
                      {sv}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div style={s.row}>
              <div style={{ ...s.field, flex: 1 }}>
                <label style={s.label}>Data</label>
                <input style={s.input} type="date" value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} />
              </div>
              <div style={{ ...s.field, flex: 1 }}>
                <label style={s.label}>Horário</label>
                <input style={s.input} type="time" value={form.horario} onChange={e => setForm({ ...form, horario: e.target.value })} />
              </div>
            </div>
            <div style={s.row}>
              <div style={{ ...s.field, flex: 1 }}>
                <label style={s.label}>Valor (R$)</label>
                <input style={{ ...s.input, fontFamily: "'JetBrains Mono', monospace" }} type="number" placeholder="0,00" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} />
              </div>
              <div style={{ ...s.field, flex: 1 }}>
                <label style={s.label}>Status</label>
                <select style={s.input} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  <option value="pendente">Aguardando</option>
                  <option value="confirmado">Confirmada</option>
                </select>
              </div>
            </div>
            {gerenciaTudo && profissionais.length > 1 && (
              <div style={s.field}>
                <label style={s.label}>Profissional</label>
                <select style={s.input} value={form.profissional_id} onChange={e => setForm({ ...form, profissional_id: e.target.value })}>
                  <option value="">Selecionar profissional</option>
                  {profissionais.map(p => <option key={p.id} value={p.id}>{p.nome}{p.papel === 'dona' ? ' (dona)' : p.papel === 'recepcionista' ? ' (recepção)' : ''}</option>)}
                </select>
              </div>
            )}
            <div style={s.field}>
              <label style={s.label}>Observações</label>
              <input style={s.input} placeholder="Opcional..." value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} />
            </div>
            <button style={s.btnPrimary} onClick={salvarAgendamento} disabled={saving}>{saving ? 'Salvando...' : 'Salvar agendamento'}</button>
            <button style={s.btnSecondary} onClick={() => setShowModal(false)}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}

const s = {
  page: { padding: 16, paddingBottom: 80, overflowX: 'hidden' },
  sectionTitle: { fontSize: 12, fontWeight: 600, color: 'var(--text2)', textTransform: 'capitalize', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 6 },
  hojeChip: { fontSize: 10, background: 'var(--pink)', color: 'white', borderRadius: 20, padding: '2px 9px', fontWeight: 700 },
  viewTabs: { display: 'flex', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', padding: 3, marginBottom: 12, gap: 3, boxShadow: 'var(--shadow-xs)', border: '1px solid var(--border)' },
  viewTab: { flex: 1, padding: '8px 0', borderRadius: 7, fontSize: 13, fontWeight: 500, background: 'transparent', color: 'var(--text3)', border: 'none', cursor: 'pointer', transition: 'all 0.15s' },
  viewTabActive: { background: 'white', color: 'var(--pink)', boxShadow: 'var(--shadow-xs)', fontWeight: 700 },
  nav: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', boxShadow: 'var(--shadow-xs)' },
  buscaWrap: { display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '9px 12px', marginBottom: 12, boxShadow: 'var(--shadow-xs)' },
  buscaInput: { flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: 'var(--text)', fontFamily: 'inherit' },
  buscaClear: { background: 'var(--surface2)', border: 'none', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text2)', flexShrink: 0 },
  buscaResumo: { fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 },
  cardDataBusca: { display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 44, background: 'var(--surface2)', borderRadius: 7, padding: '4px 6px' },
  cardDataBuscaDia: { fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, color: 'var(--text)' },
  cardDataBuscaHora: { fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--text3)', marginTop: 1 },
  profFiltro: { display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 14, paddingBottom: 2 },
  profChip: { flexShrink: 0, padding: '6px 14px', borderRadius: 'var(--radius-pill)', fontSize: 12.5, fontWeight: 600, background: 'var(--surface)', color: 'var(--text2)', border: '1px solid var(--border)', cursor: 'pointer', whiteSpace: 'nowrap' },
  profChipAtivo: { background: 'var(--pink)', color: 'white', borderColor: 'var(--pink)' },
  navBtn: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', display: 'flex', alignItems: 'center', padding: 4 },
  navLabel: { fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 14, fontWeight: 700, color: 'var(--text)', textTransform: 'capitalize' },
  weekGrid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 },
  weekDay: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '6px 2px', borderRadius: 9, cursor: 'pointer', background: 'var(--surface2)', border: '1px solid var(--border)' },
  weekDayHoje: { background: 'var(--pink-light)', border: '1px solid var(--pink-mid)' },
  weekDayLabel: { fontSize: 10, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase' },
  weekDayNum: { fontFamily: "'JetBrains Mono', monospace", fontSize: 15, fontWeight: 500, color: 'var(--text)', margin: '2px 0' },
  weekDayNumHoje: { color: 'var(--pink)' },
  weekDots: { display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' },
  weekDot: { width: 5, height: 5, borderRadius: '50%' },
  calHeader: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 2 },
  calHeaderCell: { fontSize: 10, fontWeight: 700, color: 'var(--text3)', textAlign: 'center', padding: '4px 0', textTransform: 'uppercase' },
  calRow: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, marginBottom: 1 },
  calCell: { minHeight: 54, padding: '3px 4px', background: 'var(--surface)', border: '1px solid var(--border)', cursor: 'pointer', borderRadius: 5 },
  calCellOut: { background: 'var(--surface2)', opacity: 0.5 },
  calCellHoje: { background: 'var(--pink-light)', border: '1px solid var(--pink-mid)' },
  calCellSel: { background: 'var(--pink-light)', border: '2px solid var(--pink)', outline: '2px solid var(--pink-mid)' },
  calNum: { fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 500, color: 'var(--text)', marginBottom: 2 },
  calNumHoje: { color: 'var(--pink)', fontWeight: 700 },
  calEvent: { fontSize: 9, borderRadius: 3, padding: '1px 4px', marginBottom: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', display: 'block' },
  calMore: { fontSize: 9, color: 'var(--text3)' },
  card: { background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: '4px solid var(--pink)', borderRadius: 'var(--radius-sm)', padding: '13px 14px', marginBottom: 10, boxShadow: 'var(--shadow-sm)', position: 'relative' },
  cardHeader: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 },
  cardTime: { fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 500, color: 'var(--text)', minWidth: 44, background: 'var(--surface2)', borderRadius: 7, padding: '3px 7px', textAlign: 'center' },
  cardName: { fontSize: 14, fontWeight: 700 },
  cardService: { fontSize: 12, color: 'var(--text3)', marginTop: 1 },
  cardValor: { fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 500, color: 'var(--pink)' },
  actionBtn: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 'var(--radius-pill)', border: 'none', cursor: 'pointer', transition: 'opacity 0.15s', fontFamily: 'inherit' },
  badge: { fontSize: 11, padding: '3px 10px', borderRadius: 'var(--radius-pill)', fontWeight: 600, whiteSpace: 'nowrap' },
  /* Menu 3 pontos */
  menuBtn: { width: 30, height: 30, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text2)', fontSize: 16, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: 1, flexShrink: 0 },
  menu: { position: 'absolute', top: 46, right: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-md)', zIndex: 50, minWidth: 200, overflow: 'hidden' },
  menuItem: { display: 'block', width: '100%', padding: '10px 14px', fontSize: 13, fontWeight: 500, textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text)', textDecoration: 'none', fontFamily: 'inherit' },
  /* Semana colunas */
  weekColunas: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginTop: 10, overflowX: 'auto' },
  weekColuna: { minWidth: 110, display: 'flex', flexDirection: 'column', gap: 4 },
  weekColunaHeader: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '6px 4px', borderRadius: 8, background: 'var(--surface2)', border: '1px solid var(--border)', cursor: 'pointer', marginBottom: 2 },
  weekColunaHeaderHoje: { background: 'var(--pink-light)', border: '1px solid var(--pink-mid)' },
  weekColunaDia: { fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase' },
  weekColunaNum: { fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 500, color: 'var(--text)' },
  weekColunaSemAg: { fontSize: 12, color: 'var(--border2)', textAlign: 'center', padding: '10px 0' },
  /* Card compacto (view semana) */
  cardCompacto: { display: 'flex', alignItems: 'center', gap: 5, background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: '3px solid', borderRadius: 6, padding: '6px 7px', cursor: 'pointer', position: 'relative' },
  cardCompactoHora: { fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 600, color: 'var(--text2)', whiteSpace: 'nowrap' },
  cardCompactoNome: { fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  cardCompactoServ: { fontSize: 10, color: 'var(--text3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', textAlign: 'center' },
  emptyBtn: { marginTop: 14, background: 'var(--pink)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', padding: '11px 22px', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: 'var(--shadow-pink)' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(24,7,18,0.52)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' },
  modal: { background: 'var(--surface)', borderRadius: 18, padding: '18px 16px 20px', width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '92vh', overflowY: 'auto' },
  modalTitle: { fontSize: 17, fontWeight: 700, marginBottom: 2 },
  pagInfo: { background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', padding: '11px 14px', border: '1px solid var(--border)' },
  pagCliente: { fontSize: 14, fontWeight: 700 },
  pagServico: { fontSize: 12, color: 'var(--text3)', marginTop: 3 },
  formasGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginTop: 4 },
  formaBtn: { padding: '11px 8px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--border2)', background: 'var(--surface)', fontSize: 13, fontWeight: 500, cursor: 'pointer', textAlign: 'center', color: 'var(--text2)', transition: 'all 0.15s' },
  formaBtnActive: { border: '1.5px solid var(--pink)', background: 'var(--pink-light)', color: 'var(--pink)', fontWeight: 700 },
  statusGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginTop: 4 },
  statusBtn2: { padding: '11px 8px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--border2)', background: 'var(--surface)', fontSize: 13, fontWeight: 500, cursor: 'pointer', textAlign: 'center', color: 'var(--text2)', transition: 'all 0.15s' },
  statusPagoActive: { border: '1.5px solid #4ADE80', background: '#DCFCE7', color: '#15803D', fontWeight: 700 },
  statusPendenteActive: { border: '1.5px solid #FCD34D', background: '#FEF3C7', color: '#92400E', fontWeight: 700 },
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
  label: { fontSize: 11, fontWeight: 600, color: 'var(--text2)' },
  input: { padding: '10px 13px', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', fontSize: 14, background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit' },
  row: { display: 'flex', gap: 10 },
  btnPrimary: { background: 'var(--pink)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', padding: '13px', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 4, boxShadow: 'var(--shadow-pink)', transition: 'background 0.15s' },
  btnSecondary: { background: 'var(--surface2)', color: 'var(--text2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', padding: '12px', fontSize: 14, fontWeight: 500, cursor: 'pointer' },
  linkBtn: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--pink)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 },
  miniForm: { background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', padding: '13px', border: '1px solid var(--pink-mid)' },
}
