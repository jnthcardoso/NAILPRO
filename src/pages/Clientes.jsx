import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, AlertCircle, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { differenceInDays, format } from 'date-fns'

export default function Clientes() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [clientes, setClientes] = useState([])
  const [busca, setBusca] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ nome: '', telefone: '', email: '', data_nascimento: '', observacoes: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (user) loadClientes() }, [user])

  async function loadClientes() {
    const { data } = await supabase.from('clientes').select('id, nome, telefone, ultimo_atendimento, total_visitas, total_gasto').eq('user_id', user.id).order('nome')
    setClientes(data || [])
  }

  async function salvarCliente() {
    if (!form.nome) return
    setSaving(true)
    await supabase.from('clientes').insert({ ...form, user_id: user.id })
    setSaving(false)
    setShowModal(false)
    setForm({ nome: '', telefone: '', email: '', data_nascimento: '', observacoes: '' })
    loadClientes()
  }

  const filtradas = clientes.filter(c => c.nome.toLowerCase().includes(busca.toLowerCase()))
  const sumidas = clientes.filter(c => c.ultimo_atendimento && differenceInDays(new Date(), new Date(c.ultimo_atendimento)) >= 35)

  function getInitials(nome) {
    return nome.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
  }

  return (
    <div style={s.page}>
      <div style={s.searchBar}>
        <Search size={16} color="var(--text3)" />
        <input style={s.searchInput} placeholder="Buscar cliente..." value={busca} onChange={e => setBusca(e.target.value)} />
      </div>

      {sumidas.length > 0 && busca === '' && (
        <div style={{ marginBottom: 16 }}>
          <div style={s.sectionTitle}>para reativar</div>
          <div style={s.chipsRow}>
            {sumidas.map(c => (
              <div key={c.id} style={s.chip} onClick={() => navigate(`/clientes/${c.id}`)}>
                <AlertCircle size={13} />
                {c.nome.split(' ')[0]} · {differenceInDays(new Date(), new Date(c.ultimo_atendimento))}d
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={s.sectionTitle}>todas as clientes ({filtradas.length})</div>

      {filtradas.map(c => {
        const diasAusente = c.ultimo_atendimento ? differenceInDays(new Date(), new Date(c.ultimo_atendimento)) : null
        const sumida = diasAusente && diasAusente >= 35
        return (
          <div key={c.id} style={s.card} onClick={() => navigate(`/clientes/${c.id}`)}>
            <div style={s.avatar}>{getInitials(c.nome)}</div>
            <div style={{ flex: 1 }}>
              <div style={s.cardName}>
                {c.nome}
                {sumida && <span style={s.tagSumida}>Sumida</span>}
                {c.total_visitas >= 10 && <span style={s.tagVip}>VIP ✨</span>}
              </div>
              <div style={s.cardSub}>
                {c.ultimo_atendimento ? `Última vez: ${format(new Date(c.ultimo_atendimento), 'dd/MM/yyyy')}` : 'Nunca atendida'}
              </div>
            </div>
            <div style={s.cardRight}>
              <div style={s.cardValor}>R$ {(c.total_gasto || 0).toFixed(0)}</div>
              <div style={s.cardVisitas}>{c.total_visitas || 0} visitas</div>
            </div>
            <ChevronRight size={16} color="var(--text3)" />
          </div>
        )
      })}

      {filtradas.length === 0 && (
        <div style={s.empty}><p style={{ color: 'var(--text3)', fontSize: 14 }}>Nenhuma cliente encontrada</p></div>
      )}

      <button className="fab-btn" onClick={() => setShowModal(true)} aria-label="Nova cliente">
        <Plus size={22} color="white" />
      </button>

      {showModal && (
        <div style={s.overlay} onClick={() => setShowModal(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalTitle}>Nova cliente</div>
            <div style={s.field}><label style={s.label}>Nome *</label><input style={s.input} placeholder="Nome completo" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} /></div>
            <div style={s.field}><label style={s.label}>WhatsApp</label><input style={s.input} placeholder="(51) 99999-9999" value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} /></div>
            <div style={s.field}><label style={s.label}>E-mail</label><input style={s.input} type="email" placeholder="opcional" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            <div style={s.field}><label style={s.label}>Data de nascimento</label><input style={s.input} type="date" value={form.data_nascimento} onChange={e => setForm({ ...form, data_nascimento: e.target.value })} /></div>
            <div style={s.field}><label style={s.label}>Observações</label><input style={s.input} placeholder="Preferências, alergias..." value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} /></div>
            <button style={s.btnPrimary} onClick={salvarCliente} disabled={saving}>{saving ? 'Salvando...' : 'Cadastrar cliente'}</button>
            <button style={s.btnSecondary} onClick={() => setShowModal(false)}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}

const s = {
  page: { padding: 16, paddingBottom: 80 },
  sectionTitle: { fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px', margin: '0 0 8px' },
  searchBar: { display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', padding: '10px 13px', marginBottom: 16, boxShadow: 'var(--shadow-xs)' },
  searchInput: { border: 'none', outline: 'none', flex: 1, fontSize: 14, background: 'transparent', color: 'var(--text)' },
  chipsRow: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  chip: { display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid #FECACA', borderRadius: 'var(--radius-pill)', padding: '5px 12px', fontSize: 12, fontWeight: 500, cursor: 'pointer' },
  card: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '13px 14px', marginBottom: 9, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', boxShadow: 'var(--shadow-sm)', transition: 'box-shadow 0.15s' },
  avatar: { width: 42, height: 42, borderRadius: '50%', background: 'linear-gradient(135deg, var(--pink-light), var(--pink-mid))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: 'var(--pink)', flexShrink: 0, boxShadow: '0 2px 6px rgba(190,24,93,0.15)' },
  cardName: { fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  cardSub: { fontSize: 12, color: 'var(--text3)', marginTop: 2 },
  cardRight: { textAlign: 'right', flexShrink: 0 },
  cardValor: { fontSize: 13, fontWeight: 700, color: 'var(--pink)' },
  cardVisitas: { fontSize: 11, color: 'var(--text3)', marginTop: 1 },
  tagSumida: { fontSize: 10, padding: '2px 8px', borderRadius: 'var(--radius-pill)', background: 'var(--red-bg)', color: 'var(--red)', fontWeight: 600 },
  tagVip: { fontSize: 10, padding: '2px 8px', borderRadius: 'var(--radius-pill)', background: 'var(--purple-bg)', color: 'var(--purple)', fontWeight: 600 },
  empty: { padding: '40px 0', textAlign: 'center' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(26,10,18,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
  modal: { background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '90vh', overflowY: 'auto' },
  modalTitle: { fontSize: 17, fontWeight: 700, marginBottom: 4, color: 'var(--text)' },
  field: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: { fontSize: 12, fontWeight: 600, color: 'var(--text2)' },
  input: { padding: '10px 13px', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', fontSize: 14, background: 'var(--surface)', color: 'var(--text)' },
  btnPrimary: { background: 'linear-gradient(135deg, var(--pink) 0%, #DB2777 100%)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', padding: '13px', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 4, boxShadow: 'var(--shadow-pink)' },
  btnSecondary: { background: 'var(--surface2)', color: 'var(--text2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', padding: '12px', fontSize: 14, fontWeight: 500, cursor: 'pointer' },
}
