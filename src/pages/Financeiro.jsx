import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  FileDown, ChevronLeft, ChevronRight, Calendar,
  TrendingUp, TrendingDown, DollarSign, Receipt,
  BarChart2,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useSalao } from '../contexts/SalaoContext'
import { useAssinatura } from '../contexts/AssinaturaContext'
import { UpgradeModal, ProBadge } from '../components/common/UpgradeBlock'
import { CardSkeleton } from '../components/common/Skeleton'
import PagamentoModal from '../components/agenda/PagamentoModal'
import RegistrarPagamentoModal from '../components/financeiro/RegistrarPagamentoModal'
import ProLaboreModal from '../components/financeiro/ProLaboreModal'
import DespesaModal from '../components/financeiro/DespesaModal'
import ConfirmarPagarDespesaModal from '../components/financeiro/ConfirmarPagarDespesaModal'
import { format, startOfMonth, endOfMonth, addMonths, subMonths, eachMonthOfInterval } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useToast } from '../contexts/ToastContext'
import { exportarPDFResumo, exportarPDFReceitas, exportarPDFDespesas, exportarPDFAnalises, exportarPDFAnual } from '../lib/pdfExporter'
import { formatBRL } from '../lib/formatters'
import { s, tabs } from './Financeiro.styles'
import { CATEGORIAS } from './Financeiro.constants'
import { useFinanceiroDados } from '../hooks/useFinanceiroDados'
import { useFinanceiroConfig } from '../hooks/useFinanceiroConfig'
import { useFinanceiroReceitas } from '../hooks/useFinanceiroReceitas'
import { useFinanceiroDespesas } from '../hooks/useFinanceiroDespesas'
import TabResumo from '../components/financeiro/TabResumo'
import TabAnalises from '../components/financeiro/TabAnalises'
import TabReceitas from '../components/financeiro/TabReceitas'
import TabDespesas from '../components/financeiro/TabDespesas'

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
        <TabResumo
          ehMesAtual={ehMesAtual}
          recebido={recebido} qtdPagos={qtdPagos}
          totalDespesasSalao={totalDespesasSalao} despesas={despesas}
          pendente={pendente} pagamentos={pagamentos}
          lucro={lucro} margemLucro={margemLucro} previsao={previsao}
          dreAberto={dreAberto} toggleDre={toggleDre} categoriasTodas={categoriasTodas}
          salaoAPagar={salaoAPagar} salaoPagas={salaoPagas}
          salaoPagasArr={salaoPagasArr} salaoAPagarArr={salaoAPagarArr}
          despesasSalaoArr={despesasSalaoArr}
          mostraProLabore={mostraProLabore} proLabore={proLabore}
          sobrouPraVoce={sobrouPraVoce}
          despesasPessoalArr={despesasPessoalArr} totalDespesasPessoal={totalDespesasPessoal}
          periodoLabel={periodoLabel} abrirProLabore={abrirProLabore}
          onVerPendentes={() => { setTab('receitas'); setFiltro('pendente') }}
        />
      )}

      {/* ── ABA: Análises ── */}
      {!loading && tab === 'analises' && (
        <TabAnalises
          recebido={recebido} recebidoMesAnterior={recebidoMesAnterior}
          totalAtendimentos={totalAtendimentos} ticketMedio={ticketMedio} margemLucro={margemLucro}
          totalDespesas={totalDespesas} dadosReceita6m={dadosReceita6m}
          dadosDespesas={dadosDespesas} dadosFormas={dadosFormas} topServicos={topServicos}
        />
      )}

      {/* ── ABA: Receitas ── */}
      {!loading && tab === 'receitas' && (
        <TabReceitas
          filtrados={filtrados} filtro={filtro} setFiltro={setFiltro}
          cobranca={cobranca} setShowModal={setShowModal}
          marcarCobrado={marcarCobrado} reverterParaPendente={reverterParaPendente}
          abrirConfirmarPago={abrirConfirmarPago}
        />
      )}

      {/* ── ABA: Despesas ── */}
      {!loading && tab === 'despesas' && (
        <TabDespesas
          temAcesso={temAcesso} isDesktop={isDesktop}
          filtroDespesa={filtroDespesa} setFiltroDespesa={setFiltroDespesa}
          toggleFiltroCard={toggleFiltroCard}
          despesasVisiveis={despesasVisiveis} categoriasTodas={categoriasTodas}
          salaoPagas={salaoPagas} salaoPagasArr={salaoPagasArr}
          salaoAPagar={salaoAPagar} salaoAPagarArr={salaoAPagarArr}
          pessoalPagas={pessoalPagas} pessoalPagasArr={pessoalPagasArr}
          pessoalAPagar={pessoalAPagar} pessoalAPagarArr={pessoalAPagarArr}
          totalDespesasSalao={totalDespesasSalao} totalDespesasPessoal={totalDespesasPessoal}
          despesasSalaoArr={despesasSalaoArr} despesasPessoalArr={despesasPessoalArr}
          abrirNovaDespesa={abrirNovaDespesa} abrirEditarDespesa={abrirEditarDespesa}
          excluirDespesa={excluirDespesa} abrirConfirmarPagarDespesa={abrirConfirmarPagarDespesa}
        />
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
