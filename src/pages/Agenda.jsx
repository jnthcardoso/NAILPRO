import { useEffect, useState } from 'react'
import { Plus, CheckCircle, Clock, XCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { format, addDays, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const STATUS = {
  confirmado: { label: 'Confirmada', bg: '#E8F5E9', color: '#2E7D32', border: '#43A047' },
  pendente: { label: 'Aguardando', bg: '#FFF3E0', color: '#E65100', border: '#FB8C00' },
  realizado: { label: 'Realizado', bg: '#F3E5F5', color: '#6A1B9A', border: '#9C27B0' },
  cancelado: { label: 'Cancelado', bg: '#FEECEC', color: '#C62828', border: '#EF5350' },
}

export default function Agenda() {
  const { user } = useAuth()
  const [dataSel, setDataSel] = useState(new Date())
  const [agendamentos, setAgendamentos] = useState([])
  const [clientes, setClientes] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ cliente_id: '', servico: '', horario: '', valor: '', status: 'pendente', observacoes: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (user) loadAgenda() }, [user, dataSel])
  useEffect(() => { if (user) loadClientes() }, [user])

  async function loadAgenda() {
    const { data } = await supabase.from('agendamentos').select('*, clientes(nome)').eq('user_id', user.id).eq('data', format(dataSel, 'yyyy-MM-dd')).order('horario')
    setAgendamentos(data || [])
  }

  async function loadClientes() {
    const { data } = await supabase.from('clientes').select('id, nome').eq('user_id', user.id).order('nome')
    setClientes(data || [])
  }

  async function salvarAgendamento() {
    if (!form.cliente_id || !form.horario || !form.servico) return
    setSaving(true)
    await supabase.from('agendamentos').insert({ ...form, user_id: user.id, data: format(dataSel, 'yyyy-MM-dd'), valor: parseFloat(form.valor) || 0 })
    setSaving(false)
    setShowModal(false)
    setForm({ cliente_id: '', servico: '', horario: '', valor: '', status: 'pendente', observacoes: '' })
    loadAgenda()
  }

  async function atualizarStatus(id, status) {
    await supabase.from('agendamentos').update({ status }).eq('id', id)
    loadAgenda()
  }

  return (
    <div style={s.page}>
      <div style={s.datePicker}>
        <button style={s.dateBtn} onClick={() => setDataSel(subDays(dataSel, 1))}><ChevronLeft size={18} /></button>
        <div style={s.dateLabel}>{format(dataSel, "EEEE, dd 'de' MMMM", { locale: ptBR })}</div>
        <button style={s.dateBtn} onClick={() => setDataSel(addDays(dataSel, 1))}><ChevronRight size={18} /></button>
      </div>

      {agendamentos.length === 0 ? (
        <div style={s.empty}>
          <Clock size={32} color="var(--text3)" style={{ marginBottom: 8 }} />
          <p style={{ color: 'var(--text3)', fontSize: 14 }}>Nenhum agendamento neste dia</p>
          <button style={s.emptyBtn} onClick={() => setShowModal(true)}>+ Adicionar agendamento</button>
        </div>
      ) : agendamentos.map(ag => {
        const st = STATUS[ag.status] || STATUS.pendente
        return (
          <div key={ag.id} style={{ ...s.card, borderLeftColor: st.border }}>
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
              {ag.status === 'confirmado' && <button style={{ ...s.actionBtn, background: '#F3E5F5', color: '#6A1B9A' }} onClick={() => atualizarStatus(ag.id, 'realizado')}><CheckCircle size={14} /> Marcar realizado</button>}
              {ag.status !== 'realizado' && ag.status !== 'cancelado' && <button style={{ ...s.actionBtn, background: '#FEECEC', color: '#C62828' }} onClick={() => atualizarStatus(ag.id, 'cancelado')}><XCircle size={14} /> Cancelar</button>}
            </div>
          </div>
        )
      })}

      <button style={s.fab} onClick={() => setShowModal(true)} aria-label="Novo agendamento"><Plus size={22} color="white" /></button>

      {showModal && (
        <div style={s.overlay} onClick={() => setShowModal(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalTitle}>Novo agendamento</div>
            <div style={s.field}><label style={s.label}>Cliente</label>
              <select style={s.input} value={form.cliente_id} onChange={e => setForm({ ...form, cliente_id: e.target.value })}>
                <option value="">Selecionar cliente</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div style={s.field}><label style={s.label}>Serviço</label><input style={s.input} placeholder="Ex: Gel francês..." value={form.servico} onChange={e => setForm({ ...form, servico: e.target.value })} /></div>
            <div style={s.row}>
              <div style={{ ...s.field, flex: 1 }}><label style={s.label}>Horário</label><input style={s.input} type="time" value={form.horario} onChange={e => setForm({ ...form, horario: e.target.value })} /></div>
              <div style={{ ...s.field, flex: 1 }}><label style={s.label}>Valor (R$)</label><input style={s.input} type="number" placeholder="0,00" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} /></div>
            </div>
            <div style={s.field}><label style={s.label}>Observações</label><input style={s.input} placeholder="Opcional..." value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} /></div>
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
  datePicker: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 14px' },
  dateBtn: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', display: 'flex', alignItems: 'center', padding: 4 },
  dateLabel: { fontSize: 14, fontWeight: 500, color: 'var(--text)', textTransform: 'capitalize' },
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
  modal: { background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '24px 20px 36px', width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 12 },
  modalTitle: { fontSize: 16, fontWeight: 600, marginBottom: 4 },
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
  label: { fontSize: 12, fontWeight: 500, color: 'var(--text2)' },
  input: { padding: '9px 12px', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', fontSize: 14, outline: 'none', background: 'var(--surface)', color: 'var(--text)' },
  row: { display: 'flex', gap: 10 },
  btnPrimary: { background: 'var(--pink)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', padding: '12px', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 4 },
  btnSecondary: { background: 'var(--surface2)', color: 'var(--text)', border: '0.5px solid var(--border2)', borderRadius: 'var(--radius-sm)', padding: '11px', fontSize: 14, fontWeight: 500, cursor: 'pointer' },
}