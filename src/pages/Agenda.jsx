import { useEffect, useState, useRef } from 'react'
import { Plus, ChevronLeft, ChevronRight, Search, X, Lock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useSalao } from '../contexts/SalaoContext'
import { criarEvento, excluirEvento, atualizarEvento, conectarGoogle } from '../lib/googleCalendar'
import { useToast } from '../contexts/ToastContext'
import { CardSkeleton } from '../components/common/Skeleton'
import { s } from './Agenda.styles'
import { VIEWS } from './Agenda.constants'
import NovoAgendamentoModal from '../components/agenda/NovoAgendamentoModal'
import BloqueioModal from '../components/agenda/BloqueioModal'
import EditarAgendamentoModal from '../components/agenda/EditarAgendamentoModal'
import PagamentoModal from '../components/agenda/PagamentoModal'
import { ViewDia, ViewSemana, ViewMes, ViewBusca } from '../components/agenda/views'
import DetalheAgendamentoDrawer from '../components/agenda/DetalheAgendamentoDrawer'
import {
  format, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { traduzErro } from '../lib/erros'

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
  const [buscaAberta, setBuscaAberta] = useState(false)
  // Layout 2x2 só no computador; no celular mantém a barra compacta empilhável.
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 769)
  const [resultados, setResultados] = useState([])
  const [buscando, setBuscando] = useState(false)
  // ── Bloqueios de horário ──
  const [bloqueios, setBloqueios] = useState([])
  const [showBloqueio, setShowBloqueio] = useState(false)
  const [savingBloqueio, setSavingBloqueio] = useState(false)
  const [editandoBloqueio, setEditandoBloqueio] = useState(null) // id quando editando
  const BLOQUEIO_VAZIO = { data: format(new Date(), 'yyyy-MM-dd'), dia_inteiro: false, horario_inicio: '12:00', horario_fim: '13:00', motivo: '', profissional_id: '', recorrencia: 'nenhuma', dias_semana: [], data_fim: '' }
  const [formBloqueio, setFormBloqueio] = useState(BLOQUEIO_VAZIO)

  const buscaAtiva = busca.trim().length >= 2

  // Reage ao redimensionar a janela pra alternar entre layout celular e computador.
  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 769)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Controle do auto-sync com Google (evita repetir/loopar tentativas)
  const sincronizandoRef = useRef(false)
  const tentadosGoogleRef = useRef(new Set())

  useEffect(() => { if (salaoId) loadAgendamentos() }, [salaoId, dataSel, view, filtroProf])

  // Recarrega ao voltar o foco para a aba/janela (consistência entre sessões).
  useEffect(() => {
    function aoFocar() { if (document.visibilityState === 'visible' && salaoId) loadAgendamentos() }
    window.addEventListener('focus', aoFocar)
    document.addEventListener('visibilitychange', aoFocar)
    return () => {
      window.removeEventListener('focus', aoFocar)
      document.removeEventListener('visibilitychange', aoFocar)
    }
  }, [salaoId, dataSel, view, filtroProf])

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
      if (showBloqueio) { setShowBloqueio(false); setEditandoBloqueio(null); return }
      if (showPagModal) { setShowPagModal(false); return }
      if (showModal) { setShowModal(false); return }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [agDetalhe, editando, showBloqueio, showPagModal, showModal])

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
    if (error) { erro(traduzErro(error, 'Não foi possível carregar a agenda.')); return }
    setAgendamentos(data || [])
    loadBloqueios(inicio)
  }

  async function loadBloqueios(inicio) {
    // Traz os recorrentes (todos) + os de data única a partir do início visível.
    // O recorte por dia/profissional é feito ao expandir (expandirBloqueios).
    const { data, error } = await supabase
      .from('agenda_bloqueios')
      .select('*, profissional:salao_membros(id, nome)')
      .eq('salao_id', salaoId)
      .or(`recorrencia.eq.semanal,data.gte.${inicio}`)
    if (error) { erro(traduzErro(error, 'Não foi possível carregar os bloqueios da agenda.')); return }
    setBloqueios(data || [])
  }

  // Faixa de datas visível conforme a view atual (mesma lógica do loadAgendamentos).
  function rangeVisivel() {
    if (view === 'Dia') { const d = format(dataSel, 'yyyy-MM-dd'); return { inicio: d, fim: d } }
    if (view === 'Semana') return {
      inicio: format(startOfWeek(dataSel, { locale: ptBR }), 'yyyy-MM-dd'),
      fim: format(endOfWeek(dataSel, { locale: ptBR }), 'yyyy-MM-dd'),
    }
    return { inicio: format(startOfMonth(dataSel), 'yyyy-MM-dd'), fim: format(endOfMonth(dataSel), 'yyyy-MM-dd') }
  }

  // Um bloqueio atinge a data (yyyy-MM-dd)? Considera recorrência semanal.
  function blocoAtingeData(b, dataStr) {
    if (b.recorrencia === 'semanal') {
      const dow = new Date(dataStr + 'T12:00').getDay()
      if (!(b.dias_semana || []).includes(dow)) return false
      if (dataStr < b.data) return false
      if (b.data_fim && dataStr > b.data_fim) return false
      return true
    }
    return b.data === dataStr
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

  function abrirBloqueio() {
    setEditandoBloqueio(null)
    setFormBloqueio({ ...BLOQUEIO_VAZIO, data: format(dataSel, 'yyyy-MM-dd') })
    setShowBloqueio(true)
  }

  function abrirEditarBloqueio(b) {
    setEditandoBloqueio(b.id)
    setFormBloqueio({
      data: b.data,
      dia_inteiro: !!b.dia_inteiro,
      horario_inicio: b.horario_inicio ? b.horario_inicio.slice(0, 5) : '12:00',
      horario_fim: b.horario_fim ? b.horario_fim.slice(0, 5) : '13:00',
      motivo: b.motivo || '',
      profissional_id: b.profissional_id || '',
      recorrencia: b.recorrencia || 'nenhuma',
      dias_semana: b.dias_semana || [],
      data_fim: b.data_fim || '',
    })
    setAgDetalhe(null)
    setShowBloqueio(true)
  }

  async function salvarBloqueio() {
    const f = formBloqueio
    if (!f.data) { erro('Escolha a data do bloqueio.'); return }
    if (f.recorrencia === 'semanal' && (!f.dias_semana || f.dias_semana.length === 0)) {
      erro('Escolha pelo menos um dia da semana para repetir.'); return
    }
    if (!f.dia_inteiro) {
      if (!f.horario_inicio || !f.horario_fim) { erro('Informe início e fim do bloqueio.'); return }
      if (f.horario_fim <= f.horario_inicio) { erro('O fim precisa ser depois do início.'); return }
    }
    // Profissional só bloqueia a própria agenda; dona escolhe (vazio = salão inteiro).
    const profId = isProfissional ? membroId : (f.profissional_id || null)
    const payload = {
      profissional_id: profId,
      data: f.data,
      dia_inteiro: f.dia_inteiro,
      horario_inicio: f.dia_inteiro ? null : f.horario_inicio + ':00',
      horario_fim: f.dia_inteiro ? null : f.horario_fim + ':00',
      motivo: f.motivo?.trim() || null,
      recorrencia: f.recorrencia,
      dias_semana: f.recorrencia === 'semanal' ? f.dias_semana : null,
      data_fim: f.recorrencia === 'semanal' && f.data_fim ? f.data_fim : null,
    }
    setSavingBloqueio(true)
    const { error: opErr } = editandoBloqueio
      ? await supabase.from('agenda_bloqueios').update(payload).eq('id', editandoBloqueio).eq('salao_id', salaoId)
      : await supabase.from('agenda_bloqueios').insert({ ...payload, user_id: user.id, salao_id: salaoId })
    setSavingBloqueio(false)
    if (opErr) { erro(traduzErro(opErr, 'Não foi possível salvar o bloqueio.')); return }
    setShowBloqueio(false)
    sucesso(editandoBloqueio ? 'Bloqueio atualizado' : 'Horário bloqueado')
    setEditandoBloqueio(null)
    loadAgendamentos()
  }

  async function excluirBloqueio(id) {
    const ok = await confirmar({
      titulo: 'Remover bloqueio?',
      mensagem: 'O período volta a ficar disponível para agendamentos.',
      confirmarLabel: 'Remover',
      cancelarLabel: 'Voltar',
      tipo: 'perigo',
    })
    if (!ok) return
    const { error: delErr } = await supabase.from('agenda_bloqueios').delete().eq('id', id).eq('salao_id', salaoId)
    if (delErr) { erro(traduzErro(delErr, 'Não foi possível remover o bloqueio.')); return }
    setAgDetalhe(null)
    sucesso('Bloqueio removido')
    loadAgendamentos()
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
      // Conexão agora vive no servidor (refresh token): se está conectado, está
      // pronto pra sincronizar — sem precisar carregar o GIS nem reconectar.
      setGoogleConectado(true)
      setGooglePronto(true)
    }
  }

  async function handleReconectarGoogle() {
    try {
      await conectarGoogle()
      tentadosGoogleRef.current = new Set() // reconectou: permite retentar os que falharam
      setGoogleConectado(true)
      setGooglePronto(true)
      showGoogleMsg('Google Agenda reconectado ✓', 'success')
      sincronizarGoogle(agendamentos)
    } catch (e) {
      showGoogleMsg('Falha ao reconectar Google Agenda', 'error')
    }
  }

  async function salvarAgendamento() {
    if (!form.cliente_id || !form.horario || !form.servico || !form.data) return
    if (!form.valor || parseFloat(form.valor) <= 0) { erro('Informe o valor do atendimento.'); return }

    // ── Aviso (não trava) se a data/hora já passou — pega erro de digitação,
    // mas permite lançar atendimento retroativo de propósito. ──
    if (new Date(`${form.data}T${form.horario}`) < new Date()) {
      const ok = await confirmar({
        titulo: 'Data no passado',
        mensagem: 'Esse atendimento é de uma data passada. Confirma?',
        confirmarLabel: 'Sim, confirmar',
        cancelarLabel: 'Voltar',
        tipo: 'aviso',
      })
      if (!ok) return
    }

    // profissional que vai realizar (profissional só agenda pra si)
    const profId = isProfissional ? membroId : (form.profissional_id || membroId)

    // ── Aviso (não trava) se cair sobre um bloqueio ──
    const hm = (t) => { const [h, m] = t.slice(0, 5).split(':').map(Number); return h * 60 + m }
    const sobreBloqueio = bloqueios.some(b =>
      blocoAtingeData(b, form.data) &&
      (b.profissional_id == null || b.profissional_id === profId) &&
      (b.dia_inteiro || (hm(form.horario) >= hm(b.horario_inicio) && hm(form.horario) < hm(b.horario_fim)))
    )
    if (sobreBloqueio) aviso('Atenção: esse horário está dentro de um bloqueio — o agendamento será criado mesmo assim.')

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
        // 23505 = índice único de horário: alguém reservou nesse meio-tempo.
        erro(insertError.code === '23505'
          ? 'Esse horário acabou de ser reservado. Escolha outro.'
          : 'Erro ao salvar agendamento. Tente novamente.')
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
      if (updateError) {
        erro(updateError.code === '23505'
          ? 'Esse horário acabou de ser reservado. Escolha outro.'
          : 'Erro ao atualizar agendamento. Tente novamente.')
        return
      }

      // Reflete a edição no Google Agenda (data/hora/serviço). Antes isso não
      // acontecia — o evento ficava no horário antigo. Best-effort, não trava o save.
      if (googleConectado && editando.google_event_id) {
        try {
          const agAtualizado = {
            ...editando,
            data: formEdit.data,
            horario: formEdit.horario,
            servico: formEdit.servico,
            observacoes: formEdit.observacoes,
          }
          const nomeCli = clientes.find(c => c.id === formEdit.cliente_id)?.nome || editando.clientes?.nome || ''
          const r = await atualizarEvento(editando.google_event_id, agAtualizado, nomeCli, duracaoAtend)
          // Se o evento sumiu no Google, atualizarEvento recria e devolve novo id.
          if (r?.id && r.id !== editando.google_event_id) {
            await supabase.from('agendamentos').update({ google_event_id: r.id }).eq('id', editando.id)
          }
        } catch (e) { console.error('Falha ao atualizar evento no Google:', e) }
      }

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
      // Rede de segurança: se o atendimento tem valor e ainda NÃO tem pagamento,
      // já cria um PENDENTE — assim o dinheiro aparece em "A receber" no financeiro
      // mesmo que a pessoa feche o modal sem registrar. Se ela registrar no modal,
      // a RPC (delete+insert) substitui esse pendente pelo pagamento real.
      const semPagamento = (ag.pagamentos?.length || 0) === 0
      if (semPagamento && (ag.valor || 0) > 0) {
        await supabase.rpc('salvar_pagamento_agendamento', {
          p_agendamento_id: ag.id,
          p_data: ag.data,
          p_status: 'pendente',
          p_pagamentos: [{ valor: ag.valor, forma: 'pix' }],
        })
      }
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
      // Apaga os pagamentos antigos e insere os novos numa ÚNICA transação (RPC).
      // Evita perda silenciosa caso o insert falhasse depois do delete.
      const itens = formPag.modo === 'duplo'
        ? [{ valor: v1, forma: formPag.forma }, { valor: v2, forma: formPag.forma2 }]
        : [{ valor: v1, forma: formPag.forma }]

      const { error } = await supabase.rpc('salvar_pagamento_agendamento', {
        p_agendamento_id: agSelecionado.id,
        p_data: agSelecionado.data,
        p_status: formPag.status,
        p_pagamentos: itens,
      })
      if (error) { erro('Erro ao registrar pagamento. Tente novamente.'); return }

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
      aviso('Atendimento realizado e deixado como "A receber" no financeiro. Registre o pagamento quando receber.')
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
  const agsFiltrados = filtroPag === 'todos'
    ? agendamentos
    : agendamentos.filter(a => pagState(a) === filtroPag)
  // Bloqueios entram na mesma lista das views (sempre visíveis — não dependem do
  // filtro de pagamento). Cada ocorrência (inclusive recorrentes) vira um item
  // com tipo 'bloqueio' na data certa; os cards o renderizam diferente.
  const { inicio: iniView, fim: fimView } = rangeVisivel()
  const diasVisiveis = eachDayOfInterval({ start: new Date(iniView + 'T12:00'), end: new Date(fimView + 'T12:00') })
  const bloqueiosItens = []
  for (const b of bloqueios) {
    if (filtroProf && b.profissional_id && b.profissional_id !== filtroProf) continue
    for (const dia of diasVisiveis) {
      const ds = format(dia, 'yyyy-MM-dd')
      if (!blocoAtingeData(b, ds)) continue
      bloqueiosItens.push({
        id: `bloq-${b.id}-${ds}`,
        bloqueioId: b.id,
        bloqueio: b,
        tipo: 'bloqueio',
        data: ds,
        horario: b.dia_inteiro ? null : b.horario_inicio,
        horario_fim: b.horario_fim,
        dia_inteiro: b.dia_inteiro,
        motivo: b.motivo,
        recorrencia: b.recorrencia,
        profissional: b.profissional,
      })
    }
  }
  const hmSort = (t) => { if (!t) return -1; const [h, m] = t.slice(0, 5).split(':').map(Number); return h * 60 + m }
  const agendamentosBase = [...agsFiltrados, ...bloqueiosItens].sort((a, b) => hmSort(a.horario) - hmSort(b.horario))

  return (
    <div style={s.page}>
      {isDesktop ? (
        /* Computador: grade 2x2 — [visões | busca] / [data | filtros+bloquear] */
        <>
          <div style={s.gridTopoDesktop}>
            <div style={{ ...s.viewTabs, marginBottom: 0 }}>
              {VIEWS.map(v => (
                <button key={v} style={{ ...s.viewTab, ...(view === v ? s.viewTabActive : {}) }} onClick={() => setView(v)}>{v}</button>
              ))}
            </div>
            <div style={{ ...s.buscaWrap, marginBottom: 0 }}>
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
              <div style={{ ...s.nav, marginBottom: 0 }}>
                <button style={s.navBtn} onClick={() => navegar(-1)} aria-label="Período anterior"><ChevronLeft size={18} /></button>
                <div style={s.navLabel}>{labelNavegacao()}</div>
                <button style={s.navBtn} onClick={() => navegar(1)} aria-label="Próximo período"><ChevronRight size={18} /></button>
              </div>
            )}
            {!buscaAtiva && (
              <div style={s.filtrosCelDesktop}>
                {[
                  { id: 'todos', label: 'Todos' },
                  { id: 'pago', label: '✓ Pagos' },
                  { id: 'receber', label: '⏳ A receber' },
                ].map(f => (
                  <button key={f.id} style={{ ...s.profChip, ...(filtroPag === f.id ? s.profChipAtivo : {}) }} onClick={() => setFiltroPag(f.id)}>
                    {f.label}
                  </button>
                ))}
                <div style={{ flex: 1 }} />
                <button style={s.toolBtn} onClick={abrirBloqueio}>
                  <Lock size={13} /> Bloquear horário
                </button>
              </div>
            )}
          </div>
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
        </>
      ) : (
        /* Celular: barra compacta empilhável (mantida como está) */
        <>
          <div style={s.barraTopo}>
            <div style={{ ...s.viewTabs, marginBottom: 0, flex: '1 1 180px' }}>
              {VIEWS.map(v => (
                <button key={v} style={{ ...s.viewTab, ...(view === v ? s.viewTabActive : {}) }} onClick={() => setView(v)}>{v}</button>
              ))}
            </div>
            {!buscaAtiva && (
              <div style={{ ...s.nav, marginBottom: 0, flex: '1 1 auto' }}>
                <button style={s.navBtn} onClick={() => navegar(-1)} aria-label="Período anterior"><ChevronLeft size={18} /></button>
                <div style={s.navLabel}>{labelNavegacao()}</div>
                <button style={s.navBtn} onClick={() => navegar(1)} aria-label="Próximo período"><ChevronRight size={18} /></button>
              </div>
            )}
            <button
              style={{ ...s.toolBtn, ...((buscaAberta || buscaAtiva) ? s.toolBtnAtivo : {}) }}
              onClick={() => setBuscaAberta(v => { const aberta = !v; if (!aberta) setBusca(''); return aberta })}
              aria-expanded={buscaAberta || buscaAtiva}
            >
              <Search size={15} /> Buscar
            </button>
          </div>

          {(buscaAberta || buscaAtiva) && (
            <div style={s.buscaWrap}>
              <Search size={16} color="var(--text3)" style={{ flexShrink: 0 }} />
              <input
                style={s.buscaInput}
                placeholder="Buscar por cliente ou serviço..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
                autoFocus
              />
              {busca && (
                <button style={s.buscaClear} onClick={() => setBusca('')} aria-label="Limpar busca">
                  <X size={15} />
                </button>
              )}
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
            <div style={s.barraFiltros}>
              <div style={s.pillsScroll}>
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
              <button className="agenda-acao-mobile-full" style={s.toolBtn} onClick={abrirBloqueio}>
                <Lock size={13} /> Bloquear horário
              </button>
            </div>
          )}
        </>
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
          onExcluirBloqueio={excluirBloqueio}
          onEditarBloqueio={abrirEditarBloqueio}
          onClose={() => setAgDetalhe(null)}
          onConfirmar={() => { atualizarStatus(agDetalhe, 'confirmado'); setAgDetalhe(null) }}
          onRealizar={() => { atualizarStatus(agDetalhe, 'realizado'); setAgDetalhe(null) }}
          onCancelar={() => { setAgDetalhe(null); atualizarStatus(agDetalhe, 'cancelado') }}
          onEditar={() => { setAgDetalhe(null); abrirEdicao(agDetalhe) }}
          onRegistrarPagamento={() => {
            const pags = agDetalhe.pagamentos || []
            setAgDetalhe(null)
            setAgSelecionado(agDetalhe)
            if (pags.length >= 2) {
              // Já tinha pagamento em 2 formas: reabre no modo duplo com os dois
              // lançamentos, pra editar não apagar a 2ª forma sem querer.
              setFormPag({
                forma: pags[0].forma || 'pix', valor: String(pags[0].valor ?? ''),
                status: pags[0].status || 'pago', modo: 'duplo',
                forma2: pags[1].forma || 'cartao_credito', valor2: String(pags[1].valor ?? ''),
              })
            } else {
              const pag = pags[0]
              setFormPag({ forma: pag?.forma || 'pix', status: pag?.status || 'pago', valor: String(pag?.valor || agDetalhe.valor || ''), modo: 'simples', forma2: 'cartao_credito', valor2: '' })
            }
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

      {/* ── Modal de bloqueio de horário ────── */}
      {showBloqueio && (
        <BloqueioModal
          formBloqueio={formBloqueio}
          setFormBloqueio={setFormBloqueio}
          profissionais={profissionais}
          gerenciaTudo={gerenciaTudo}
          saving={savingBloqueio}
          editando={!!editandoBloqueio}
          onSalvar={salvarBloqueio}
          onCancelar={() => { setShowBloqueio(false); setEditandoBloqueio(null) }}
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
