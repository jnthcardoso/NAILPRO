import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Plus, FileDown, ChevronLeft, ChevronRight, Crown, Calendar,
  TrendingUp, TrendingDown, DollarSign, Receipt, X, Pencil,
  BarChart2, ListOrdered, CalendarClock, MessageCircle, Check
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useSalao } from '../contexts/SalaoContext'
import { useAssinatura } from '../contexts/AssinaturaContext'
import { formatBRL, formatMoeda, linkWhatsApp, validarTelefone } from '../lib/formatters'
import { aplicarVariaveis } from '../lib/mensagens'
import { UpgradeModal, ProBadge } from '../components/common/UpgradeBlock'
import { CardSkeleton } from '../components/common/Skeleton'
import PagamentoModal from '../components/agenda/PagamentoModal'
import RegistrarPagamentoModal from '../components/financeiro/RegistrarPagamentoModal'
import ProLaboreModal from '../components/financeiro/ProLaboreModal'
import DespesaModal from '../components/financeiro/DespesaModal'
import ConfirmarPagarDespesaModal from '../components/financeiro/ConfirmarPagarDespesaModal'
import { format, startOfMonth, endOfMonth, addMonths, subMonths, eachMonthOfInterval } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import BarChart, { HBarChart } from '../components/charts/BarChart'
import DonutChart from '../components/charts/DonutChart'
import { useToast } from '../contexts/ToastContext'
import { exportarPDFResumo, exportarPDFReceitas, exportarPDFDespesas, exportarPDFAnalises, exportarPDFAnual } from '../lib/pdfExporter'
import { s, tabs } from './Financeiro.styles'
import { CATEGORIAS, FORMAS_PAGAMENTO } from './Financeiro.constants'
import { useFinanceiroDados } from '../hooks/useFinanceiroDados'
import { useFinanceiroConfig } from '../hooks/useFinanceiroConfig'
import { useFinanceiroReceitas } from '../hooks/useFinanceiroReceitas'
import { useFinanceiroDespesas } from '../hooks/useFinanceiroDespesas'

// Linha do DRE que expande pra mostrar os lançamentos que somam aquele valor.
function LinhaDespesaExpansivel({ label, sub, valor, cor, items, aberto, onToggle, categorias = CATEGORIAS }) {
  return (
    <>
      <div style={{ ...s.dreLinha, cursor: 'pointer' }} onClick={onToggle}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <ChevronRight size={13} style={{ transition: 'transform .15s', transform: aberto ? 'rotate(90deg)' : 'none', flexShrink: 0 }} />
          {label}{sub && <span style={{ color: 'var(--text3)', fontSize: 11 }}> {sub}</span>}
        </span>
        <span style={{ ...s.mono, color: cor }}>− {formatBRL(valor)}</span>
      </div>
      {aberto && (
        <div style={s.dreSubLista}>
          {items.length === 0
            ? <div style={{ ...s.dreSubItem, color: 'var(--text3)' }}>nenhum lançamento</div>
            : items.map(d => {
              const c = categorias.find(x => x.id === d.categoria)
              return (
                <div key={d.id} style={s.dreSubItem}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                    {c?.icon || '📦'} {d.descricao}
                  </span>
                  <span style={{ ...s.mono, color: 'var(--text2)', flexShrink: 0 }}>
                    {d.valor_a_preencher ? '—' : formatBRL(d.valor)}
                  </span>
                </div>
              )
            })}
        </div>
      )}
    </>
  )
}

