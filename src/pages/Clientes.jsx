import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, AlertCircle, ChevronRight, MessageCircle, Crown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useSalao } from '../contexts/SalaoContext'
import { useAssinatura, PLANOS } from '../contexts/AssinaturaContext'
import { useToast } from '../contexts/ToastContext'
import { UpgradeModal } from '../components/common/UpgradeBlock'
import Modal from '../components/common/Modal'
import { inputBase, labelBase, btnPrimaryBase, btnSecondaryBase } from '../lib/ui'
import { formatTelefone, unformatTelefone, validarEmail, validarTelefone, validarNome, linkWhatsApp } from '../lib/formatters'
import { differenceInDays, format } from 'date-fns'
import { DIAS_RETORNO_PADRAO } from '../lib/constants'

export default function Clientes() {
  const { user } = useAuth()
  const { salaoId } = useSalao()
  const navigate = useNavigate()
  const { plano, dentroDoLimite } = useAssinatura()
  const { sucesso, erro } = useToast()
  const [clientes, setClientes] = useState([])
  const [buscaInput, setBuscaInput] = useState('')
  const [busca, setBusca] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const diasAlerta = DIAS_RETORNO_PADRAO
  const [filtro, setFiltro] = useState('todas')
  const [ordenacao, setOrdenacao] = useState('nome')
  const [pagina, setPagina] = useState(1)
  const [form, setForm] = useState({ nome: '', telefone: '', email: '', data_nascimento: '', observacoes: '', dias_retorno: '' })
  const [erros, setErros] = useState({})
  const [saving, setSaving] = useState(false)

  const ITENS_POR_PAGINA = 20

  const ativas = clientes.filter(c => !c.arquivada)
  const arquivadas = clientes.filter(c => c.arquivada)
  const limiteClientes = plano?.limites?.clientes ?? Infinity
  const noLimite = limiteClientes !== Infinity && ativas.length >= limiteClientes
  const perto = limiteClientes !== Infinity && ativas.length >= limiteClientes - 5 && !noLimite

  useEffect(() => { if (salaoId) { loadClientes() } }, [salaoId])

  // Debounce na busca (300ms)
  useEffect(() => {
    const timer = setTimeout(() => { setBusca(buscaInput); setPagina(1) }, 300)
    return () => clearTimeout(timer)
  }, [buscaInput])

  // Reset paginação quando filtro/ordenação muda
  useEffect(() => { setPagina(1) }, [filtro, ordenacao])

  // Fechar modal com Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' && showModal) setShowModal(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [showModal])

  async function loadClientes() {
    const { data } = await supabase.from('clientes').select('id, nome, telefone, ultimo_atendimento, total_visitas, total_gasto, arquivada, dias_retorno').eq('salao_id', salaoId).order('nome')
    setClientes(data || [])
  }

  async function salvarCliente() {
    const novosErros = {}
    if (!validarNome(form.nome)) novosErros.nome = 'Nome inválido (mín. 2 caracteres)'
    if (form.telefone && !validarTelefone(form.telefone)) novosErros.telefone = 'WhatsApp deve ter 10 ou 11 dígitos'
    if (form.email && !validarEmail(form.email)) novosErros.email = 'E-mail inválido'
    const diasRetorno = form.dias_retorno === '' ? null : parseInt(form.dias_retorno, 10)
    if (form.dias_retorno !== '' && (!Number.isFinite(diasRetorno) || diasRetorno < 1 || diasRetorno > 365)) {
      novosErros.dias_retorno = 'Informe entre 1 e 365 dias'
    }
    if (Object.keys(novosErros).length > 0) { setErros(novosErros); return }

    // 🔒 Bloqueio de limite no Starter
    if (noLimite) {
      setShowModal(false)
      setShowUpgrade(true)
      return
    }
    setSaving(true)
    const { error } = await supabase.from('clientes').insert({
      ...form,
      telefone: unformatTelefone(form.telefone),
      dias_retorno: diasRetorno,
      user_id: user.id,
      salao_id: salaoId,
    })
    setSaving(false)
    if (error) { erro('Erro ao cadastrar: ' + error.message); return }
    setShowModal(false)
    setForm({ nome: '', telefone: '', email: '', data_nascimento: '', observacoes: '', dias_retorno: '' })
    setErros({})
    sucesso('Cliente cadastrada')
    loadClientes()
  }

  function abrirModalNova() {
    if (noLimite) {
      setShowUpgrade(true)
      return
    }
    setShowModal(true)
  }

  // ── UTC-safe date parse ──
  const parseUADate = (d) => d ? new Date(d + 'T12:00:00') : null

  // Cliente "sumida": passou do ciclo de retorno individual (dias_retorno)
  // ou, na ausência dele, do padrão do salão (diasAlerta).
  const estaSumida = (c) => {
    if (!c.ultimo_atendimento) return false
    const limite = c.dias_retorno ?? diasAlerta
    return differenceInDays(new Date(), parseUADate(c.ultimo_atendimento)) >= limite
  }

  const sumidas = ativas.filter(estaSumida)
  const vips = ativas.filter(c => c.total_visitas >= 10)
  const semVisita = ativas.filter(c => !c.ultimo_atendimento)

  const filtradas = (filtro === 'arquivadas' ? arquivadas : ativas)
    .filter(c => {
      if (busca && !c.nome.toLowerCase().includes(busca.toLowerCase())) return false
      if (filtro === 'vip') return c.total_visitas >= 10
      if (filtro === 'sumidas') return estaSumida(c)
      if (filtro === 'sem_visita') return !c.ultimo_atendimento
      return true
    })
    .sort((a, b) => {
      if (ordenacao === 'gasto') return (b.total_gasto || 0) - (a.total_gasto || 0)
      if (ordenacao === 'visitas') return (b.total_visitas || 0) - (a.total_visitas || 0)
      if (ordenacao === 'recente') {
        if (!a.ultimo_atendimento && !b.ultimo_atendimento) return 0
        if (!a.ultimo_atendimento) return 1
        if (!b.ultimo_atendimento) return -1
        return parseUADate(b.ultimo_atendimento) - parseUADate(a.ultimo_atendimento)
      }
      return a.nome.localeCompare(b.nome)
    })

  const filtradaExibidas = filtradas.slice(0, pagina * ITENS_POR_PAGINA)
  const temMais = filtradas.length > pagina * ITENS_POR_PAGINA

  function getInitials(nome) {
    return nome.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
  }

  function handleWhatsApp(e, telefone) {
    e.stopPropagation()
    const tel = (telefone || '').replace(/\D/g, '')
    if (tel) window.open(linkWhatsApp(tel), '_blank')
  }

  return (
    <div style={s.page}>
      <div style={s.searchBar}>
        <Search size={16} color="var(--text3)" />
        <input style={s.searchInput} placeholder="Buscar cliente..." value={buscaInput} onChange={e => setBuscaInput(e.target.value)} />
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

      {/* Mini stats */}
      <div style={s.statsRow}>
        <div style={s.statCard}>
          <div style={s.statNum}>{ativas.length}</div>
          <div style={s.statLabel}>Total</div>
        </div>
        <div style={{ ...s.statCard, cursor: vips.length ? 'pointer' : 'default' }} onClick={() => vips.length && setFiltro(filtro === 'vip' ? 'todas' : 'vip')}>
          <div style={{ ...s.statNum, color: 'var(--gold, #D4AF37)' }}>{vips.length}</div>
          <div style={s.statLabel}>✦ VIP</div>
        </div>
        <div style={{ ...s.statCard, cursor: sumidas.length ? 'pointer' : 'default' }} onClick={() => sumidas.length && setFiltro(filtro === 'sumidas' ? 'todas' : 'sumidas')}>
          <div style={{ ...s.statNum, color: sumidas.length ? 'var(--red, #B91C1C)' : 'var(--text3)' }}>{sumidas.length}</div>
          <div style={s.statLabel}>Retorno</div>
        </div>
      </div>

      {/* Filtros + Ordenação */}
      <div style={s.filtrosWrap}>
        <div style={s.filtrosChips}>
          {[
            { id: 'todas', label: 'Todas' },
            { id: 'vip', label: '✦ VIP' },
            { id: 'sumidas', label: '⏰ Retorno' },
            { id: 'sem_visita', label: '🆕 Novas' },
            ...(arquivadas.length ? [{ id: 'arquivadas', label: `🗄 Arquivadas (${arquivadas.length})` }] : []),
          ].map(f => (
            <button
              key={f.id}
              style={{ ...s.filtroChip, ...(filtro === f.id ? s.filtroChipAtivo : {}) }}
              onClick={() => setFiltro(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <select
          style={s.sortSelect}
          value={ordenacao}
          onChange={e => setOrdenacao(e.target.value)}
        >
          <option value="nome">A–Z</option>
          <option value="gasto">Maior gasto</option>
          <option value="visitas">Mais visitas</option>
          <option value="recente">Mais recente</option>
        </select>
      </div>

      <div style={s.sectionTitle}>{filtradas.length} cliente{filtradas.length !== 1 ? 's' : ''}</div>

      {filtradaExibidas.map(c => {
        const sumida = estaSumida(c)
        return (
          <div key={c.id} style={s.card} onClick={() => navigate(`/app/clientes/${c.id}`)}>
            <div style={s.avatar}>{getInitials(c.nome)}</div>
            <div style={{ flex: 1 }}>
              <div style={s.cardName}>
                {c.nome}
                {sumida && <span style={s.tagSumida}>Sumida</span>}
                {c.total_visitas >= 10 && <span style={s.tagVip}>✦ VIP</span>}
              </div>
              <div style={s.cardSub}>
                {c.ultimo_atendimento ? `Última vez: ${format(parseUADate(c.ultimo_atendimento), 'dd/MM/yyyy')}` : 'Nunca atendida'}
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

      {temMais && (
        <button style={s.verMaisBtn} onClick={() => setPagina(p => p + 1)}>
          Ver mais ({filtradas.length - pagina * ITENS_POR_PAGINA} restantes)
        </button>
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
        <Modal onClose={() => setShowModal(false)} variant="sheet" boxStyle={s.modal}>
            <div style={s.modalTitle}>Nova cliente</div>
            <div style={s.field}>
              <label style={s.label}>Nome *</label>
              <input
                style={{ ...s.input, ...(erros.nome ? s.inputErro : {}) }}
                placeholder="Nome completo"
                value={form.nome}
                onChange={e => { setForm({ ...form, nome: e.target.value }); setErros({ ...erros, nome: null }) }}
              />
              {erros.nome && <span style={s.erroMsg}>{erros.nome}</span>}
            </div>
            <div style={s.field}>
              <label style={s.label}>WhatsApp</label>
              <input
                style={{ ...s.input, ...(erros.telefone ? s.inputErro : {}) }}
                placeholder="(51) 99999-9999"
                value={formatTelefone(form.telefone)}
                onChange={e => { setForm({ ...form, telefone: e.target.value }); setErros({ ...erros, telefone: null }) }}
                inputMode="numeric"
              />
              {erros.telefone && <span style={s.erroMsg}>{erros.telefone}</span>}
            </div>
            <div style={s.field}>
              <label style={s.label}>E-mail</label>
              <input
                style={{ ...s.input, ...(erros.email ? s.inputErro : {}) }}
                type="email"
                placeholder="opcional"
                value={form.email}
                onChange={e => { setForm({ ...form, email: e.target.value }); setErros({ ...erros, email: null }) }}
              />
              {erros.email && <span style={s.erroMsg}>{erros.email}</span>}
            </div>
            <div style={s.field}><label style={s.label}>Data de nascimento</label><input style={s.input} type="date" value={form.data_nascimento} onChange={e => setForm({ ...form, data_nascimento: e.target.value })} /></div>
            <div style={s.field}><label style={s.label}>Observações</label><input style={s.input} placeholder="Preferências, alergias..." value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} /></div>
            <div style={s.field}>
              <label style={s.label}>Retorno a cada (dias)</label>
              <input
                style={{ ...s.input, ...(erros.dias_retorno ? s.inputErro : {}) }}
                type="number"
                min="1"
                max="365"
                inputMode="numeric"
                placeholder={`Padrão (${diasAlerta} dias)`}
                value={form.dias_retorno}
                onChange={e => { setForm({ ...form, dias_retorno: e.target.value }); setErros({ ...erros, dias_retorno: null }) }}
              />
              {erros.dias_retorno
                ? <span style={s.erroMsg}>{erros.dias_retorno}</span>
                : <span style={s.hint}>Deixe em branco para usar o padrão de {diasAlerta} dias.</span>}
            </div>
            <button style={s.btnPrimary} onClick={salvarCliente} disabled={saving}>{saving ? 'Salvando...' : 'Cadastrar cliente'}</button>
            <button style={s.btnSecondary} onClick={() => { setShowModal(false); setErros({}) }}>Cancelar</button>
        </Modal>
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
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 },
  statCard: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', textAlign: 'center', boxShadow: 'var(--shadow-xs)', transition: 'border 0.15s' },
  statNum: { fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 700, color: 'var(--text)', lineHeight: 1 },
  statLabel: { fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginTop: 3 },
  filtrosWrap: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 },
  filtrosChips: { display: 'flex', gap: 6, flex: 1, overflowX: 'auto', paddingBottom: 2 },
  filtroChip: { flexShrink: 0, padding: '6px 12px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border2)', background: 'var(--surface)', color: 'var(--text2)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'all 0.15s' },
  filtroChipAtivo: { background: 'var(--pink)', color: 'white', border: '1px solid var(--pink)', boxShadow: 'var(--shadow-pink)' },
  sortSelect: { flexShrink: 0, padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border2)', background: 'var(--surface)', color: 'var(--text2)', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', outline: 'none' },
  card: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '13px 14px', marginBottom: 9, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', boxShadow: 'var(--shadow-sm)' },
  avatar: { width: 42, height: 42, borderRadius: '50%', background: 'var(--pink-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: 'var(--pink)', flexShrink: 0 },
  cardName: { fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  cardSub: { fontSize: 12, color: 'var(--text3)', marginTop: 2 },
  cardRight: { textAlign: 'right', flexShrink: 0 },
  cardValor: { fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 500, color: 'var(--pink)' },
  cardVisitas: { fontSize: 11, color: 'var(--text3)', marginTop: 1 },
  waBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: '50%', background: '#DCFCE7', color: '#15803D', border: 'none', cursor: 'pointer', flexShrink: 0, transition: 'opacity 0.15s' },
  verMaisBtn: { width: '100%', padding: '12px', background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 600, color: 'var(--text2)', cursor: 'pointer', marginBottom: 16, fontFamily: 'inherit' },
  tagSumida: { fontSize: 10, padding: '2px 8px', borderRadius: 'var(--radius-pill)', background: 'var(--red-bg)', color: 'var(--red)', fontWeight: 600 },
  tagVip: { fontSize: 10, padding: '2px 8px', borderRadius: 'var(--radius-pill)', background: 'var(--gold)', color: 'var(--text)', fontWeight: 700, letterSpacing: '0.2px' },
  empty: { padding: '40px 0', textAlign: 'center' },
  modal: { background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '90vh', overflowY: 'auto' },
  modalTitle: { fontSize: 17, fontWeight: 700, marginBottom: 4 },
  field: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: labelBase,
  input: { ...inputBase, outline: 'none', transition: 'border 0.15s' },
  inputErro: { border: '1.5px solid #FCA5A5', background: '#FEF2F2' },
  erroMsg: { fontSize: 11, color: '#B91C1C', fontWeight: 600, marginTop: 4 },
  hint: { fontSize: 11, color: 'var(--text3)', marginTop: 2 },
  btnPrimary: btnPrimaryBase,
  btnSecondary: btnSecondaryBase,
}
