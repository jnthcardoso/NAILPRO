import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default function Financeiro() {
  const { user } = useAuth()
  const [pagamentos, setPagamentos] = useState([])
  const [agendamentos, setAgendamentos] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ agendamento_id: '', valor: '', status: 'pendente', forma: 'pix', data: format(new Date(), 'yyyy-MM-dd') })
  const [saving, setSaving] = useState(false)
  const [filtro, setFiltro] = useState('todos')

  useEffect(() => { if (user) { loadPagamentos(); loadAgendamentos() } }, [user])

  async function loadPagamentos() {
    const inicio = format(startOfMonth(new Date()), 'yyyy-MM-dd')
    const fim = format(endOfMonth(new Date()), 'yyyy-MM-dd')
    const { data } = await supabase.from('pagamentos').select('*, agendamentos(servico, clientes(nome))').eq('user_id', user.id).gte('data', inicio).lte('data', fim).order('data', { ascending: false })
    setPagamentos(data || [])
  }

  async function loadAgendamentos() {
    const { data } = await supabase.from('agendamentos').select('id, servico, data, clientes(nome)').eq('user_id', user.id).order('data', { ascending: false }).limit(50)
    setAgendamentos(data || [])
  }

  async function salvarPagamento() {
    if (!form.valor) return
    setSaving(true)
    await supabase.from('pagamentos').insert({ ...form, user_id: user.id, valor: parseFloat(form.valor) })
    setSaving(false)
    setShowModal(false)
    setForm({ agendamento_id: '', valor: '', status: 'pendente', forma: 'pix', data: format(new Date(), 'yyyy-MM-dd') })
    loadPagamentos()
  }

  async function togglePago(pag) {
    await supabase.from('pagamentos').update({ status: pag.status === 'pago' ? 'pendente' : 'pago' }).eq('id', pag.id)
    loadPagamentos()
  }

  const recebido = pagamentos.filter(p => p.status === 'pago').reduce((s, p) => s + p.valor, 0)
  const pendente = pagamentos.filter(p => p.status === 'pendente').reduce((s, p) => s + p.valor, 0)
  const filtrados = filtro === 'todos' ? pagamentos : pagamentos.filter(p => p.status === filtro)
  const mesLabel = format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })

  return (
    <div style={s.page}>
      <div style={s.mesLabel}>{mesLabel}</div>

      <div style={s.grid}>
        <div style={{ ...s.card, borderTop: '3px solid var(--green)' }}>
          <div style={s.cardLabel}>Recebido</div>
          <div style={{ ...s.cardValue, color: 'var(--green)' }}>
            R$ {recebido.toFixed(2).replace('.', ',')}
          </div>
        </div>
        <div style={{ ...s.card, borderTop: `3px solid ${pendente > 0 ? 'var(--amber)' : 'var(--border2)'}` }}>
          <div style={s.cardLabel}>A receber</div>
          <div style={{ ...s.cardValue, color: pendente > 0 ? 'var(--amber)' : 'var(--text3)' }}>
            R$ {pendente.toFixed(2).replace('.', ',')}
          </div>
        </div>
      </div>

      <div style={s.filtros}>
        {['todos', 'pago', 'pendente'].map(f => (
          <button key={f} style={{ ...s.filtroBtn, ...(filtro === f ? s.filtroBtnActive : {}) }} onClick={() => setFiltro(f)}>
            {f === 'todos' ? 'Todos' : f === 'pago' ? 'Pagos' : 'Pendentes'}
          </button>
        ))}
      </div>

      <div style={s.sectionTitle}>lançamentos</div>

      {filtrados.length === 0
        ? <div style={s.empty}>Nenhum lançamento encontrado</div>
        : filtrados.map(p => {
          const pago = p.status === 'pago'
          return (
            <div key={p.id} style={s.finCard}>
              <div style={{ ...s.dot, background: pago ? 'var(--green)' : '#F59E0B' }} />
              <div style={{ flex: 1 }}>
                <div style={s.finNome}>{p.agendamentos?.clientes?.nome || '—'}</div>
                <div style={s.finSub}>{p.agendamentos?.servico || '—'} · {format(new Date(p.data), 'dd/MM', { locale: ptBR })}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ ...s.finValor, color: pago ? 'var(--green)' : 'var(--amber)' }}>
                  R$ {p.valor.toFixed(2).replace('.', ',')}
                </div>
                <button style={{ ...s.statusBtn, ...(pago ? s.statusPago : s.statusPendente) }} onClick={() => togglePago(p)}>
                  {pago ? '✓ Pago' : '⏳ Pendente'}
                </button>
              </div>
            </div>
          )
        })
      }

      <button className="fab-btn" onClick={() => setShowModal(true)} aria-label="Registrar pagamento">
        <Plus size={22} color="white" />
      </button>

      {showModal && (
        <div style={s.overlay} onClick={() => setShowModal(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalTitle}>Registrar pagamento</div>
            <div style={s.field}>
              <label style={s.label}>Atendimento (opcional)</label>
              <select style={s.input} value={form.agendamento_id} onChange={e => setForm({ ...form, agendamento_id: e.target.value })}>
                <option value="">Selecionar atendimento</option>
                {agendamentos.map(a => (
                  <option key={a.id} value={a.id}>{a.clientes?.nome} — {a.servico} ({format(new Date(a.data), 'dd/MM')})</option>
                ))}
              </select>
            </div>
            <div style={s.row}>
              <div style={{ ...s.field, flex: 1 }}>
                <label style={s.label}>Valor (R$) *</label>
                <input style={{ ...s.input, fontFamily: "'JetBrains Mono', monospace" }} type="number" placeholder="0,00" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} />
              </div>
              <div style={{ ...s.field, flex: 1 }}>
                <label style={s.label}>Forma</label>
                <select style={s.input} value={form.forma} onChange={e => setForm({ ...form, forma: e.target.value })}>
                  <option value="pix">Pix</option>
                  <option value="dinheiro">Dinheiro</option>
                  <option value="cartao_debito">Débito</option>
                  <option value="cartao_credito">Crédito</option>
                </select>
              </div>
            </div>
            <div style={s.row}>
              <div style={{ ...s.field, flex: 1 }}>
                <label style={s.label}>Status</label>
                <select style={s.input} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  <option value="pago">Pago</option>
                  <option value="pendente">Pendente</option>
                </select>
              </div>
              <div style={{ ...s.field, flex: 1 }}>
                <label style={s.label}>Data</label>
                <input style={s.input} type="date" value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} />
              </div>
            </div>
            <button style={s.btnPrimary} onClick={salvarPagamento} disabled={saving}>{saving ? 'Salvando...' : 'Registrar'}</button>
            <button style={s.btnSecondary} onClick={() => setShowModal(false)}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}