export default function Financeiro() {
  const { user } = useAuth()
  const { salaoId, gerenciaTudo } = useSalao()
  const { temAcesso } = useAssinatura()
  const { erro: toastErro, sucesso, confirmar } = useToast()

  // ── Estados de UI ─────────────────────────────────────────────────────────
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [filtro, setFiltro] = useState('todos')
  const [filtroDespesa, setFiltroDespesa] = useState('todas')
  const [periodoSel, setPeriodoSel] = useState(new Date())
  const [rangeMode, setRangeMode] = useState('mes')
  const [customInicio, setCustomInicio] = useState('')
  const [customFim, setCustomFim] = useState('')
  const [exportando, setExportando] = useState(false)
  const [exportandoAnual, setExportandoAnual] = useState(false)
  const [tab, setTab] = useState('resumo')
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 769)
  const [dreAberto, setDreAberto] = useState({})
  const toggleDre = (k) => setDreAberto(p => ({ ...p, [k]: !p[k] }))
  const [searchParams] = useSearchParams()

  // ── Dados do banco (pagamentos, despesas, agendamentos, previsão) ──────────
  const {
    pagamentos, setPagamentos, despesas, pagamentos6m, agendamentos, previsao, loading,
    loadPagamentos, loadDespesas, refDate,
  } = useFinanceiroDados({ salaoId, user, gerenciaTudo, periodoSel, rangeMode, customInicio, customFim })

  // ── Configurações do salão (cobrança PIX, pró-labore, categorias) ──────────
  const {
    cobranca, proLabore, showProLabore, setShowProLabore,
    proLaboreInput, setProLaboreInput, savingProLabore,
    categoriasCustom, setCategoriasCustom,
    abrirProLabore, salvarProLabore,
  } = useFinanceiroConfig({ salaoId, user })

  // ── Ações de receitas (registrar, confirmar pago, reverter, cobrar) ────────
  const {
    showModal, setShowModal,
    form, setForm, saving,
    pagSelecionado, setPagSelecionado,
    formPag, setFormPag, savingPag,
    salvarPagamento, reverterParaPendente, marcarCobrado,
    abrirConfirmarPago, salvarPagamentoConfirmado,
  } = useFinanceiroReceitas({ loadPagamentos, setPagamentos })

  // ── Ações de despesas (criar, editar, pagar, excluir, categorias) ──────────
  const {
    showDespesaModal, setShowDespesaModal,
    editandoDespesa,
    formDespesa, setFormDespesa, savingDespesa,
    despesaParaPagar, setDespesaParaPagar,
    formPagarDespesa, setFormPagarDespesa, savingPagarDespesa,
    showNovaCat, setShowNovaCat,
    novaCat, setNovaCat, savingCat,
    abrirNovaDespesa, abrirEditarDespesa, fecharDespesaModal,
    abrirConfirmarPagarDespesa,
    salvarDespesa, confirmarPagarDespesa, excluirDespesa,
    salvarNovaCategoria, excluirCategoria,
  } = useFinanceiroDespesas({ loadDespesas, setCategoriasCustom })

  // Alterna entre layout celular e computador ao redimensionar a janela.
  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 769)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Atalho vindo da Home: ?ver=pendentes abre direto Receitas filtrado em pendentes.
  useEffect(() => {
    if (searchParams.get('ver') === 'pendentes') {
      setTab('receitas')
      setFiltro('pendente')
    }
    if (searchParams.get('ver') === 'apagar') {
      setTab('despesas')
      setFiltroDespesa('a_pagar')
    }
  }, [searchParams])

  // PDF contextual: exporta o conteúdo da aba ativa respeitando o filtro vigente.
  async function handleExportarPDF() {
    if (!temAcesso('exportPDF')) { setShowUpgrade(true); return }
    setExportando(true)
    try {
      if (tab === 'resumo')   await exportarPDFResumo({ periodoLabel, recebido, pendente, qtdPagos, totalDespesasSalao, salaoPagas, salaoAPagar, totalDespesasPessoal, proLabore: proLaboreEfetivo, mostraProLabore, lucro, margemLucro, despesasSalaoArr, salaoPagasArr, salaoAPagarArr, despesasPessoalArr, categorias: categoriasTodas })
      if (tab === 'receitas') await exportarPDFReceitas(filtrados, periodoLabel, filtro)
      if (tab === 'despesas') await exportarPDFDespesas(despesasVisiveis, periodoLabel, filtroDespesa, categoriasTodas)
      if (tab === 'analises') await exportarPDFAnalises({ periodoLabel, recebido, totalDespesasSalao, lucro, topServicos, dadosFormas, dadosDespesas })
    } catch (e) { toastErro('Erro ao gerar PDF') }
    setExportando(false)
  }

  async function handleExportarAnual() {
    if (!temAcesso('exportPDF')) { setShowUpgrade(true); return }
    setExportandoAnual(true)
    try {
      const ano = refDate.getFullYear()
      const inicio = `${ano}-01-01`
      const fim = `${ano}-12-31`
      let despQ = supabase.from('despesas').select('*').gte('data', inicio).lte('data', fim)
      despQ = gerenciaTudo ? despQ.eq('salao_id', salaoId) : despQ.eq('user_id', user.id)
      const [{ data: pagsRaw }, { data: desps }] = await Promise.all([
        supabase.from('pagamentos')
          .select('data, valor, status, forma, agendamentos(servico, status, clientes(nome))')
          .eq('salao_id', salaoId).eq('status', 'pago')
          .gte('data', inicio).lte('data', fim).limit(10000),
        despQ.limit(2000),
      ])
      const pags = (pagsRaw || []).filter(p => p.agendamentos?.status !== 'cancelado')
      await exportarPDFAnual(pags, desps || [], ano)
    } catch (e) { toastErro('Erro ao gerar PDF anual') }
    setExportandoAnual(false)
  }

  const labelBtnPDF = {
    resumo:   'PDF do Resumo',
    receitas: 'PDF de Receitas',
    despesas: 'PDF de Despesas',
    analises: 'PDF de Análises',
  }[tab] || 'PDF'

  // ─── Calculos ───
  const recebido = pagamentos.filter(p => p.status === 'pago').reduce((s, p) => s + p.valor, 0)
  const pendente = pagamentos.filter(p => p.status === 'pendente').reduce((s, p) => s + p.valor, 0)
  const qtdPagos = pagamentos.filter(p => p.status === 'pago').length
  const totalDespesas = despesas.reduce((s, d) => s + d.valor, 0)
  // Bolso: despesa do salão (custo do negócio) × pessoal (gasto da dona).
  // Pessoal NÃO entra no lucro do salão — vai pro "seu bolso".
  const totalDespesasPessoal = despesas.filter(d => d.tipo === 'pessoal').reduce((s, d) => s + (d.valor || 0), 0)
  const totalDespesasSalao = totalDespesas - totalDespesasPessoal
  // Pró-labore é DESPESA operacional: abatido ANTES do lucro líquido (contábil).
  // Só pra dona/recepção e em mês fechado (não em período personalizado).
  const mostraProLabore = gerenciaTudo && rangeMode === 'mes'
  const proLaboreEfetivo = mostraProLabore ? proLabore : 0
  const lucro = recebido - totalDespesasSalao - proLaboreEfetivo
  const margemLucro = recebido > 0 ? (lucro / recebido) * 100 : 0
  const filtrados = filtro === 'todos' ? pagamentos : pagamentos.filter(p => p.status === filtro)
  // Previsão de receita só faz sentido no MÊS ATUAL (é "daqui pra frente").
  const ehMesAtual = rangeMode === 'mes' && format(periodoSel, 'yyyy-MM') === format(new Date(), 'yyyy-MM')
  const periodoLabel = (rangeMode === 'custom' && customInicio && customFim)
    ? `${format(new Date((customInicio <= customFim ? customInicio : customFim) + 'T12:00:00'), 'dd/MM/yy')} – ${format(new Date((customInicio <= customFim ? customFim : customInicio) + 'T12:00:00'), 'dd/MM/yy')}`
    : format(periodoSel, "MMMM 'de' yyyy", { locale: ptBR })

  // Gráficos
  const meses6 = eachMonthOfInterval({ start: subMonths(refDate, 5), end: refDate })
  const dadosReceita6m = meses6.map(mes => {
    const ini = format(startOfMonth(mes), 'yyyy-MM-dd')
    const fim = format(endOfMonth(mes), 'yyyy-MM-dd')
    const total = pagamentos6m.filter(p => p.data >= ini && p.data <= fim).reduce((s, p) => s + (p.valor || 0), 0)
    return { label: format(mes, 'MMM', { locale: ptBR }), valor: total }
  })

  // Quebra por serviço baseada no que foi RECEBIDO (pagamentos pagos), pra bater
  // com a receita do período. Antes usava agendamentos.valor, que divergia.
  const servicosMap = {}
  const agsVistosPorServico = {}
  pagamentos.filter(p => p.status === 'pago').forEach(p => {
    const sv = p.agendamentos?.servico
    if (!sv) return
    if (!servicosMap[sv]) { servicosMap[sv] = { qtd: 0, valor: 0 }; agsVistosPorServico[sv] = new Set() }
    servicosMap[sv].valor += p.valor || 0
    // qtd = atendimentos distintos (pagamento de 2 formas não conta dobrado)
    const aid = p.agendamento_id
    if (!aid) { servicosMap[sv].qtd += 1 }
    else if (!agsVistosPorServico[sv].has(aid)) { agsVistosPorServico[sv].add(aid); servicosMap[sv].qtd += 1 }
  })
  const topServicos = Object.entries(servicosMap)
    .map(([nome, v]) => ({ label: nome, valor: v.valor, qtd: v.qtd }))
    .sort((a, b) => b.valor - a.valor).slice(0, 5)

  // KPIs da aba Análises
  const agIdsVistos = new Set()
  let totalAtendimentos = 0
  pagamentos.filter(p => p.status === 'pago').forEach(p => {
    if (!p.agendamento_id) { totalAtendimentos++; return }
    if (!agIdsVistos.has(p.agendamento_id)) { agIdsVistos.add(p.agendamento_id); totalAtendimentos++ }
  })
  const ticketMedio = totalAtendimentos > 0 ? recebido / totalAtendimentos : 0
  // Comparação com o mês anterior (só no modo "por mês", usa os dados dos 6m)
  const mesAnteriorDate = subMonths(periodoSel, 1)
  const iniAnterior = format(startOfMonth(mesAnteriorDate), 'yyyy-MM-dd')
  const fimAnterior = format(endOfMonth(mesAnteriorDate), 'yyyy-MM-dd')
  const recebidoMesAnterior = rangeMode === 'mes'
    ? pagamentos6m.filter(p => p.data >= iniAnterior && p.data <= fimAnterior).reduce((s, p) => s + (p.valor || 0), 0)
    : null

  // 'sem' = pagamento pago sem forma preenchida (aparece como fatia cinza própria).
  const FORMA_LABEL = { pix: 'Pix', dinheiro: 'Dinheiro', cartao_debito: 'Débito', cartao_credito: 'Crédito', sem: 'Sem forma registrada' }
  const FORMA_COR = { pix: '#15803D', dinheiro: '#D4AF37', cartao_debito: '#3B82F6', cartao_credito: '#8B2655', sem: '#9CA3AF' }
  const formaMap = {}
  pagamentos.filter(p => p.status === 'pago').forEach(p => {
    const forma = p.forma || 'sem'
    formaMap[forma] = (formaMap[forma] || 0) + (p.valor || 0)
  })
  const dadosFormas = Object.entries(formaMap).map(([forma, valor]) => ({
    label: FORMA_LABEL[forma] || forma, valor, cor: FORMA_COR[forma] || '#888',
  }))

  // Categorias = 14 fixas + as personalizadas do salão. findCat resolve ícone/cor/nome
  // tanto dos ids fixos ('luz', 'produtos'...) quanto dos uuids das personalizadas.
  const categoriasTodas = [...CATEGORIAS, ...categoriasCustom.map(c => ({ id: c.id, label: c.label, icon: c.icon, cor: c.cor, custom: true }))]
  const findCat = (id) => categoriasTodas.find(c => c.id === id)

  // Despesas agrupadas por categoria
  const despesasPorCategoria = {}
  despesas.forEach(d => {
    if (!despesasPorCategoria[d.categoria]) despesasPorCategoria[d.categoria] = 0
    despesasPorCategoria[d.categoria] += d.valor
  })
  const dadosDespesas = Object.entries(despesasPorCategoria)
    .map(([cat, valor]) => {
      const c = findCat(cat)
      return { label: c?.label || 'Categoria removida', valor, cor: c?.cor || '#888' }
    })
    .sort((a, b) => b.valor - a.valor)

  // Filtro da lista de despesas (todas / a pagar / recorrentes / "a preencher" /
  // combinações bolso×status acionadas ao clicar nos cards de resumo).
  const despesasVisiveis = despesas.filter(d =>
    filtroDespesa === 'a_pagar' ? d.pago === false
    : filtroDespesa === 'recorrentes' ? d.recorrente
    : filtroDespesa === 'preencher' ? d.valor_a_preencher
    : filtroDespesa === 'salao' ? d.tipo !== 'pessoal'
    : filtroDespesa === 'pessoal' ? d.tipo === 'pessoal'
    : filtroDespesa === 'salao_pago' ? (d.tipo !== 'pessoal' && d.pago !== false)
    : filtroDespesa === 'salao_apagar' ? (d.tipo !== 'pessoal' && d.pago === false)
    : filtroDespesa === 'pessoal_pago' ? (d.tipo === 'pessoal' && d.pago !== false)
    : filtroDespesa === 'pessoal_apagar' ? (d.tipo === 'pessoal' && d.pago === false)
    : true)
  // Clicar de novo no card já filtrado volta pra "Todas" (alterna o filtro).
  const toggleFiltroCard = (f) => setFiltroDespesa(prev => prev === f ? 'todas' : f)
  // Para o DRE do salão: pagas × a pagar SÓ das despesas do salão (sem pessoal).
  const despesasSalaoArr = despesas.filter(d => d.tipo !== 'pessoal')
  const despesasPessoalArr = despesas.filter(d => d.tipo === 'pessoal')
  const salaoPagasArr = despesasSalaoArr.filter(d => d.pago !== false)
  const salaoAPagarArr = despesasSalaoArr.filter(d => d.pago === false)
  const salaoAPagar = salaoAPagarArr.reduce((s, d) => s + (d.valor || 0), 0)
  const salaoPagas = totalDespesasSalao - salaoAPagar
  const pessoalAPagarArr = despesasPessoalArr.filter(d => d.pago === false)
  const pessoalPagasArr = despesasPessoalArr.filter(d => d.pago !== false)
  const pessoalAPagar = pessoalAPagarArr.reduce((s, d) => s + (d.valor || 0), 0)
  const pessoalPagas = totalDespesasPessoal - pessoalAPagar
  const sobrouPraVoce = proLabore - totalDespesasPessoal

  // Blocos da barra do topo — definidos uma vez e reaproveitados nos dois layouts
  // (computador = 2 faixas / celular = 4 faixas empilhadas, sem mudança).
  const modoTabsInner = (
    <>
      <button style={{ ...s.modoTab, ...(rangeMode === 'mes' ? s.modoTabAtivo : {}) }} onClick={() => setRangeMode('mes')}>Por mês</button>
      <button style={{ ...s.modoTab, ...(rangeMode === 'custom' ? s.modoTabAtivo : {}) }} onClick={() => setRangeMode('custom')}>Período personalizado</button>
    </>
  )
  const periodoNavInner = rangeMode === 'mes' ? (
    <>
      <button style={s.navBtn} onClick={() => setPeriodoSel(subMonths(periodoSel, 1))}><ChevronLeft size={18} /></button>
      <div style={s.periodoLabel}>{periodoLabel}</div>
      <button style={s.navBtn} onClick={() => setPeriodoSel(addMonths(periodoSel, 1))}><ChevronRight size={18} /></button>
    </>
  ) : (
    <div className="fin-range-inputs">
      <div style={s.rangeField}>
        <label style={s.rangeLabel}>De</label>
        <input style={s.rangeInput} type="date" value={customInicio} onChange={e => setCustomInicio(e.target.value)} />
      </div>
      <div style={s.rangeField}>
        <label style={s.rangeLabel}>Até</label>
        <input style={s.rangeInput} type="date" value={customFim} onChange={e => setCustomFim(e.target.value)} />
      </div>
    </div>
  )
  const exportInner = (
    <>
      <span style={s.exportLabel}>Exportar:</span>
      <button style={s.exportBtn} onClick={handleExportarPDF} disabled={exportando} title={labelBtnPDF}>
        <FileDown size={13} />
        {exportando ? '...' : labelBtnPDF}
        {!temAcesso('exportPDF') && <ProBadge />}
      </button>
      <button style={s.exportBtnAnual} onClick={handleExportarAnual} disabled={exportandoAnual} title="Relatório anual completo">
        <Calendar size={13} />
        {exportandoAnual ? '...' : `Ano ${refDate.getFullYear()}`}
        {!temAcesso('exportPDF') && <ProBadge />}
      </button>
    </>
  )
  const tabsInner = [
    { id: 'resumo',   label: 'Resumo',   icon: DollarSign },
    { id: 'analises', label: 'Análises', icon: BarChart2 },
    { id: 'receitas', label: 'Receitas', icon: TrendingUp },
    { id: 'despesas', label: 'Despesas', icon: Receipt },
  ].map(t => {
    const Ico = t.icon
    const ativo = tab === t.id
    return (
      <button key={t.id} onClick={() => setTab(t.id)} style={{ ...tabs.btn, ...(ativo ? tabs.btnAtivo : {}) }}>
        <Ico size={15} />
        <span>{t.label}</span>
      </button>
    )
  })

  return (
    <div style={s.page}>
      {isDesktop ? (
        /* Computador: 2 faixas — [modo | navegação (mesma largura)] / [abas | exportar] */
        <>
          <div style={s.topoGridDesktop}>
            <div style={{ ...s.modoTabs, marginBottom: 0 }}>{modoTabsInner}</div>
            <div style={{ ...s.periodoNav, marginBottom: 0 }}>{periodoNavInner}</div>
          </div>
          <div style={s.tabsExportDesktop}>
            <div className="fin-tabs" style={{ ...tabs.bar, marginBottom: 0, position: 'static', flex: 1 }}>{tabsInner}</div>
            <div style={{ ...s.exportRow, marginBottom: 0, flexShrink: 0 }}>{exportInner}</div>
          </div>
        </>
      ) : (
        /* Celular: 4 faixas empilhadas (mantido como está) */
        <>
          <div style={s.modoTabs}>{modoTabsInner}</div>
          <div style={s.periodoNav}>{periodoNavInner}</div>
          <div style={s.exportRow}>{exportInner}</div>
          <div className="fin-tabs" style={tabs.bar}>{tabsInner}</div>
        </>
      )}

      {loading && <div style={s.tabContent}><CardSkeleton count={4} /></div>}

      {/* ── ABA: Resumo ── */}
      {!loading && tab === 'resumo' && (
        <div style={s.tabContent}>
          {/* KPIs */}
          <div style={{ ...s.grid4, ...(ehMesAtual ? { gridTemplateColumns: 'repeat(5, 1fr)' } : {}) }} className="fin-resumo-grid">
            <div style={{ ...s.card, borderTop: '3px solid var(--green)' }} className="fin-resumo-card">
              <div style={s.cardLabel} className="fin-card-label"><DollarSign size={11} /> Recebido</div>
              <div style={{ ...s.cardValue, color: 'var(--green)' }} className="fin-card-value">{formatBRL(recebido)}</div>
              <div style={s.cardSub} className="fin-card-sub">{qtdPagos} pagamento{qtdPagos !== 1 ? 's' : ''}</div>
            </div>
            <div style={{ ...s.card, borderTop: '3px solid #B91C1C' }} className="fin-resumo-card">
              <div style={s.cardLabel} className="fin-card-label"><Receipt size={11} /> Despesas do salão</div>
              <div style={{ ...s.cardValue, color: '#B91C1C' }} className="fin-card-value">{formatBRL(totalDespesasSalao)}</div>
              <div style={s.cardSub} className="fin-card-sub">{despesas.filter(d => d.tipo !== 'pessoal').length} lançamento{despesas.filter(d => d.tipo !== 'pessoal').length !== 1 ? 's' : ''}</div>
            </div>
            <div
              style={{ ...s.card, borderTop: `3px solid ${pendente > 0 ? 'var(--amber)' : 'var(--border2)'}`, cursor: 'pointer' }}
              className="fin-resumo-card"
              onClick={() => { setTab('receitas'); setFiltro('pendente') }}
              title="Ver receitas pendentes"
            >
              <div style={s.cardLabel} className="fin-card-label">⏰ A receber</div>
              <div style={{ ...s.cardValue, color: pendente > 0 ? 'var(--amber)' : 'var(--text3)' }} className="fin-card-value">{formatBRL(pendente)}</div>
              <div style={s.cardSub} className="fin-card-sub">{pagamentos.filter(p => p.status === 'pendente').length} pendente{pagamentos.filter(p => p.status === 'pendente').length !== 1 ? 's' : ''}</div>
            </div>
            <div style={{ ...s.card, borderTop: `3px solid ${lucro >= 0 ? 'var(--gold, #D4AF37)' : '#B91C1C'}`, background: lucro >= 0 ? 'linear-gradient(135deg, #FEFCE8, var(--surface))' : 'linear-gradient(135deg, #FEF2F2, var(--surface))' }} className="fin-resumo-card">
              <div style={s.cardLabel} className="fin-card-label">{lucro >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />} Lucro líquido</div>
              <div style={{ ...s.cardValue, color: lucro >= 0 ? 'var(--gold, #B7791F)' : '#B91C1C' }} className="fin-card-value">{formatBRL(lucro)}</div>
              <div style={s.cardSub} className="fin-card-sub">{margemLucro.toFixed(0)}% de margem</div>
            </div>
            {/* Previsão de receita do mês — só no mês atual */}
            {ehMesAtual && (
              <div style={{ ...s.card, borderTop: '3px solid var(--pink)' }} className="fin-resumo-card">
                <div style={s.cardLabel} className="fin-card-label"><Calendar size={11} /> Previsão de fechamento</div>
                <div style={{ ...s.cardValue, color: 'var(--pink)' }} className="fin-card-value">{formatBRL(recebido + pendente + previsao.entraMes)}</div>
                <div style={s.cardSub} className="fin-card-sub">estimativa do mês</div>
              </div>
            )}
          </div>

          {/* DRE */}
          <div style={s.dreCard}>
            <div style={s.dreTitulo}>📊 DRE — {periodoLabel}</div>
            <div style={s.dreLinha}>
              <span>(+) Receitas recebidas</span>
              <span style={{ ...s.mono, color: 'var(--green)' }}>{formatBRL(recebido)}</span>
            </div>
            {salaoAPagar > 0 ? (
              <>
                <LinhaDespesaExpansivel
                  label="(−) Despesas do salão" sub="(já pagas)"
                  valor={salaoPagas} cor="#B91C1C" items={salaoPagasArr}
                  aberto={!!dreAberto.pagas} onToggle={() => toggleDre('pagas')}
                  categorias={categoriasTodas}
                />
                <LinhaDespesaExpansivel
                  label="(−) Contas a pagar" sub="(vai sair)"
                  valor={salaoAPagar} cor="#B45309" items={salaoAPagarArr}
                  aberto={!!dreAberto.apagar} onToggle={() => toggleDre('apagar')}
                  categorias={categoriasTodas}
                />
              </>
            ) : (
              <LinhaDespesaExpansivel
                label="(−) Despesas do salão"
                valor={totalDespesasSalao} cor="#B91C1C" items={despesasSalaoArr}
                aberto={!!dreAberto.salao} onToggle={() => toggleDre('salao')}
                categorias={categoriasTodas}
              />
            )}

            {/* Pró-labore é despesa operacional: vem ANTES do lucro líquido */}
            {mostraProLabore && (
              proLabore > 0 ? (
                <div style={s.dreLinha}>
                  <span>
                    (−) Seu salário <span style={{ color: 'var(--text3)', fontSize: 11 }}>(pró-labore)</span>
                    <button onClick={abrirProLabore} style={s.proLaboreEdit} title="Editar seu salário"><Pencil size={11} /></button>
                  </span>
                  <span style={{ ...s.mono, color: '#7C3AED' }}>− {formatBRL(proLabore)}</span>
                </div>
              ) : (
                <div style={s.dreLinha}>
                  <span>(−) Seu salário <span style={{ color: 'var(--text3)', fontSize: 11 }}>(pró-labore)</span></span>
                  <button onClick={abrirProLabore} style={s.proLaboreLink}>+ definir</button>
                </div>
              )
            )}

            <div style={s.dreDivider} />
            <div style={{ ...s.dreLinha, ...s.dreTotal }}>
              <span>(=) Lucro líquido</span>
              <span style={{ ...s.mono, color: lucro >= 0 ? 'var(--green)' : '#B91C1C', fontSize: 16 }}>{formatBRL(lucro)}</span>
            </div>
            {recebido > 0 && (
              <div style={s.dreMargem}>
                Margem de lucro: <strong>{margemLucro.toFixed(1)}%</strong>
                {margemLucro >= 30 && ' 🎉 Excelente!'}
                {margemLucro >= 15 && margemLucro < 30 && ' 👍 Saudável'}
                {margemLucro >= 0 && margemLucro < 15 && ' ⚠️ Atenção'}
                {margemLucro < 0 && ' 🚨 Prejuízo'}
              </div>
            )}

            {/* Seu bolso: gastos pessoais (não entram no lucro do salão) */}
            {mostraProLabore && totalDespesasPessoal > 0 && (
              <>
                <div style={s.dreDivider} />
                <LinhaDespesaExpansivel
                  label="👤 Gastos pessoais" sub="(seu bolso)"
                  valor={totalDespesasPessoal} cor="#7C3AED" items={despesasPessoalArr}
                  aberto={!!dreAberto.pessoal} onToggle={() => toggleDre('pessoal')}
                  categorias={categoriasTodas}
                />
                {proLabore > 0
                  ? <div style={s.dreMargem}>
                      {sobrouPraVoce >= 0
                        ? <>Do seu salário de {formatBRL(proLabore)}, sobrou <strong>{formatBRL(sobrouPraVoce)}</strong> pra você 💜</>
                        : <>🚨 Você gastou <strong>{formatBRL(-sobrouPraVoce)}</strong> a mais do que tirou de salário</>}
                    </div>
                  : <div style={s.dreMargem}>Defina seu salário acima pra saber se seus gastos pessoais cabem no que você tira. 💡</div>}
              </>
            )}
          </div>

        </div>
      )}

      {/* ── ABA: Análises ── */}
      {!loading && tab === 'analises' && (
        <div style={s.tabContent}>
          {/* KPI cards */}
          <div style={s.kpiGrid}>
            {[
              {
                label: 'Receita recebida',
                valor: formatBRL(recebido),
                sub: recebidoMesAnterior !== null
                  ? (recebido >= recebidoMesAnterior
                    ? { seta: '▲', cor: '#15803D', txt: `+${formatBRL(recebido - recebidoMesAnterior)} vs mês ant.` }
                    : { seta: '▼', cor: '#DC2626', txt: `-${formatBRL(recebidoMesAnterior - recebido)} vs mês ant.` })
                  : null,
              },
              {
                label: 'Atendimentos',
                valor: totalAtendimentos,
                sub: null,
              },
              {
                label: 'Ticket médio',
                valor: ticketMedio > 0 ? formatBRL(ticketMedio) : '—',
                sub: null,
              },
              {
                label: 'Margem de lucro',
                valor: recebido > 0 ? `${margemLucro.toFixed(0)}%` : '—',
                sub: recebido > 0
                  ? { cor: margemLucro >= 0 ? '#15803D' : '#DC2626', txt: margemLucro >= 0 ? 'positiva' : 'negativa' }
                  : null,
              },
            ].map((k, i) => (
              <div key={i} style={s.kpiCard}>
                <div style={s.kpiLabel}>{k.label}</div>
                <div style={s.kpiValor}>{k.valor}</div>
                {k.sub && (
                  <div style={{ ...s.kpiSub, color: k.sub.cor }}>
                    {k.sub.seta && <span>{k.sub.seta} </span>}{k.sub.txt}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={s.graficosGrid}>
            <div style={s.graficoCard}>
              <div style={s.graficoTitulo}>Receita dos últimos 6 meses</div>
              <BarChart data={dadosReceita6m} cor="#15803D" prefixo="R$ " height={160} />
            </div>

            <div style={s.graficoCard}>
              <div style={s.graficoTitulo}>Despesas por categoria</div>
              {dadosDespesas.length === 0
                ? <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 13, padding: 30 }}>Sem despesas no período</div>
                : <DonutChart data={dadosDespesas} size={160} centerLabel={formatBRL(totalDespesas)} centerSub="total" />
              }
            </div>

            <div style={s.graficoCard}>
              <div style={s.graficoTitulo}>Como você recebeu</div>
              {dadosFormas.length === 0
                ? <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 13, padding: 30 }}>Sem dados</div>
                : <DonutChart data={dadosFormas} size={160} centerLabel={formatBRL(recebido)} centerSub="recebido" />
              }
            </div>

            <div style={{ ...s.graficoCard, gridColumn: '1 / -1' }}>
              <div style={s.graficoTitulo}>Top serviços por receita</div>
              <HBarChart data={topServicos} cor="var(--pink)" formatValor={(v) => formatBRL(v)} showQtd />
            </div>
          </div>
        </div>
      )}

      {/* ── ABA: Receitas ── */}
      {!loading && tab === 'receitas' && (
        <div style={s.tabContent}>
          <div style={s.colHeader}>
            <div style={s.colTitulo}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)' }} />
              Receitas ({filtrados.length})
            </div>
            <button style={s.addBtnSmall} onClick={() => setShowModal(true)}>
              <Plus size={13} /> Pagamento
            </button>
          </div>

          <div style={s.filtros} className="fin-filtros-receita">
            {['todos', 'pago', 'pendente'].map(f => (
              <button key={f} style={{ ...s.filtroBtn, ...(filtro === f ? s.filtroBtnActive : {}) }} onClick={() => setFiltro(f)}>
                {f === 'todos' ? 'Todos' : f === 'pago' ? 'Pagos' : 'Pendentes'}
              </button>
            ))}
          </div>

          {filtrados.length === 0
            ? <div style={s.empty}>Nenhum lançamento encontrado</div>
            : filtrados.map(p => {
              const pago = p.status === 'pago'
              const tel = p.agendamentos?.clientes?.telefone
              // Cobrança só faz sentido em pendente com telefone válido.
              const podeCobrar = !pago && validarTelefone(tel) && temAcesso('cobrancaWhatsapp')
              const cobrado = !!p.cobranca_enviada_em
              const msgCobranca = aplicarVariaveis(cobranca.template, {
                nome: p.agendamentos?.clientes?.nome || '',
                salao: cobranca.nomeSalao,
                servico: p.agendamentos?.servico || '',
                valor: formatBRL(p.valor ?? 0),
                pix: cobranca.chavePix,
              })
              return (
                <div key={p.id} style={s.finCard}>
                  <div style={{ ...s.dot, background: pago ? 'var(--green)' : '#F59E0B' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={s.finNome}>{p.agendamentos?.clientes?.nome || '—'}</div>
                    <div style={s.finSub}>
                      {p.agendamentos?.servico || '—'} · {format(new Date(p.data + 'T12:00:00'), 'dd/MM', { locale: ptBR })}
                      {' · '}{FORMA_LABEL[p.forma] || p.forma}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ ...s.finValor, color: pago ? 'var(--green)' : 'var(--amber)' }}>
                      {formatBRL(p.valor ?? 0)}
                    </div>
                    <div style={{ display: 'flex', gap: 5, marginTop: 3, justifyContent: 'flex-end' }}>
                      {podeCobrar && (
                        <a
                          style={cobrado ? s.cobradoBtn : s.cobrarBtn}
                          href={linkWhatsApp(tel, msgCobranca)}
                          target="_blank" rel="noreferrer"
                          onClick={() => marcarCobrado(p)}
                          title={cobrado ? 'Cobrança já enviada — toque para reenviar' : 'Cobrar pelo WhatsApp'}
                        >
                          {cobrado ? <><Check size={11} /> Cobrado</> : <><MessageCircle size={11} /> Cobrar</>}
                        </a>
                      )}
                      <button style={{ ...s.statusBtn, ...(pago ? s.statusPago : s.statusPendente) }} onClick={() => pago ? reverterParaPendente(p) : abrirConfirmarPago(p)}>
                        {pago ? '✓ Pago' : '⏳ Pendente'}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          }
        </div>
      )}

      {/* ── ABA: Despesas ── */}
      {!loading && tab === 'despesas' && (
        <div style={s.tabContent}>
          {/* Cards de resumo por bolso. Pro: 4 cards (salão pago/a pagar + pessoal pago/a pagar). Solo: 2 (totais por bolso). */}
          {temAcesso('contasAPagar') ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ ...s.card, borderTop: '3px solid var(--green)', cursor: 'pointer', ...(filtroDespesa === 'salao_pago' ? s.cardAtivo : {}) }} onClick={() => toggleFiltroCard('salao_pago')} title="Ver só os lançamentos do salão já pagos">
                <div style={s.cardLabel}>🏢 Salão — pago</div>
                <div style={{ ...s.cardValue, color: '#15803D' }}>{formatBRL(salaoPagas)}</div>
                <div style={s.cardSub}>{salaoPagasArr.length} lançamento{salaoPagasArr.length !== 1 ? 's' : ''}</div>
              </div>
              <div style={{ ...s.card, borderTop: '3px solid #FCD34D', cursor: 'pointer', ...(filtroDespesa === 'salao_apagar' ? s.cardAtivo : {}) }} onClick={() => toggleFiltroCard('salao_apagar')} title="Ver só as contas do salão a pagar">
                <div style={s.cardLabel}>🏢 Salão — a pagar</div>
                <div style={{ ...s.cardValue, color: '#B45309' }}>{formatBRL(salaoAPagar)}</div>
                <div style={s.cardSub}>{salaoAPagarArr.length} conta{salaoAPagarArr.length !== 1 ? 's' : ''}</div>
              </div>
              <div style={{ ...s.card, borderTop: '3px solid var(--green)', cursor: 'pointer', ...(filtroDespesa === 'pessoal_pago' ? s.cardAtivo : {}) }} onClick={() => toggleFiltroCard('pessoal_pago')} title="Ver só os gastos pessoais já pagos">
                <div style={s.cardLabel}>👤 Pessoal — pago</div>
                <div style={{ ...s.cardValue, color: '#15803D' }}>{formatBRL(pessoalPagas)}</div>
                <div style={s.cardSub}>{pessoalPagasArr.length} lançamento{pessoalPagasArr.length !== 1 ? 's' : ''}</div>
              </div>
              <div style={{ ...s.card, borderTop: '3px solid #FCD34D', cursor: 'pointer', ...(filtroDespesa === 'pessoal_apagar' ? s.cardAtivo : {}) }} onClick={() => toggleFiltroCard('pessoal_apagar')} title="Ver só os gastos pessoais a pagar">
                <div style={s.cardLabel}>👤 Pessoal — a pagar</div>
                <div style={{ ...s.cardValue, color: '#B45309' }}>{formatBRL(pessoalAPagar)}</div>
                <div style={s.cardSub}>{pessoalAPagarArr.length} conta{pessoalAPagarArr.length !== 1 ? 's' : ''}</div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ ...s.card, borderTop: '3px solid #B91C1C', cursor: 'pointer', ...(filtroDespesa === 'salao' ? s.cardAtivo : {}) }} onClick={() => toggleFiltroCard('salao')} title="Ver só as despesas do salão">
                <div style={s.cardLabel}>🏢 Despesas do salão</div>
                <div style={{ ...s.cardValue, color: '#B91C1C' }}>{formatBRL(totalDespesasSalao)}</div>
                <div style={s.cardSub}>{despesasSalaoArr.length} lançamento{despesasSalaoArr.length !== 1 ? 's' : ''}</div>
              </div>
              <div style={{ ...s.card, borderTop: '3px solid #7C3AED', cursor: 'pointer', ...(filtroDespesa === 'pessoal' ? s.cardAtivo : {}) }} onClick={() => toggleFiltroCard('pessoal')} title="Ver só as despesas pessoais">
                <div style={s.cardLabel}>👤 Despesas pessoais</div>
                <div style={{ ...s.cardValue, color: '#7C3AED' }}>{formatBRL(totalDespesasPessoal)}</div>
                <div style={s.cardSub}>{despesasPessoalArr.length} lançamento{despesasPessoalArr.length !== 1 ? 's' : ''}</div>
              </div>
            </div>
          )}

          {/* Cabeçalho: título + filtro + adicionar.
              Desktop: numa linha só. Mobile: título+botão na 1ª linha, filtro embaixo. */}
          <div style={s.colHeader} className="fin-despesas-header">
            <div style={s.colTitulo}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#B91C1C' }} />
              Despesas ({despesasVisiveis.length})
            </div>
            <select className="fin-despesas-filtro" value={filtroDespesa} onChange={e => setFiltroDespesa(e.target.value)} style={{ ...s.filtroSelect, marginLeft: 'auto' }}>
                <option value="todas">Todas</option>
                <option value="salao">🏢 Do salão</option>
                <option value="pessoal">👤 Pessoal</option>
                {temAcesso('contasAPagar') && <option value="a_pagar">💸 A pagar</option>}
                {temAcesso('contasAPagar') && <option value="salao_pago">🏢 Salão — pagas</option>}
                {temAcesso('contasAPagar') && <option value="salao_apagar">🏢 Salão — a pagar</option>}
                {temAcesso('contasAPagar') && <option value="pessoal_pago">👤 Pessoal — pagas</option>}
                {temAcesso('contasAPagar') && <option value="pessoal_apagar">👤 Pessoal — a pagar</option>}
                <option value="recorrentes">🔁 Recorrentes</option>
                <option value="preencher">⚠️ A preencher</option>
            </select>
            <button className="fin-despesas-addbtn" style={s.addBtnSmall} onClick={abrirNovaDespesa}>
              <Plus size={13} /> Despesa
            </button>
          </div>

          {despesasVisiveis.length === 0
            ? <div style={s.empty}>Nenhuma despesa {
                filtroDespesa === 'a_pagar' || filtroDespesa === 'salao_apagar' || filtroDespesa === 'pessoal_apagar' ? 'a pagar'
                : filtroDespesa === 'salao_pago' || filtroDespesa === 'pessoal_pago' ? 'paga'
                : filtroDespesa === 'recorrentes' ? 'recorrente'
                : filtroDespesa === 'preencher' ? 'a preencher'
                : 'registrada'}</div>
            : despesasVisiveis.map(d => {
              const cat = findCat(d.categoria)
              const ehAPagar = d.pago === false
              return (
                <div key={d.id} style={s.finCard}>
                  <div style={{ ...s.catBadge, background: (cat?.cor || '#888') + '22', color: cat?.cor || '#888' }}>
                    {cat?.icon || '📦'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={s.finNome}>{d.descricao}</div>
                    <div style={s.finSub}>
                      {d.tipo === 'pessoal' && <span style={{ fontWeight: 700, color: '#7C3AED' }}>👤 Pessoal · </span>}
                      {cat?.label || 'Categoria removida'} · {ehAPagar ? 'vence ' : ''}{format(new Date(d.data + 'T12:00:00'), 'dd/MM', { locale: ptBR })}
                      {d.recorrente && ' · 🔁 mensal'}{d.valor_variavel && ' (valor varia)'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {d.valor_a_preencher
                      ? <div style={{ ...s.finValor, color: '#B45309', fontSize: 12 }}>⚠️ a preencher</div>
                      : <div style={{ ...s.finValor, color: '#B91C1C' }}>− {formatBRL(d.valor ?? 0)}</div>}
                    {temAcesso('contasAPagar') && !d.valor_a_preencher && (
                      ehAPagar
                        ? <div style={s.aPagarBadge}>💸 a pagar</div>
                        : <div style={s.pagaBadge}>✓ paga</div>
                    )}
                    <div style={{ display: 'flex', gap: 4, marginTop: 4, justifyContent: 'flex-end' }}>
                      {ehAPagar && !d.valor_a_preencher && (
                        <button style={s.pagarBtn} onClick={() => abrirConfirmarPagarDespesa(d)} title="Confirmar pagamento">
                          <Check size={11} /> Pagar
                        </button>
                      )}
                      <button style={s.miniIconBtn} onClick={() => abrirEditarDespesa(d)} title="Editar">
                        <Pencil size={11} />
                      </button>
                      <button style={{ ...s.miniIconBtn, color: '#B91C1C' }} onClick={() => excluirDespesa(d)} title="Excluir">
                        <X size={11} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          }
        </div>
      )}

      <UpgradeModal
        aberto={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        titulo="Exportação PDF é Pro"
        descricao="Gere relatórios financeiros profissionais (mensal e anual) em PDF. Disponível no plano Pro."
      />

      {/* Modal: registrar pagamento avulso */}
      {showModal && (
        <RegistrarPagamentoModal
          form={form} setForm={setForm} agendamentos={agendamentos}
          saving={saving} onSalvar={salvarPagamento} onClose={() => setShowModal(false)}
        />
      )}

      {/* Modal: pró-labore (seu salário) */}
      {showProLabore && (
        <ProLaboreModal
          proLaboreInput={proLaboreInput} setProLaboreInput={setProLaboreInput}
          savingProLabore={savingProLabore} onSalvar={salvarProLabore} onClose={() => setShowProLabore(false)}
        />
      )}

      {/* Modal: nova/editar despesa */}
      {showDespesaModal && (
        <DespesaModal
          editandoDespesa={editandoDespesa} formDespesa={formDespesa} setFormDespesa={setFormDespesa}
          showNovaCat={showNovaCat} setShowNovaCat={setShowNovaCat}
          categoriasCustom={categoriasCustom} novaCat={novaCat} setNovaCat={setNovaCat}
          salvarNovaCategoria={salvarNovaCategoria} savingCat={savingCat} excluirCategoria={excluirCategoria}
          temAcesso={temAcesso} savingDespesa={savingDespesa}
          onSalvar={salvarDespesa} onClose={fecharDespesaModal}
        />
      )}

      {/* Modal: confirmar pagamento de despesa a pagar */}
      {despesaParaPagar && (
        <ConfirmarPagarDespesaModal
          despesa={despesaParaPagar} formPagarDespesa={formPagarDespesa} setFormPagarDespesa={setFormPagarDespesa}
          savingPagarDespesa={savingPagarDespesa} onConfirmar={confirmarPagarDespesa} onClose={() => setDespesaParaPagar(null)}
        />
      )}

      {/* Modal: confirmar pagamento pendente como pago — mesmo modal da agenda (1 ou 2 formas) */}
      {pagSelecionado && (
        <PagamentoModal
          agSelecionado={{
            id: pagSelecionado.agendamento_id,
            clientes: pagSelecionado.agendamentos?.clientes,
            servico: pagSelecionado.agendamentos?.servico,
            data: pagSelecionado.data,
          }}
          formPag={formPag}
          setFormPag={setFormPag}
          savingPag={savingPag}
          pagModalObrigatorio={false}
          onSalvar={salvarPagamentoConfirmado}
          onFechar={() => setPagSelecionado(null)}
        />
      )}
    </div>
  )
}
