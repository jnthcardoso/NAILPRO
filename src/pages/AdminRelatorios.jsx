import { useEffect, useState } from 'react'
import { BarChart3, TrendingUp, Filter, Activity, Crown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { format, parseISO, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { formatBRL } from '../lib/formatters'

// Tempo relativo amigável ("há 2 dias", "nunca").
function quando(ts) {
  if (!ts) return 'nunca'
  try { return formatDistanceToNow(new Date(ts), { addSuffix: true, locale: ptBR }) } catch { return '—' }
}

function pct(parte, total) {
  if (!total) return 0
  return Math.round((Number(parte) / Number(total)) * 100)
}

function mesLabel(d) {
  try { return format(parseISO(d), "MMM/yy", { locale: ptBR }) } catch { return d }
}

// Cor do semáforo de saúde
const SAUDE = {
  2: { cor: '#15803D', bg: '#DCFCE7', label: 'Saudável' },
  1: { cor: '#C2410C', bg: '#FFEDD5', label: 'Atenção' },
  0: { cor: '#B91C1C', bg: '#FEE2E2', label: 'Risco' },
}

const STATUS_PT = {
  active: 'Ativas', trialing: 'Trial', pending: 'Aguardando',
  canceled: 'Canceladas', expired: 'Expiradas', past_due: 'Atrasadas',
}

export default function AdminRelatorios() {
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)
  const [adocao, setAdocao] = useState([])
  const [funil, setFunil] = useState([])
  const [planos, setPlanos] = useState([])
  const [statusBreak, setStatusBreak] = useState([])
  const [mensal, setMensal] = useState([])
  const [coorte, setCoorte] = useState([])
  const [saude, setSaude] = useState([])

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    setErro(null)
    const [a, f, p, st, m, c, sa] = await Promise.all([
      supabase.rpc('admin_rel_adocao'),
      supabase.rpc('admin_rel_funil'),
      supabase.rpc('admin_rel_planos'),
      supabase.rpc('admin_rel_status'),
      supabase.rpc('admin_rel_mensal', { p_meses: 6 }),
      supabase.rpc('admin_rel_coorte', { p_meses: 6 }),
      supabase.rpc('admin_rel_saude'),
    ])
    const primeiroErro = [a, f, p, st, m, c, sa].find(r => r.error)
    if (primeiroErro) {
      setErro(primeiroErro.error.message || 'Erro ao carregar relatórios')
      setLoading(false)
      return
    }
    setAdocao(a.data || [])
    setFunil(f.data || [])
    setPlanos(p.data || [])
    setStatusBreak(st.data || [])
    setMensal(m.data || [])
    setCoorte(c.data || [])
    setSaude(sa.data || [])
    setLoading(false)
  }

  if (loading) return <div style={s.carregando}>Carregando relatórios…</div>
  if (erro) return <div style={s.erro}>Não foi possível carregar: {erro}</div>

  // ── Métricas derivadas ──
  const mrrTotal = planos.reduce((acc, p) => acc + Number(p.mrr_centavos || 0), 0)
  const ativasTotal = planos.reduce((acc, p) => acc + Number(p.ativas || 0), 0)
  const cadastroBase = funil[0]?.contas || 0
  const mensalMax = Math.max(1, ...mensal.map(m => Math.max(Number(m.novas), Number(m.canceladas))))

  // Conversão = ativas / (ativas + canceladas + expiradas)
  const mapStatus = Object.fromEntries(statusBreak.map(x => [x.status, Number(x.contas)]))
  const ativ = mapStatus.active || 0
  const perdidas = (mapStatus.canceled || 0) + (mapStatus.expired || 0)
  const conv = pct(ativ, ativ + perdidas)

  return (
    <div style={s.wrap}>

      {/* ════ ONDA 1 — Adoção de funcionalidades ════ */}
      <section style={s.card}>
        <div style={s.cardHead}>
          <BarChart3 size={16} color="var(--pink)" />
          <h3 style={s.cardTitle}>Adoção de funcionalidades</h3>
        </div>
        <p style={s.cardSub}>De {adocao[0]?.total || 0} contas, quantas usam cada recurso.</p>
        <div style={s.barras}>
          {adocao.map(r => {
            const p = pct(r.usados, r.total)
            return (
              <div key={r.recurso} className="rel-bar-row" style={s.barraLinha}>
                <div className="rel-bar-label" style={s.barraLabel}>{r.recurso}</div>
                <div className="rel-bar-track" style={s.barraTrack}>
                  <div style={{ ...s.barraFill, width: `${p}%` }} />
                </div>
                <div className="rel-bar-val" style={s.barraVal}>{r.usados}<span style={s.barraValSub}>/{r.total} · {p}%</span></div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ════ ONDA 1 — Funil de ativação ════ */}
      <section style={s.card}>
        <div style={s.cardHead}>
          <Filter size={16} color="var(--pink)" />
          <h3 style={s.cardTitle}>Funil de ativação</h3>
        </div>
        <p style={s.cardSub}>Onde a conta nova trava no caminho até virar usuária de verdade.</p>
        <div style={s.barras}>
          {funil.map((etp, i) => {
            const p = pct(etp.contas, cadastroBase)
            const queda = i > 0 ? pct(etp.contas, funil[i - 1].contas) : 100
            return (
              <div key={etp.etapa} className="rel-bar-row" style={s.barraLinha}>
                <div className="rel-bar-label" style={s.barraLabel}>{etp.etapa}</div>
                <div className="rel-bar-track" style={s.barraTrack}>
                  <div style={{ ...s.barraFill, width: `${p}%`, background: 'var(--gold, #D4AF37)' }} />
                </div>
                <div className="rel-bar-val" style={s.barraVal}>
                  {etp.contas}
                  <span style={s.barraValSub}>{i > 0 ? ` · ${queda}% do passo anterior` : ` · ${p}%`}</span>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ════ ONDA 2 — Planos & MRR ════ */}
      <section style={s.card}>
        <div style={s.cardHead}>
          <Crown size={16} color="var(--gold, #D4AF37)" />
          <h3 style={s.cardTitle}>Planos & MRR</h3>
        </div>
        <div style={s.mrrTopo}>
          <div>
            <div style={s.mrrValor}>{formatBRL(mrrTotal / 100)}</div>
            <div style={s.mrrLabel}>MRR ({ativasTotal} ativas pagantes)</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ ...s.mrrValor, fontSize: 20, color: '#15803D' }}>{conv}%</div>
            <div style={s.mrrLabel}>conversão (ativa vs. perdida)</div>
          </div>
        </div>
        <table style={s.tabela}>
          <thead>
            <tr>
              <th style={s.th}>Plano</th><th style={s.th}>Ciclo</th>
              <th style={{ ...s.th, textAlign: 'right' }}>Ativas</th>
              <th style={{ ...s.th, textAlign: 'right' }}>MRR</th>
            </tr>
          </thead>
          <tbody>
            {planos.map((p, i) => (
              <tr key={i}>
                <td style={s.td}>{p.plano === 'salao' ? 'Salão' : (p.plano?.[0]?.toUpperCase() + p.plano?.slice(1))}</td>
                <td style={s.tdSub}>{p.ciclo}</td>
                <td style={{ ...s.td, textAlign: 'right' }}>{p.ativas}</td>
                <td style={{ ...s.td, textAlign: 'right', fontWeight: 700 }}>{formatBRL(Number(p.mrr_centavos) / 100)}</td>
              </tr>
            ))}
            {planos.length === 0 && <tr><td colSpan={4} style={s.vazio}>Nenhuma assinatura ativa pagante.</td></tr>}
          </tbody>
        </table>

        {/* Status (chips) */}
        <div style={s.chips}>
          {statusBreak.map(x => (
            <span key={x.status} style={s.chip}>
              {STATUS_PT[x.status] || x.status}: <strong>{x.contas}</strong>
            </span>
          ))}
        </div>
      </section>

      {/* ════ ONDA 2 — Mês a mês ════ */}
      <section style={s.card}>
        <div style={s.cardHead}>
          <TrendingUp size={16} color="var(--pink)" />
          <h3 style={s.cardTitle}>Mês a mês</h3>
        </div>
        <p style={s.cardSub}>Novas ativações <span style={{ color: '#15803D', fontWeight: 700 }}>(verde)</span> e cancelamentos <span style={{ color: '#B91C1C', fontWeight: 700 }}>(vermelho)</span>.</p>
        <div style={s.mensalRow}>
          {mensal.map((m, i) => (
            <div key={i} style={s.mensalCol}>
              <div style={s.mensalBarras}>
                <div title={`${m.novas} novas`} style={{ ...s.mensalBar, height: `${(Number(m.novas) / mensalMax) * 60}px`, background: '#15803D' }} />
                <div title={`${m.canceladas} canceladas`} style={{ ...s.mensalBar, height: `${(Number(m.canceladas) / mensalMax) * 60}px`, background: '#B91C1C' }} />
              </div>
              <div style={s.mensalNum}>+{m.novas}{Number(m.canceladas) > 0 && <span style={{ color: '#B91C1C' }}> −{m.canceladas}</span>}</div>
              <div style={s.mensalMes}>{mesLabel(m.mes)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ════ ONDA 2 — Retenção por safra ════ */}
      <section style={s.card}>
        <div style={s.cardHead}>
          <Activity size={16} color="var(--pink)" />
          <h3 style={s.cardTitle}>Retenção por safra</h3>
        </div>
        <p style={s.cardSub}>De quem se cadastrou em cada mês, quantas seguem ativas hoje.</p>
        <table style={s.tabela}>
          <thead>
            <tr>
              <th style={s.th}>Mês de cadastro</th>
              <th style={{ ...s.th, textAlign: 'right' }}>Cadastros</th>
              <th style={{ ...s.th, textAlign: 'right' }}>Ativas hoje</th>
              <th style={{ ...s.th, textAlign: 'right' }}>Retenção</th>
            </tr>
          </thead>
          <tbody>
            {coorte.map((c, i) => {
              const ret = pct(c.ativas_hoje, c.cadastros)
              return (
                <tr key={i}>
                  <td style={s.td}>{mesLabel(c.mes)}</td>
                  <td style={{ ...s.td, textAlign: 'right' }}>{c.cadastros}</td>
                  <td style={{ ...s.td, textAlign: 'right' }}>{c.ativas_hoje}</td>
                  <td style={{ ...s.td, textAlign: 'right', fontWeight: 700, color: ret >= 50 ? '#15803D' : ret > 0 ? '#C2410C' : 'var(--text3)' }}>{ret}%</td>
                </tr>
              )
            })}
            {coorte.length === 0 && <tr><td colSpan={4} style={s.vazio}>Sem cadastros no período.</td></tr>}
          </tbody>
        </table>
      </section>

      {/* ════ ONDA 3 — Saúde das contas ════ */}
      <section style={s.card}>
        <div style={s.cardHead}>
          <Activity size={16} color="#B91C1C" />
          <h3 style={s.cardTitle}>Saúde das contas</h3>
        </div>
        <p style={s.cardSub}>Contas ativas/trial ordenadas por risco de cancelar (🔴 primeiro). Cruza último login, última atividade e agendamentos dos últimos 30 dias.</p>
        <div style={s.saudeLista}>
          {saude.map(u => {
            const sm = SAUDE[u.score] || SAUDE[1]
            return (
              <div key={u.user_id} style={s.saudeItem}>
                <span style={{ ...s.saudeDot, background: sm.cor }} title={sm.label} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={s.saudeNome}>
                    {u.nome || u.email?.split('@')[0]}
                    {u.nome_salao && <span style={s.saudeSalao}> · {u.nome_salao}</span>}
                  </div>
                  <div style={s.saudeMeta}>
                    login {quando(u.ultimo_acesso)} · ativa {quando(u.ultima_atividade)} · {u.agendamentos_30d} agend. em 30d
                  </div>
                </div>
                <span style={{ ...s.saudeBadge, background: sm.bg, color: sm.cor }}>{sm.label}</span>
              </div>
            )
          })}
          {saude.length === 0 && <div style={s.vazio}>Nenhuma conta ativa/trial.</div>}
        </div>
      </section>

    </div>
  )
}

const s = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 12 },
  carregando: { textAlign: 'center', padding: 40, color: 'var(--text3)', fontSize: 13 },
  erro: { textAlign: 'center', padding: 24, color: '#B91C1C', fontSize: 13, background: '#FEE2E2', borderRadius: 'var(--radius-sm)' },
  card: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 16, boxShadow: 'var(--shadow-xs)' },
  cardHead: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 },
  cardTitle: { fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 15, fontWeight: 800, color: 'var(--text)', margin: 0 },
  cardSub: { fontSize: 11.5, color: 'var(--text3)', margin: '0 0 12px', lineHeight: 1.5 },
  /* Barras (adoção/funil) */
  barras: { display: 'flex', flexDirection: 'column', gap: 9 },
  barraLinha: { display: 'grid', gridTemplateColumns: '130px 1fr auto', alignItems: 'center', gap: 10 },
  barraLabel: { fontSize: 11.5, color: 'var(--text2)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  barraTrack: { height: 8, background: 'var(--surface2, #F3F4F6)', borderRadius: 999, overflow: 'hidden' },
  barraFill: { height: '100%', background: 'var(--pink)', borderRadius: 999, transition: 'width 0.4s' },
  barraVal: { fontSize: 11, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', fontFamily: "'JetBrains Mono', monospace" },
  barraValSub: { fontSize: 9.5, fontWeight: 500, color: 'var(--text3)', fontFamily: 'inherit' },
  /* MRR topo */
  mrrTopo: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, padding: '4px 0 14px', borderBottom: '1px solid var(--border)', marginBottom: 12 },
  mrrValor: { fontFamily: "'JetBrains Mono', monospace", fontSize: 26, fontWeight: 700, color: 'var(--gold, #D4AF37)', lineHeight: 1 },
  mrrLabel: { fontSize: 10.5, color: 'var(--text3)', marginTop: 4, fontWeight: 600 },
  /* Tabela */
  tabela: { width: '100%', borderCollapse: 'collapse', fontSize: 12.5 },
  th: { textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '4px 6px', borderBottom: '1px solid var(--border)' },
  td: { padding: '7px 6px', color: 'var(--text)', borderBottom: '1px solid var(--border)', fontWeight: 600 },
  tdSub: { padding: '7px 6px', color: 'var(--text3)', borderBottom: '1px solid var(--border)', fontSize: 11.5 },
  vazio: { padding: 16, textAlign: 'center', color: 'var(--text3)', fontSize: 12 },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  chip: { fontSize: 11, color: 'var(--text2)', background: 'var(--surface2, #F3F4F6)', border: '1px solid var(--border)', borderRadius: 999, padding: '3px 10px' },
  /* Mês a mês */
  mensalRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 6, paddingTop: 8 },
  mensalCol: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 },
  mensalBarras: { display: 'flex', alignItems: 'flex-end', gap: 3, height: 64 },
  mensalBar: { width: 12, borderRadius: '3px 3px 0 0', minHeight: 2, transition: 'height 0.4s' },
  mensalNum: { fontSize: 10, fontWeight: 700, color: '#15803D', fontFamily: "'JetBrains Mono', monospace" },
  mensalMes: { fontSize: 9.5, color: 'var(--text3)', textTransform: 'capitalize' },
  /* Saúde */
  saudeLista: { display: 'flex', flexDirection: 'column', gap: 2 },
  saudeItem: { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 4px', borderBottom: '1px solid var(--border)' },
  saudeDot: { width: 10, height: 10, borderRadius: '50%', flexShrink: 0 },
  saudeNome: { fontSize: 12.5, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  saudeSalao: { fontWeight: 500, color: 'var(--text3)' },
  saudeMeta: { fontSize: 10.5, color: 'var(--text3)', marginTop: 2 },
  saudeBadge: { fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 999, whiteSpace: 'nowrap', flexShrink: 0 },
}
