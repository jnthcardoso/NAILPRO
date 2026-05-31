import { useEffect, useState, useRef } from 'react'
import { Shield, Crown, Search, MoreVertical, RefreshCw, StickyNote, UserX, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { format, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CardSkeleton } from '../components/common/Skeleton'
import { useToast } from '../contexts/ToastContext'

const STATUS_LABELS = {
  trialing: { label: 'Teste', color: '#1E40AF', bg: '#DBEAFE' },
  active: { label: 'Ativa', color: '#15803D', bg: '#DCFCE7' },
  past_due: { label: 'Atrasada', color: '#92400E', bg: '#FEF3C7' },
  canceled: { label: 'Cancelada', color: '#B91C1C', bg: '#FEE2E2' },
  expired: { label: 'Expirada', color: '#7F1D1D', bg: '#FECACA' },
}

// Chave para notas internas salvas no localStorage (sem backend)
const NOTAS_KEY = 'admin_notas_internas'

function carregarNotas() {
  try { return JSON.parse(localStorage.getItem(NOTAS_KEY) || '{}') } catch { return {} }
}
function salvarNotas(notas) {
  try { localStorage.setItem(NOTAS_KEY, JSON.stringify(notas)) } catch {}
}

export default function Admin() {
  const { confirmar, sucesso, erro: toastErro } = useToast()
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [acaoUserId, setAcaoUserId] = useState(null)
  const [acaoLoading, setAcaoLoading] = useState(false)
  const [filtro, setFiltro] = useState('todos')
  const [aba, setAba] = useState('assinaturas') // 'assinaturas' | 'inativos'
  const [notas, setNotas] = useState(carregarNotas)
  const [notaEditando, setNotaEditando] = useState(null) // user_id sendo editado
  const [notaTexto, setNotaTexto] = useState('')
  const notaInputRef = useRef(null)

  useEffect(() => { load() }, [])

  // Foco no input de nota ao abrir
  useEffect(() => {
    if (notaEditando && notaInputRef.current) notaInputRef.current.focus()
  }, [notaEditando])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.rpc('admin_listar_usuarios')
    if (error) {
      toastErro('Acesso negado ou erro: ' + error.message)
      setLoading(false)
      return
    }
    setUsuarios(data || [])
    setLoading(false)
  }

  async function ativar(userId, plano, ciclo) {
    const ok = await confirmar({
      titulo: `Ativar ${plano.toUpperCase()} (${ciclo})?`,
      mensagem: 'O usuário terá acesso completo até a próxima cobrança.',
      confirmarLabel: 'Sim, ativar',
    })
    if (!ok) return
    setAcaoLoading(true)
    const { error } = await supabase.rpc('admin_ativar_assinatura', { p_user_id: userId, p_plano: plano, p_ciclo: ciclo })
    setAcaoLoading(false)
    if (error) { toastErro('Erro: ' + error.message); return }
    sucesso(`${plano.toUpperCase()} ativado ✓`)
    setAcaoUserId(null)
    load()
  }

  async function cancelar(userId) {
    const ok = await confirmar({
      titulo: 'Cancelar assinatura?',
      mensagem: 'O usuário perderá acesso ao final do período atual.',
      confirmarLabel: 'Sim, cancelar',
      tipo: 'perigo',
    })
    if (!ok) return
    setAcaoLoading(true)
    const { error } = await supabase.rpc('admin_cancelar_assinatura', { p_user_id: userId })
    setAcaoLoading(false)
    if (error) { toastErro('Erro: ' + error.message); return }
    sucesso('Assinatura cancelada')
    setAcaoUserId(null)
    load()
  }

  async function estenderTrial(userId, dias) {
    const ok = await confirmar({
      titulo: `Estender trial em +${dias} dias?`,
      mensagem: 'O usuário ganha mais tempo de teste gratuito.',
      confirmarLabel: 'Sim, estender',
    })
    if (!ok) return
    setAcaoLoading(true)
    const { error } = await supabase.rpc('admin_estender_trial', { p_user_id: userId, p_dias: dias })
    setAcaoLoading(false)
    if (error) { toastErro('Erro: ' + error.message); return }
    sucesso(`Trial estendido +${dias} dias ✓`)
    setAcaoUserId(null)
    load()
  }

  function abrirNota(userId) {
    setNotaEditando(userId)
    setNotaTexto(notas[userId] || '')
    setAcaoUserId(null)
  }

  function salvarNota(userId) {
    const novasNotas = { ...notas, [userId]: notaTexto.trim() }
    if (!notaTexto.trim()) delete novasNotas[userId]
    setNotas(novasNotas)
    salvarNotas(novasNotas)
    setNotaEditando(null)
    sucesso('Nota salva ✓')
  }

  // ── Dados derivados ───────────────────────────────────────
  const filtradosBusca = usuarios.filter(u => {
    const q = busca.toLowerCase()
    return !q || u.email?.toLowerCase().includes(q) || u.nome?.toLowerCase().includes(q) || u.nome_salao?.toLowerCase().includes(q)
  })

  const filtrados = filtro === 'todos'
    ? filtradosBusca
    : filtradosBusca.filter(u => u.assinatura_status === filtro)

  // Inativos: cadastrados há mais de 3 dias e com 0 clientes (nunca usaram de verdade)
  // OU cancelados/expirados há mais de 7 dias
  const inativos = usuarios.filter(u => {
    const diasCadastro = differenceInDays(new Date(), new Date(u.user_created_at))
    const semClientes = (u.total_clientes || 0) === 0 && diasCadastro > 3
    const canceladoOuExpirado = ['canceled', 'expired'].includes(u.assinatura_status)
    return semClientes || canceladoOuExpirado
  })

  const stats = {
    total: usuarios.length,
    ativas: usuarios.filter(u => u.assinatura_status === 'active').length,
    trial: usuarios.filter(u => u.assinatura_status === 'trialing').length,
    inativos: inativos.length,
    mrrCentavos: usuarios
      .filter(u => u.assinatura_status === 'active')
      .reduce((s, u) => s + (u.assinatura_plano === 'pro' ? 17900 : 9700), 0),
  }

  if (loading) {
    return <div style={s.page}><CardSkeleton count={5} /></div>
  }

  // ── Card de usuário reutilizável ───────────────────────────
  function UserCard({ u }) {
    const st = STATUS_LABELS[u.assinatura_status] || STATUS_LABELS.expired
    const diasTrial = u.trial_termina_em ? differenceInDays(new Date(u.trial_termina_em), new Date()) : null
    const diasPeriodo = u.periodo_termina_em ? differenceInDays(new Date(u.periodo_termina_em), new Date()) : null
    const diasCadastro = differenceInDays(new Date(), new Date(u.user_created_at))
    const aberto = acaoUserId === u.user_id
    const notaExiste = !!notas[u.user_id]
    const editandoEsta = notaEditando === u.user_id

    return (
      <div style={s.userCard}>
        <div style={s.userMain}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={s.userNome}>
              {u.nome || u.email?.split('@')[0]}
              {u.assinatura_plano === 'pro' && u.assinatura_status === 'active' && (
                <Crown size={13} color="var(--gold, #D4AF37)" style={{ marginLeft: 6 }} />
              )}
              {notaExiste && (
                <StickyNote size={11} color="#D4AF37" style={{ marginLeft: 5 }} title="Tem nota interna" />
              )}
            </div>
            <div style={s.userEmail}>{u.email}</div>
            {u.nome_salao && <div style={s.userSalao}>🏪 {u.nome_salao}</div>}
            <div style={s.userMeta}>
              📅 {format(new Date(u.user_created_at), "dd/MM/yyyy", { locale: ptBR })}
              {' · '}⏱ {diasCadastro}d desde cadastro
              {u.whatsapp && <> · 📱 {u.whatsapp}</>}
              {' · '}👥 {u.total_clientes} clientes
            </div>
          </div>

          <div style={s.userRight}>
            <span style={{ ...s.statusBadge, background: st.bg, color: st.color }}>{st.label}</span>
            <div style={s.planoTexto}>
              {u.assinatura_plano?.toUpperCase() || '—'}
              {u.assinatura_ciclo && <span style={{ color: 'var(--text3)' }}> · {u.assinatura_ciclo}</span>}
            </div>
            {u.assinatura_status === 'trialing' && diasTrial !== null && (
              <div style={{ fontSize: 10, color: diasTrial > 3 ? 'var(--text3)' : '#B91C1C', fontWeight: 600, marginTop: 2 }}>
                {diasTrial > 0 ? `${diasTrial}d restantes` : 'expirado'}
              </div>
            )}
            {u.assinatura_status === 'active' && diasPeriodo !== null && (
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
                Renova em {diasPeriodo}d
              </div>
            )}
          </div>

          <button style={s.menuBtn} onClick={() => setAcaoUserId(aberto ? null : u.user_id)}>
            <MoreVertical size={16} />
          </button>
        </div>

        {/* Nota interna (exibição) */}
        {notaExiste && !editandoEsta && (
          <div style={s.notaBox} onClick={() => abrirNota(u.user_id)}>
            <StickyNote size={11} color="#92400E" />
            <span style={s.notaTextoDisplay}>{notas[u.user_id]}</span>
          </div>
        )}

        {/* Nota interna (edição) */}
        {editandoEsta && (
          <div style={s.notaEditorWrap}>
            <textarea
              ref={notaInputRef}
              style={s.notaEditor}
              value={notaTexto}
              onChange={e => setNotaTexto(e.target.value)}
              placeholder="Escreva uma nota interna sobre este cliente..."
              rows={3}
            />
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <button style={s.notaBtnCancelar} onClick={() => setNotaEditando(null)}>Cancelar</button>
              <button style={s.notaBtnSalvar} onClick={() => salvarNota(u.user_id)}>Salvar nota</button>
            </div>
          </div>
        )}

        {/* Menu de ações */}
        {aberto && (
          <div style={s.acoes}>
            <div style={s.acoesGrid}>
              <button style={s.acaoBtn} onClick={() => ativar(u.user_id, 'pro', 'anual')} disabled={acaoLoading}>
                ✓ Ativar Pro Anual (R$ 179/mês)
              </button>
              <button style={s.acaoBtn} onClick={() => ativar(u.user_id, 'solo', 'anual')} disabled={acaoLoading}>
                ✓ Ativar Solo Anual (R$ 97/mês)
              </button>
              <button
                style={{ ...s.acaoBtn, background: '#EFF6FF', color: '#1E40AF', border: '1px solid #93C5FD' }}
                onClick={() => estenderTrial(u.user_id, 7)} disabled={acaoLoading}
              >
                + 7 dias de trial
              </button>
              <button
                style={{ ...s.acaoBtn, background: '#EFF6FF', color: '#1E40AF', border: '1px solid #93C5FD' }}
                onClick={() => estenderTrial(u.user_id, 30)} disabled={acaoLoading}
              >
                + 30 dias de trial
              </button>
              <button
                style={{ ...s.acaoBtn, background: '#FEF9C3', color: '#92400E', border: '1px solid #FDE68A' }}
                onClick={() => { abrirNota(u.user_id) }} disabled={acaoLoading}
              >
                📝 {notaExiste ? 'Editar nota' : 'Adicionar nota'}
              </button>
              <button
                style={{ ...s.acaoBtn, background: '#FEE2E2', color: '#B91C1C', border: '1px solid #FCA5A5' }}
                onClick={() => cancelar(u.user_id)} disabled={acaoLoading}
              >
                ✗ Cancelar assinatura
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={s.page}>

      {/* Header */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <div style={s.iconBox}><Shield size={22} color="white" /></div>
          <div>
            <h1 style={s.title}>Admin</h1>
            <p style={s.sub}>Gerenciamento de assinaturas</p>
          </div>
        </div>
        <button style={s.refreshBtn} onClick={load} title="Atualizar">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Stats */}
      <div style={s.stats}>
        <div style={s.statCard}>
          <div style={s.statValor}>{stats.total}</div>
          <div style={s.statLabel}>Total</div>
        </div>
        <div style={{ ...s.statCard, borderTop: '3px solid #15803D' }}>
          <div style={{ ...s.statValor, color: '#15803D' }}>{stats.ativas}</div>
          <div style={s.statLabel}>Ativas</div>
        </div>
        <div style={{ ...s.statCard, borderTop: '3px solid #1E40AF' }}>
          <div style={{ ...s.statValor, color: '#1E40AF' }}>{stats.trial}</div>
          <div style={s.statLabel}>Em trial</div>
        </div>
        <div style={{ ...s.statCard, borderTop: '3px solid var(--gold, #D4AF37)' }}>
          <div style={{ ...s.statValor, color: 'var(--gold, #D4AF37)' }}>
            R$ {(stats.mrrCentavos / 100).toFixed(0)}
          </div>
          <div style={s.statLabel}>MRR</div>
        </div>
      </div>

      {/* Abas */}
      <div style={s.abas}>
        <button
          style={{ ...s.aba, ...(aba === 'assinaturas' ? s.abaAtiva : {}) }}
          onClick={() => setAba('assinaturas')}
        >
          <Shield size={13} /> Assinaturas
        </button>
        <button
          style={{ ...s.aba, ...(aba === 'inativos' ? s.abaAtiva : {}) }}
          onClick={() => setAba('inativos')}
        >
          <UserX size={13} />
          Inativos
          {stats.inativos > 0 && (
            <span style={s.abaBadge}>{stats.inativos}</span>
          )}
        </button>
      </div>

      {/* ── ABA: Assinaturas ── */}
      {aba === 'assinaturas' && (
        <>
          <div style={s.searchBar}>
            <Search size={16} color="var(--text3)" />
            <input
              style={s.searchInput}
              placeholder="Buscar por email, nome ou salão..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />
          </div>

          <div style={s.filtros}>
            {[
              { id: 'todos', label: 'Todos' },
              { id: 'active', label: 'Ativas' },
              { id: 'trialing', label: 'Trial' },
              { id: 'canceled', label: 'Canceladas' },
              { id: 'expired', label: 'Expiradas' },
            ].map(f => (
              <button
                key={f.id}
                style={{ ...s.filtroBtn, ...(filtro === f.id ? s.filtroBtnActive : {}) }}
                onClick={() => setFiltro(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div style={s.listaTitulo}>
            {filtrados.length} {filtrados.length === 1 ? 'usuário' : 'usuários'}
          </div>

          {filtrados.map(u => <UserCard key={u.user_id} u={u} />)}
          {filtrados.length === 0 && <div style={s.empty}>Nenhum usuário encontrado</div>}
        </>
      )}

      {/* ── ABA: Inativos ── */}
      {aba === 'inativos' && (
        <>
          <div style={s.inativoInfo}>
            <Clock size={13} color="var(--text3)" />
            <span>Usuários sem clientes cadastrados ou com assinatura cancelada/expirada. Oportunidade de reengajamento.</span>
          </div>

          <div style={s.listaTitulo}>
            {inativos.length} {inativos.length === 1 ? 'usuário inativo' : 'usuários inativos'}
          </div>

          {inativos.map(u => <UserCard key={u.user_id} u={u} />)}
          {inativos.length === 0 && (
            <div style={s.empty}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
              Nenhum usuário inativo!
            </div>
          )}
        </>
      )}

    </div>
  )
}

const s = {
  page: { padding: 20, paddingBottom: 80 },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  iconBox: { width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, #1F2937 0%, #4B5563 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  title: { fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 20, fontWeight: 800, color: 'var(--text)', margin: 0 },
  sub: { fontSize: 12, color: 'var(--text3)', margin: '2px 0 0' },
  refreshBtn: { width: 36, height: 36, borderRadius: '50%', background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text2)' },
  stats: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 },
  statCard: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '12px 8px', textAlign: 'center', boxShadow: 'var(--shadow-xs)' },
  statValor: { fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 700, color: 'var(--text)', lineHeight: 1 },
  statLabel: { fontSize: 10, color: 'var(--text3)', marginTop: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' },
  /* Abas */
  abas: { display: 'flex', gap: 6, marginBottom: 14 },
  aba: { display: 'flex', alignItems: 'center', gap: 5, padding: '8px 16px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border2)', background: 'var(--surface)', color: 'var(--text3)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', position: 'relative' },
  abaAtiva: { background: 'var(--pink)', color: 'white', border: '1px solid var(--pink)' },
  abaBadge: { background: '#FEE2E2', color: '#B91C1C', borderRadius: '999px', fontSize: 10, fontWeight: 700, padding: '1px 6px', marginLeft: 2 },
  /* Info inativos */
  inativoInfo: { display: 'flex', alignItems: 'flex-start', gap: 7, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 13px', marginBottom: 12, fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 },
  /* Busca e filtros */
  searchBar: { display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', padding: '10px 13px', marginBottom: 10, boxShadow: 'var(--shadow-xs)' },
  searchInput: { border: 'none', outline: 'none', flex: 1, fontSize: 14, background: 'transparent', color: 'var(--text)' },
  filtros: { display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' },
  filtroBtn: { padding: '6px 12px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border2)', background: 'var(--surface)', color: 'var(--text3)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  filtroBtnActive: { background: 'var(--pink)', color: 'white', border: '1px solid var(--pink)' },
  listaTitulo: { fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 },
  /* Cards */
  userCard: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 14, marginBottom: 8, boxShadow: 'var(--shadow-xs)' },
  userMain: { display: 'flex', alignItems: 'flex-start', gap: 10 },
  userNome: { fontSize: 14, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2 },
  userEmail: { fontSize: 12, color: 'var(--text2)', marginTop: 2 },
  userSalao: { fontSize: 11, color: 'var(--text3)', marginTop: 2 },
  userMeta: { fontSize: 10, color: 'var(--text3)', marginTop: 4, lineHeight: 1.6 },
  userRight: { textAlign: 'right', flexShrink: 0 },
  statusBadge: { fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 'var(--radius-pill)', whiteSpace: 'nowrap' },
  planoTexto: { fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600, marginTop: 4, color: 'var(--text2)' },
  menuBtn: { background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text3)', flexShrink: 0 },
  /* Ações */
  acoes: { marginTop: 12, paddingTop: 12, borderTop: '1px dashed var(--border)' },
  acoesGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 },
  acaoBtn: { background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid #86EFAC', borderRadius: 8, padding: '8px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center' },
  /* Notas internas */
  notaBox: { marginTop: 10, padding: '8px 10px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, display: 'flex', alignItems: 'flex-start', gap: 6, cursor: 'pointer' },
  notaTextoDisplay: { fontSize: 11, color: '#92400E', lineHeight: 1.5, flex: 1 },
  notaEditorWrap: { marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 },
  notaEditor: { width: '100%', border: '1.5px solid #FDE68A', borderRadius: 8, padding: '8px 10px', fontSize: 12, fontFamily: 'inherit', color: 'var(--text)', background: '#FFFBEB', outline: 'none', resize: 'vertical', boxSizing: 'border-box' },
  notaBtnSalvar: { background: '#D4AF37', color: 'white', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  notaBtnCancelar: { background: 'var(--surface)', color: 'var(--text3)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  empty: { textAlign: 'center', padding: 40, color: 'var(--text3)', fontSize: 13 },
}
