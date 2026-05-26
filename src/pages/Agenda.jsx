import { useEffect, useState } from 'react'
import { Plus, CheckCircle, XCircle, ChevronLeft, ChevronRight, UserPlus, Calendar, CreditCard, MessageCircle, Pencil } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { initTokenClient, criarEvento, excluirEvento, conectarGoogle } from '../lib/googleCalendar'
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
  const [view, setView] = useState('Semana')
  const [dataSel, setDataSel] = useState(new Date())
  const [agendamentos, setAgendamentos] = useState([])
  const [clientes, setClientes] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [showNovaCliente, setShowNovaCliente] = useState(false)
  const [showPagModal, setShowPagModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [agSelecionado, setAgSelecionado] = useState(null)
  const [formPag, setFormPag] = useState({ forma: 'pix', status: 'pago', valor: '' })
  const [form, setForm] = useState({ cliente_id: '', servico: '', horario: '', valor: '', status: 'pendente', observacoes: '', data: format(new Date(), 'yyyy-MM-dd') })
  const [formEdit, setFormEdit] = useState({ cliente_id: '', servico: '', horario: '', valor: '', status: 'pendente', observacoes: '', data: '' })
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

  useEffect(() => { if (user) loadAgendamentos() }, [user, dataSel, view])
  useEffect(() => { if (user) { loadClientes(); loadServicosPadrao(); loadGoogleConfig() } }, [user])

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
    const { data } = await supabase
      .from('agendamentos')
      .select('*, clientes(id, nome, telefone), pagamentos(id, status, forma, valor)')
      .eq('user_id', user.id)
      .gte('data', inicio).lte('data', fim)
      .order('data').order('horario')
    setAgendamentos(data || [])
  }

  async function loadClientes() {
    const { data } = await supabase.from('clientes').select('id, nome, telefone').eq('user_id', user.id).order('nome')
    setClientes(data || [])
  }

  async function loadServicosPadrao() {
    const { data } = await supabase.from('configuracoes').select('servicos_padrao').eq('user_id', user.id).single()
    if (data?.servicos_padrao?.length) setServicosPadrao(data.servicos_padrao)
  }

  function showGoogleMsg(msg, tipo = 'info') {
    setGoogleMsg({ msg, tipo })
    setTimeout(() => setGoogleMsg(null), 4000)
  }

  async function loadGoogleConfig() {
    const { data } = await supabase.from('configuracoes').select('google_conectado, duracao_atendimento').eq('user_id', user.id).single()
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
    setSaving(true)
    const { data: ag } = await supabase
      .from('agendamentos')
      .insert({ ...form, user_id: user.id, valor: parseFloat(form.valor) || 0 })
      .select('*, clientes(nome)')
      .single()
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
    setSaving(false)
    setShowModal(false)
    setForm({ cliente_id: '', servico: '', horario: '', valor: '', status: 'pendente', observacoes: '', data: format(dataSel, 'yyyy-MM-dd') })
    loadAgendamentos()
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
    })
    setEditando(ag)
  }

  async function atualizarAgendamento() {
    if (!editando) return
    setSavingEdit(true)
    await supabase.from('agendamentos').update({
      cliente_id: formEdit.cliente_id,
      servico: formEdit.servico,
      data: formEdit.data,
      horario: formEdit.horario,
      valor: parseFloat(formEdit.valor) || 0,
      status: formEdit.status,
      observacoes: formEdit.observacoes,
    }).eq('id', editando.id)
    setSavingEdit(false)
    setEditando(null)
    loadAgendamentos()
  }

  async function salvarNovaCliente() {
    if (!formCliente.nome) return
    setSavingCliente(true)
    const { data } = await supabase.from('clientes').insert({ ...formCliente, user_id: user.id }).select().single()
    setSavingCliente(false)
    if (data) {
      setClientes(prev => [...prev, data].sort((a, b) => a.nome.localeCompare(b.nome)))
      setForm(f => ({ ...f, cliente_id: data.id }))
      setShowNovaCliente(false)
      setFormCliente({ nome: '', telefone: '' })
    }
  }

  async function atualizarStatus(ag, novoStatus) {
    await supabase.from('agendamentos').update({ status: novoStatus }).eq('id', ag.id)
    if (novoStatus === 'cancelado' && ag.google_event_id && googleConectado) {
      try {
        await excluirEvento(ag.google_event_id)
        showGoogleMsg('Evento removido do Google Agenda ✓', 'success')
      } catch (e) {
        console.error('Google Agenda excluir erro:', e)
        showGoogleMsg(`Google Agenda: ${e.message}`, 'error')
      }
    }
    if (novoStatus === 'realizado') {
      setAgSelecionado(ag)
      setFormPag({ forma: 'pix', status: 'pago', valor: String(ag.valor || '') })
      setShowPagModal(true)
    }
    loadAgendamentos()
  }

  async function salvarPagamento() {
    if (!agSelecionado) return
    setSavingPag(true)
    const pagExistente = agSelecionado.pagamentos?.[0]
    if (pagExistente) {
      await supabase.from('pagamentos').update({
        forma: formPag.forma,
        status: formPag.status,
        valor: parseFloat(formPag.valor) || agSelecionado.valor,
      }).eq('id', pagExistente.id)
    } else {
      await supabase.from('pagamentos').insert({
        user_id: user.id,
        agendamento_id: agSelecionado.id,
        valor: parseFloat(formPag.valor) || agSelecionado.valor || 0,
        forma: formPag.forma,
        status: formPag.status,
        data: agSelecionado.data,
      })
    }
    setSavingPag(false)
    setShowPagModal(false)
    setAgSelecionado(null)
    loadAgendamentos()
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

  function CardAgendamento({ ag }) {
    const st = STATUS[ag.status] || STATUS.pendente
    const pag = ag.pagamentos?.[0]
    const telefone = (ag.clientes?.telefone || '').replace(/\D/g, '')
    const waLink = telefone ? `https://wa.me/55${telefone}` : null
    const waConfirm = buildWhatsAppConfirm(ag)
    return (
      <div style={{ ...s.card, borderLeftColor: st.border }}>
        <div style={s.cardHeader}>
          <div style={s.cardTime}>{ag.horario?.slice(0, 5)}</div>
          <div style={{ flex: 1 }}>
            <div style={s.cardName}>{ag.clientes?.nome}</div>
            <div style={s.cardService}>{ag.servico}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {waLink && (
              <a href={waLink} target="_blank" rel="noreferrer" style={s.waIconBtn} title="Abrir WhatsApp">
                <MessageCircle size={15} />
              </a>
            )}
            <button style={s.editIconBtn} onClick={() => abrirEdicao(ag)} title="Editar agendamento">
              <Pencil size={14} />
            </button>
            <span style={{ ...s.badge, background: st.bg, color: st.color }}>{st.label}</span>
          </div>
        </div>
        {ag.valor > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
            <div style={s.cardValor}>R$ {ag.valor.toFixed(2).replace('.', ',')}</div>
            {pag && (
              <span style={{ ...s.badge, background: pag.status === 'pago' ? '#DCFCE7' : '#FEF3C7', color: pag.status === 'pago' ? '#15803D' : '#92400E', fontSize: 10 }}>
                {pag.status === 'pago' ? '✓ Pago' : '⏳ Pendente'} · {FORMAS.find(f => f.value === pag.forma)?.label.split(' ')[1] || pag.forma}
              </span>
            )}
          </div>
        )}
        <div style={s.cardActions}>
          {ag.status === 'pendente' && (
            <button style={{ ...s.actionBtn, background: '#DCFCE7', color: '#15803D' }} onClick={() => atualizarStatus(ag, 'confirmado')}>
              <CheckCircle size={13} /> Confirmar
            </button>
          )}
          {ag.status === 'confirmado' && (
            <button style={{ ...s.actionBtn, background: '#EDE9FE', color: '#5B21B6' }} onClick={() => atualizarStatus(ag, 'realizado')}>
              <CheckCircle size={13} /> Marcar realizado
            </button>
          )}
          {ag.status === 'realizado' && (
            <button
              style={{ ...s.actionBtn, background: '#DCFCE7', color: '#15803D' }}
              onClick={() => {
                setAgSelecionado(ag)
                setFormPag({ forma: pag?.forma || 'pix', status: pag?.status || 'pago', valor: String(pag?.valor || ag.valor || '') })
                setShowPagModal(true)
              }}
            >
              <CreditCard size={13} /> {pag ? 'Editar pagamento' : 'Registrar pagamento'}
            </button>
          )}
          {ag.status !== 'realizado' && ag.status !== 'cancelado' && waConfirm && (
            <a href={waConfirm} target="_blank" rel="noreferrer" style={{ ...s.actionBtn, background: '#DCFCE7', color: '#15803D', textDecoration: 'none' }}>
              <MessageCircle size={13} /> Confirmar via WhatsApp
            </a>
          )}
          {ag.status !== 'realizado' && ag.status !== 'cancelado' && (
            <button style={{ ...s.actionBtn, background: '#FEE2E2', color: '#B91C1C' }} onClick={() => atualizarStatus(ag, 'cancelado')}>
              <XCircle size={13} /> Cancelar
            </button>
          )}
        </div>
      </div>
    )
  }

  function ViewDia() {
    const dia = agendamentos.filter(a => a.data === format(dataSel, 'yyyy-MM-dd'))
    if (dia.length === 0) return (
      <div style={s.empty}>
        <Calendar size={34} color="var(--text3)" style={{ marginBottom: 10 }} />
        <p style={{ color: 'var(--text3)', fontSize: 14 }}>Nenhum agendamento neste dia</p>
        <button style={s.emptyBtn} onClick={() => { setForm(f => ({ ...f, data: format(dataSel, 'yyyy-MM-dd') })); setShowModal(true) }}>
          + Adicionar agendamento
        </button>
      </div>
    )
    return dia.map(ag => <CardAgendamento key={ag.id} ag={ag} />)
  }

  function ViewSemana() {
    const dias = eachDayOfInterval({ start: startOfWeek(dataSel, { locale: ptBR }), end: endOfWeek(dataSel, { locale: ptBR }) })
    return (
      <div>
        <div style={s.weekGrid}>
          {dias.map(dia => {
            const agsDia = agendamentos.filter(a => a.data === format(dia, 'yyyy-MM-dd'))
            const hoje = isToday(dia)
            return (
              <div key={dia.toISOString()} style={{ ...s.weekDay, ...(hoje ? s.weekDayHoje : {}) }} onClick={() => { setDataSel(dia); setView('Dia') }}>
                <div style={{ ...s.weekDayLabel, ...(hoje ? { color: 'var(--pink)' } : {}) }}>{format(dia, 'EEE', { locale: ptBR })}</div>
                <div style={{ ...s.weekDayNum, ...(hoje ? s.weekDayNumHoje : {}) }}>{format(dia, 'd')}</div>
                {agsDia.length > 0 && (
                  <div style={s.weekDots}>
                    {agsDia.slice(0, 3).map((ag, i) => {
                      const st = STATUS[ag.status] || STATUS.pendente
                      return <div key={i} style={{ ...s.weekDot, background: st.border }} />
                    })}
                    {agsDia.length > 3 && <div style={{ fontSize: 9, color: 'var(--text3)' }}>+{agsDia.length - 3}</div>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div style={{ marginTop: 14 }}>
          {dias.map(dia => {
            const agsDia = agendamentos.filter(a => a.data === format(dia, 'yyyy-MM-dd'))
            if (agsDia.length === 0) return null
            return (
              <div key={dia.toISOString()} style={{ marginBottom: 18 }}>
                <div style={s.sectionTitle}>
                  {format(dia, "EEEE, dd 'de' MMM", { locale: ptBR })}
                  {isToday(dia) && <span style={s.hojeChip}>hoje</span>}
                </div>
                {agsDia.map(ag => <CardAgendamento key={ag.id} ag={ag} />)}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  function ViewMes() {
    const inicio = startOfMonth(dataSel)
    const fim = endOfMonth(dataSel)
    const dias = eachDayOfInterval({ start: startOfWeek(inicio, { locale: ptBR }), end: endOfWeek(fim, { locale: ptBR }) })
    const semanas = []
    for (let i = 0; i < dias.length; i += 7) semanas.push(dias.slice(i, i + 7))
    return (
      <div>
        <div style={s.calHeader}>
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
            <div key={d} style={s.calHeaderCell}>{d}</div>
          ))}
        </div>
        {semanas.map((semana, si) => (
          <div key={si} style={s.calRow}>
            {semana.map(dia => {
              const agsDia = agendamentos.filter(a => a.data === format(dia, 'yyyy-MM-dd'))
              const hoje = isToday(dia)
              const doMes = isSameMonth(dia, dataSel)
              return (
                <div
                  key={dia.toISOString()}
                  style={{ ...s.calCell, ...(!doMes ? s.calCellOut : {}), ...(hoje ? s.calCellHoje : {}) }}
                  onClick={() => { setDataSel(dia); setView('Dia') }}
                >
                  <div style={{ ...s.calNum, ...(hoje ? s.calNumHoje : {}) }}>{format(dia, 'd')}</div>
                  {agsDia.slice(0, 2).map((ag, i) => {
                    const st = STATUS[ag.status] || STATUS.pendente
                    return <div key={i} style={{ ...s.calEvent, background: st.bg, color: st.color }}>{ag.horario?.slice(0, 5)} {ag.clientes?.nome?.split(' ')[0]}</div>
                  })}
                  {agsDia.length > 2 && <div style={s.calMore}>+{agsDia.length - 2}</div>}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div style={s.page}>
      <div style={s.viewTabs}>
        {VIEWS.map(v => (
          <button key={v} style={{ ...s.viewTab, ...(view === v ? s.viewTabActive : {}) }} onClick={() => setView(v)}>{v}</button>
        ))}
        {googleConectado && (
          <button
            onClick={googlePronto ? undefined : handleReconectarGoogle}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 'var(--radius-pill)', border: 'none', background: googlePronto ? '#DCFCE7' : '#FEF3C7', color: googlePronto ? '#15803D' : '#92400E', fontSize: 11, fontWeight: 600, cursor: googlePronto ? 'default' : 'pointer', flexShrink: 0 }}
            title={googlePronto ? 'Google Agenda ativo' : 'Clique para reconectar'}
          >
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: googlePronto ? '#16A34A' : '#D97706', display: 'inline-block' }} />
            {googlePronto ? 'Google' : 'Reconectar'}
          </button>
        )}
      </div>
      <div style={s.nav}>
        <button style={s.navBtn} onClick={() => navegar(-1)}><ChevronLeft size={18} /></button>
        <div style={s.navLabel}>{labelNavegacao()}</div>
        <button style={s.navBtn} onClick={() => navegar(1)}><ChevronRight size={18} /></button>
      </div>
      {view === 'Dia' && <ViewDia />}
      {view === 'Semana' && <ViewSemana />}
      {view === 'Mês' && <ViewMes />}

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
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
                  {servicosPadrao.map(sv => (
                    <button key={sv} style={{ ...s.actionBtn, background: formEdit.servico === sv ? 'var(--pink-light)' : 'var(--surface2)', color: formEdit.servico === sv ? 'var(--pink)' : 'var(--text2)', border: '1px solid ' + (formEdit.servico === sv ? 'var(--pink-mid)' : 'var(--border2)') }} onClick={() => setFormEdit({ ...formEdit, servico: sv })}>
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
        <div style={s.overlay} onClick={() => setShowPagModal(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalTitle}>💳 Registrar pagamento</div>

            <div style={s.pagInfo}>
              <div style={s.pagCliente}>{agSelecionado.clientes?.nome}</div>
              <div style={s.pagServico}>{agSelecionado.servico} · {agSelecionado.data}</div>
            </div>

            <div style={s.field}>
              <label style={s.label}>Valor (R$)</label>
              <input
                style={{ ...s.input, fontFamily: "'JetBrains Mono', monospace" }}
                type="number"
                placeholder="0,00"
                value={formPag.valor}
                onChange={e => setFormPag({ ...formPag, valor: e.target.value })}
              />
            </div>

            <div style={s.field}>
              <label style={s.label}>Forma de pagamento</label>
              <div style={s.formasGrid}>
                {FORMAS.map(f => (
                  <button
                    key={f.value}
                    style={{ ...s.formaBtn, ...(formPag.forma === f.value ? s.formaBtnActive : {}) }}
                    onClick={() => setFormPag({ ...formPag, forma: f.value })}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={s.field}>
              <label style={s.label}>Status do pagamento</label>
              <div style={s.statusGrid}>
                <button
                  style={{ ...s.statusBtn2, ...(formPag.status === 'pago' ? s.statusPagoActive : {}) }}
                  onClick={() => setFormPag({ ...formPag, status: 'pago' })}
                >
                  ✓ Pago
                </button>
                <button
                  style={{ ...s.statusBtn2, ...(formPag.status === 'pendente' ? s.statusPendenteActive : {}) }}
                  onClick={() => setFormPag({ ...formPag, status: 'pendente' })}
                >
                  ⏳ Pendente
                </button>
              </div>
            </div>

            <button style={s.btnPrimary} onClick={salvarPagamento} disabled={savingPag}>
              {savingPag ? 'Salvando...' : 'Confirmar pagamento'}
            </button>
            <button style={s.btnSecondary} onClick={() => setShowPagModal(false)}>Fechar</button>
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
                <input style={{ ...s.input, marginTop: 8 }} placeholder="WhatsApp" value={formCliente.telefone} onChange={e => setFormCliente({ ...formCliente, telefone: e.target.value })} />
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
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
                  {servicosPadrao.map(sv => (
                    <button key={sv} style={{ ...s.actionBtn, background: form.servico === sv ? 'var(--pink-light)' : 'var(--surface2)', color: form.servico === sv ? 'var(--pink)' : 'var(--text2)', border: '1px solid ' + (form.servico === sv ? 'var(--pink-mid)' : 'var(--border2)') }} onClick={() => setForm({ ...form, servico: sv })}>
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
  page: { padding: 16, paddingBottom: 80 },
  sectionTitle: { fontSize: 12, fontWeight: 600, color: 'var(--text2)', textTransform: 'capitalize', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 6 },
  hojeChip: { fontSize: 10, background: 'var(--pink)', color: 'white', borderRadius: 20, padding: '2px 9px', fontWeight: 700 },
  viewTabs: { display: 'flex', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', padding: 3, marginBottom: 12, gap: 3, boxShadow: 'var(--shadow-xs)', border: '1px solid var(--border)' },
  viewTab: { flex: 1, padding: '8px 0', borderRadius: 7, fontSize: 13, fontWeight: 500, background: 'transparent', color: 'var(--text3)', border: 'none', cursor: 'pointer', transition: 'all 0.15s' },
  viewTabActive: { background: 'white', color: 'var(--pink)', boxShadow: 'var(--shadow-xs)', fontWeight: 700 },
  nav: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', boxShadow: 'var(--shadow-xs)' },
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
  calNum: { fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 500, color: 'var(--text)', marginBottom: 2 },
  calNumHoje: { color: 'var(--pink)', fontWeight: 700 },
  calEvent: { fontSize: 9, borderRadius: 3, padding: '1px 4px', marginBottom: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  calMore: { fontSize: 9, color: 'var(--text3)' },
  card: { background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: '4px solid var(--pink)', borderRadius: 'var(--radius-sm)', padding: '13px 14px', marginBottom: 10, boxShadow: 'var(--shadow-sm)' },
  cardHeader: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 },
  cardTime: { fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 500, color: 'var(--text)', minWidth: 44, background: 'var(--surface2)', borderRadius: 7, padding: '3px 7px', textAlign: 'center' },
  cardName: { fontSize: 14, fontWeight: 700 },
  cardService: { fontSize: 12, color: 'var(--text3)', marginTop: 1 },
  cardValor: { fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 500, color: 'var(--pink)' },
  cardActions: { display: 'flex', gap: 7, flexWrap: 'wrap' },
  actionBtn: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, padding: '5px 11px', borderRadius: 'var(--radius-pill)', border: 'none', cursor: 'pointer', transition: 'opacity 0.15s' },
  waIconBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: '50%', background: '#DCFCE7', color: '#15803D', border: 'none', cursor: 'pointer', textDecoration: 'none', flexShrink: 0 },
  editIconBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: '50%', background: 'var(--surface2)', color: 'var(--text3)', border: '1px solid var(--border)', cursor: 'pointer', flexShrink: 0 },
  badge: { fontSize: 11, padding: '3px 10px', borderRadius: 'var(--radius-pill)', fontWeight: 600, whiteSpace: 'nowrap' },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', textAlign: 'center' },
  emptyBtn: { marginTop: 14, background: 'var(--pink)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', padding: '11px 22px', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: 'var(--shadow-pink)' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(24,7,18,0.52)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
  modal: { background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 13, maxHeight: '90vh', overflowY: 'auto' },
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
  field: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: { fontSize: 12, fontWeight: 600, color: 'var(--text2)' },
  input: { padding: '10px 13px', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', fontSize: 14, background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit' },
  row: { display: 'flex', gap: 10 },
  btnPrimary: { background: 'var(--pink)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', padding: '13px', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 4, boxShadow: 'var(--shadow-pink)', transition: 'background 0.15s' },
  btnSecondary: { background: 'var(--surface2)', color: 'var(--text2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', padding: '12px', fontSize: 14, fontWeight: 500, cursor: 'pointer' },
  linkBtn: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--pink)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 },
  miniForm: { background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', padding: '13px', border: '1px solid var(--pink-mid)' },
}
