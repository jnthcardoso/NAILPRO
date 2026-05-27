import { useEffect, useState } from 'react'
import { TrendingUp, Plus, X, Target } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { format, endOfMonth, endOfYear, startOfMonth, startOfYear, endOfWeek, startOfWeek, subWeeks } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default function Metas() {
  const { user } = useAuth()
  const { confirmar, sucesso } = useToast()
  const [metas, setMetas] = useState([])
  const [progressos, setProgressos] = useState({})
  const [estimativas, setEstimativas] = useState({ dia: 0, semana: 0, mes: 0, ano: 0 })
  const [projecao, setProjecao] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ tipo: 'mes', periodo: format(new Date(), 'yyyy-MM'), valor_meta: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (user) { loadMetas(); loadEstimativas() } }, [user])

  async function loadEstimativas() {
    const hoje = format(new Date(), 'yyyy-MM-dd')
    const fimSemana = format(endOfWeek(new Date(), { locale: ptBR }), 'yyyy-MM-dd')
    const fimMes = format(endOfMonth(new Date()), 'yyyy-MM-dd')
    const fimAno = format(endOfYear(new Date()), 'yyyy-MM-dd')

    const { data: ags } = await supabase
      .from('agendamentos').select('data, valor, status')
      .eq('user_id', user.id).gte('data', hoje).neq('status', 'cancelado')

    if (ags) {
      setEstimativas({
        dia: ags.filter(a => a.data === hoje).reduce((s, a) => s + (a.valor || 0), 0),
        semana: ags.filter(a => a.data <= fimSemana).reduce((s, a) => s + (a.valor || 0), 0),
        mes: ags.filter(a => a.data <= fimMes).reduce((s, a) => s + (a.valor || 0), 0),
        ano: ags.filter(a => a.data <= fimAno).reduce((s, a) => s + (a.valor || 0), 0),
      })
    }

    const h4 = format(subWeeks(new Date(), 4), 'yyyy-MM-dd')
    const { data: pags } = await supabase.from('pagamentos')
      .select('valor').eq('user_id', user.id).eq('status', 'pago').gte('data', h4)
    if (pags?.length) {
      const mediaSemanal = pags.reduce((s, p) => s + (p.valor || 0), 0) / 4
      setProjecao((mediaSemanal / 7) * endOfMonth(new Date()).getDate())
    }
  }

  async function loadMetas() {
    const { data } = await supabase.from('metas').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    setMetas(data || [])
    if (!data?.length) return
    const pros = {}
    for (const meta of data) {
      let inicio, fim
      if (meta.tipo === 'mes') {
        const [a, m] = meta.periodo.split('-')
        inicio = `${a}-${m}-01`
        fim = format(endOfMonth(new Date(parseInt(a), parseInt(m) - 1)), 'yyyy-MM-dd')
      } else if (meta.tipo === 'ano') {
        inicio = `${meta.periodo}-01-01`; fim = `${meta.periodo}-12-31`
      } else {
        inicio = meta.periodo; fim = meta.periodo
      }
      const { data: ps } = await supabase.from('pagamentos')
        .select('valor').eq('user_id', user.id).eq('status', 'pago').gte('data', inicio).lte('data', fim)
      pros[meta.id] = (ps || []).reduce((s, p) => s + (p.valor || 0), 0)
    }
    setProgressos(pros)
  }

  async function salvarMeta() {
    if (!form.valor_meta) return
    setSaving(true)
    await supabase.from('metas').insert({ ...form, user_id: user.id, valor_meta: parseFloat(form.valor_meta) })
    setSaving(false); setShowModal(false)
    setForm({ tipo: 'mes', periodo: format(new Date(), 'yyyy-MM'), valor_meta: '' })
    loadMetas()
  }

  async function excluirMeta(meta) {
    const ok = await confirmar({
      titulo: 'Excluir esta meta?',
      mensagem: `${meta.tipo === 'mes' ? 'Meta mensal' : meta.tipo === 'ano' ? 'Meta anual' : 'Meta semanal'} - R$ ${meta.valor_meta.toFixed(0)}`,
      confirmarLabel: 'Sim, excluir',
      cancelarLabel: 'Cancelar',
      tipo: 'perigo',
    })
    if (!ok) return

    const metaAnterior = meta
    await supabase.from('metas').delete().eq('id', meta.id)
    setMetas(m => m.filter(x => x.id !== meta.id))

    sucesso('Meta excluída', {
      duracao: 5000,
      acaoLabel: 'Desfazer',
      acao: async () => {
        const { tipo, periodo, valor_meta } = metaAnterior
        await supabase.from('metas').insert({ tipo, periodo, valor_meta, user_id: user.id })
        loadMetas()
      },
    })
  }

  function labelPeriodo(meta) {
    if (meta.tipo === 'mes') {
      const [a, m] = meta.periodo.split('-')
      return format(new Date(parseInt(a), parseInt(m) - 1), 'MMMM yyyy', { locale: ptBR })
    }
    if (meta.tipo === 'ano') return meta.periodo
    return `Semana ${meta.periodo}`
  }

  const ESTIM = [
    { label: 'Hoje', valor: estimativas.dia },
    { label: 'Semana', valor: estimativas.semana },
    { label: 'Mês', valor: estimativas.mes },
    { label: 'Ano', valor: estimativas.ano },
  ]

  return (
    <div style={s.page}>

      <div style={s.sectionTitle}>receita estimada (agendamentos futuros)</div>
      <div style={s.grid4}>
        {ESTIM.map(({ label, valor }) => (
          <div key={label} style={s.estimCard}>
            <div style={s.estimLabel}>{label}</div>
            <div style={s.estimValor}>R$ {valor.toFixed(0)}</div>
          </div>
        ))}
      </div>

      {projecao !== null && (
        <div style={s.projecaoCard}>
          <TrendingUp size={16} style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Projeção do mês</div>
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>
              Média das últimas 4 semanas → <strong>R$ {projecao.toFixed(0)}</strong> estimado
            </div>
          </div>
        </div>
      )}

      <div style={{ ...s.sectionTitle, marginTop: 20 }}>metas cadastradas</div>

      {metas.length === 0 && (
        <div style={s.empty}>
          <Target size={32} color="var(--text3)" style={{ marginBottom: 10 }} />
          <p style={{ color: 'var(--text3)', fontSize: 14 }}>Nenhuma meta ainda</p>
          <p style={{ color: 'var(--text3)', fontSize: 12, marginTop: 4 }}>Clique em + para definir uma meta</p>
        </div>
      )}

      {metas.map(meta => {
        const realizado = progressos[meta.id] || 0
        const pct = Math.min(100, Math.round((realizado / meta.valor_meta) * 100))
        const cor = pct >= 100 ? 'var(--green)' : pct >= 60 ? '#D97706' : 'var(--pink)'
        const bgCor = pct >= 100 ? 'var(--green-bg)' : pct >= 60 ? '#FEF3C7' : 'var(--pink-light)'
        const txtCor = pct >= 100 ? 'var(--green)' : pct >= 60 ? '#92400E' : 'var(--pink)'
        return (
          <div key={meta.id} style={s.metaCard}>
            <div style={s.metaHeader}>
              <div>
                <div style={s.metaTipo}>
                  {meta.tipo === 'mes' ? '📅 Meta mensal' : meta.tipo === 'semana' ? '🗓 Meta semanal' : '🎯 Meta anual'}
                </div>
                <div style={s.metaPeriodo}>{labelPeriodo(meta)}</div>
              </div>
              <button style={s.deleteBtn} onClick={() => excluirMeta(meta)}><X size={14} /></button>
            </div>
            <div style={s.metaValores}>
              <span style={s.mono}>R$ {realizado.toFixed(0)} <span style={{ color: 'var(--text3)' }}>/ R$ {meta.valor_meta.toFixed(0)}</span></span>
              <span style={{ ...s.pctBadge, background: bgCor, color: txtCor }}>{pct}%</span>
            </div>
            <div style={s.barBg}>
              <div style={{ ...s.barFill, width: `${pct}%`, background: cor }} />
            </div>
          </div>
        )
      })}

      <button className="fab-btn" onClick={() => setShowModal(true)} aria-label="Nova meta">
        <Plus size={22} color="white" />
      </button>

      {showModal && (
        <div style={s.overlay} onClick={() => setShowModal(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalTitle}>Nova meta</div>
            <div style={s.field}>
              <label style={s.label}>Tipo</label>
              <select style={s.input} value={form.tipo} onChange={e => {
                const tipo = e.target.value
                const periodo = tipo === 'ano' ? format(new Date(), 'yyyy') : format(new Date(), 'yyyy-MM')
                setForm(f => ({ ...f, tipo, periodo }))
              }}>
                <option value="mes">Mensal</option>
                <option value="semana">Semanal</option>
                <option value="ano">Anual</option>
              </select>
            </div>
            <div style={s.field}>
              <label style={s.label}>Período</label>
              {form.tipo === 'ano'
                ? <input style={s.input} type="number" min="2020" max="2035" value={form.periodo} onChange={e => setForm(f => ({ ...f, periodo: e.target.value }))} />
                : <input style={s.input} type="month" value={form.periodo} onChange={e => setForm(f => ({ ...f, periodo: e.target.value }))} />
              }
            </div>
            <div style={s.field}>
              <label style={s.label}>Valor da meta (R$)</label>
              <input style={{ ...s.input, fontFamily: "'JetBrains Mono', monospace" }} type="number" placeholder="5000" value={form.valor_meta} onChange={e => setForm(f => ({ ...f, valor_meta: e.target.value }))} />
            </div>
            <button style={s.btnPrimary} onClick={salvarMeta} disabled={saving}>{saving ? 'Salvando...' : 'Salvar meta'}</button>
            <button style={s.btnSecondary} onClick={() => setShowModal(false)}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}

const s = {
  page: { padding: 16, paddingBottom: 80 },
  sectionTitle: { fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 10 },
  grid4: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 },
  estimCard: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', boxShadow: 'var(--shadow-xs)' },
  estimLabel: { fontSize: 10, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 },
  estimValor: { fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600, color: 'var(--pink)' },
  projecaoCard: { display: 'flex', alignItems: 'center', gap: 10, background: '#EFF6FF', border: '1px solid #93C5FD', borderRadius: 'var(--radius-sm)', padding: '11px 14px', color: '#1D4ED8', marginBottom: 4 },
  metaCard: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '14px 15px', marginBottom: 10, boxShadow: 'var(--shadow-sm)' },
  metaHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 },
  metaTipo: { fontSize: 13, fontWeight: 700, color: 'var(--text)' },
  metaPeriodo: { fontSize: 12, color: 'var(--text3)', marginTop: 2, textTransform: 'capitalize' },
  deleteBtn: { background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' },
  metaValores: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  mono: { fontFamily: "'JetBrains Mono', monospace", fontSize: 13 },
  pctBadge: { fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 'var(--radius-pill)' },
  barBg: { height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3, transition: 'width 0.5s ease' },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0', textAlign: 'center' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(24,7,18,0.52)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
  modal: { background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 13 },
  modalTitle: { fontSize: 17, fontWeight: 700, marginBottom: 2 },
  field: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: { fontSize: 12, fontWeight: 600, color: 'var(--text2)' },
  input: { padding: '10px 13px', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', fontSize: 14, background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit' },
  btnPrimary: { background: 'var(--pink)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', padding: '13px', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 4, boxShadow: 'var(--shadow-pink)' },
  btnSecondary: { background: 'var(--surface2)', color: 'var(--text2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', padding: '12px', fontSize: 14, fontWeight: 500, cursor: 'pointer' },
}
