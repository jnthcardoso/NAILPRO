import { useEffect, useState, useCallback } from 'react'
import { Plus, CheckCircle, XCircle, ChevronLeft, ChevronRight, UserPlus, Calendar } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  format, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, isSameMonth, isToday, parseISO
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
const STATUS = {
  confirmado: { label: 'Confirmada', bg: '#E8F5E9', color: '#2E7D32', border: '#43A047' },
  pendente:   { label: 'Aguardando', bg: '#FFF3E0', color: '#E65100', border: '#FB8C00' },
  realizado:  { label: 'Realizado',  bg: '#F3E5F5', color: '#6A1B9A', border: '#9C27B0' },
  cancelado:  { label: 'Cancelado',  bg: '#FEECEC', color: '#C62828', border: '#EF5350' },
}

const VIEWS = ['Dia', 'Semana', 'Mês']

export default function Agenda() {
  const { user } = useAuth()
  const [view, setView] = useState('Dia')
  const [dataSel, setDataSel] = useState(new Date())
  const [agendamentos, setAgendamentos] = useState([])
  const [clientes, setClientes] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [showNovaCliente, setShowNovaCliente] = useState(false)
  const [form, setForm] = useState({ cliente_id: '', servico: '', horario: '', valor: '', status: 'pendente', observacoes: '', data: format(new Date(), 'yyyy-MM-dd') })
  const [formCliente, setFormCliente] = useState({ nome: '', telefone: '' })
  const [saving, setSaving] = useState(false)
  const [savingCliente, setSavingCliente] = useState(false)

  useEffect(() => { if (user) loadAgendamentos() }, [user, dataSel, view])
  useEffect(() => { if (user) loadClientes() }, [user])

  async function loadAgendamentos() {
    let inicio, fim
    if (view === 'Dia') {
      inicio = fim = format(dataSel, 'yyyy-MM-dd')
    } else if (view === 'Semana') {
      inicio = format(startOfWeek(dataSel, { locale: ptBR }), 'yyyy-MM-dd')
      fim = format(endOfWeek(dataSel, { locale: ptBR }), 'yyyy-MM-dd')
    } else {
      inicio = format(startOfMonth(dataSel), 'yyyy-MM-dd')
      fim = format(endOfMonth(dataSel), 'yyyy-MM-dd')
    }
    const { data } = await supabase
      .from('agendamentos')
      .select('*, clientes(nome)')
      .eq('user_id', user.id)
      .gte('data', inicio)
      .lte('data', fim)
      .order('data').order('horario')
    setAgendamentos(data || [])
  }

  async function loadClientes() {
    const { data } = await supabase.from('clientes').select('id, nome').eq('user_id', user.id).order('nome')
    setClientes(data || [])
  }

  async function salvarAgendamento() {
    if (!form.cliente_id || !form.horario || !form.servico || !form.data) return
    setSaving(true)
    await supabase.from('agendamentos').insert({
      ...form, user_id: user.id, valor: parseFloat(form.valor) || 0,
    })
    setSaving(false)
    setShowModal(false)
    setForm({ cliente_id: '', servico: '', horario: '', valor: '', status: 'pendente', observacoes: '', data: format(dataSel, 'yyyy-MM-dd') })
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

  async function atualizarStatus(id, status) {
    await supabase.from('agendamentos').update({ status }).eq('id', id)
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
  }function ViewDia() {
    const dia = agendamentos.filter(a => a.data === format(dataSel, 'yyyy-MM-dd'))
    if (dia.length === 0) return (
      <div style={s.empty}>
        <Calendar size={32} color="var(--text3)" style={{ marginBottom: 8 }} />
        <p style={{ color: 'var(--text3)', fontSize: 14 }}>Nenhum agendamento neste dia</p>
        <button style={s.emptyBtn} onClick={() => { setForm(f => ({ ...f, data: format(dataSel, 'yyyy-MM-dd') })); setShowModal(true) }}>+ Adicionar agendamento</button>
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
                <div style={{ ...s.weekDayLabel, ...(hoje ? { color: 'var(--pink)' } : {}) }}>
                  {format(dia, 'EEE', { locale: ptBR })}
                </div>
                <div style={{ ...s.weekDayNum, ...(hoje ? s.weekDayNumHoje : {}) }}>
                  {format(dia, 'd')}
                </div>
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
        <div style={{ marginTop: 12 }}>
          {dias.map(dia => {
            const agsDia = agendamentos.filter(a => a.data === format(dia, 'yyyy-MM-dd'))
            if (agsDia.length === 0) return null
            return (
              <div key={dia.toISOString()} style={{ marginBottom: 16 }}>
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
    const dias = eachDayOfInterval({
      start: startOfWeek(inicio, { locale: ptBR }),
      end: endOfWeek(fim, { locale: ptBR })
    })
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
                <div key={dia.toISOString()} style={{ ...s.calCell, ...(!doMes ? s.calCellOut : {}), ...(hoje ? s.calCellHoje : {}) }}
                  onClick={() => { setDataSel(dia); setView('Dia') }}>
                  <div style={{ ...s.calNum, ...(hoje ? s.calNumHoje : {}) }}>{format(dia, 'd')}</div>
                  {agsDia.slice(0, 2).map((ag, i) => {
                    const st = STATUS[ag.status] || STATUS.pendente
                    return (
                      <div key={i} style={{ ...s.calEvent, background: st.bg, color: st.color }}>
                        {ag.horario?.slice(0, 5)} {ag.clientes?.nome?.split(' ')[0]}
                      </div>
                    )
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

  function CardAgendamento({ ag }) {
    const st = STATUS[ag.status] || STATUS.pendente
    return (
      <div style={{ ...s.card, borderLeftColor: st.border }}>
        <div style={s.cardHeader}>
          <div style={s.cardTime}>{ag.horario?.slice(0, 5)}</div>
          <div style={{ flex: 1 }}>
            <div style={s.cardName}>{ag.clientes?.nome}</div>
            <div style={s.cardService}>{ag.servico}</div>
          </div>
          <span style={{ ...s.badge, background: st.bg, color: st.color }}>{st.label}</span>
        </div>
        {ag.valor > 0 && <div style={s.cardValor}>R$ {ag.valor.toFixed(2).replace('.', ',')}</div>}
        <div style={s.cardActions}>
          {ag.status === 'pendente' && <button style={{ ...s.actionBtn, background: '#E8F5E9', color: '#2E7D32' }} onClick={() => atualizarStatus(ag.id, 'confirmado')}><CheckCircle size={14} /> Confirmar</button>}
          {ag.status === 'confirmado' && <button style={{ ...s.actionBtn, background: '#F3E5F5', color: '#6A1B9A' }} onClick={() => atualizarStatus(ag.id, 'realizado')}><CheckCircle size={14} /> Realizado</button>}
          {ag.status !== 'realizado' && ag.status !== 'cancelado' && <button style={{ ...s.actionBtn, background: '#FEECEC', color: '#C62828' }} onClick={() => atualizarStatus(ag.id, 'cancelado')}><XCircle size={14} /> Cancelar</button>}
        </div>
      </div>
    )
  }return (
    <div style={s.page}>
      <div style={s.viewTabs}>
        {VIEWS.map(v => (
          <button key={v} style={{ ...s.viewTab, ...(view === v ? s.viewTabActive : {}) }} onClick={() => setView(v)}>{v}</button>
        ))}
      </div>
      <div style={s.nav}>
        <button style={s.navBtn} onClick={() => navegar(-1)}><ChevronLeft size={18} /></button>
        <div style={s.navLabel}>{labelNavegacao()}</div>
        <button style={s.navBtn} onClick={() => navegar(1)}><ChevronRight size={18} /></button>
      </div>
      {view === 'Dia' && <ViewDia />}
      {view === 'Semana' && <ViewSemana />}
      {view === 'Mês' && <ViewMes />}
      <button style={s.fab} onClick={() => { setForm(f => ({ ...f, data: format(dataSel, 'yyyy-MM-dd') })); setShowModal(true) }} aria-label="Novo agendamento">
        <Plus size={22} color="white" />
      </button>
      {showModal && (
        <div style={s.overlay} onClick={() => setShowModal(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalTitle}>Novo agendamento</div>
            <div style={s.field}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <label style={s.label}>Cliente</label>
                <button style={s.linkBtn} onClick={() => setShowNovaCliente(true)}>
                  <UserPlus size={13} /> Nova cliente
                </button>
              </div>
              <select style={s.input} value={form.cliente_id} onChange={e => setForm({ ...form, cliente_id: e.target.value })}>
                <option value="">Selecionar cliente</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            {showNovaCliente && (
              <div style={s.miniForm}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--pink)', marginBottom: 8 }}>Nova cliente rápida</div>
                <input style={s.input} placeholder="Nome *" value={formCliente.nome} onChange={e => setFormCliente({ ...formCliente, nome: e.target.value })} />
                <input style={{ ...s.input, marginTop: 8 }} placeholder="WhatsApp" value={formCliente.telefone} onChange={e => setFormCliente({ ...formCliente, telefone: e.target.value })} />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button style={{ ...s.btnPrimary, flex: 1, padding: '8px' }} onClick={salvarNovaCliente} disabled={savingCliente}>{savingCliente ? '...' : 'Salvar'}</button>
                  <button style={{ ...s.btnSecondary, flex: 1, padding: '8px' }} onClick={() => setShowNovaCliente(false)}>Cancelar</button>
                </div>
              </div>
            )}
            <div style={s.field}>
              <label style={s.label}>Serviço</label>
              <input style={s.input} placeholder="Ex: Gel francês, Manutenção..." value={form.servico} onChange={e => setForm({ ...form, servico: e.target.value })} />
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
                <input style={s.input} type="number" placeholder="0,00" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} />
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
  hojeChip: { fontSize: 10, background: 'var(--pink)', color: 'white', borderRadius: 20, padding: '1px 8px', fontWeight: 600 },
  viewTabs: { display: 'flex', background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', padding: 3, marginBottom: 12, gap: 3 },
  viewTab: { flex: 1, padding: '7px 0', borderRadius: 6, fontSize: 13, fontWeight: 500, background: 'transparent', color: 'var(--text3)', border: 'none', cursor: 'pointer', transition: 'all 0.15s' },
  viewTabActive: { background: 'white', color: 'var(--pink)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
  nav: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 14px' },
  navBtn: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', display: 'flex', alignItems: 'center', padding: 4 },
  navLabel: { fontSize: 14, fontWeight: 500, color: 'var(--text)', textTransform: 'capitalize' },
  weekGrid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 },
  weekDay: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '6px 2px', borderRadius: 8, cursor: 'pointer', background: 'var(--surface2)' },
  weekDayHoje: { background: '#FCE4EC' },
  weekDayLabel: { fontSize: 10, color: 'var(--text3)', fontWeight: 500, textTransform: 'uppercase' },
  weekDayNum: { fontSize: 15, fontWeight: 600, color: 'var(--text)', margin: '2px 0' },
  weekDayNumHoje: { color: 'var(--pink)' },
  weekDots: { display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' },
  weekDot: { width: 5, height: 5, borderRadius: '50%' },
  calHeader: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 2 },
  calHeaderCell: { fontSize: 10, fontWeight: 600, color: 'var(--text3)', textAlign: 'center', padding: '4px 0', textTransform: 'uppercase' },
  calRow: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, marginBottom: 1 },
  calCell: { minHeight: 52, padding: '3px 4px', background: 'var(--surface)', border: '0.5px solid var(--border)', cursor: 'pointer', borderRadius: 4 },
  calCellOut: { background: 'var(--surface2)', opacity: 0.5 },
  calCellHoje: { background: '#FCE4EC', border: '1px solid var(--pink-mid)' },
  calNum: { fontSize: 12, fontWeight: 500, color: 'var(--text)', marginBottom: 2 },
  calNumHoje: { color: 'var(--pink)', fontWeight: 700 },
  calEvent: { fontSize: 9, borderRadius: 3, padding: '1px 4px', marginBottom: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  calMore: { fontSize: 9, color: 'var(--text3)' },
  card: { background: 'var(--surface)', border: '0.5px solid var(--border)', borderLeft: '3px solid var(--pink)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', marginBottom: 10 },
  cardHeader: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 },
  cardTime: { fontSize: 13, fontWeight: 600, color: 'var(--text)', minWidth: 42 },
  cardName: { fontSize: 14, fontWeight: 500 },
  cardService: { fontSize: 12, color: 'var(--text3)' },
  cardValor: { fontSize: 13, fontWeight: 600, color: 'var(--pink)', marginBottom: 8 },
  cardActions: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  actionBtn: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 500, padding: '5px 10px', borderRadius: 'var(--radius-pill)', border: 'none', cursor: 'pointer' },
  badge: { fontSize: 11, padding: '2px 9px', borderRadius: 'var(--radius-pill)', fontWeight: 500, whiteSpace: 'nowrap' },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', textAlign: 'center' },
  emptyBtn: { marginTop: 12, background: 'var(--pink)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', padding: '10px 20px', fontSize: 13, fontWeight: 500, cursor: 'pointer' },
  fab: { position: 'fixed', bottom: 76, right: 16, width: 50, height: 50, borderRadius: '50%', background: 'var(--pink)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 10px rgba(194,24,91,0.35)', cursor: 'pointer', zIndex: 99 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
  modal: { background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '24px 20px 36px', width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '90vh', overflowY: 'auto' },
  modalTitle: { fontSize: 16, fontWeight: 600, marginBottom: 4 },
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
  label: { fontSize: 12, fontWeight: 500, color: 'var(--text2)' },
  input: { padding: '9px 12px', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', fontSize: 14, outline: 'none', background: 'var(--surface)', color: 'var(--text)' },
  row: { display: 'flex', gap: 10 },
  btnPrimary: { background: 'var(--pink)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', padding: '12px', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 4 },
  btnSecondary: { background: 'var(--surface2)', color: 'var(--text)', border: '0.5px solid var(--border2)', borderRadius: 'var(--radius-sm)', padding: '11px', fontSize: 14, fontWeight: 500, cursor: 'pointer' },
  linkBtn: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--pink)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 },
  miniForm: { background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', padding: '12px', border: '1px solid var(--pink-light)' },
}