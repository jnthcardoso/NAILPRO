import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Shield, TrendingUp, Users, Bell, AlertTriangle,
  ArrowRight, Clock, RefreshCw,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatBRL } from '../lib/formatters'
import { format, differenceInDays, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const RENOVAR_DIAS = 30

const STATUS_LABELS = {
  active:   { label: 'Ativa',      color: '#15803D', bg: '#DCFCE7' },
  trialing: { label: 'Trial',      color: '#1E40AF', bg: '#DBEAFE' },
  pending:  { label: 'Aguard.',    color: '#6B7280', bg: '#F3F4F6' },
  canceled: { label: 'Cancelada',  color: '#B91C1C', bg: '#FEE2E2' },
  expired:  { label: 'Expirada',   color: '#7F1D1D', bg: '#FECACA' },
  past_due: { label: 'Atrasada',   color: '#92400E', bg: '#FEF3C7' },
}

function quando(ts) {
  if (!ts) return 'nunca'
  try { return formatDistanceToNow(new Date(ts), { addSuffix: true, locale: ptBR }) } catch { return '—' }
}

function diasAte(ts) {
  if (!ts) return null
  return differenceInDays(new Date(ts), new Date())
}

function mesLabel(mes) {
  try { return format(new Date(mes + '-02'), 'MMM', { locale: ptBR }) } catch { return mes }
}

export default function FounderDash() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [usuarios, setUsuarios] = useState([])
  const [mensal, setMensal] = useState([])

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    const [u, m] = await Promise.all([
      supabase.rpc('admin_listar_usuarios'),
      supabase.rpc('admin_rel_mensal', { p_meses: 6 }),
    ])
    setUsuarios(u.data || [])
    setMensal(m.data || [])
    setLoading(false)
  }

  // ── Métricas derivadas ──────────────────────────────────────
  const pagantes    = usuarios.filter(u => u.assinatura_status === 'active' && !u.cortesia)
  const trials      = usuarios.filter(u => u.assinatura_status === 'trialing' && !u.cortesia)
  const novasSemana = usuarios.filter(u => differenceInDays(new Date(), new Date(u.user_created_at)) <= 7)

  const mrr = pagantes.reduce((s, u) => {
    const base   = u.assinatura_plano === 'pro' ? 17900 : u.assinatura_plano === 'salao' ? 19900 : 9700
    const extras = (u.licencas_adicionais || 0) * 4490
    return s + base + extras
  }, 0)

  // ── Alertas ─────────────────────────────────────────────────
  const trialsExpirando = trials
    .filter(u => diasAte(u.trial_termina_em) !== null && diasAte(u.trial_termina_em) <= 3)
    .sort((a, b) => new Date(a.trial_termina_em) - new Date(b.trial_termina_em))

  const contasSumidas = usuarios
    .filter(u => ['active', 'trialing'].includes(u.assinatura_status) && !u.cortesia)
    .filter(u => !u.ultimo_acesso || differenceInDays(new Date(), new Date(u.ultimo_acesso)) >= 7)
    .sort((a, b) => {
      const da = a.ultimo_acesso ? new Date(a.ultimo_acesso) : new Date(0)
      const db = b.ultimo_acesso ? new Date(b.ultimo_acesso) : new Date(0)
      return da - db
    })

  const renovacoes = pagantes
    .filter(u => u.assinatura_ciclo === 'anual'
      && diasAte(u.periodo_termina_em) !== null
      && diasAte(u.periodo_termina_em) <= RENOVAR_DIAS)
    .sort((a, b) => new Date(a.periodo_termina_em) - new Date(b.periodo_termina_em))

  const alertasTotal = trialsExpirando.length + contasSumidas.length + renovacoes.length

  const mensalMax = Math.max(1, ...mensal.map(m => Math.max(Number(m.novas), Number(m.canceladas))))

  function nomeLabel(u) {
    return u.nome || u.email?.split('@')[0] || '?'
  }

  if (loading) {
    return <div style={s.carregando}>Carregando…</div>
  }

  return (
    <div style={s.page}>

      {/* ── Header ── */}
      <div style={s.header}>
        <div>
          <h1 style={s.title}>Founder Dashboard</h1>
          <p style={s.sub}>Visão geral do Lumen</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={s.iconBtn} onClick={carregar} title="Atualizar">
            <RefreshCw size={16} />
          </button>
          <button style={s.adminBtn} onClick={() => navigate('/app/admin')}>
            <Shield size={14} /> Admin <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div style={s.kpis}>
        <div style={{ ...s.kpi, borderTop: '3px solid var(--gold, #D4AF37)' }}>
          <div style={{ ...s.kpiValor, color: 'var(--gold, #D4AF37)' }}>{formatBRL(mrr / 100)}</div>
          <div style={s.kpiLabel}>MRR</div>
        </div>
        <div style={{ ...s.kpi, borderTop: '3px solid #15803D' }}>
          <div style={{ ...s.kpiValor, color: '#15803D' }}>{pagantes.length}</div>
          <div style={s.kpiLabel}>Ativas pagantes</div>
        </div>
        <div style={{ ...s.kpi, borderTop: '3px solid #1E40AF' }}>
          <div style={{ ...s.kpiValor, color: '#1E40AF' }}>{trials.length}</div>
          <div style={s.kpiLabel}>Em trial</div>
        </div>
        <div style={{ ...s.kpi, borderTop: '3px solid var(--pink)' }}>
          <div style={{ ...s.kpiValor, color: 'var(--pink)' }}>{novasSemana.length}</div>
          <div style={s.kpiLabel}>Novas (7 dias)</div>
        </div>
      </div>

      {/* ── Alertas ── */}
      <section style={s.card}>
        <div style={s.cardHead}>
          <Bell size={15} color={alertasTotal > 0 ? '#C2410C' : 'var(--text3)'} />
          <h3 style={s.cardTitle}>
            Alertas
            {alertasTotal > 0 && <span style={s.alertaBadge}>{alertasTotal}</span>}
          </h3>
        </div>

        {alertasTotal === 0 ? (
          <div style={s.vazio}>Tudo ok — nenhum alerta no momento.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {trialsExpirando.map(u => (
              <div key={u.user_id} style={{ ...s.alerta, borderLeft: '3px solid #B91C1C' }}>
                <AlertTriangle size={13} color="#B91C1C" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={s.alertaNome}>{nomeLabel(u)}</div>
                  <div style={s.alertaMeta}>
                    Trial expira {diasAte(u.trial_termina_em) <= 0 ? 'hoje' : `em ${diasAte(u.trial_termina_em)}d`} · sem converter
                  </div>
                </div>
                <span style={{ ...s.alertaTag, background: '#FEE2E2', color: '#B91C1C' }}>Trial expirando</span>
              </div>
            ))}

            {renovacoes.map(u => (
              <div key={u.user_id} style={{ ...s.alerta, borderLeft: '3px solid #C2410C' }}>
                <Clock size={13} color="#C2410C" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={s.alertaNome}>{nomeLabel(u)}</div>
                  <div style={s.alertaMeta}>
                    Anual vence em {diasAte(u.periodo_termina_em)}d — renovação manual
                  </div>
                </div>
                <span style={{ ...s.alertaTag, background: '#FFEDD5', color: '#C2410C' }}>Renovar</span>
              </div>
            ))}

            {contasSumidas.map(u => (
              <div key={u.user_id} style={{ ...s.alerta, borderLeft: '3px solid #6B7280' }}>
                <Clock size={13} color="#6B7280" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={s.alertaNome}>{nomeLabel(u)}</div>
                  <div style={s.alertaMeta}>
                    Último acesso {quando(u.ultimo_acesso)} · {u.assinatura_status === 'trialing' ? 'trial' : 'ativa'}
                  </div>
                </div>
                <span style={{ ...s.alertaTag, background: '#F3F4F6', color: '#6B7280' }}>Sumida</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Crescimento mês a mês ── */}
      <section style={s.card}>
        <div style={s.cardHead}>
          <TrendingUp size={15} color="var(--pink)" />
          <h3 style={s.cardTitle}>Crescimento</h3>
          <span style={s.cardLegenda}>
            <span style={{ color: '#15803D' }}>■</span> novas &nbsp;
            <span style={{ color: '#B91C1C' }}>■</span> canceladas
          </span>
        </div>
        <div style={s.mensalRow}>
          {mensal.map((m, i) => (
            <div key={i} style={s.mensalCol}>
              <div style={s.mensalBarras}>
                <div
                  title={`+${m.novas} novas`}
                  style={{ ...s.mensalBar, height: `${(Number(m.novas) / mensalMax) * 56}px`, background: '#15803D' }}
                />
                <div
                  title={`${m.canceladas} canceladas`}
                  style={{ ...s.mensalBar, height: `${(Number(m.canceladas) / mensalMax) * 56}px`, background: '#B91C1C' }}
                />
              </div>
              <div style={s.mensalNum}>
                +{m.novas}
                {Number(m.canceladas) > 0 && <span style={{ color: '#B91C1C' }}>/{m.canceladas}</span>}
              </div>
              <div style={s.mensalMes}>{mesLabel(m.mes)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Últimas contas cadastradas ── */}
      <section style={s.card}>
        <div style={s.cardHead}>
          <Users size={15} color="var(--pink)" />
          <h3 style={s.cardTitle}>Últimas contas</h3>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {[...usuarios]
            .sort((a, b) => new Date(b.user_created_at) - new Date(a.user_created_at))
            .slice(0, 8)
            .map(u => {
              const st = STATUS_LABELS[u.assinatura_status] || STATUS_LABELS.expired
              return (
                <div key={u.user_id} style={s.ultimaLinha}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={s.ultimaNome}>{nomeLabel(u)}</div>
                    <div style={s.ultimaMeta}>
                      {quando(u.user_created_at)} · {u.total_clientes || 0} clientes
                    </div>
                  </div>
                  <span style={{ ...s.alertaTag, background: st.bg, color: st.color }}>
                    {st.label}
                  </span>
                </div>
              )
            })}
        </div>
        <button style={s.verTodosBtn} onClick={() => navigate('/app/admin')}>
          Ver todas no Admin <ArrowRight size={12} />
        </button>
      </section>

    </div>
  )
}

const s = {
  page:       { padding: 20, paddingBottom: 80, display: 'flex', flexDirection: 'column', gap: 14 },
  carregando: { textAlign: 'center', padding: 48, color: 'var(--text3)', fontSize: 13 },
  header:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title:      { fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 20, fontWeight: 800, color: 'var(--text)', margin: 0 },
  sub:        { fontSize: 12, color: 'var(--text3)', margin: '2px 0 0' },
  iconBtn:    { width: 36, height: 36, borderRadius: '50%', background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text2)' },
  adminBtn:   { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#1F2937', color: 'white', border: 'none', borderRadius: 'var(--radius-pill)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  /* KPIs */
  kpis:     { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 },
  kpi:      { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '12px 8px', textAlign: 'center', boxShadow: 'var(--shadow-xs)' },
  kpiValor: { fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 700, lineHeight: 1 },
  kpiLabel: { fontSize: 10, color: 'var(--text3)', marginTop: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' },
  /* Cards */
  card:       { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 16, boxShadow: 'var(--shadow-xs)' },
  cardHead:   { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 },
  cardTitle:  { fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 15, fontWeight: 800, color: 'var(--text)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 },
  cardLegenda:{ fontSize: 10, color: 'var(--text3)', marginLeft: 'auto', fontWeight: 600 },
  alertaBadge:{ background: '#FEE2E2', color: '#B91C1C', borderRadius: 999, fontSize: 10, fontWeight: 700, padding: '2px 7px' },
  /* Alertas */
  alerta:    { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 },
  alertaNome:{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  alertaMeta:{ fontSize: 10.5, color: 'var(--text3)', marginTop: 1 },
  alertaTag: { fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 999, whiteSpace: 'nowrap', flexShrink: 0 },
  /* Crescimento */
  mensalRow:  { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 6 },
  mensalCol:  { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 },
  mensalBarras:{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 60 },
  mensalBar:  { width: 14, borderRadius: '3px 3px 0 0', minHeight: 2, transition: 'height 0.4s' },
  mensalNum:  { fontSize: 10, fontWeight: 700, color: '#15803D', fontFamily: "'JetBrains Mono', monospace" },
  mensalMes:  { fontSize: 9.5, color: 'var(--text3)', textTransform: 'capitalize' },
  /* Últimas contas */
  ultimaLinha:{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', borderBottom: '1px solid var(--border)' },
  ultimaNome: { fontSize: 12.5, fontWeight: 700, color: 'var(--text)' },
  ultimaMeta: { fontSize: 10.5, color: 'var(--text3)', marginTop: 1 },
  verTodosBtn:{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 10, background: 'transparent', border: 'none', color: 'var(--pink)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: 0 },
  vazio:      { fontSize: 12, color: 'var(--text3)', textAlign: 'center', padding: '16px 0' },
}
