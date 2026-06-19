import { useEffect, useState, useRef } from 'react'
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
import { MSG_COBRANCA_PADRAO, aplicarVariaveis } from '../lib/mensagens'
import { UpgradeModal, ProBadge } from '../components/common/UpgradeBlock'
import Modal from '../components/common/Modal'
import { CardSkeleton } from '../components/common/Skeleton'
import PagamentoModal from '../components/agenda/PagamentoModal'
import { inputBase, labelBase, btnPrimaryBase, btnSecondaryBase } from '../lib/ui'
import { format, startOfMonth, endOfMonth, addMonths, subMonths, eachMonthOfInterval, startOfYear, endOfYear, endOfWeek } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import BarChart, { HBarChart } from '../components/charts/BarChart'
import DonutChart from '../components/charts/DonutChart'
import { useToast } from '../contexts/ToastContext'
import { traduzErro } from '../lib/erros'

const CATEGORIAS = [
  { id: 'aluguel', label: 'Aluguel', cor: '#B91C1C', icon: '🏠' },
  { id: 'luz', label: 'Luz', cor: '#D97706', icon: '💡' },
  { id: 'agua', label: 'Água', cor: '#1E40AF', icon: '💧' },
  { id: 'internet', label: 'Internet', cor: '#6D28D9', icon: '📶' },
  { id: 'telefone', label: 'Telefone', cor: '#0E7490', icon: '📱' },
  { id: 'produtos', label: 'Produtos', cor: '#8B2655', icon: '💅' },
  { id: 'materiais', label: 'Materiais', cor: '#A16207', icon: '🧰' },
  { id: 'equipamentos', label: 'Equipamentos', cor: '#15803D', icon: '🔧' },
  { id: 'salario', label: 'Salário', cor: '#7C3AED', icon: '👥' },
  { id: 'imposto', label: 'Imposto', cor: '#991B1B', icon: '📋' },
  { id: 'marketing', label: 'Marketing', cor: '#DB2777', icon: '📣' },
  { id: 'manutencao', label: 'Manutenção', cor: '#0F766E', icon: '🛠' },
  { id: 'transporte', label: 'Transporte', cor: '#1D4ED8', icon: '🚗' },
  { id: 'outros', label: 'Outros', cor: '#525252', icon: '📦' },
]

const FORMAS_PAGAMENTO = [
  { value: 'pix', label: 'Pix' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'debito', label: 'Débito' },
  { value: 'credito', label: 'Crédito' },
  { value: 'boleto', label: 'Boleto' },
]

async function exportarPDFMensal(pagamentos, despesas, periodoLabel) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')
  const doc = new jsPDF()
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('Lumen — Relatório Financeiro', 14, 18)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.text(periodoLabel, 14, 27)

  const recebido = pagamentos.filter(p => p.status === 'pago').reduce((s, p) => s + p.valor, 0)
  const pendente = pagamentos.filter(p => p.status === 'pendente').reduce((s, p) => s + p.valor, 0)
  const qtd = pagamentos.filter(p => p.status === 'pago').length
  const ticket = qtd > 0 ? recebido / qtd : 0
  const totalDespesas = despesas.reduce((s, d) => s + d.valor, 0)
  const lucro = recebido - totalDespesas

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('RESUMO DO PERÍODO', 14, 38)
  doc.setFont('helvetica', 'normal')
  doc.text(`Receita recebida: R$ ${formatMoeda(recebido)}`, 14, 45)
  doc.text(`A receber: R$ ${formatMoeda(pendente)}`, 14, 51)
  doc.text(`Total de despesas: R$ ${formatMoeda(totalDespesas)}`, 14, 57)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(lucro >= 0 ? 21 : 185, lucro >= 0 ? 128 : 28, lucro >= 0 ? 61 : 28)
  doc.text(`LUCRO LÍQUIDO: R$ ${formatMoeda(lucro)}`, 14, 64)
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'normal')
  doc.text(`Ticket médio: R$ ${formatMoeda(ticket)} (${qtd} atendimentos)`, 14, 71)

  const totalPago = pagamentos.filter(p => p.status === 'pago').reduce((s, p) => s + p.valor, 0)
  const totalPendente = pagamentos.filter(p => p.status === 'pendente').reduce((s, p) => s + p.valor, 0)

  if (pagamentos.length) {
    autoTable(doc, {
      startY: 78,
      head: [['Data', 'Cliente', 'Serviço', 'Forma', 'Valor', 'Status']],
      body: pagamentos.map(p => [
        format(new Date(p.data + 'T12:00:00'), 'dd/MM/yyyy'),
        p.agendamentos?.clientes?.nome || '—',
        p.agendamentos?.servico || '—',
        ({ pix: 'Pix', dinheiro: 'Dinheiro', cartao_debito: 'Débito', cartao_credito: 'Crédito' }[p.forma]) || p.forma,
        `R$ ${formatMoeda(p.valor)}`,
        p.status === 'pago' ? 'Pago' : 'Pendente',
      ]),
      foot: [[
        '', '', '', 'TOTAL RECEBIDO',
        `R$ ${formatMoeda(totalPago)}`,
        totalPendente > 0 ? `+ R$ ${formatMoeda(totalPendente)} pend.` : '',
      ]],
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [139, 38, 85] },
      footStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      didDrawPage: (data) => {
        doc.setFontSize(11)
        doc.setFont('helvetica', 'bold')
        if (data.pageNumber === 1) doc.text('RECEITAS', 14, 76)
      },
    })
  }

  if (despesas.length) {
    const finalY = doc.lastAutoTable?.finalY || 90
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('DESPESAS', 14, finalY + 12)
    autoTable(doc, {
      startY: finalY + 16,
      head: [['Data', 'Categoria', 'Descrição', 'Valor']],
      body: despesas.map(d => [
        format(new Date(d.data + 'T12:00:00'), 'dd/MM/yyyy'),
        CATEGORIAS.find(c => c.id === d.categoria)?.label || d.categoria,
        d.descricao,
        `R$ ${formatMoeda(d.valor)}`,
      ]),
      foot: [['', '', 'TOTAL DESPESAS', `R$ ${formatMoeda(totalDespesas)}`]],
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [185, 28, 28] },
      footStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', fontSize: 9 },
    })

    const finalYDespesas = doc.lastAutoTable?.finalY || 90
    const margemFinal = recebido > 0 ? ((lucro / recebido) * 100).toFixed(1) : '0.0'
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(lucro >= 0 ? 21 : 185, lucro >= 0 ? 128 : 28, lucro >= 0 ? 61 : 28)
    doc.text(`LUCRO LÍQUIDO DO PERÍODO: R$ ${formatMoeda(lucro)} (margem ${margemFinal}%)`, 14, finalYDespesas + 12)
    doc.setTextColor(0, 0, 0)
  }

  doc.save(`lumen-financeiro-${periodoLabel.replace(/[^\w]/g, '-').toLowerCase()}.pdf`)
}

