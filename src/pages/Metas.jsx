import { useEffect, useState } from 'react'
import { TrendingUp, Plus, X, Target, Pencil, Calendar, DollarSign, Zap } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import {
  format, endOfMonth, endOfYear, startOfMonth, startOfYear,
  endOfWeek, startOfWeek, subWeeks, eachDayOfInterval, getDay, parseISO
} from 'date-fns'
import { ptBR } from 'date-fns/locale'

// Dias úteis padrão se não tiver config (seg-sex)
const DIAS_UTEIS_PADRAO = [1, 2, 3, 4, 5]

export default function Metas() {
  const { user } = useAuth()
  const { confirmar, sucesso, erro: toastErro } = useToast()
  const [metas, setMetas] = useState([])
  const [progressos, setProgressos] = useState({})
  const [estimativas, setEstimativas] = useState({ dia: 0, semana: 0, mes: 0, ano: 0 })
  const [diasFuncionamento, setDiasFuncionamento] = useState(DIAS_UTEIS_PADRAO)
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState(null) // null = criar, objeto = editar
  const [form, setForm] = useState({ tipo: 'mes', periodo: format(new Date(), 'yyyy-MM'), valor_meta: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (user) { loadConfig(); loadMetas(); loadEstimativas() } }, [user])

  async function loadConfig() {
    const { data } = await supabase.from('configuracoes')
      .select('dias_semana').eq('user_id', user.id).maybeSingle()
    if (data?.dias_semana?.length) setDiasFuncionamento(data.dias_semana)
  }

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
  }

  async function loadMetas() {
    const { data } = await supabase.from('metas').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    setMetas(data || [])
    if (!data?.length) return
    const pros = {}
    for (const meta of data) {
      const { inicio, fim } = periodoMeta(meta)
      const { data: ps } = await supabase.from('pagamentos')
        .select('valor').eq('user_id', user.id).eq('status', 'pago').gte('data', inicio).lte('data', fim)
      pros[meta.id] = (ps || []).reduce((s, p) => s + (p.valor || 0), 0)
    }
    setProgressos(pros)
  }

  function periodoMeta(meta) {
    if (meta.tipo === 'mes') {
      const [a, m] = meta.periodo.split('-')
      const inicio = `${a}-${m}-01`
      const fim = format(endOfMonth(new Date(parseInt(a), parseInt(m) - 1)), 'yyyy-MM-dd')
      return { inicio, fim, inicioDate: new Date(parseInt(a), parseInt(m) - 1, 1), fimDate: endOfMonth(new Date(parseInt(a), parseInt(m) - 1)) }
    }
    if (meta.tipo === 'ano') {
      return { inicio: `${meta.periodo}-01-01`, fim: `${meta.periodo}-12-31`, inicioDate: new Date(parseInt(meta.periodo), 0, 1), fimDate: new Date(parseInt(meta.periodo), 11, 31) }
    }
    return { inicio: meta.periodo, fim: meta.periodo, inicioDate: new Date(meta.periodo + 'T12:00:00'), fimDate: new Date(meta.periodo + 'T12:00:00') }
  }

  // Calcula projeção baseada em dias úteis trabalhados
  function calcularProjecao(meta, realizado) {
    const { inicioDate, fimDate } = periodoMeta(meta)
    const hoje = new Date()
    const fimReal = hoje > fimDate ? fimDate : hoje

    // Período inteiro
    const todosDias = eachDayOfInterval({ start: inicioDate, end: fimDate })
    const diasUteisTotal = todosDias.filter(d => diasFuncionamento.includes(getDay(d))).length

    // Dias úteis trabalhados até hoje (ou fim, se já passou)
    if (fimReal < inicioDate) return 0
    const diasAteAgora = eachDayOfInterval({ start: inicioDate, end: fimReal })
    const diasUteisTrabalhados = diasAteAgora.filter(d => diasFuncionamento.includes(getDay(d))).length

    if (diasUteisTrabalhados === 0 || diasUteisTotal === 0) return 0
    return (realizado / diasUteisTrabalhados) * diasUteisTotal
  }

  function dadosPeriodoAtual(meta) {
    const { inicioDate, fimDate } = periodoMeta(meta)
    const hoje = new Date()
    const todosDias = eachDayOfInterval({ start: inicioDate, end: fimDate })
    const diasUteisTotal = todosDias.filter(d => diasFuncionamento.includes(getDay(d))).length
    const fimReal = hoje > fimDate ? fimDate : (hoje < inicioDate ? inicioDate : hoje)
    const diasAteAgora = fimReal >= inicioDate ? eachDayOfInterval({ start: inicioDate, end: fimReal }) : []
    const diasUteisTrabalhados = diasAteAgora.filter(d => diasFuncionamento.includes(getDay(d))).length
    return { diasUteisTotal, diasUteisTrabalhados, diasUteisRestantes: Math.max(0, diasUteisTotal - diasUteisTrabalhados) }
  }

  async function salvarMeta() {
    if (!form.valor_meta || parseFloat(form.valor_meta) <= 0) {
      toastErro('Informe um valor de meta válido')
      return
    }
    setSaving(true)
    const dados = {
      user_id: user.id,
      tipo: form.tipo,
      periodo: form.periodo,
      valor_meta: parseFloat(form.valor_meta),
    }
    let resp
    if (editando) {
      resp = await supabase.from('metas').update(dados).eq('id', editando.id)
    } else {
      resp = await supabase.from('metas').insert(dados)
    }
    setSaving(false)
    if (resp.error) {
      toastErro('Erro ao salvar: ' + resp.error.message)
      return
    }
    sucesso(editando ? 'Meta atualizada ✓' : 'Meta criada ✓')
    fecharModal()
    loadMetas()
  }

  function abrirModalNova() {
    setEditando(null)
    setForm({ tipo: 'mes', periodo: format(new Date(), 'yyyy-MM'), valor_meta: '' })
    setShowModal(true)
  }

  function abrirModalEdicao(meta) {
    setEditando(meta)
    setForm({
      tipo: meta.tipo,
      periodo: meta.periodo,
      valor_meta: String(meta.valor_meta),
    })
    setShowModal(true)
  }

  function fecharModal() {
    setShowModal(false)
    setEditando(null)
    setForm({ tipo: 'mes', periodo: format(new Date(), 'yyyy-MM'), valor_meta: '' })
  }

  async function excluirMeta(meta) {
    const ok = await confirmar({
      titulo: 'Excluir esta meta?',
      mensagem: `${labelTipo(meta.tipo)} de ${labelPeriodo(meta)} - R$ ${meta.valor_meta.toFixed(0)}`,
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

  function labelTipo(tipo) {
    return tipo === 'mes' ? 'Meta mensal' : tipo === 'ano' ? 'Meta anual' : 'Meta semanal'
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
        const projecao = calcularProjecao(meta, realizado)
        const { diasUteisTotal, diasUteisTrabalhados, diasUteisRestantes } = dadosPeriodoAtual(meta)
        const pct = Math.min(100, Math.round((realizado / meta.valor_meta) * 100))
        const projecaoPct = Math.round((projecao / meta.valor_meta) * 100)
        const cor = pct >= 100 ? 'var(--green)' : pct >= 60 ? '#D97706' : 'var(--pink)'
        const bgCor = pct >= 100 ? 'var(--green-bg)' : pct >= 60 ? '#FEF3C7' : 'var(--pink-light)'
        const txtCor = pct >= 100 ? 'var(--green)' : pct >= 60 ? '#92400E' : 'var(--pink)'
        const projOnTrack = projecao >= meta.valor_meta

        return (
          <div key={meta.id} style={s.metaCard}>
            <div style={s.metaHeader}>
              <div style={{ flex: 1 }}>
                <div style={s.metaTipo}>
                  {meta.tipo === 'mes' ? '📅' : meta.tipo === 'semana' ? '🗓' : '🎯'} {labelTipo(meta)}
                </div>
                <div style={s.metaPeriodo}>{labelPeriodo(meta)}</div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button style={s.iconBtn} onClick={() => abrirModalEdicao(meta)} title="Editar">
                  <Pencil size={14} />
                </button>
                <button style={s.iconBtn} onClick={() => excluirMeta(meta)} title="Excluir">
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Grid de indicadores */}
            <div style={s.indicadoresGrid}>
              <div style={s.indicador}>
                <div style={s.indicadorLabel}><Target size={11} /> Meta</div>
                <div style={{ ...s.indicadorValor, color: 'var(--text)' }}>R$ {meta.valor_meta.toFixed(0)}</div>
              </div>
              <div style={s.indicador}>
                <div style={s.indicadorLabel}><DollarSign size={11} /> Realizado</div>
                <div style={{ ...s.indicadorValor, color: cor }}>R$ {realizado.toFixed(0)}</div>
              </div>
              <div style={s.indicador}>
                <div style={s.indicadorLabel}><Zap size={11} /> Projeção</div>
                <div style={{ ...s.indicadorValor, color: projOnTrack ? 'var(--green)' : '#D97706' }}>R$ {projecao.toFixed(0)}</div>
              </div>
            </div>

            {/* Barra de progresso */}
            <div style={s.metaValores}>
              <span style={{ ...s.mono, fontSize: 12, color: 'var(--text3)' }}>
                {diasUteisTrabalhados} de {diasUteisTotal} dias úteis · faltam {diasUteisRestantes}d
              </span>
              <span style={{ ...s.pctBadge, background: bgCor, color: txtCor }}>{pct}%</span>
            </div>
            <div style={s.barBg}>
              <div style={{ ...s.barFill, width: `${pct}%`, background: cor }} />
              {projecao > realizado && (
                <div style={{ ...s.barProjFill, width: `${Math.min(100, projecaoPct)}%` }} />
              )}
            </div>

            {/* Insight de projeção */}
            <div style={{ ...s.projecaoInsight, color: projOnTrack ? '#15803D' : '#9A3412', background: projOnTrack ? '#F0FDF4' : '#FEF3C7', borderColor: projOnTrack ? '#86EFAC' : '#FCD34D' }}>
              <TrendingUp size={13} />
              <span>
                {projOnTrack
                  ? `📈 Você está no ritmo de bater a meta! Projetado: R$ ${projecao.toFixed(0)} (${projecaoPct}%)`
                  : `⚠️ Ritmo abaixo. Precisa de R$ ${((meta.valor_meta - realizado) / Math.max(1, diasUteisRestantes)).toFixed(0)}/dia útil pra bater`}
              </span>
            </div>
          </div>
        )
      })}

      <button className="fab-btn" onClick={abrirModalNova} aria-label="Nova meta">
        <Plus size={22} color="white" />
      </button>

      {showModal && (
        <div style={s.overlay} onClick={fecharModal}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalTitle}>{editando ? '✏️ Editar meta' : '🎯 Nova meta'}</div>

            <div style={s.field}>
              <label style={s.label}>Tipo</label>
              <select
                style={s.input}
                value={form.tipo}
                onChange={e => {
                  const tipo = e.target.value
                  const periodo = tipo === 'ano' ? format(new Date(), 'yyyy') : format(new Date(), 'yyyy-MM')
                  setForm(f => ({ ...f, tipo, periodo }))
                }}
                disabled={!!editando}
              >
                <option value="mes">Mensal</option>
                <option value="semana">Semanal</option>
                <option value="ano">Anual</option>
              </select>
              {editando && <div style={s.hint}>Tipo não pode ser alterado após criação</div>}
            </div>

            <div style={s.field}>
              <label style={s.label}>Período</label>
              {form.tipo === 'ano'
                ? <input style={s.input} type="number" min="2020" max="2099" value={form.periodo} onChange={e => setForm(f => ({ ...f, periodo: e.target.value }))} />
                : <input style={s.input} type="month" value={form.periodo} onChange={e => setForm(f => ({ ...f, periodo: e.target.value }))} />
              }
            </div>

            <div style={s.field}>
              <label style={s.label}>Valor da meta (R$)</label>
              <input
                style={{ ...s.input, fontFamily: "'JetBrains Mono', monospace" }}
                type="number"
                placeholder="5000"
                value={form.valor_meta}
                onChange={e => setForm(f => ({ ...f, valor_meta: e.target.value }))}
              />
            </div>

            <button style={s.btnPrimary} onClick={salvarMeta} disabled={saving}>
              {saving ? 'Salvando...' : editando ? 'Salvar alterações' : 'Criar meta'}
            </button>
            <button style={s.btnSecondary} onClick={fecharModal}>Cancelar</button>
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
  metaCard: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '14px 15px', marginBottom: 10, boxShadow: 'var(--shadow-sm)' },
  metaHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12, gap: 8 },
  metaTipo: { fontSize: 13, fontWeight: 700, color: 'var(--text)' },
  metaPeriodo: { fontSize: 12, color: 'var(--text3)', marginTop: 2, textTransform: 'capitalize' },
  iconBtn: { background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text2)', cursor: 'pointer', padding: 6, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  indicadoresGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 },
  indicador: { background: 'var(--surface2)', borderRadius: 8, padding: '8px 10px' },
  indicadorLabel: { fontSize: 10, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 },
  indicadorValor: { fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 700 },
  metaValores: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  mono: { fontFamily: "'JetBrains Mono', monospace", fontSize: 13 },
  pctBadge: { fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 'var(--radius-pill)' },
  barBg: { position: 'relative', height: 8, borderRadius: 4, background: 'var(--border)', overflow: 'hidden', marginBottom: 10 },
  barFill: { height: '100%', borderRadius: 4, transition: 'width 0.5s ease', position: 'relative', zIndex: 2 },
  barProjFill: { position: 'absolute', top: 0, left: 0, height: '100%', borderRadius: 4, background: 'repeating-linear-gradient(45deg, rgba(217,119,6,0.3) 0px, rgba(217,119,6,0.3) 4px, transparent 4px, transparent 8px)', zIndex: 1 },
  projecaoInsight: { display: 'flex', alignItems: 'center', gap: 7, padding: '8px 10px', borderRadius: 8, border: '1px solid', fontSize: 11, fontWeight: 600, lineHeight: 1.4 },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0', textAlign: 'center' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(24,7,18,0.52)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
  modal: { background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 13 },
  modalTitle: { fontSize: 17, fontWeight: 700, marginBottom: 2 },
  field: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: { fontSize: 12, fontWeight: 600, color: 'var(--text2)' },
  hint: { fontSize: 11, color: 'var(--text3)', marginTop: 2 },
  input: { padding: '10px 13px', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', fontSize: 14, background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit' },
  btnPrimary: { background: 'var(--pink)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', padding: '13px', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 4, boxShadow: 'var(--shadow-pink)' },
  btnSecondary: { background: 'var(--surface2)', color: 'var(--text2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', padding: '12px', fontSize: 14, fontWeight: 500, cursor: 'pointer' },
}
