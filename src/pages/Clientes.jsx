import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, AlertCircle, ChevronRight, MessageCircle, Crown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useAssinatura, PLANOS } from '../contexts/AssinaturaContext'
import { UpgradeModal } from '../components/common/UpgradeBlock'
import { differenceInDays, format } from 'date-fns'

export default function Clientes() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { plano, dentroDoLimite } = useAssinatura()
  const [clientes, setClientes] = useState([])
  const [busca, setBusca] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [diasAlerta, setDiasAlerta] = useState(30)
  const [form, setForm] = useState({ nome: '', telefone: '', email: '', data_nascimento: '', observacoes: '' })
  const [saving, setSaving] = useState(false)

  const limiteClientes = plano?.limites?.clientes ?? Infinity
  const noLimite = limiteClientes !== Infinity && clientes.length >= limiteClientes
  const perto = limiteClientes !== Infinity && clientes.length >= limiteClientes - 5 && !noLimite

  useEffect(() => { if (user) { loadClientes(); loadConfig() } }, [user])

  async function loadConfig() {
    const { data } = await supabase.from('configuracoes').select('dias_retorno_alerta').eq('user_id', user.id).single()
    if (data?.dias_retorno_alerta) setDiasAlerta(data.dias_retorno_alerta)
  }

  async function loadClientes() {
    const { data } = await supabase.from('clientes').select('id, nome, telefone, ultimo_atendimento, total_visitas, total_gasto').eq('user_id', user.id).order('nome')
    setClientes(data || [])
  }

  async function salvarCliente() {
    if (!form.nome) return
    // 🔒 Bloqueio de limite no Starter
    if (noLimite) {
      setShowModal(false)
      setShowUpgrade(true)
      return
    }
    setSaving(true)
    await supabase.from('clientes').insert({ ...form, user_id: user.id })
    setSaving(false)
    setShowModal(false)
    setForm({ nome: '', telefone: '', email: '', data_nascimento: '', observacoes: '' })
    loadClientes()
  }

  function abrirModalNova() {
    if (noLimite) {
      setShowUpgrade(true)
      return
    }
    setShowModal(true)
  }

  const filtradas = clientes.filter(c => c.nome.toLowerCase().includes(busca.toLowerCase()))
  const sumidas = clientes.filter(c => c.ultimo_atendimento && differenceInDays(new Date(), new Date(c.ultimo_atendimento)) >= diasAlerta)

  function getInitials(nome) {
    return nome.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
  }

  function handleWhatsApp(e, telefone) {
    e.stopPropagation()
    const tel = (telefone || '').replace(/\D/g, '')
    if (tel) window.open(`https://wa.me/55${tel}`, '_blank')
  }

  return (
    <div style={s.page}>
      <div style={s.searchBar}>
        <Search size={16} color="var(--text3)" />
        <input style={s.searchInput} placeholder="Buscar cliente..." value={busca} onChange={e => setBusca(e.target.value)} />
      </div>

      {/* Aviso de limite (Starter) */}
      {(perto || noLimite) && (
        <div
          onClick={() => navigate('/planos')}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: noLimite ? 'linear-gradient(135deg, #FEF2F2, #FEE2E2)' : 'linear-gradient(135deg, #FEF3C7, #FDE68A)',
            border: '1px solid ' + (noLimite ? '#FCA5A5' : '#FCD34D'),
            borderRadius: 'var(--radius-sm)', padding: '11px 14px', marginBottom: 12,
            cursor: 'pointer', boxShadow: 'var(--shadow-xs)',
          }}
        >
          <Crown size={18} color={noLimite ? '#B91C1C' : '#D97706'} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, fontSize: 12 }}>
            <div style={{ fontWeight: 700, color: noLimite ? '#7F1D1D' : '#78350F' }}>
              {noLimite
                ? `Você atingiu o limite de ${limiteClientes} clientes do plano ${plano?.nome}`
                : `${clientes.length} de ${limiteClientes} clientes (${plano?.nome})`}
            </div>
            <div style={{ color: noLimite ? '#991B1B' : '#92400E', marginTop: 2 }}>
              Faça upgrade pro Pro pra cadastrar clientes ilimitadas →
            </div>
          </div>
        </div>
      )}

      {sumidas.length > 0 && busca === '' && (
        <div style={{ marginBottom: 16 }}>
          <div style={s.sectionTitle}>para reativar (+{diasAlerta} dias)</div>
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
        const sumida = diasAusente != null && diasAusente >= diasAlerta
        return (
          <div key={c.id} style={s.card} onClick={() => navigate(`/clientes/${c.id}`)}>
            <div style={s.avatar}>{getInitials(c.nome)}</div>
            <div style={{ flex: 1 }}>
              <div style={s.cardName}>
                {c.nome}
                {sumida && <span style={s.tagSumida}>Sumida</span>}
                {c.total_visitas >= 10 && <span style={s.tagVip}>✦ VIP</span>}
              </div>
              <div style={s.cardSub}>
                {c.ultimo_atendimento ? `Última vez: ${format(new Date(c.ultimo_atendimento), 'dd/MM/yyyy')}` : 'Nunca atendida'}
              </div>
            </div>
            <div style={s.cardRight}>
              <div style={s.cardValor}>R$ {(c.total_gasto || 0).toFixed(0)}</div>
              <div style={s.cardVisitas}>{c.total_visitas || 0} visitas</div>
            </div>
            {c.telefone && (
              <button
                style={s.waBtn}
                onClick={e => handleWhatsApp(e, c.telefone)}
                title="Abrir WhatsApp"
              >
                <MessageCircle size={15} />
              </button>
            )}
            <ChevronRight size={16} color="var(--text3)" />
          </div>
        )
      })}

      {filtradas.length === 0 && (
        <div style={s.empty}><p style={{ color: 'var(--text3)', fontSize: 14 }}>Nenhuma cliente encontrada</p></div>
      )}

      <button className="fab-btn" onClick={abrirModalNova} aria-label="Nova cliente">
        <Plus size={22} color="white" />
      </button>

      <UpgradeModal
        aberto={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        titulo="Limite de clientes atingido"
        descricao={`Você atingiu o limite de ${limiteClientes} clientes do plano ${plano?.nome}. Faça upgrade pro Pro pra cadastrar quantas clientes quiser.`}
      />

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
  card: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '13px 14px', marginBottom: 9, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', boxShadow: 'var(--shadow-sm)' },
  avatar: { width: 42, height: 42, borderRadius: '50%', background: 'var(--pink-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: 'var(--pink)', flexShrink: 0 },
  cardName: { fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  cardSub: { fontSize: 12, color: 'var(--text3)', marginTop: 2 },
  cardRight: { textAlign: 'right', flexShrink: 0 },
  cardValor: { fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 500, color: 'var(--pink)' },
  cardVisitas: { fontSize: 11, color: 'var(--text3)', marginTop: 1 },
  waBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: '50%', background: '#DCFCE7', color: '#15803D', border: 'none', cursor: 'pointer', flexShrink: 0, transition: 'opacity 0.15s' },
  tagSumida: { fontSize: 10, padding: '2px 8px', borderRadius: 'var(--radius-pill)', background: 'var(--red-bg)', color: 'var(--red)', fontWeight: 600 },
  tagVip: { fontSize: 10, padding: '2px 8px', borderRadius: 'var(--radius-pill)', background: 'var(--gold)', color: 'var(--text)', fontWeight: 700, letterSpacing: '0.2px' },
  empty: { padding: '40px 0', textAlign: 'center' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(24,7,18,0.52)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
  modal: { background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '90vh', overflowY: 'auto' },
  modalTitle: { fontSize: 17, fontWeight: 700, marginBottom: 4 },
  field: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: { fontSize: 12, fontWeight: 600, color: 'var(--text2)' },
  input: { padding: '10px 13px', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', fontSize: 14, background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit' },
  btnPrimary: { background: 'var(--pink)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', padding: '13px', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 4, boxShadow: 'var(--shadow-pink)', transition: 'background 0.15s' },
  btnSecondary: { background: 'var(--surface2)', color: 'var(--text2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', padding: '12px', fontSize: 14, fontWeight: 500, cursor: 'pointer' },
}