async function exportarPDFAnual(salaoId, ano, { gerenciaTudo, userId }) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  // Buscar todos os dados do ano
  const inicio = `${ano}-01-01`
  const fim = `${ano}-12-31`

  // Despesas: dona/recepção por salão; profissional por user_id (despesas dela
  // são privadas, gravadas com salao_id NULL). Mesma lógica do loadDespesas —
  // sem isso, o anual da manicure mostraria despesas = 0 (lucro inflado).
  let despQ = supabase.from('despesas').select('*').gte('data', inicio).lte('data', fim)
  despQ = gerenciaTudo ? despQ.eq('salao_id', salaoId) : despQ.eq('user_id', userId)

  const [{ data: pagsRaw }, { data: desps }] = await Promise.all([
    supabase.from('pagamentos')
      .select('data, valor, status, forma, agendamentos(servico, status, clientes(nome))')
      .eq('salao_id', salaoId).eq('status', 'pago')
      .gte('data', inicio).lte('data', fim),
    despQ,
  ])
  // Não conta dinheiro de atendimento cancelado (igual ao resto do Financeiro).
  const pags = (pagsRaw || []).filter(p => p.agendamentos?.status !== 'cancelado')

  const doc = new jsPDF()
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text(`Lumen — Relatório Anual ${ano}`, 14, 18)

  // Tabela mensal
  const meses = eachMonthOfInterval({ start: new Date(ano, 0, 1), end: new Date(ano, 11, 31) })
  const linhasMeses = meses.map(m => {
    const ini = format(startOfMonth(m), 'yyyy-MM-dd')
    const fimM = format(endOfMonth(m), 'yyyy-MM-dd')
    const receita = (pags || []).filter(p => p.data >= ini && p.data <= fimM).reduce((s, p) => s + p.valor, 0)
    const despesa = (desps || []).filter(d => d.data >= ini && d.data <= fimM).reduce((s, d) => s + d.valor, 0)
    const lucro = receita - despesa
    return [
      format(m, 'MMMM', { locale: ptBR }),
      `R$ ${formatMoeda(receita)}`,
      `R$ ${formatMoeda(despesa)}`,
      `R$ ${formatMoeda(lucro)}`,
      receita > 0 ? `${((lucro / receita) * 100).toFixed(1)}%` : '—',
    ]
  })

  const totalReceita = (pags || []).reduce((s, p) => s + p.valor, 0)
  const totalDespesa = (desps || []).reduce((s, d) => s + d.valor, 0)
  const totalLucro = totalReceita - totalDespesa

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text(`Período: Janeiro a Dezembro de ${ano}`, 14, 27)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text(`RECEITA TOTAL: R$ ${formatMoeda(totalReceita)}`, 14, 38)
  doc.text(`DESPESA TOTAL: R$ ${formatMoeda(totalDespesa)}`, 14, 45)
  doc.setTextColor(totalLucro >= 0 ? 21 : 185, totalLucro >= 0 ? 128 : 28, totalLucro >= 0 ? 61 : 28)
  doc.text(`LUCRO LÍQUIDO: R$ ${formatMoeda(totalLucro)}`, 14, 52)
  doc.setTextColor(0, 0, 0)

  autoTable(doc, {
    startY: 60,
    head: [['Mês', 'Receita', 'Despesas', 'Lucro', 'Margem']],
    body: linhasMeses,
    foot: [['TOTAL ANUAL', `R$ ${formatMoeda(totalReceita)}`, `R$ ${formatMoeda(totalDespesa)}`, `R$ ${formatMoeda(totalLucro)}`, totalReceita > 0 ? `${((totalLucro / totalReceita) * 100).toFixed(1)}%` : '—']],
    styles: { fontSize: 10, cellPadding: 4 },
    headStyles: { fillColor: [139, 38, 85], fontSize: 10 },
    footStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [251, 246, 248] },
  })

  doc.save(`lumen-relatorio-anual-${ano}.pdf`)
}

