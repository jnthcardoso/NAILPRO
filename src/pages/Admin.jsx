import { useEffect, useState } from 'react'
import { Shield, Crown, Search, Check, X, Clock, AlertCircle, MoreVertical, Calendar, Phone, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { format, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const STATUS_LABELS = {
  trialing: { label: 'Teste', color: '#1E40AF', bg: '#DBEAFE' },
  active: { label: 'Ativa', color: '#15803D', bg: '#DCFCE7' },
  past_due: { label: 'Atrasada', color: '#92400E', bg: '#FEF3C7' },
  canceled: { label: 'Cancelada', color: '#B91C1C', bg: '#FEE2E2' },
  expired: { label: 'Expirada', color: '#7F1D1D', bg: '#FECACA' },
}

export default function Admin() {
  const { user } = useAuth()
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [acaoUserId, setAcaoUserId] = useState(null)
  const [acaoLoading, setAcaoLoading] = useState(false)
  const [filtro, setFiltro] = useState('todos')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.rpc('admin_listar_usuarios')
    if (error) {
      console.error('Erro:', error)
      alert('Acesso negado ou erro: ' + error.message)
      setLoading(false)
      return
    }
    setUsuarios(data || [])
    setLoading(false)
  }

  async function ativar(userId, plano, ciclo) {
    if (!confirm(`Ativar plano ${plano.toUpperCase()} (${ciclo}) para este usuário?`)) return
    setAcaoLoading(true)
    const { error } = await supabase.rpc('admin_ativar_assinatura', {
      p_user_id: userId, p_plano: plano, p_ciclo: ciclo
    })
    setAcaoLoading(false)
    if (error) { alert('Erro: ' + error.message); return }
    setAcaoUserId(null)
    load()
  }

  async function cancelar(userId) {
    if (!confirm('Cancelar a assinatura deste usuário? Ele perderá acesso.')) return
    setAcaoLoading(true)
    const { error } = await supabase.rpc('admin_cancelar_assinatura', { p_user_id: userId })
    setAcaoLoading(false)
    if (error) { alert('Erro: ' + error.message); return }
    setAcaoUserId(null)
    load()
  }

  async function estenderTrial(userId, dias) {
    if (!confirm(`Estender trial por +${dias} dias?`)) return
    setAcaoLoading(true)
    const { error } = await supabase.rpc('admin_estender_trial', { p_user_id: userId, p_dias: dias })
    setAcaoLoading(false)
    if (error) { alert('Erro: ' + error.message); return }
    setAcaoUserId(null)
    load()
  }

  const filtradosBusca = usuarios.filter(u => {
    const q = busca.toLowerCase()
    return !q || u.email?.toLowerCase().includes(q) || u.nome?.toLowerCase().includes(q) || u.nome_salao?.toLowerCase().includes(q)
  })

  const filtrados = filtro === 'todos'
    ? filtradosBusca
    : filtradosBusca.filter(u => u.assinatura_status === filtro)

  const stats = {
    total: usuarios.length,
    ativas: usuarios.filter(u => u.assinatura_status === 'active').length,
    trial: usuarios.filter(u => u.assinatura_status === 'trialing').length,
    expiradas: usuarios.filter(u => ['expired', 'canceled'].includes(u.assinatura_status)).length,
    mrrCentavos: usuarios
      .filter(u => u.assinatura_status === 'active')
      .reduce((s, u) => s + (u.assinatura_plano === 'pro' ? 12990 : 9990), 0),
  }

  if (loading) {
    return <div style={s.loading}>Carregando...</div>
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
        <div style={{ ...s.statCard, borderTop: '3px solid var(--gold)' }}>
          <div style={{ ...s.statValor, color: 'var(--gold, #D4AF37)' }}>
            R$ {(stats.mrrCentavos / 100).toFixed(0)}
          </div>
          <div style={s.statLabel}>MRR</div>
        </div>
      </div>

      {/* Busca + Filtros */}
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

      {/* Lista de usuários */}
      <div style={s.listaTitulo}>
        {filtrados.length} {filtrados.length === 1 ? 'usuário' : 'usuários'}
      </div>

      {filtrados.map(u => {
        const st = STATUS_LABELS[u.assinatura_status] || STATUS_LABELS.expired
        const diasTrial = u.trial_termina_em
          ? differenceInDays(new Date(u.trial_termina_em), new Date())
          : null
        const diasPeriodo = u.periodo_termina_em
          ? differenceInDays(new Date(u.periodo_termina_em), new Date())
          : null
        const aberto = acaoUserId === u.user_id

        return (
          <div key={u.user_id} style={s.userCard}>
            <div style={s.userMain}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={s.userNome}>
                  {u.nome || u.email?.split('@')[0]}
                  {u.assinatura_plano === 'pro' && u.assinatura_status === 'active' && (
                    <Crown size={13} color="var(--gold, #D4AF37)" style={{ marginLeft: 6 }} />
                  )}
                </div>
                <div style={s.userEmail}>{u.email}</div>
                {u.nome_salao && <div style={s.userSalao}>🏪 {u.nome_salao}</div>}
                <div style={s.userMeta}>
                  📅 Cadastro: {format(new Date(u.user_created_at), "dd/MM/yyyy", { locale: ptBR })}
                  {u.whatsapp && <> · 📱 {u.whatsapp}</>}
                  {' · '}👥 {u.total_clientes} clientes
                </div>
              </div>

              <div style={s.userRight}>
                <span style={{ ...s.statusBadge, background: st.bg, color: st.color }}>
                  {st.label}
                </span>
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

            {/* Menu de ações */}
            {aberto && (
              <div style={s.acoes}>
                <div style={s.acoesGrid}>
                  <button
                    style={s.acaoBtn}
                    onClick={() => ativar(u.user_id, 'pro', 'mensal')}
                    disabled={acaoLoading}
                  >
                    ✓ Ativar Pro Mensal (R$ 129,90)
                  </button>
                  <button
                    style={s.acaoBtn}
                    onClick={() => ativar(u.user_id, 'pro', 'anual')}
                    disabled={acaoLoading}
                  >
                    ✓ Ativar Pro Anual (R$ 1.299)
                  </button>
                  <button
                    style={s.acaoBtn}
                    onClick={() => ativar(u.user_id, 'starter', 'mensal')}
                    disabled={acaoLoading}
                  >
                    ✓ Ativar Starter Mensal (R$ 99,90)
                  </button>
                  <button
                    style={s.acaoBtn}
                    onClick={() => ativar(u.user_id, 'starter', 'anual')}
                    disabled={acaoLoading}
                  >
                    ✓ Ativar Starter Anual (R$ 999)
                  </button>
                  <button
                    style={{ ...s.acaoBtn, background: '#EFF6FF', color: '#1E40AF', border: '1px solid #93C5FD' }}
                    onClick={() => estenderTrial(u.user_id, 7)}
                    disabled={acaoLoading}
                  >
                    + 7 dias de trial
                  </button>
                  <button
                    style={{ ...s.acaoBtn, background: '#EFF6FF', color: '#1E40AF', border: '1px solid #93C5FD' }}
                    onClick={() => estenderTrial(u.user_id, 30)}
                    disabled={acaoLoading}
                  >
                    + 30 dias de trial
                  </button>
                  <button
                    style={{ ...s.acaoBtn, background: '#FEE2E2', color: '#B91C1C', border: '1px solid #FCA5A5', gridColumn: '1 / -1' }}
                    onClick={() => cancelar(u.user_id)}
                    disabled={acaoLoading}
                  >
                    ✗ Cancelar assinatura
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {filtrados.length === 0 && (
        <div style={s.empty}>Nenhum usuário encontrado</div>
      )}

    </div>
  )
}

const s = {
  page: { padding: 20, paddingBottom: 80 },
  loading: { padding: 40, textAlign: 'center', color: 'var(--text3)' },
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
  searchBar: { display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', padding: '10px 13px', marginBottom: 10, boxShadow: 'var(--shadow-xs)' },
  searchInput: { border: 'none', outline: 'none', flex: 1, fontSize: 14, background: 'transparent', color: 'var(--text)' },
  filtros: { display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' },
  filtroBtn: { padding: '6px 12px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border2)', background: 'var(--surface)', color: 'var(--text3)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  filtroBtnActive: { background: 'var(--pink)', color: 'white', border: '1px solid var(--pink)' },
  listaTitulo: { fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 },
  userCard: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 14, marginBottom: 8, boxShadow: 'var(--shadow-xs)' },
  userMain: { display: 'flex', alignItems: 'flex-start', gap: 10 },
  userNome: { fontSize: 14, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center' },
  userEmail: { fontSize: 12, color: 'var(--text2)', marginTop: 2 },
  userSalao: { fontSize: 11, color: 'var(--text3)', marginTop: 2 },
  userMeta: { fontSize: 10, color: 'var(--text3)', marginTop: 4 },
  userRight: { textAlign: 'right', flexShrink: 0 },
  statusBadge: { fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 'var(--radius-pill)', whiteSpace: 'nowrap' },
  planoTexto: { fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600, marginTop: 4, color: 'var(--text2)' },
  menuBtn: { background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text3)', flexShrink: 0 },
  acoes: { marginTop: 12, paddingTop: 12, borderTop: '1px dashed var(--border)' },
  acoesGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 },
  acaoBtn: { background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid #86EFAC', borderRadius: 8, padding: '8px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  empty: { textAlign: 'center', padding: 40, color: 'var(--text3)', fontSize: 13 },
}