const s = {
  page: { padding: 16, paddingBottom: 80 },
  mesLabel: { fontSize: 14, fontWeight: 600, color: 'var(--text2)', textTransform: 'capitalize', marginBottom: 14 },
  sectionTitle: { fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px', margin: '0 0 10px' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 },
  card: { background: 'var(--surface)', borderRadius: 'var(--radius-sm)', padding: '14px 15px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)' },
  cardLabel: { fontSize: 11, color: 'var(--text3)', marginBottom: 6, fontWeight: 500 },
  cardValue: { fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 500 },
  filtros: { display: 'flex', gap: 8, marginBottom: 18 },
  filtroBtn: { padding: '7px 16px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border2)', background: 'var(--surface)', color: 'var(--text3)', fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' },
  filtroBtnActive: { background: 'var(--pink)', color: 'white', border: '1px solid var(--pink)', boxShadow: 'var(--shadow-pink)' },
  finCard: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', marginBottom: 9, display: 'flex', alignItems: 'center', gap: 10, boxShadow: 'var(--shadow-xs)' },
  dot: { width: 10, height: 10, borderRadius: '50%', flexShrink: 0 },
  finNome: { fontSize: 14, fontWeight: 600 },
  finSub: { fontSize: 12, color: 'var(--text3)', marginTop: 2 },
  finValor: { fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 500, marginBottom: 3 },
  statusBtn: { fontSize: 11, padding: '3px 10px', borderRadius: 'var(--radius-pill)', fontWeight: 600, border: 'none', cursor: 'pointer' },
  statusPago: { background: 'var(--green-bg)', color: 'var(--green)' },
  statusPendente: { background: 'var(--amber-bg)', color: 'var(--amber)' },
  empty: { color: 'var(--text3)', fontSize: 14, textAlign: 'center', padding: '28px 0' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(24,7,18,0.52)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
  modal: { background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 12 },
  modalTitle: { fontSize: 17, fontWeight: 700, marginBottom: 4 },
  field: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: { fontSize: 12, fontWeight: 600, color: 'var(--text2)' },
  input: { padding: '10px 13px', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', fontSize: 14, background: 'var(--surface)', color: 'var(--text)' },
  row: { display: 'flex', gap: 10 },
  btnPrimary: { background: 'var(--pink)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', padding: '13px', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 4, boxShadow: 'var(--shadow-pink)', transition: 'background 0.15s' },
  btnSecondary: { background: 'var(--surface2)', color: 'var(--text2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', padding: '12px', fontSize: 14, fontWeight: 500, cursor: 'pointer' },
}