export default function Financeiro() {
  const { user } = useAuth()
  const { salaoId, gerenciaTudo } = useSalao()
  const { temAcesso } = useAssinatura()
  const { erro: toastErro, sucesso, confirmar } = useToast()
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [pagamentos, setPagamentos] = useState([])
  const [despesas, setDespesas] = useState([])
  const [pagamentos6m, setPagamentos6m] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [showDespesaModal, setShowDespesaModal] = useState(false)
  const [editandoDespesa, setEditandoDespesa] = useState(null)
  const [agendamentos, setAgendamentos] = useState([])
  // Previsão = receita futura (agendamentos pendentes/confirmados a partir de hoje).
  const [previsao, setPrevisao] = useState({ entraSemana: 0, entraMes: 0, saiSemana: 0, saiMes: 0, confirmadoMes: 0, aguardandoMes: 0 })
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ agendamento_id: '', valor: '', status: 'pendente', forma: 'pix', data: format(new Date(), 'yyyy-MM-dd') })
  const [formDespesa, setFormDespesa] = useState({ descricao: '', categoria: 'produtos', valor: '', data: format(new Date(), 'yyyy-MM-dd'), forma_pagamento: 'pix', recorrente: false, valor_variavel: false, recorrente_ate: '', observacoes: '', pago: true, tipo: 'salao' })
  const [saving, setSaving] = useState(false)
  const [savingDespesa, setSavingDespesa] = useState(false)
  // Confirmar um pagamento pendente como pago (reaproveita o modal da agenda: 1 ou 2 formas).
  const [pagSelecionado, setPagSelecionado] = useState(null)
  const [formPag, setFormPag] = useState({ forma: 'pix', status: 'pago', valor: '', modo: 'simples', forma2: 'cartao_credito', valor2: '' })
  const [savingPag, setSavingPag] = useState(false)
  const [filtro, setFiltro] = useState('todos')
  const [filtroDespesa, setFiltroDespesa] = useState('todas') // 'todas' | 'recorrentes' | 'preencher'
  const [periodoSel, setPeriodoSel] = useState(new Date())
  const [rangeMode, setRangeMode] = useState('mes') // 'mes' | 'custom'
  const [customInicio, setCustomInicio] = useState('') // vazios: o usuario escolhe
  const [customFim, setCustomFim] = useState('')
  const [exportando, setExportando] = useState(false)
  const [exportandoAnual, setExportandoAnual] = useState(false)
  const [tab, setTab] = useState('resumo')
  // Config de cobrança (chave Pix + modelo da mensagem) — usada no botão "Cobrar".
  const [cobranca, setCobranca] = useState({ chavePix: '', template: MSG_COBRANCA_PADRAO, nomeSalao: '' })
  // Pró-labore ("meu salário"): valor mensal que a dona tira pra ela.
  const [proLabore, setProLabore] = useState(0)
  const [showProLabore, setShowProLabore] = useState(false)
  const [proLaboreInput, setProLaboreInput] = useState('')
  const [savingProLabore, setSavingProLabore] = useState(false)
  const [searchParams] = useSearchParams()

  // Config de cobrança (chave Pix + modelo) — carrega uma vez por salão.
  useEffect(() => {
    if (!salaoId) return
    supabase.from('configuracoes')
      .select('chave_pix, msg_cobranca, nome_salao, pro_labore')
      .eq('salao_id', salaoId).maybeSingle()
      .then(({ data }) => {
        if (!data) return
        setCobranca({
          chavePix: data.chave_pix || '',
          template: data.msg_cobranca || MSG_COBRANCA_PADRAO,
          nomeSalao: data.nome_salao || '',
        })
        setProLabore(Number(data.pro_labore) || 0)
      })
  }, [salaoId])

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

  // Intervalo efetivo (mês selecionado ou período personalizado)
  function getRange() {
    if (rangeMode === 'custom' && customInicio && customFim) {
      return customInicio <= customFim
        ? { inicio: customInicio, fim: customFim }
        : { inicio: customFim, fim: customInicio }
    }
    return { inicio: format(startOfMonth(periodoSel), 'yyyy-MM-dd'), fim: format(endOfMonth(periodoSel), 'yyyy-MM-dd') }
  }
  // Data de referência (para janela de 6 meses e relatório anual)
  const refDate = (rangeMode === 'custom' && customFim) ? new Date(customFim + 'T12:00:00') : periodoSel

  // Mostra o esqueleto só na 1ª carga. Ao trocar mês/período, rebusca em
  // segundo plano mantendo os números antigos na tela (sem "piscar" reload).
  const primeiraCarga = useRef(true)
  useEffect(() => {
    if (!salaoId) return
    if (primeiraCarga.current) setLoading(true)
    Promise.all([loadPagamentos(), loadAgendamentos(), loadDespesas(), loadPrevisao()])
      .finally(() => { setLoading(false); primeiraCarga.current = false })
  }, [salaoId, periodoSel, rangeMode, customInicio, customFim])

  // Recarrega ao voltar o foco para a aba/janela: mantém os números frescos
  // quando dona e profissional mexem ao mesmo tempo em sessões diferentes.
  useEffect(() => {
    function aoFocar() {
      if (document.visibilityState === 'visible' && salaoId) {
        loadPagamentos(); loadDespesas()
      }
    }
    window.addEventListener('focus', aoFocar)
    document.addEventListener('visibilitychange', aoFocar)
    return () => {
      window.removeEventListener('focus', aoFocar)
      document.removeEventListener('visibilitychange', aoFocar)
    }
  }, [salaoId, periodoSel, rangeMode, customInicio, customFim])

  async function loadPagamentos() {
    const { inicio, fim } = getRange()
    const { data, error } = await supabase.from('pagamentos').select('*, agendamentos(servico, status, clientes(nome, telefone))').eq('salao_id', salaoId).gte('data', inicio).lte('data', fim).order('data', { ascending: false })
    if (error) { toastErro(traduzErro(error, 'Não foi possível carregar os pagamentos.')); return }
    // Pagamento de atendimento CANCELADO não é receita (some do perfil da cliente
    // pelo mesmo motivo). Avulso (sem agendamento) continua contando.
    setPagamentos((data || []).filter(p => p.agendamentos?.status !== 'cancelado'))

    const inicio6m = format(startOfMonth(subMonths(refDate, 5)), 'yyyy-MM-dd')
    const fim6m = format(endOfMonth(refDate), 'yyyy-MM-dd')
    const { data: data6m } = await supabase.from('pagamentos')
      .select('data, valor, status, agendamentos(status)').eq('salao_id', salaoId).eq('status', 'pago')
      .gte('data', inicio6m).lte('data', fim6m)
    setPagamentos6m((data6m || []).filter(p => p.agendamentos?.status !== 'cancelado'))
  }

  // Previsão de receita: o que AINDA vai entrar (agendamentos pendentes/confirmados
  // de hoje em diante). Independe do período selecionado — é sempre "daqui pra frente".
  async function loadPrevisao() {
    const hoje = format(new Date(), 'yyyy-MM-dd')
    const fimSemana = format(endOfWeek(new Date(), { locale: ptBR }), 'yyyy-MM-dd')
    const fimMes = format(endOfMonth(new Date()), 'yyyy-MM-dd')
    const fimAno = format(endOfYear(new Date()), 'yyyy-MM-dd')

    const { data: ags } = await supabase
      .from('agendamentos').select('data, valor, status')
      .eq('salao_id', salaoId)
      .gte('data', hoje)
      .in('status', ['pendente', 'confirmado'])

    if (!ags) return
    const soma = (arr) => arr.reduce((acc, a) => acc + (a.valor || 0), 0)

    // "Vai sair": despesas futuras (data >= hoje) + contas a pagar em aberto
    // (pago = false, inclusive vencidas). Respeita quem-vê-o-quê (dona x profissional).
    let despQ = supabase.from('despesas').select('data, valor, pago')
      .lte('data', fimMes).or(`data.gte.${hoje},pago.eq.false`)
    despQ = gerenciaTudo ? despQ.eq('salao_id', salaoId) : despQ.eq('user_id', user.id)
    const { data: desp } = await despQ
    const somaD = (arr) => (arr || []).reduce((acc, d) => acc + (d.valor || 0), 0)

    setPrevisao({
      // Fluxo de caixa cumulativo: o que entra/sai de hoje até o fim do período.
      entraSemana: soma(ags.filter(a => a.data <= fimSemana)),
      entraMes: soma(ags.filter(a => a.data <= fimMes)),
      saiSemana: somaD((desp || []).filter(d => d.data <= fimSemana)),
      saiMes: somaD(desp),
      // Do "vai entrar" do mês: quanto já está confirmado × ainda aguardando.
      confirmadoMes: soma(ags.filter(a => a.data <= fimMes && a.status === 'confirmado')),
      aguardandoMes: soma(ags.filter(a => a.data <= fimMes && a.status === 'pendente')),
    })
  }

  async function loadDespesas() {
    const { inicio, fim } = getRange()
    // Dona/recepção veem as despesas do salão; a profissional vê só as DELA
    // (privadas, gravadas com salao_id NULL e identificadas pelo user_id).
    let q = supabase.from('despesas')
      .select('*')
      .gte('data', inicio).lte('data', fim).order('data', { ascending: false })
    q = gerenciaTudo ? q.eq('salao_id', salaoId) : q.eq('user_id', user.id)
    const { data, error } = await q
    if (error) { toastErro(traduzErro(error, 'Não foi possível carregar as despesas.')); return }
    setDespesas(data || [])
  }

  async function loadAgendamentos() {
    const { data } = await supabase.from('agendamentos').select('id, servico, data, clientes(nome)').eq('salao_id', salaoId).order('data', { ascending: false }).limit(50)
    setAgendamentos(data || [])
  }

  async function salvarPagamento() {
    if (!form.valor) return
    setSaving(true)
    // agendamento_id vem '' quando nenhum atendimento é escolhido (pagamento
    // avulso). '' não é uuid válido → precisa virar null, senão o insert falha.
    const { error } = await supabase.from('pagamentos').insert({ ...form, agendamento_id: form.agendamento_id || null, user_id: user.id, salao_id: salaoId, valor: parseFloat(form.valor) })
    setSaving(false)
    if (error) { toastErro(traduzErro(error, 'Não foi possível registrar o pagamento.')); return }
    setShowModal(false)
    setForm({ agendamento_id: '', valor: '', status: 'pendente', forma: 'pix', data: format(new Date(), 'yyyy-MM-dd') })
    loadPagamentos()
    sucesso('Pagamento registrado')
  }

  async function salvarDespesa() {
    // Recorrente variável: o valor pode ficar em branco (entra como "a preencher").
    const ehVariavel = formDespesa.recorrente && formDespesa.valor_variavel
    if (!formDespesa.descricao || (!formDespesa.valor && !ehVariavel)) {
      toastErro('Preencha descrição e valor')
      return
    }
    if (formDespesa.recorrente && !editandoDespesa && !formDespesa.recorrente_ate) {
      toastErro('Escolha até quando repetir a despesa')
      return
    }
    setSavingDespesa(true)
    // "Contas a pagar" é Pro/Salão: no Solo, toda despesa entra como já paga.
    const podeContasAPagar = temAcesso('contasAPagar')
    const baseValor = formDespesa.valor ? parseFloat(formDespesa.valor) : 0
    // Profissional: despesa privada (sem vínculo ao salão, fora do DRE da dona).
    const comum = {
      user_id: user.id,
      salao_id: gerenciaTudo ? salaoId : null,
      descricao: formDespesa.descricao,
      categoria: formDespesa.categoria,
      forma_pagamento: formDespesa.forma_pagamento || null,
      observacoes: formDespesa.observacoes || null,
      tipo: formDespesa.tipo || 'salao',
    }

    // EDIÇÃO: atualiza só ESTE lançamento (não regenera a série). Útil também
    // pra preencher o valor de um card variável "a preencher".
    if (editandoDespesa) {
      const dados = {
        ...comum,
        valor: baseValor,
        data: formDespesa.data,
        recorrente: formDespesa.recorrente,
        valor_variavel: formDespesa.valor_variavel,
        valor_a_preencher: !!editandoDespesa.valor_a_preencher && baseValor === 0,
        pago: podeContasAPagar ? formDespesa.pago : true,
      }
      const base = supabase.from('despesas')
      const resp = gerenciaTudo
        ? await base.update(dados).eq('id', editandoDespesa.id).eq('salao_id', salaoId)
        : await base.update(dados).eq('id', editandoDespesa.id).eq('user_id', user.id)
      setSavingDespesa(false)
      if (resp.error) { toastErro(traduzErro(resp.error, 'Não foi possível salvar a despesa.')); return }
      sucesso('Despesa atualizada ✓')
      fecharDespesaModal(); loadDespesas()
      return
    }

    // CRIAÇÃO simples (não recorrente).
    if (!formDespesa.recorrente) {
      const { error } = await supabase.from('despesas').insert({
        ...comum, valor: baseValor, data: formDespesa.data,
        recorrente: false, valor_variavel: false, valor_a_preencher: false,
        pago: podeContasAPagar ? formDespesa.pago : true,
      })
      setSavingDespesa(false)
      if (error) { toastErro(traduzErro(error, 'Não foi possível salvar a despesa.')); return }
      sucesso('Despesa registrada ✓')
      fecharDespesaModal(); loadDespesas()
      return
    }

    // CRIAÇÃO recorrente: gera um lançamento por mês, no mesmo dia, até "repetir até".
    //   - fixo:     todos os meses com o valor.
    //   - variável: 1º mês usa o que foi digitado; meses seguintes entram em
    //               branco (valor 0, "a preencher").
    const recorrenciaId = crypto.randomUUID()
    const inicio = new Date(formDespesa.data + 'T12:00:00')
    const ate = new Date(formDespesa.recorrente_ate + 'T12:00:00')
    const LIMITE_MESES = 36
    const linhas = []
    for (let i = 0; i < LIMITE_MESES; i++) {
      const dt = addMonths(inicio, i)
      if (dt > ate) break
      const valorMes = i === 0 ? baseValor : (formDespesa.valor_variavel ? 0 : baseValor)
      linhas.push({
        ...comum,
        data: format(dt, 'yyyy-MM-dd'),
        valor: valorMes,
        recorrente: true,
        recorrencia_id: recorrenciaId,
        valor_variavel: formDespesa.valor_variavel,
        valor_a_preencher: formDespesa.valor_variavel && valorMes === 0,
        // 1º mês segue o checkbox; meses futuros já nascem "a pagar".
        pago: podeContasAPagar ? (i === 0 ? formDespesa.pago : false) : true,
      })
    }
    const { error } = await supabase.from('despesas').insert(linhas)
    setSavingDespesa(false)
    if (error) { toastErro(traduzErro(error, 'Não foi possível criar a despesa recorrente.')); return }
    sucesso(`Despesa recorrente criada (${linhas.length} ${linhas.length === 1 ? 'mês' : 'meses'}) ✓`)
    fecharDespesaModal(); loadDespesas()
  }

  function abrirProLabore() {
    setProLaboreInput(proLabore ? String(proLabore) : '')
    setShowProLabore(true)
  }

  async function salvarProLabore() {
    const valor = parseFloat(proLaboreInput) || 0
    setSavingProLabore(true)
    const { error } = await supabase.from('configuracoes').update({ pro_labore: valor }).eq('salao_id', salaoId)
    setSavingProLabore(false)
    if (error) { toastErro(traduzErro(error, 'Não foi possível salvar seu salário.')); return }
    setProLabore(valor)
    setShowProLabore(false)
    sucesso('Pró-labore salvo ✓')
  }

  function abrirNovaDespesa() {
    setEditandoDespesa(null)
    setFormDespesa({ descricao: '', categoria: 'produtos', valor: '', data: format(new Date(), 'yyyy-MM-dd'), forma_pagamento: 'pix', recorrente: false, valor_variavel: false, recorrente_ate: '', observacoes: '', pago: true, tipo: 'salao' })
    setShowDespesaModal(true)
  }

  function abrirEditarDespesa(despesa) {
    setEditandoDespesa(despesa)
    setFormDespesa({
      descricao: despesa.descricao,
      categoria: despesa.categoria,
      valor: String(despesa.valor),
      data: despesa.data,
      forma_pagamento: despesa.forma_pagamento || 'pix',
      recorrente: despesa.recorrente || false,
      valor_variavel: despesa.valor_variavel || false,
      recorrente_ate: '',
      observacoes: despesa.observacoes || '',
      pago: despesa.pago !== false,
      tipo: despesa.tipo || 'salao',
    })
    setShowDespesaModal(true)
  }

  function fecharDespesaModal() {
    setShowDespesaModal(false)
    setEditandoDespesa(null)
    setFormDespesa({ descricao: '', categoria: 'produtos', valor: '', data: format(new Date(), 'yyyy-MM-dd'), forma_pagamento: 'pix', recorrente: false, valor_variavel: false, recorrente_ate: '', observacoes: '', pago: true, tipo: 'salao' })
  }

  // Marca uma conta a pagar como PAGA (botão rápido no card). Otimista + banco.
  async function marcarDespesaPaga(despesa) {
    setDespesas(prev => prev.map(d => d.id === despesa.id ? { ...d, pago: true } : d))
    const q = supabase.from('despesas').update({ pago: true }).eq('id', despesa.id)
    const { error } = await (gerenciaTudo ? q.eq('salao_id', salaoId) : q.eq('user_id', user.id))
    if (error) {
      setDespesas(prev => prev.map(d => d.id === despesa.id ? { ...d, pago: false } : d))
      toastErro(traduzErro(error, 'Não foi possível marcar como paga.'))
      return
    }
    sucesso('Conta marcada como paga ✓', {
      acaoLabel: 'Desfazer',
      acao: async () => {
        setDespesas(prev => prev.map(d => d.id === despesa.id ? { ...d, pago: false } : d))
        const uq = supabase.from('despesas').update({ pago: false }).eq('id', despesa.id)
        await (gerenciaTudo ? uq.eq('salao_id', salaoId) : uq.eq('user_id', user.id))
        loadDespesas()
      },
    })
  }

  async function excluirDespesa(despesa) {
    const ok = await confirmar({
      titulo: 'Excluir esta despesa?',
      mensagem: `${despesa.descricao} - ${formatBRL(despesa.valor)}`,
      confirmarLabel: 'Sim, excluir',
      tipo: 'perigo',
    })
    if (!ok) return

    // Se faz parte de uma série recorrente, oferece apagar os próximos também.
    if (despesa.recorrencia_id) {
      const serie = await confirmar({
        titulo: 'Apagar os próximos também?',
        mensagem: 'Esta despesa se repete nos próximos meses. Quer apagar também os lançamentos seguintes (do mesmo dia em diante)?',
        confirmarLabel: 'Sim, apagar os próximos',
        cancelarLabel: 'Não, só esta',
        tipo: 'perigo',
      })
      if (serie) {
        const dq = supabase.from('despesas').delete()
          .eq('recorrencia_id', despesa.recorrencia_id).gte('data', despesa.data)
        const { error } = await (gerenciaTudo ? dq.eq('salao_id', salaoId) : dq.eq('user_id', user.id))
        if (error) { toastErro(traduzErro(error, 'Não foi possível excluir os lançamentos.')); return }
        sucesso('Despesas recorrentes excluídas (deste mês em diante)')
        loadDespesas()
        return
      }
    }

    const delQ = supabase.from('despesas').delete().eq('id', despesa.id)
    const { error } = await (gerenciaTudo ? delQ.eq('salao_id', salaoId) : delQ.eq('user_id', user.id))
    if (error) { toastErro(traduzErro(error, 'Não foi possível excluir a despesa.')); return }
    sucesso('Despesa excluída', {
      acaoLabel: 'Desfazer',
      acao: async () => {
        const { id, created_at, updated_at, ...rest } = despesa
        await supabase.from('despesas').insert(rest)
        loadDespesas()
      },
    })
    loadDespesas()
  }

  // Reverter um pagamento de "pago" para "pendente" — pede confirmação (evita clique acidental).
  async function reverterParaPendente(pag) {
    const ok = await confirmar({
      titulo: 'Marcar como pendente?',
      mensagem: `${pag.agendamentos?.clientes?.nome || 'Este pagamento'} · ${formatBRL(pag.valor ?? 0)} (${FORMA_LABEL[pag.forma] || pag.forma}) deixará de ser um valor recebido.`,
      confirmarLabel: 'Sim, marcar pendente',
      tipo: 'perigo',
    })
    if (!ok) return
    const { error } = await supabase.from('pagamentos').update({ status: 'pendente' }).eq('id', pag.id).eq('salao_id', salaoId)
    if (error) { toastErro(traduzErro(error, 'Não foi possível atualizar o pagamento.')); return }
    loadPagamentos()
  }

  // Marca que a cobrança foi enviada (1º clique no "Cobrar"). Atualiza a tela na
  // hora (otimista) e grava a data no banco — igual ao "enviado" dos lembretes.
  // Reenvios não re-gravam: o link do WhatsApp abre normalmente nos dois casos.
  async function marcarCobrado(pag) {
    if (pag.cobranca_enviada_em) return
    const agora = new Date().toISOString()
    setPagamentos(prev => prev.map(x => x.id === pag.id ? { ...x, cobranca_enviada_em: agora } : x))
    await supabase.from('pagamentos').update({ cobranca_enviada_em: agora }).eq('id', pag.id).eq('salao_id', salaoId)
  }

  // Abre o modal (igual ao da agenda) para confirmar um pendente como pago.
  function abrirConfirmarPago(pag) {
    setFormPag({ forma: pag.forma || 'pix', status: 'pago', valor: String(pag.valor || ''), modo: 'simples', forma2: 'cartao_credito', valor2: '' })
    setPagSelecionado(pag)
  }

  async function salvarPagamentoConfirmado() {
    if (!pagSelecionado) return
    const v1 = parseFloat(formPag.valor) || 0
    const v2 = formPag.modo === 'duplo' ? (parseFloat(formPag.valor2) || 0) : 0
    if (v1 <= 0) { toastErro('Informe o valor do pagamento.'); return }
    if (formPag.modo === 'duplo' && v2 <= 0) { toastErro('Informe o valor da 2ª forma de pagamento.'); return }
    setSavingPag(true)
    // 1ª forma: atualiza o pagamento que já existia (mantém o vínculo com o agendamento)
    const { error } = await supabase.from('pagamentos')
      .update({ status: formPag.status, forma: formPag.forma, valor: v1 })
      .eq('id', pagSelecionado.id).eq('salao_id', salaoId)
    let erro2 = null
    // 2ª forma (modo duplo): cria um segundo lançamento para o mesmo agendamento
    if (!error && formPag.modo === 'duplo') {
      const r = await supabase.from('pagamentos').insert({
        user_id: pagSelecionado.user_id || user.id, salao_id: salaoId,
        agendamento_id: pagSelecionado.agendamento_id || null, data: pagSelecionado.data,
        status: formPag.status, valor: v2, forma: formPag.forma2,
      })
      erro2 = r.error
    }
    setSavingPag(false)
    if (error || erro2) { toastErro('Erro ao registrar pagamento: ' + (error || erro2).message); return }
    setPagSelecionado(null)
    sucesso(formPag.modo === 'duplo' ? 'Pagamento em 2 formas registrado' : 'Pagamento registrado')
    loadPagamentos()
  }

  async function handleExportarPDF() {
    if (!temAcesso('exportPDF')) { setShowUpgrade(true); return }
    setExportando(true)
    try { await exportarPDFMensal(pagamentos, despesas, periodoLabel) }
    catch (e) { toastErro('Erro ao gerar PDF') }
    setExportando(false)
  }

  async function handleExportarAnual() {
    if (!temAcesso('exportPDF')) { setShowUpgrade(true); return }
    setExportandoAnual(true)
    try { await exportarPDFAnual(salaoId, refDate.getFullYear(), { gerenciaTudo, userId: user.id }) }
    catch (e) { toastErro('Erro ao gerar PDF anual') }
    setExportandoAnual(false)
  }

  // ─── Calculos ───
  const recebido = pagamentos.filter(p => p.status === 'pago').reduce((s, p) => s + p.valor, 0)
  const pendente = pagamentos.filter(p => p.status === 'pendente').reduce((s, p) => s + p.valor, 0)
  const qtdPagos = pagamentos.filter(p => p.status === 'pago').length
  const ticketMedio = qtdPagos > 0 ? recebido / qtdPagos : 0
  const totalDespesas = despesas.reduce((s, d) => s + d.valor, 0)
  // Bolso: despesa do salão (custo do negócio) × pessoal (gasto da dona).
  // Pessoal NÃO entra no lucro do salão — vai pro "seu bolso".
  const totalDespesasPessoal = despesas.filter(d => d.tipo === 'pessoal').reduce((s, d) => s + (d.valor || 0), 0)
  const totalDespesasSalao = totalDespesas - totalDespesasPessoal
  const lucro = recebido - totalDespesasSalao
  const margemLucro = recebido > 0 ? (lucro / recebido) * 100 : 0
  const filtrados = filtro === 'todos' ? pagamentos : pagamentos.filter(p => p.status === filtro)
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

  // Despesas agrupadas por categoria
  const despesasPorCategoria = {}
  despesas.forEach(d => {
    if (!despesasPorCategoria[d.categoria]) despesasPorCategoria[d.categoria] = 0
    despesasPorCategoria[d.categoria] += d.valor
  })
  const dadosDespesas = Object.entries(despesasPorCategoria)
    .map(([cat, valor]) => {
      const c = CATEGORIAS.find(x => x.id === cat)
      return { label: c?.label || cat, valor, cor: c?.cor || '#888' }
    })
    .sort((a, b) => b.valor - a.valor)

  // Filtro da lista de despesas (todas / a pagar / recorrentes / "a preencher").
  const despesasVisiveis = despesas.filter(d =>
    filtroDespesa === 'a_pagar' ? d.pago === false
    : filtroDespesa === 'recorrentes' ? d.recorrente
    : filtroDespesa === 'preencher' ? d.valor_a_preencher
    : filtroDespesa === 'salao' ? d.tipo !== 'pessoal'
    : filtroDespesa === 'pessoal' ? d.tipo === 'pessoal'
    : true)
  // Contas ainda a pagar no período (pago = false).
  const contasAPagar = despesas.filter(d => d.pago === false)
  const totalAPagar = contasAPagar.reduce((s, d) => s + (d.valor || 0), 0)
  const totalDespesasPagas = totalDespesas - totalAPagar
  // Para o DRE do salão: pagas × a pagar SÓ das despesas do salão (sem pessoal).
  const salaoAPagar = despesas.filter(d => d.pago === false && d.tipo !== 'pessoal').reduce((s, d) => s + (d.valor || 0), 0)
  const salaoPagas = totalDespesasSalao - salaoAPagar
  // Pró-labore só faz sentido pra dona/recepção e num mês fechado (não em range custom).
  const mostraProLabore = gerenciaTudo && rangeMode === 'mes'
  const sobrouReinvestir = lucro - proLabore
  const sobrouPraVoce = proLabore - totalDespesasPessoal

  return (
    <div style={s.page}>
      {/* Modo de período */}
      <div style={s.modoTabs}>
        <button style={{ ...s.modoTab, ...(rangeMode === 'mes' ? s.modoTabAtivo : {}) }} onClick={() => setRangeMode('mes')}>Por mês</button>
        <button style={{ ...s.modoTab, ...(rangeMode === 'custom' ? s.modoTabAtivo : {}) }} onClick={() => setRangeMode('custom')}>Período personalizado</button>
      </div>

      {/* Navegação de período */}
      <div style={s.periodoNav}>
        {rangeMode === 'mes' ? (
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
        )}
        <button style={s.exportBtn} onClick={handleExportarPDF} disabled={exportando} title="PDF do período">
          <FileDown size={14} />
          {exportando ? '...' : 'PDF'}
          {!temAcesso('exportPDF') && <ProBadge />}
        </button>
        <button style={s.exportBtnAnual} onClick={handleExportarAnual} disabled={exportandoAnual} title="PDF anual">
          <Calendar size={14} />
          {exportandoAnual ? '...' : `Ano ${refDate.getFullYear()}`}
          {!temAcesso('exportPDF') && <ProBadge />}
        </button>
      </div>

      {/* ── Tabs ── */}
      <div className="fin-tabs" style={tabs.bar}>
        {[
          { id: 'resumo',   label: 'Resumo',   icon: DollarSign },
          { id: 'analises', label: 'Análises', icon: BarChart2 },
          { id: 'receitas', label: 'Receitas', icon: TrendingUp },
          { id: 'previsao', label: 'Previsão', icon: CalendarClock },
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
        })}
      </div>

      {loading && <div style={s.tabContent}><CardSkeleton count={4} /></div>}

      {/* ── ABA: Resumo ── */}
      {!loading && tab === 'resumo' && (
        <div style={s.tabContent}>
          {/* KPIs */}
          <div style={s.grid4} className="fin-resumo-grid">
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
                <div style={s.dreLinha}>
                  <span>(−) Despesas do salão <span style={{ color: 'var(--text3)', fontSize: 11 }}>(já pagas)</span></span>
                  <span style={{ ...s.mono, color: '#B91C1C' }}>− {formatBRL(salaoPagas)}</span>
                </div>
                <div style={s.dreLinha}>
                  <span>(−) Contas a pagar <span style={{ color: 'var(--text3)', fontSize: 11 }}>(vai sair)</span></span>
                  <span style={{ ...s.mono, color: '#B45309' }}>− {formatBRL(salaoAPagar)}</span>
                </div>
              </>
            ) : (
              <div style={s.dreLinha}>
                <span>(−) Despesas do salão</span>
                <span style={{ ...s.mono, color: '#B91C1C' }}>− {formatBRL(totalDespesasSalao)}</span>
              </div>
            )}
            <div style={s.dreDivider} />
            <div style={{ ...s.dreLinha, ...s.dreTotal }}>
              <span>(=) Lucro do salão</span>
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

            {/* Pró-labore: "meu salário" → sobrou pra reinvestir (só dona, mês fechado) */}
            {mostraProLabore && (
              proLabore > 0 ? (
                <>
                  <div style={s.dreDivider} />
                  <div style={s.dreLinha}>
                    <span>
                      (−) Seu salário <span style={{ color: 'var(--text3)', fontSize: 11 }}>(pró-labore)</span>
                      <button onClick={abrirProLabore} style={s.proLaboreEdit} title="Editar seu salário"><Pencil size={11} /></button>
                    </span>
                    <span style={{ ...s.mono, color: '#7C3AED' }}>− {formatBRL(proLabore)}</span>
                  </div>
                  <div style={{ ...s.dreLinha, ...s.dreTotal }}>
                    <span>(=) Sobrou pra reinvestir</span>
                    <span style={{ ...s.mono, color: sobrouReinvestir >= 0 ? 'var(--green)' : '#B91C1C', fontSize: 15 }}>{formatBRL(sobrouReinvestir)}</span>
                  </div>
                </>
              ) : (
                <button onClick={abrirProLabore} style={s.proLaboreBtn}>+ Definir seu salário (pró-labore)</button>
              )
            )}

            {/* Seu bolso: gastos pessoais (não entram no lucro do salão) */}
            {mostraProLabore && totalDespesasPessoal > 0 && (
              <>
                <div style={s.dreDivider} />
                <div style={s.dreLinha}>
                  <span>👤 Gastos pessoais <span style={{ color: 'var(--text3)', fontSize: 11 }}>(seu bolso)</span></span>
                  <span style={{ ...s.mono, color: '#7C3AED' }}>− {formatBRL(totalDespesasPessoal)}</span>
                </div>
                {proLabore > 0 && (
                  <div style={s.dreMargem}>
                    {sobrouPraVoce >= 0
                      ? <>Do seu salário de {formatBRL(proLabore)}, sobrou <strong>{formatBRL(sobrouPraVoce)}</strong> pra você 💜</>
                      : <>🚨 Você gastou <strong>{formatBRL(-sobrouPraVoce)}</strong> a mais do que tirou de salário</>}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── ABA: Análises ── */}
      {!loading && tab === 'analises' && (
        <div style={s.tabContent}>
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
              <HBarChart data={topServicos} cor="var(--pink)" formatValor={(v) => formatBRL(v)} />
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

      {/* ── ABA: Previsão ── */}
      {!loading && tab === 'previsao' && (
        <div style={s.tabContent}>
          <div style={s.prevInfo}>
            📅 O que ainda vai <strong>entrar e sair</strong> daqui pra frente — pra você saber se a semana e o mês fecham no azul.
          </div>

          {/* 1) Vai sobrar quanto? (entra − sai = sobra) */}
          <div style={s.prevSection}>Vai sobrar quanto?</div>
          <div style={s.prevGrid}>
            {[
              { label: 'Esta semana', entra: previsao.entraSemana, sai: previsao.saiSemana },
              { label: 'Este mês', entra: previsao.entraMes, sai: previsao.saiMes },
            ].map(({ label, entra, sai }) => {
              const sobra = entra - sai
              const neg = sobra < 0
              return (
                <div key={label} style={{ ...s.prevCard, ...(neg ? { borderColor: '#FCA5A5', background: '#FEF2F2' } : {}) }}>
                  <div style={s.prevLabel}>{label}</div>
                  <div style={s.fluxoLinha}><span>vai entrar</span><span style={{ ...s.mono, color: 'var(--green)' }}>{formatBRL(entra)}</span></div>
                  <div style={s.fluxoLinha}><span>vai sair</span><span style={{ ...s.mono, color: '#B91C1C' }}>− {formatBRL(sai)}</span></div>
                  <div style={s.fluxoSobra}>
                    <span style={{ fontSize: 12, fontWeight: 700 }}>sobra</span>
                    <span style={{ ...s.mono, fontWeight: 700, fontSize: 16, color: neg ? '#B91C1C' : 'var(--green)' }}>{formatBRL(sobra)}</span>
                  </div>
                  {neg && <div style={{ fontSize: 10.5, color: '#B91C1C', marginTop: 4, fontWeight: 600 }}>⚠️ as contas passam o que entra</div>}
                </div>
              )
            })}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--text3)' }}>
            <strong>Vai entrar</strong> = atendimentos já agendados. <strong>Vai sair</strong> = despesas a vencer e contas a pagar. (Contas com valor "a preencher" ainda não entram.)
          </div>

          {/* 2) Do "vai entrar" do mês, quanto já está garantido */}
          <div style={{ ...s.prevSection, marginTop: 6 }}>Desse "vai entrar" do mês, quanto já está garantido?</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ ...s.prevPipeCard, borderColor: '#4ADE80', background: '#F0FDF4' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#15803D', marginBottom: 6 }}>✓ Confirmado</div>
              <div style={{ ...s.mono, fontSize: 22, fontWeight: 700, color: '#15803D' }}>{formatBRL(previsao.confirmadoMes)}</div>
              <div style={{ fontSize: 11, color: '#166534', marginTop: 3 }}>a cliente confirmou que vem</div>
            </div>
            <div style={{ ...s.prevPipeCard, borderColor: '#FCD34D', background: '#FFFBEB' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#92400E', marginBottom: 6 }}>⏳ Ainda não confirmou</div>
              <div style={{ ...s.mono, fontSize: 22, fontWeight: 700, color: '#D97706' }}>{formatBRL(previsao.aguardandoMes)}</div>
              <div style={{ fontSize: 11, color: '#92400E', marginTop: 3 }}>mande um lembrete pra confirmar</div>
            </div>
          </div>
        </div>
      )}

      {/* ── ABA: Despesas ── */}
      {!loading && tab === 'despesas' && (
        <div style={s.tabContent}>
          {/* Cards de resumo: já pago × a pagar (ou só o total, no Solo) */}
          {temAcesso('contasAPagar') ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ ...s.card, borderTop: '3px solid var(--green)' }}>
                <div style={s.cardLabel}>✓ Já paguei (já saiu)</div>
                <div style={{ ...s.cardValue, color: '#15803D' }}>{formatBRL(totalDespesasPagas)}</div>
                <div style={s.cardSub}>{despesas.filter(d => d.pago !== false).length} lançamento{despesas.filter(d => d.pago !== false).length !== 1 ? 's' : ''}</div>
              </div>
              <div style={{ ...s.card, borderTop: '3px solid #FCD34D' }}>
                <div style={s.cardLabel}>💸 A pagar (vai sair)</div>
                <div style={{ ...s.cardValue, color: '#B45309' }}>{formatBRL(totalAPagar)}</div>
                <div style={s.cardSub}>{contasAPagar.length} conta{contasAPagar.length !== 1 ? 's' : ''}</div>
              </div>
            </div>
          ) : (
            <div style={{ ...s.card, borderTop: '3px solid #B91C1C' }}>
              <div style={s.cardLabel}><Receipt size={11} /> Total de despesas</div>
              <div style={{ ...s.cardValue, color: '#B91C1C' }}>{formatBRL(totalDespesas)}</div>
              <div style={s.cardSub}>{despesas.length} lançamento{despesas.length !== 1 ? 's' : ''}</div>
            </div>
          )}

          {/* Cabeçalho: título + 1 filtro (dropdown) + adicionar */}
          <div style={s.colHeader}>
            <div style={s.colTitulo}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#B91C1C' }} />
              Despesas ({despesasVisiveis.length})
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select value={filtroDespesa} onChange={e => setFiltroDespesa(e.target.value)} style={s.filtroSelect}>
                <option value="todas">Todas</option>
                <option value="salao">🏢 Do salão</option>
                <option value="pessoal">👤 Pessoal</option>
                {temAcesso('contasAPagar') && <option value="a_pagar">💸 A pagar</option>}
                <option value="recorrentes">🔁 Recorrentes</option>
                <option value="preencher">⚠️ A preencher</option>
              </select>
              <button style={s.addBtnSmall} onClick={abrirNovaDespesa}>
                <Plus size={13} /> Despesa
              </button>
            </div>
          </div>

          {despesasVisiveis.length === 0
            ? <div style={s.empty}>Nenhuma despesa {filtroDespesa === 'a_pagar' ? 'a pagar' : filtroDespesa === 'recorrentes' ? 'recorrente' : filtroDespesa === 'preencher' ? 'a preencher' : 'registrada'}</div>
            : despesasVisiveis.map(d => {
              const cat = CATEGORIAS.find(c => c.id === d.categoria)
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
                      {cat?.label || d.categoria} · {ehAPagar ? 'vence ' : ''}{format(new Date(d.data + 'T12:00:00'), 'dd/MM', { locale: ptBR })}
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
                        <button style={s.pagarBtn} onClick={() => marcarDespesaPaga(d)} title="Marcar como paga">
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

      {/* Modal Pagamento */}
      {showModal && (
        <Modal onClose={() => setShowModal(false)} variant="sheet" boxStyle={s.modal}>
            <div style={s.modalTitle}>💰 Registrar pagamento</div>
            <div style={s.field}>
              <label style={s.label}>Atendimento (opcional)</label>
              <select style={s.input} value={form.agendamento_id} onChange={e => setForm({ ...form, agendamento_id: e.target.value })}>
                <option value="">Selecionar atendimento</option>
                {agendamentos.map(a => (
                  <option key={a.id} value={a.id}>{a.clientes?.nome} — {a.servico} ({format(new Date(a.data + 'T12:00:00'), 'dd/MM')})</option>
                ))}
              </select>
            </div>
            <div style={s.row}>
              <div style={{ ...s.field, flex: 1 }}>
                <label style={s.label}>Valor (R$) *</label>
                <input style={{ ...s.input, fontFamily: "'JetBrains Mono', monospace" }} type="number" placeholder="0,00" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} />
              </div>
              <div style={{ ...s.field, flex: 1 }}>
                <label style={s.label}>Forma</label>
                <select style={s.input} value={form.forma} onChange={e => setForm({ ...form, forma: e.target.value })}>
                  <option value="pix">Pix</option>
                  <option value="dinheiro">Dinheiro</option>
                  <option value="cartao_debito">Débito</option>
                  <option value="cartao_credito">Crédito</option>
                </select>
              </div>
            </div>
            <div className="form-row-stack" style={s.row}>
              <div style={{ ...s.field, flex: 1 }}>
                <label style={s.label}>Status</label>
                <select style={s.input} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  <option value="pago">Pago</option>
                  <option value="pendente">Pendente</option>
                </select>
              </div>
              <div style={{ ...s.field, flex: 1 }}>
                <label style={s.label}>Data</label>
                <input style={s.input} type="date" value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} />
              </div>
            </div>
            <button style={s.btnPrimary} onClick={salvarPagamento} disabled={saving}>{saving ? 'Salvando...' : 'Registrar'}</button>
            <button style={s.btnSecondary} onClick={() => setShowModal(false)}>Cancelar</button>
        </Modal>
      )}

      {/* Modal Pró-labore (seu salário) */}
      {showProLabore && (
        <Modal onClose={() => setShowProLabore(false)} variant="sheet" boxStyle={s.modal}>
            <div style={s.modalTitle}>💜 Seu salário (pró-labore)</div>
            <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5, marginBottom: 4 }}>
              Quanto você tira pra você por mês? Entra no DRE como "(−) Seu salário" e mostra quanto <strong>sobra pra reinvestir</strong> no negócio.
            </div>
            <div style={s.field}>
              <label style={s.label}>Valor por mês (R$)</label>
              <input style={{ ...s.input, fontFamily: "'JetBrains Mono', monospace" }} type="number" step="0.01" placeholder="0,00" value={proLaboreInput} onChange={e => setProLaboreInput(e.target.value)} />
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>Deixe em 0 para não mostrar essa linha.</div>
            </div>
            <button style={s.btnPrimary} onClick={salvarProLabore} disabled={savingProLabore}>{savingProLabore ? 'Salvando...' : 'Salvar'}</button>
            <button style={s.btnSecondary} onClick={() => setShowProLabore(false)}>Cancelar</button>
        </Modal>
      )}

      {/* Modal Despesa */}
      {showDespesaModal && (
        <Modal onClose={fecharDespesaModal} variant="sheet" boxStyle={s.modal}>
            <div style={s.modalTitle}>{editandoDespesa ? '✏️ Editar despesa' : '📉 Nova despesa'}</div>

            {/* Bolso: do salão (custo do negócio) × pessoal (gasto da dona) */}
            <div style={s.field}>
              <label style={s.label}>De quem é esse gasto?</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[{ id: 'salao', label: '🏢 Do salão' }, { id: 'pessoal', label: '👤 Pessoal' }].map(o => {
                  const ativo = (formDespesa.tipo || 'salao') === o.id
                  return (
                    <button key={o.id} type="button" onClick={() => setFormDespesa({ ...formDespesa, tipo: o.id })}
                      style={{ flex: 1, padding: '9px 12px', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid ' + (ativo ? 'var(--pink)' : 'var(--border2)'), background: ativo ? 'var(--pink)' : 'var(--surface)', color: ativo ? 'white' : 'var(--text3)' }}>
                      {o.label}
                    </button>
                  )
                })}
              </div>
              {(formDespesa.tipo || 'salao') === 'pessoal' && (
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>Gasto seu (não conta no lucro do salão — vai pro "seu bolso").</div>
              )}
            </div>

            <div style={s.field}>
              <label style={s.label}>Descrição *</label>
              <input style={s.input} placeholder="Ex: Conta de luz" value={formDespesa.descricao} onChange={e => setFormDespesa({ ...formDespesa, descricao: e.target.value })} />
            </div>
            <div style={s.field}>
              <label style={s.label}>Categoria *</label>
              <select style={s.input} value={formDespesa.categoria} onChange={e => setFormDespesa({ ...formDespesa, categoria: e.target.value })}>
                {CATEGORIAS.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
              </select>
            </div>
            <div className="form-row-stack" style={s.row}>
              <div style={{ ...s.field, flex: 1 }}>
                <label style={s.label}>Valor (R$){formDespesa.recorrente && formDespesa.valor_variavel ? '' : ' *'}</label>
                <input style={{ ...s.input, fontFamily: "'JetBrains Mono', monospace" }} type="number" step="0.01" placeholder={formDespesa.recorrente && formDespesa.valor_variavel ? 'pode deixar em branco' : '0,00'} value={formDespesa.valor} onChange={e => setFormDespesa({ ...formDespesa, valor: e.target.value })} />
              </div>
              <div style={{ ...s.field, flex: 1 }}>
                <label style={s.label}>Data *</label>
                <input style={s.input} type="date" value={formDespesa.data} onChange={e => setFormDespesa({ ...formDespesa, data: e.target.value })} />
              </div>
            </div>
            <div style={s.field}>
              <label style={s.label}>Forma de pagamento</label>
              <select style={s.input} value={formDespesa.forma_pagamento} onChange={e => setFormDespesa({ ...formDespesa, forma_pagamento: e.target.value })}>
                {FORMAS_PAGAMENTO.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>

            {/* Já paga × conta a pagar (Pro/Salão) — vencimento = data acima */}
            {temAcesso('contasAPagar') && (
              <>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text2)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={formDespesa.pago} onChange={e => setFormDespesa({ ...formDespesa, pago: e.target.checked })} />
                  ✅ Já paguei essa conta
                </label>
                {!formDespesa.pago && (
                  <div style={{ fontSize: 12, color: '#92400E', background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 8, padding: '8px 12px' }}>
                    💸 Vai entrar em <strong>Contas a pagar</strong> com vencimento em {formDespesa.data ? format(new Date(formDespesa.data + 'T12:00:00'), 'dd/MM') : 'na data acima'}.
                    {formDespesa.recorrente && !editandoDespesa && ' Os próximos meses também já nascem a pagar.'}
                  </div>
                )}
              </>
            )}

            {editandoDespesa ? (
              formDespesa.recorrente && (
                <div style={{ fontSize: 12, color: 'var(--text3)', background: 'var(--surface2)', borderRadius: 8, padding: '8px 12px' }}>
                  🔁 Faz parte de uma despesa recorrente{formDespesa.valor_variavel ? ' (valor varia todo mês)' : ''}. Editar aqui altera só este mês.
                </div>
              )
            ) : (
              <>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text2)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={formDespesa.recorrente} onChange={e => {
                    const checked = e.target.checked
                    setFormDespesa(f => ({
                      ...f,
                      recorrente: checked,
                      valor_variavel: checked ? f.valor_variavel : false,
                      recorrente_ate: checked && !f.recorrente_ate
                        ? format(addMonths(new Date((f.data || format(new Date(), 'yyyy-MM-dd')) + 'T12:00:00'), 12), 'yyyy-MM-dd')
                        : f.recorrente_ate,
                    }))
                  }} />
                  🔁 Despesa mensal recorrente
                </label>
                {formDespesa.recorrente && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '10px 12px', background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text2)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={formDespesa.valor_variavel} onChange={e => setFormDespesa({ ...formDespesa, valor_variavel: e.target.checked })} />
                      💧 O valor muda todo mês (futuros entram em branco pra preencher)
                    </label>
                    <div style={s.field}>
                      <label style={s.label}>Repetir até *</label>
                      <input style={s.input} type="date" value={formDespesa.recorrente_ate} onChange={e => setFormDespesa({ ...formDespesa, recorrente_ate: e.target.value })} />
                    </div>
                  </div>
                )}
              </>
            )}
            <div style={s.field}>
              <label style={s.label}>Observações</label>
              <input style={s.input} placeholder="Opcional..." value={formDespesa.observacoes} onChange={e => setFormDespesa({ ...formDespesa, observacoes: e.target.value })} />
            </div>
            <button style={s.btnPrimary} onClick={salvarDespesa} disabled={savingDespesa}>{savingDespesa ? 'Salvando...' : editandoDespesa ? 'Salvar alterações' : 'Registrar despesa'}</button>
            <button style={s.btnSecondary} onClick={fecharDespesaModal}>Cancelar</button>
        </Modal>
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

const s = {
  page: { padding: 16, paddingBottom: 80 },
  /* Previsão (receita futura) */
  prevInfo: { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 13px', fontSize: 12, color: 'var(--text2)' },
  prevSection: { fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px' },
  prevGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 },
  prevCard: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '12px 13px', boxShadow: 'var(--shadow-xs)' },
  prevLabel: { fontSize: 11, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 },
  prevValor: { fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 700, color: 'var(--pink)' },
  prevSub: { fontSize: 10, color: 'var(--text3)', marginTop: 2 },
  fluxoLinha: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11.5, color: 'var(--text3)', marginTop: 4 },
  fluxoSobra: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed var(--border)', marginTop: 7, paddingTop: 7 },
  prevPipeCard: { background: 'var(--surface)', border: '1.5px solid', borderRadius: 'var(--radius-sm)', padding: '14px 15px', boxShadow: 'var(--shadow-xs)' },
  prevTotal: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '13px 15px', boxShadow: 'var(--shadow-xs)' },
  modoTabs: { display: 'flex', gap: 6, marginBottom: 10 },
  modoTab: { flex: 1, padding: '7px 12px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text3)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  modoTabAtivo: { background: 'var(--pink)', color: 'white', border: '1px solid var(--pink)', fontWeight: 700 },
  rangeField: { display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 },
  rangeLabel: { fontSize: 9, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px' },
  rangeInput: { border: '1px solid var(--border2)', borderRadius: 8, padding: '6px 8px', fontSize: 13, background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box', minWidth: 0 },
  periodoNav: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', boxShadow: 'var(--shadow-xs)', flexWrap: 'wrap' },
  periodoLabel: { flex: 1, fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 14, fontWeight: 700, color: 'var(--text)', textTransform: 'capitalize', textAlign: 'center', minWidth: 140 },
  navBtn: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', display: 'flex', alignItems: 'center', padding: 4 },
  exportBtn: { display: 'flex', alignItems: 'center', gap: 5, background: 'var(--pink-light)', color: 'var(--pink)', border: '1px solid var(--pink-mid)', borderRadius: 8, padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' },
  exportBtnAnual: { display: 'flex', alignItems: 'center', gap: 5, background: 'var(--gold, #D4AF37)', color: '#5C4A0F', border: '1px solid #B7791F', borderRadius: 8, padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' },
  sectionTitle: { fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px', margin: '0 0 10px' },
  tabContent: { display: 'flex', flexDirection: 'column', gap: 16 },
  /* KPIs */
  grid4: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 },
  card: { background: 'var(--surface)', borderRadius: 'var(--radius-sm)', padding: '12px 12px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)' },
  cardLabel: { fontSize: 10, color: 'var(--text3)', marginBottom: 5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 },
  cardValue: { fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 700, lineHeight: 1 },
  cardSub: { fontSize: 10, color: 'var(--text3)', marginTop: 4 },
  /* DRE */
  dreCard: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '14px 16px', boxShadow: 'var(--shadow-sm)' },
  dreTitulo: { fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 10 },
  dreLinha: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', fontSize: 13, color: 'var(--text2)' },
  dreDivider: { height: 1, background: 'var(--border)', margin: '4px 0' },
  dreTotal: { fontWeight: 700, color: 'var(--text)', paddingTop: 5 },
  dreMargem: { fontSize: 11, color: 'var(--text3)', marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--border)' },
  mono: { fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 },
  /* Gráficos */
  graficosGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 },
  graficoCard: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '14px 14px 10px', boxShadow: 'var(--shadow-xs)' },
  graficoTitulo: { fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 10 },
  /* Colunas Receitas/Despesas - 2 colunas no desktop */
  colunasGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 32 },
  colHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  colTitulo: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: 'var(--text)' },
  addBtnSmall: { display: 'flex', alignItems: 'center', gap: 4, background: 'var(--pink)', color: 'white', border: 'none', borderRadius: 'var(--radius-pill)', padding: '6px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' },
  filtros: { display: 'flex', gap: 6, marginBottom: 10 },
  filtroBtn: { padding: '5px 12px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border2)', background: 'var(--surface)', color: 'var(--text3)', fontSize: 11, fontWeight: 600, cursor: 'pointer' },
  filtroBtnActive: { background: 'var(--pink)', color: 'white', border: '1px solid var(--pink)' },
  finCard: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', marginBottom: 7, display: 'flex', alignItems: 'center', gap: 10, boxShadow: 'var(--shadow-xs)' },
  dot: { width: 10, height: 10, borderRadius: '50%', flexShrink: 0 },
  catBadge: { width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 },
  finNome: { fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  finSub: { fontSize: 11, color: 'var(--text3)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  finValor: { fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700 },
  statusBtn: { fontSize: 10, padding: '3px 9px', borderRadius: 'var(--radius-pill)', fontWeight: 600, border: 'none', cursor: 'pointer', marginTop: 3 },
  cobrarBtn: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, padding: '3px 9px', borderRadius: 'var(--radius-pill)', fontWeight: 700, background: 'var(--green-bg)', color: '#15803D', border: '1px solid #86EFAC', cursor: 'pointer', textDecoration: 'none' },
  cobradoBtn: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, padding: '3px 9px', borderRadius: 'var(--radius-pill)', fontWeight: 700, background: 'var(--surface2)', color: 'var(--text3)', border: '1px solid var(--border2)', cursor: 'pointer', textDecoration: 'none' },
  aPagarBadge: { fontSize: 10, fontWeight: 700, color: '#B45309', marginTop: 2 },
  pagaBadge: { fontSize: 10, fontWeight: 700, color: '#15803D', marginTop: 2 },
  filtroSelect: { fontSize: 12, fontWeight: 600, padding: '6px 10px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border2)', background: 'var(--surface)', color: 'var(--text2)', cursor: 'pointer', fontFamily: 'inherit' },
  pagarBtn: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, padding: '3px 9px', borderRadius: 'var(--radius-pill)', fontWeight: 700, background: 'var(--green-bg)', color: '#15803D', border: '1px solid #86EFAC', cursor: 'pointer' },
  aPagarResumo: { display: 'flex', alignItems: 'center', gap: 6, background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 'var(--radius-sm)', padding: '9px 13px', marginBottom: 10, fontSize: 12.5, color: '#92400E', cursor: 'pointer', fontWeight: 500 },
  proLaboreEdit: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: '0 0 0 6px', verticalAlign: 'middle' },
  proLaboreBtn: { width: '100%', marginTop: 10, background: 'var(--surface2)', border: '1px dashed var(--border2)', borderRadius: 'var(--radius-sm)', padding: '9px', fontSize: 12.5, color: 'var(--pink)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  statusPago: { background: 'var(--green-bg)', color: 'var(--green)' },
  statusPendente: { background: 'var(--amber-bg)', color: 'var(--amber)' },
  miniIconBtn: { width: 22, height: 22, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  empty: { color: 'var(--text3)', fontSize: 13, textAlign: 'center', padding: '24px 0', background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border2)' },
  /* Modal */
  modal: { background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '90vh', overflowY: 'auto' },
  modalTitle: { fontSize: 17, fontWeight: 700, marginBottom: 4 },
  field: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: labelBase,
  input: inputBase,
  row: { display: 'flex', gap: 10 },
  btnPrimary: btnPrimaryBase,
  btnSecondary: btnSecondaryBase,
}

const tabs = {
  bar: {
    display: 'flex',
    gap: 4,
    background: 'var(--surface)',
    borderRadius: 'var(--radius-sm)',
    padding: 4,
    marginBottom: 20,
    boxShadow: 'var(--shadow-xs)',
    border: '1px solid var(--border)',
    overflowX: 'auto',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  btn: {
    flex: 1,
    minWidth: 80,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '10px 12px',
    borderRadius: 8,
    background: 'transparent',
    border: 'none',
    color: 'var(--text3)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  },
  btnAtivo: {
    background: 'var(--pink)',
    color: 'white',
    boxShadow: 'var(--shadow-pink)',
    fontWeight: 700,
  },
}
