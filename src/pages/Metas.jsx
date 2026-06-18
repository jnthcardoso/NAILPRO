import { useEffect, useState } from 'react'
import { TrendingUp, Plus, X, Target, Pencil, DollarSign, Zap, Users, BarChart2, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useSalao } from '../contexts/SalaoContext'
import { useToast } from '../contexts/ToastContext'
import { useAssinatura } from '../contexts/AssinaturaContext'
import { useNavigate } from 'react-router-dom'
import { ProBadge } from '../components/common/UpgradeBlock'
import Modal from '../components/common/Modal'
import { inputBase, labelBase, btnPrimaryBase, btnSecondaryBase } from '../lib/ui'
import { formatBRL } from '../lib/formatters'
import { traduzErro } from '../lib/erros'
import {
  format, endOfMonth, subMonths, addMonths, eachDayOfInterval, getDay, parseISO, differenceInDays
} from 'date-fns'
import { ptBR } from 'date-fns/locale'

const DIAS_UTEIS_PADRAO = [1, 2, 3, 4, 5]

export default function Metas() {
  const { user } = useAuth()
  const { salaoId } = useSalao()
  const { confirmar, sucesso, erro: toastErro } = useToast()
  const { temAcesso } = useAssinatura()
  const navigate = useNavigate()
  const [tab, setTab] = useState('metas')

  // ── Metas ───────────────────────────────────────────
  const [metas, setMetas] = useState([])
  const [progressos, setProgressos] = useState({})
  const [diasFuncionamento, setDiasFuncionamento] = useState(DIAS_UTEIS_PADRAO)
  const [mesFiltro, setMesFiltro] = useState(format(new Date(), 'yyyy-MM'))
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState({ tipo: 'mes', periodo: format(new Date(), 'yyyy-MM'), valor_meta: '' })
  const [saving, setSaving] = useState(false)

  // ── KPIs ─────────────────────────────────────────────
  const [kpiMeses, setKpiMeses] = useState('3')
  const [retencaoDias, setRetencaoDias] = useState(45)
  const [faturServico, setFaturServico] = useState([])
  const [taxaRetencao, setTaxaRetencao] = useState(null)
  const [novasClientes, setNovasClientes] = useState([])
  const [loadingKpi, setLoadingKpi] = useState(false)   // carga inicial (todos)
  const [loadingFatur, setLoadingFatur] = useState(false) // carga isolada do faturamento

  useEffect(() => { if (salaoId) { loadConfig(); loadMetas() } }, [salaoId])
  // Carga inicial: carrega TODOS os KPIs quando entra na tab
  useEffect(() => { if (salaoId && tab === 'kpis') loadKpis() }, [salaoId, tab])
  // kpiMeses → só recarrega faturamento
  useEffect(() => { if (salaoId && tab === 'kpis') loadFaturamento() }, [kpiMeses])
  // retencaoDias → só recarrega retenção
  useEffect(() => { if (salaoId && tab === 'kpis') loadRetencaoKpi() }, [retencaoDias])


  // ── Config ────────────────────────────────────────────
  async function loadConfig() {
    const { data } = await supabase.from('configuracoes')
      .select('dias_semana').eq('salao_id', salaoId).maybeSingle()
    if (data?.dias_semana?.length) setDiasFuncionamento(data.dias_semana)
  }

  // ── Metas ─────────────────────────────────────────────
  async function loadMetas() {
    const { data } = await supabase.from('metas').select('*').eq('salao_id', salaoId).order('created_at', { ascending: false })
    setMetas(data || [])
    if (!data?.length) { setProgressos({}); return }
    // 1 só consulta: busca todos os pagamentos pagos no intervalo que cobre todas as metas
    // (em vez de 1 consulta por meta) e soma cada meta no cliente.
    // Limita ao dia de hoje — não existe faturamento "realizado" no futuro.
    const hojeStr = format(new Date(), 'yyyy-MM-dd')
    let minIni = null, maxFim = null
    data.forEach(meta => {
      const { inicio, fim } = periodoMeta(meta)
      if (!minIni || inicio < minIni) minIni = inicio
      if (!maxFim || fim > maxFim) maxFim = fim
    })
    if (maxFim > hojeStr) maxFim = hojeStr
    const pros = {}
    if (minIni && maxFim && minIni <= maxFim) {
      const { data: pags } = await supabase.from('pagamentos')
        .select('valor, data').eq('salao_id', salaoId).eq('status', 'pago')
        .gte('data', minIni).lte('data', maxFim)
      data.forEach(meta => {
        const { inicio, fim } = periodoMeta(meta)
        const fimReal = fim > hojeStr ? hojeStr : fim
        pros[meta.id] = (pags || []).reduce(
          (s, p) => (p.data >= inicio && p.data <= fimReal ? s + (p.valor || 0) : s), 0)
      })
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

  function calcularProjecao(meta, realizado) {
    const { inicioDate, fimDate } = periodoMeta(meta)
    const hoje = new Date()
    const fimReal = hoje > fimDate ? fimDate : hoje
    const todosDias = eachDayOfInterval({ start: inicioDate, end: fimDate })
    const diasUteisTotal = todosDias.filter(d => diasFuncionamento.includes(getDay(d))).length
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
    if (!form.valor_meta || parseFloat(form.valor_meta) <= 0) { toastErro('Informe um valor válido'); return }
    // Evita criar duas metas para o mesmo período (uma só por tipo/período).
    if (!editando && metas.some(m => m.tipo === form.tipo && m.periodo === form.periodo)) {
      toastErro('Já existe uma meta para este período. Edite a meta existente.'); return
    }
    setSaving(true)
    const dados = { user_id: user.id, salao_id: salaoId, tipo: form.tipo, periodo: form.periodo, valor_meta: parseFloat(form.valor_meta) }
    const resp = editando
      ? await supabase.from('metas').update(dados).eq('id', editando.id).eq('salao_id', salaoId)
      : await supabase.from('metas').insert(dados)
    setSaving(false)
    if (resp.error) { toastErro(traduzErro(resp.error, 'Não foi possível salvar a meta.')); return }
    sucesso(editando ? 'Meta atualizada ✓' : 'Meta criada ✓')
    fecharModal(); loadMetas()
  }

  function abrirModalNova() {
    setEditando(null)
    setForm({ tipo: 'mes', periodo: mesFiltro, valor_meta: '' })
    setShowModal(true)
  }

  function abrirModalEdicao(meta) {
    setEditando(meta)
    setForm({ tipo: meta.tipo, periodo: meta.periodo, valor_meta: String(meta.valor_meta) })
    setShowModal(true)
  }

  function fecharModal() {
    setShowModal(false); setEditando(null)
    setForm({ tipo: 'mes', periodo: format(new Date(), 'yyyy-MM'), valor_meta: '' })
  }

  async function excluirMeta(meta) {
    const ok = await confirmar({
      titulo: 'Excluir esta meta?',
      mensagem: `${labelTipo(meta.tipo)} de ${labelPeriodo(meta)} - ${formatBRL(meta.valor_meta)}`,
      confirmarLabel: 'Sim, excluir', cancelarLabel: 'Cancelar', tipo: 'perigo',
    })
    if (!ok) return
    const metaAnterior = meta
    const { error } = await supabase.from('metas').delete().eq('id', meta.id).eq('salao_id', salaoId)
    if (error) { toastErro(traduzErro(error, 'Não foi possível excluir a meta.')); return }
    setMetas(m => m.filter(x => x.id !== meta.id))
    sucesso('Meta excluída', {
      duracao: 5000, acaoLabel: 'Desfazer',
      acao: async () => {
        const { tipo, periodo, valor_meta } = metaAnterior
        await supabase.from('metas').insert({ tipo, periodo, valor_meta, user_id: user.id, salao_id: salaoId })
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

  // ── KPIs — funções isoladas ───────────────────────────

  // 1. Faturamento por serviço (depende de kpiMeses)
  async function loadFaturamento(mesesParam) {
    const m = mesesParam ?? kpiMeses
    setLoadingFatur(true)
    const inicio = format(subMonths(new Date(), parseInt(m)), 'yyyy-MM-dd')
    const { data: agsServ } = await supabase
      .from('agendamentos')
      .select('servico, valor, pagamentos(valor, status)')
      .eq('salao_id', salaoId)
      .eq('status', 'realizado')
      .gte('data', inicio)
    if (agsServ) {
      const grouped = {}
      agsServ.forEach(a => {
        // Faturamento = dinheiro efetivamente recebido (pagamento "pago"),
        // mesma definição do "Realizado" das metas e do Financeiro.
        const pag = a.pagamentos?.find(p => p.status === 'pago')
        if (!pag) return
        const val = pag.valor || 0
        if (val > 0) grouped[a.servico] = (grouped[a.servico] || 0) + val
      })
      const sorted = Object.entries(grouped)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([nome, valor]) => ({ nome, valor }))
      const totalFatur = sorted.reduce((s, x) => s + x.valor, 0)
      setFaturServico(sorted.map(x => ({ ...x, pct: totalFatur > 0 ? Math.round((x.valor / totalFatur) * 100) : 0 })))
    }
    setLoadingFatur(false)
  }

  // 2. Taxa de retenção (depende de retencaoDias)
  async function loadRetencaoKpi(diasParam) {
    const dias = diasParam ?? retencaoDias
    const hoje = new Date()
    const { data: agsRet } = await supabase
      .from('agendamentos')
      .select('cliente_id, data')
      .eq('salao_id', salaoId)
      .eq('status', 'realizado')
      .order('data')
    if (agsRet) {
      const byClient = {}
      agsRet.forEach(a => {
        if (!byClient[a.cliente_id]) byClient[a.cliente_id] = []
        byClient[a.cliente_id].push(a.data)
      })
      let analisados = 0, retornaram = 0
      Object.values(byClient).forEach(visitas => {
        const primeiraVisita = parseISO(visitas[0])
        if (differenceInDays(hoje, primeiraVisita) < dias) return
        analisados++
        for (let i = 0; i < visitas.length - 1; i++) {
          const diff = differenceInDays(parseISO(visitas[i + 1]), parseISO(visitas[i]))
          if (diff <= dias) { retornaram++; break }
        }
      })
      setTaxaRetencao({
        taxa: analisados > 0 ? Math.round((retornaram / analisados) * 100) : 0,
        retornaram, analisados,
      })
    }
  }

  // 3. Novas clientes por mês (estático — sempre últimos 6 meses)
  async function loadNovasKpi() {
    const { data: cls } = await supabase
      .from('clientes')
      .select('created_at')
      .eq('salao_id', salaoId)
    if (cls) {
      const byMonth = {}
      cls.forEach(c => {
        const mes = format(new Date(c.created_at), 'yyyy-MM')
        byMonth[mes] = (byMonth[mes] || 0) + 1
      })
      const months = []
      for (let i = 5; i >= 0; i--) {
        const d = subMonths(new Date(), i)
        const key = format(d, 'yyyy-MM')
        months.push({ label: format(d, 'MMM/yy', { locale: ptBR }), qtd: byMonth[key] || 0 })
      }
      setNovasClientes(months)
    }
  }

  // Carga completa (entrada na tab)
  async function loadKpis() {
    setLoadingKpi(true)
    await Promise.all([loadFaturamento(), loadRetencaoKpi(), loadNovasKpi()])
    setLoadingKpi(false)
  }

  const maxFatur = faturServico.length > 0 ? faturServico[0].valor : 1
  const maxNovas = novasClientes.length > 0 ? Math.max(...novasClientes.map(m => m.qtd), 1) : 1

  // ── Navegação de mês ──────────────────────────────────
  function mesAnterior() {
    setMesFiltro(prev => format(subMonths(new Date(prev + '-02'), 1), 'yyyy-MM'))
  }
  function mesProximo() {
    setMesFiltro(prev => format(addMonths(new Date(prev + '-02'), 1), 'yyyy-MM'))
  }
  const labelMesFiltro = format(new Date(mesFiltro + '-02'), "MMMM 'de' yyyy", { locale: ptBR })
  const ehMesAtual = mesFiltro === format(new Date(), 'yyyy-MM')

  // Filtra metas pelo período selecionado
  const metasFiltradas = metas.filter(m => {
    if (m.tipo === 'mes') return m.periodo === mesFiltro
    if (m.tipo === 'ano') return m.periodo === mesFiltro.slice(0, 4)
    // semana/custom: verifica se o período começa com o ano-mês selecionado
    return (m.periodo || '').startsWith(mesFiltro)
  })

  return (
    <div style={s.page}>
      {/* Tab bar */}
      <div style={tabs.bar}>
        <button style={{ ...tabs.btn, ...(tab === 'metas' ? tabs.btnAtivo : {}) }} onClick={() => setTab('metas')}>
          <Target size={14} /> Metas
        </button>
        <button style={{ ...tabs.btn, ...(tab === 'kpis' ? tabs.btnAtivo : {}) }} onClick={() => setTab('kpis')}>
          <BarChart2 size={14} /> KPIs
        </button>
      </div>

      {/* ── TAB: METAS ─────────────────────────────────── */}
      {tab === 'metas' && (
        <>
          {/* Navegação de mês */}
          <div style={s.mesNav}>
            <button style={s.mesNavBtn} onClick={mesAnterior}>‹</button>
            <div style={s.mesNavLabel}>
              {labelMesFiltro}
              {ehMesAtual && <span style={s.mesAtualChip}>atual</span>}
            </div>
            <button style={s.mesNavBtn} onClick={mesProximo}>›</button>
          </div>

          {metasFiltradas.length === 0 && (
            <div style={s.empty}>
              <Target size={32} color="var(--text3)" style={{ marginBottom: 10 }} />
              <p style={{ color: 'var(--text3)', fontSize: 14 }}>Nenhuma meta para {labelMesFiltro}</p>
              <p style={{ color: 'var(--text3)', fontSize: 12, marginTop: 4 }}>Clique em + para criar uma meta para este mês</p>
            </div>
          )}
          {metasFiltradas.map(meta => {
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
                    <div style={s.metaTipo}>{meta.tipo === 'mes' ? '📅' : meta.tipo === 'semana' ? '🗓' : '🎯'} {labelTipo(meta.tipo)}</div>
                    <div style={s.metaPeriodo}>{labelPeriodo(meta)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button style={s.iconBtn} onClick={() => abrirModalEdicao(meta)}><Pencil size={14} /></button>
                    <button style={s.iconBtn} onClick={() => excluirMeta(meta)}><X size={14} /></button>
                  </div>
                </div>
                <div className="meta-ind-grid" style={s.indicadoresGrid}>
                  <div className="meta-ind" style={s.indicador}>
                    <div className="meta-ind-label" style={s.indicadorLabel}><Target size={11} /> Meta</div>
                    <div style={{ ...s.indicadorValor, color: 'var(--text)' }}>{formatBRL(meta.valor_meta)}</div>
                  </div>
                  <div className="meta-ind" style={s.indicador}>
                    <div className="meta-ind-label" style={s.indicadorLabel}><DollarSign size={11} /> Realizado</div>
                    <div style={{ ...s.indicadorValor, color: cor }}>{formatBRL(realizado)}</div>
                  </div>
                  <div className="meta-ind" style={s.indicador}>
                    <div className="meta-ind-label" style={s.indicadorLabel}><Zap size={11} /> Projeção</div>
                    <div style={{ ...s.indicadorValor, color: projOnTrack ? 'var(--green)' : '#D97706' }}>{formatBRL(projecao)}</div>
                  </div>
                </div>
                <div style={s.metaValores}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--text3)' }}>
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
                <div style={{ ...s.projecaoInsight, color: projOnTrack ? '#15803D' : '#9A3412', background: projOnTrack ? '#F0FDF4' : '#FEF3C7', borderColor: projOnTrack ? '#86EFAC' : '#FCD34D' }}>
                  <TrendingUp size={13} />
                  <span>
                    {projOnTrack
                      ? `📈 Você está no ritmo de bater a meta! Projetado: ${formatBRL(projecao)} (${projecaoPct}%)`
                      : diasUteisRestantes === 0
                        ? `Período encerrado. Faltaram ${formatBRL(Math.max(0, meta.valor_meta - realizado))} pra meta`
                        : `⚠️ Ritmo abaixo. Precisa de ${formatBRL((meta.valor_meta - realizado) / diasUteisRestantes)}/dia útil pra bater`}
                  </span>
                </div>
              </div>
            )
          })}
          <button className="fab-btn" onClick={abrirModalNova} aria-label="Nova meta">
            <Plus size={22} color="white" />
          </button>
        </>
      )}

      {/* ── TAB: KPIs ──────────────────────────────────── */}
      {tab === 'kpis' && (
        <>
          {loadingKpi ? (
            <div style={s.kpiGrid}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ ...s.kpiCard, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={s.skeletonTitle} />
                  <div style={s.skeletonLine} />
                  {[1, 2, 3, 4].map(j => (
                    <div key={j} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ ...s.skeletonLine, width: `${60 + j * 8}%` }} />
                      <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', width: `${80 - j * 10}%` }} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div style={s.kpiGrid}>
              {/* 1. Faturamento por serviço */}
              <div style={s.kpiCard}>
                <div style={s.kpiCardTitle}><BarChart2 size={15} color="var(--pink)" /> Faturamento por serviço</div>
                {/* Seletor de período — local ao card de faturamento */}
                <div style={s.faturControle}>
                  <div style={s.segmented}>
                    {[['1', '1m'], ['3', '3m'], ['6', '6m'], ['12', '12m']].map(([v, l]) => (
                      <button
                        key={v}
                        style={{ ...s.segBtn, ...(kpiMeses === v ? s.segBtnAtivo : {}) }}
                        onClick={() => setKpiMeses(v)}
                      >{l}</button>
                    ))}
                  </div>
                  <button style={s.reloadBtnSm} onClick={() => loadFaturamento()} title="Atualizar" disabled={loadingFatur}>
                    <RefreshCw size={12} style={{ animation: loadingFatur ? 'spin 1s linear infinite' : 'none' }} />
                  </button>
                </div>
                {loadingFatur ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                    {[1, 2, 3].map(j => (
                      <div key={j} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ ...s.skeletonLine, width: `${70 + j * 5}%` }} />
                        <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', width: `${85 - j * 10}%` }} />
                      </div>
                    ))}
                  </div>
                ) : faturServico.length === 0
                  ? <div style={s.kpiEmpty}>Sem dados no período selecionado</div>
                  : faturServico.map((item, i) => (
                    <div key={i} style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{item.nome}</span>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--pink)', fontWeight: 600 }}>
                            {formatBRL(item.valor)}
                          </span>
                          <span style={{ fontSize: 10, color: 'var(--text3)', minWidth: 28, textAlign: 'right' }}>{item.pct}%</span>
                        </div>
                      </div>
                      <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 3, background: 'var(--pink)', width: `${(item.valor / maxFatur) * 100}%`, transition: 'width 0.4s ease' }} />
                      </div>
                    </div>
                  ))
                }
              </div>

              {/* 2 e 3 (retenção + novas clientes) são KPIs avançados: Pro/Salão. */}
              {temAcesso('relatoriosAvancados') ? (
              <>
              {/* 2. Taxa de retenção */}
              <div style={s.kpiCard}>
                <div style={s.kpiCardTitle}><RefreshCw size={15} color="var(--pink)" /> Taxa de retenção</div>

                {/* Configuração do período */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, background: 'var(--surface2)', borderRadius: 8, padding: '10px 12px', border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 500, whiteSpace: 'nowrap' }}>Retorno esperado em até</span>
                  <select
                    style={{ ...s.miniSelect }}
                    value={retencaoDias}
                    onChange={e => setRetencaoDias(parseInt(e.target.value))}
                  >
                    {[14, 21, 30, 45, 60, 90].map(d => (
                      <option key={d} value={d}>{d} dias</option>
                    ))}
                  </select>
                </div>

                {taxaRetencao === null ? (
                  <div style={s.kpiEmpty}>Calculando...</div>
                ) : (
                  <>
                    {/* Indicador principal */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
                      <div style={{
                        width: 80, height: 80, borderRadius: '50%',
                        background: `conic-gradient(${taxaRetencao.taxa >= 70 ? 'var(--green)' : taxaRetencao.taxa >= 40 ? '#D97706' : 'var(--pink)'} ${taxaRetencao.taxa * 3.6}deg, var(--border) 0deg)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        boxShadow: 'inset 0 0 0 12px var(--surface)'
                      }}>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{taxaRetencao.taxa}%</span>
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                          {taxaRetencao.taxa >= 70 ? '😍 Excelente retenção!' : taxaRetencao.taxa >= 40 ? '😊 Retenção boa' : '⚠️ Retenção baixa'}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>
                          {taxaRetencao.retornaram} de {taxaRetencao.analisados} clientes voltaram dentro de {retencaoDias} dias
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                          {taxaRetencao.analisados - taxaRetencao.retornaram} não retornaram no prazo
                        </div>
                      </div>
                    </div>
                    <div style={{ height: 8, borderRadius: 4, background: 'var(--border)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 4,
                        background: taxaRetencao.taxa >= 70 ? 'var(--green)' : taxaRetencao.taxa >= 40 ? '#D97706' : 'var(--pink)',
                        width: `${taxaRetencao.taxa}%`, transition: 'width 0.5s ease'
                      }} />
                    </div>
                  </>
                )}
              </div>

              {/* 3. Novas clientes por mês */}
              <div style={s.kpiCard}>
                <div style={s.kpiCardTitle}><Users size={15} color="var(--pink)" /> Novas clientes por mês</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 12 }}>Últimos 6 meses</div>
                {novasClientes.every(m => m.qtd === 0) ? (
                  <div style={s.kpiEmpty}>Sem dados suficientes</div>
                ) : (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 80 }}>
                    {novasClientes.map((m, i) => (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, color: m.qtd > 0 ? 'var(--pink)' : 'var(--text3)' }}>
                          {m.qtd > 0 ? m.qtd : '—'}
                        </span>
                        <div style={{ width: '100%', borderRadius: '3px 3px 0 0', background: m.qtd > 0 ? 'var(--pink)' : 'var(--border)', height: `${Math.max(4, (m.qtd / maxNovas) * 52)}px`, transition: 'height 0.4s ease', opacity: i === novasClientes.length - 1 ? 1 : 0.6 + (i * 0.08) }} />
                        <span style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>{m.label}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', background: 'var(--surface2)', borderRadius: 8, padding: '8px 12px' }}>
                  <span style={{ fontSize: 12, color: 'var(--text2)' }}>Total nos últimos 6 meses</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: 'var(--pink)' }}>
                    {novasClientes.reduce((s, m) => s + m.qtd, 0)} clientes
                  </span>
                </div>
              </div>
              </>
              ) : (
                <div style={{ ...s.kpiCard, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 10, minHeight: 180 }}>
                  <RefreshCw size={26} color="var(--text3)" />
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    KPIs avançados <ProBadge />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', maxWidth: 240, lineHeight: 1.5 }}>
                    Taxa de retenção e novas clientes por mês fazem parte do plano Pro.
                  </div>
                  <button
                    onClick={() => navigate('/planos')}
                    style={{ marginTop: 4, background: 'var(--pink)', color: 'white', border: 'none', borderRadius: 'var(--radius-pill)', padding: '8px 16px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                  >Conhecer o Pro</button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Modal de meta ──────────────────────────────── */}
      {showModal && (
        <Modal onClose={fecharModal} variant="sheet" boxStyle={s.modal}>
            <div style={s.modalTitle}>{editando ? '✏️ Editar meta' : '🎯 Nova meta'}</div>
            <div style={s.field}>
              <label style={s.label}>Tipo</label>
              <select style={s.input} value={form.tipo} onChange={e => {
                const tipo = e.target.value
                const periodo = tipo === 'ano' ? format(new Date(), 'yyyy') : format(new Date(), 'yyyy-MM')
                setForm(f => ({ ...f, tipo, periodo }))
              }} disabled={!!editando}>
                <option value="mes">Mensal</option>
                <option value="ano">Anual</option>
              </select>
              {editando && <div style={{ fontSize: 11, color: 'var(--text3)' }}>Tipo não pode ser alterado após criação</div>}
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
              <input style={{ ...s.input, fontFamily: "'JetBrains Mono', monospace" }} type="number" placeholder="5000" value={form.valor_meta} onChange={e => setForm(f => ({ ...f, valor_meta: e.target.value }))} />
            </div>
            <button style={s.btnPrimary} onClick={salvarMeta} disabled={saving}>{saving ? 'Salvando...' : editando ? 'Salvar alterações' : 'Criar meta'}</button>
            <button style={s.btnSecondary} onClick={fecharModal}>Cancelar</button>
        </Modal>
      )}
    </div>
  )
}

const tabs = {
  bar: { display: 'flex', gap: 4, background: 'var(--surface)', borderRadius: 'var(--radius-sm)', padding: 4, marginBottom: 20, boxShadow: 'var(--shadow-xs)', border: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 10 },
  btn: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 12px', borderRadius: 8, background: 'transparent', border: 'none', color: 'var(--text3)', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  btnAtivo: { background: 'var(--pink)', color: 'white', boxShadow: 'var(--shadow-pink)', fontWeight: 700 },
}

const s = {
  page: { padding: 16, paddingBottom: 80 },
  mesNav: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: 16, boxShadow: 'var(--shadow-xs)' },
  mesNavBtn: { background: 'none', border: 'none', fontSize: 22, color: 'var(--text2)', cursor: 'pointer', padding: '0 6px', lineHeight: 1, fontFamily: 'inherit' },
  mesNavLabel: { display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 14, fontWeight: 700, color: 'var(--text)', textTransform: 'capitalize' },
  mesAtualChip: { fontSize: 10, fontWeight: 700, background: 'var(--pink)', color: 'white', borderRadius: 'var(--radius-pill)', padding: '2px 8px' },
  // Metas
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
  pctBadge: { fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 'var(--radius-pill)' },
  barBg: { position: 'relative', height: 8, borderRadius: 4, background: 'var(--border)', overflow: 'hidden', marginBottom: 10 },
  barFill: { height: '100%', borderRadius: 4, transition: 'width 0.5s ease', position: 'relative', zIndex: 2 },
  barProjFill: { position: 'absolute', top: 0, left: 0, height: '100%', borderRadius: 4, background: 'repeating-linear-gradient(45deg, rgba(217,119,6,0.3) 0px, rgba(217,119,6,0.3) 4px, transparent 4px, transparent 8px)', zIndex: 1 },
  projecaoInsight: { display: 'flex', alignItems: 'center', gap: 7, padding: '8px 10px', borderRadius: 8, border: '1px solid', fontSize: 11, fontWeight: 600, lineHeight: 1.4 },
  // KPIs
  faturControle: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, marginTop: 4 },
  segmented: { display: 'flex', gap: 3, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: 3, flex: 1 },
  segBtn: { flex: 1, padding: '5px 6px', borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--text3)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'all 0.15s' },
  segBtnAtivo: { background: 'var(--pink)', color: 'white', boxShadow: 'var(--shadow-pink)' },
  reloadBtnSm: { width: 28, height: 28, borderRadius: 7, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'opacity 0.15s' },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, alignItems: 'start' },
  kpiCard: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '15px', boxShadow: 'var(--shadow-sm)' },
  kpiCardTitle: { display: 'flex', alignItems: 'center', gap: 7, fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 },
  kpiEmpty: { textAlign: 'center', color: 'var(--text3)', fontSize: 13, padding: '20px 0' },
  miniSelect: { padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border2)', background: 'var(--surface)', color: 'var(--pink)', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', outline: 'none' },
  loading: { textAlign: 'center', color: 'var(--text3)', fontSize: 13, padding: '40px 0' },
  skeletonTitle: { height: 16, borderRadius: 6, background: 'var(--border)', width: '60%', animation: 'np-pulse-soft 1.5s ease-in-out infinite' },
  skeletonLine: { height: 12, borderRadius: 6, background: 'var(--border)', width: '80%', animation: 'np-pulse-soft 1.5s ease-in-out infinite' },
  // Modal
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0', textAlign: 'center' },
  modal: { background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 13 },
  modalTitle: { fontSize: 17, fontWeight: 700, marginBottom: 2 },
  field: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: labelBase,
  input: inputBase,
  btnPrimary: { ...btnPrimaryBase, transition: undefined },
  btnSecondary: btnSecondaryBase,
}
