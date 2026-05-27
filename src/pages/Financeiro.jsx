import { useEffect, useState } from 'react'
import {
  Plus, FileDown, ChevronLeft, ChevronRight, Crown, Calendar,
  TrendingUp, TrendingDown, DollarSign, Receipt, X, Pencil,
  BarChart2, ListOrdered
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useAssinatura } from '../contexts/AssinaturaContext'
import { UpgradeModal, ProBadge } from '../components/common/UpgradeBlock'
import { format, startOfMonth, endOfMonth, addMonths, subMonths, eachMonthOfInterval, startOfYear, endOfYear } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import BarChart, { HBarChart } from '../components/charts/BarChart'
import DonutChart from '../components/charts/DonutChart'
import { useToast } from '../contexts/ToastContext'

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
  doc.text('NailPro — Relatório Financeiro', 14, 18)
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
  doc.text(`Receita recebida: R$ ${recebido.toFixed(2)}`, 14, 45)
  doc.text(`A receber: R$ ${pendente.toFixed(2)}`, 14, 51)
  doc.text(`Total de despesas: R$ ${totalDespesas.toFixed(2)}`, 14, 57)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(lucro >= 0 ? 21 : 185, lucro >= 0 ? 128 : 28, lucro >= 0 ? 61 : 28)
  doc.text(`LUCRO LÍQUIDO: R$ ${lucro.toFixed(2)}`, 14, 64)
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'normal')
  doc.text(`Ticket médio: R$ ${ticket.toFixed(2)} (${qtd} atendimentos)`, 14, 71)

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
        `R$ ${p.valor.toFixed(2)}`,
        p.status === 'pago' ? 'Pago' : 'Pendente',
      ]),
      foot: [[
        '', '', '', 'TOTAL RECEBIDO',
        `R$ ${totalPago.toFixed(2)}`,
        totalPendente > 0 ? `+ R$ ${totalPendente.toFixed(2)} pend.` : '',
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
        `R$ ${d.valor.toFixed(2)}`,
      ]),
      foot: [['', '', 'TOTAL DESPESAS', `R$ ${totalDespesas.toFixed(2)}`]],
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [185, 28, 28] },
      footStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', fontSize: 9 },
    })

    const finalYDespesas = doc.lastAutoTable?.finalY || 90
    const margemFinal = recebido > 0 ? ((lucro / recebido) * 100).toFixed(1) : '0.0'
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(lucro >= 0 ? 21 : 185, lucro >= 0 ? 128 : 28, lucro >= 0 ? 61 : 28)
    doc.text(`LUCRO LÍQUIDO DO PERÍODO: R$ ${lucro.toFixed(2)} (margem ${margemFinal}%)`, 14, finalYDespesas + 12)
    doc.setTextColor(0, 0, 0)
  }

  doc.save(`nailpro-financeiro-${periodoLabel.replace(/[^\w]/g, '-').toLowerCase()}.pdf`)
}

async function exportarPDFAnual(userId, ano) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  // Buscar todos os dados do ano
  const inicio = `${ano}-01-01`
  const fim = `${ano}-12-31`

  const [{ data: pags }, { data: desps }] = await Promise.all([
    supabase.from('pagamentos')
      .select('data, valor, status, forma, agendamentos(servico, clientes(nome))')
      .eq('user_id', userId).eq('status', 'pago')
      .gte('data', inicio).lte('data', fim),
    supabase.from('despesas').select('*').eq('user_id', userId).gte('data', inicio).lte('data', fim),
  ])

  const doc = new jsPDF()
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text(`NailPro — Relatório Anual ${ano}`, 14, 18)

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
      `R$ ${receita.toFixed(2)}`,
      `R$ ${despesa.toFixed(2)}`,
      `R$ ${lucro.toFixed(2)}`,
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
  doc.text(`RECEITA TOTAL: R$ ${totalReceita.toFixed(2)}`, 14, 38)
  doc.text(`DESPESA TOTAL: R$ ${totalDespesa.toFixed(2)}`, 14, 45)
  doc.setTextColor(totalLucro >= 0 ? 21 : 185, totalLucro >= 0 ? 128 : 28, totalLucro >= 0 ? 61 : 28)
  doc.text(`LUCRO LÍQUIDO: R$ ${totalLucro.toFixed(2)}`, 14, 52)
  doc.setTextColor(0, 0, 0)

  autoTable(doc, {
    startY: 60,
    head: [['Mês', 'Receita', 'Despesas', 'Lucro', 'Margem']],
    body: linhasMeses,
    foot: [['TOTAL ANUAL', `R$ ${totalReceita.toFixed(2)}`, `R$ ${totalDespesa.toFixed(2)}`, `R$ ${totalLucro.toFixed(2)}`, totalReceita > 0 ? `${((totalLucro / totalReceita) * 100).toFixed(1)}%` : '—']],
    styles: { fontSize: 10, cellPadding: 4 },
    headStyles: { fillColor: [139, 38, 85], fontSize: 10 },
    footStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [251, 246, 248] },
  })

  doc.save(`nailpro-relatorio-anual-${ano}.pdf`)
}

export default function Financeiro() {
  const { user } = useAuth()
  const { temAcesso } = useAssinatura()
  const { erro: toastErro, sucesso, confirmar } = useToast()
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [pagamentos, setPagamentos] = useState([])
  const [despesas, setDespesas] = useState([])
  const [pagamentos6m, setPagamentos6m] = useState([])
  const [agendamentosMes, setAgendamentosMes] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [showDespesaModal, setShowDespesaModal] = useState(false)
  const [editandoDespesa, setEditandoDespesa] = useState(null)
  const [agendamentos, setAgendamentos] = useState([])
  const [form, setForm] = useState({ agendamento_id: '', valor: '', status: 'pendente', forma: 'pix', data: format(new Date(), 'yyyy-MM-dd') })
  const [formDespesa, setFormDespesa] = useState({ descricao: '', categoria: 'produtos', valor: '', data: format(new Date(), 'yyyy-MM-dd'), forma_pagamento: 'pix', recorrente: false, observacoes: '' })
  const [saving, setSaving] = useState(false)
  const [savingDespesa, setSavingDespesa] = useState(false)
  const [filtro, setFiltro] = useState('todos')
  const [periodoSel, setPeriodoSel] = useState(new Date())
  const [exportando, setExportando] = useState(false)
  const [exportandoAnual, setExportandoAnual] = useState(false)
  const [tab, setTab] = useState('resumo')

  useEffect(() => { if (user) { loadPagamentos(); loadAgendamentos(); loadDespesas() } }, [user, periodoSel])

  // Fechar modais com Escape
  useEffect(() => {
    const handler = (e) => {
      if (e.key !== 'Escape') return
      if (showDespesaModal) { fecharDespesaModal(); return }
      if (showModal) { setShowModal(false); return }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [showModal, showDespesaModal])

  async function loadPagamentos() {
    const inicio = format(startOfMonth(periodoSel), 'yyyy-MM-dd')
    const fim = format(endOfMonth(periodoSel), 'yyyy-MM-dd')
    const { data } = await supabase.from('pagamentos').select('*, agendamentos(servico, clientes(nome))').eq('user_id', user.id).gte('data', inicio).lte('data', fim).order('data', { ascending: false })
    setPagamentos(data || [])

    const inicio6m = format(startOfMonth(subMonths(periodoSel, 5)), 'yyyy-MM-dd')
    const { data: data6m } = await supabase.from('pagamentos')
      .select('data, valor, status').eq('user_id', user.id).eq('status', 'pago')
      .gte('data', inicio6m).lte('data', fim)
    setPagamentos6m(data6m || [])

    const { data: ags } = await supabase.from('agendamentos')
      .select('servico, valor').eq('user_id', user.id)
      .gte('data', inicio).lte('data', fim).neq('status', 'cancelado')
    setAgendamentosMes(ags || [])
  }

  async function loadDespesas() {
    const inicio = format(startOfMonth(periodoSel), 'yyyy-MM-dd')
    const fim = format(endOfMonth(periodoSel), 'yyyy-MM-dd')
    const { data } = await supabase.from('despesas')
      .select('*').eq('user_id', user.id)
      .gte('data', inicio).lte('data', fim).order('data', { ascending: false })
    setDespesas(data || [])
  }

  async function loadAgendamentos() {
    const { data } = await supabase.from('agendamentos').select('id, servico, data, clientes(nome)').eq('user_id', user.id).order('data', { ascending: false }).limit(50)
    setAgendamentos(data || [])
  }

  async function salvarPagamento() {
    if (!form.valor) return
    setSaving(true)
    await supabase.from('pagamentos').insert({ ...form, user_id: user.id, valor: parseFloat(form.valor) })
    setSaving(false)
    setShowModal(false)
    setForm({ agendamento_id: '', valor: '', status: 'pendente', forma: 'pix', data: format(new Date(), 'yyyy-MM-dd') })
    loadPagamentos()
    sucesso('Pagamento registrado ✓')
  }

  async function salvarDespesa() {
    if (!formDespesa.descricao || !formDespesa.valor) {
      toastErro('Preencha descrição e valor')
      return
    }
    setSavingDespesa(true)
    const dados = {
      user_id: user.id,
      descricao: formDespesa.descricao,
      categoria: formDespesa.categoria,
      valor: parseFloat(formDespesa.valor),
      data: formDespesa.data,
      forma_pagamento: formDespesa.forma_pagamento || null,
      recorrente: formDespesa.recorrente,
      observacoes: formDespesa.observacoes || null,
    }
    const resp = editandoDespesa
      ? await supabase.from('despesas').update(dados).eq('id', editandoDespesa.id)
      : await supabase.from('despesas').insert(dados)
    setSavingDespesa(false)
    if (resp.error) {
      toastErro('Erro: ' + resp.error.message)
      return
    }
    sucesso(editandoDespesa ? 'Despesa atualizada ✓' : 'Despesa registrada ✓')
    fecharDespesaModal()
    loadDespesas()
  }

  function abrirNovaDespesa() {
    setEditandoDespesa(null)
    setFormDespesa({ descricao: '', categoria: 'produtos', valor: '', data: format(new Date(), 'yyyy-MM-dd'), forma_pagamento: 'pix', recorrente: false, observacoes: '' })
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
      observacoes: despesa.observacoes || '',
    })
    setShowDespesaModal(true)
  }

  function fecharDespesaModal() {
    setShowDespesaModal(false)
    setEditandoDespesa(null)
    setFormDespesa({ descricao: '', categoria: 'produtos', valor: '', data: format(new Date(), 'yyyy-MM-dd'), forma_pagamento: 'pix', recorrente: false, observacoes: '' })
  }

  async function excluirDespesa(despesa) {
    const ok = await confirmar({
      titulo: 'Excluir esta despesa?',
      mensagem: `${despesa.descricao} - R$ ${despesa.valor.toFixed(2)}`,
      confirmarLabel: 'Sim, excluir',
      tipo: 'perigo',
    })
    if (!ok) return
    await supabase.from('despesas').delete().eq('id', despesa.id)
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

  async function togglePago(pag) {
    await supabase.from('pagamentos').update({ status: pag.status === 'pago' ? 'pendente' : 'pago' }).eq('id', pag.id)
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
    try { await exportarPDFAnual(user.id, periodoSel.getFullYear()) }
    catch (e) { toastErro('Erro ao gerar PDF anual') }
    setExportandoAnual(false)
  }

  // ─── Calculos ───
  const recebido = pagamentos.filter(p => p.status === 'pago').reduce((s, p) => s + p.valor, 0)
  const pendente = pagamentos.filter(p => p.status === 'pendente').reduce((s, p) => s + p.valor, 0)
  const qtdPagos = pagamentos.filter(p => p.status === 'pago').length
  const ticketMedio = qtdPagos > 0 ? recebido / qtdPagos : 0
  const totalDespesas = despesas.reduce((s, d) => s + d.valor, 0)
  const lucro = recebido - totalDespesas
  const margemLucro = recebido > 0 ? (lucro / recebido) * 100 : 0
  const filtrados = filtro === 'todos' ? pagamentos : pagamentos.filter(p => p.status === filtro)
  const periodoLabel = format(periodoSel, "MMMM 'de' yyyy", { locale: ptBR })

  // Gráficos
  const meses6 = eachMonthOfInterval({ start: subMonths(periodoSel, 5), end: periodoSel })
  const dadosReceita6m = meses6.map(mes => {
    const ini = format(startOfMonth(mes), 'yyyy-MM-dd')
    const fim = format(endOfMonth(mes), 'yyyy-MM-dd')
    const total = pagamentos6m.filter(p => p.data >= ini && p.data <= fim).reduce((s, p) => s + (p.valor || 0), 0)
    return { label: format(mes, 'MMM', { locale: ptBR }), valor: total }
  })

  const servicosMap = {}
  agendamentosMes.forEach(a => {
    if (!a.servico) return
    if (!servicosMap[a.servico]) servicosMap[a.servico] = { qtd: 0, valor: 0 }
    servicosMap[a.servico].qtd += 1
    servicosMap[a.servico].valor += a.valor || 0
  })
  const topServicos = Object.entries(servicosMap)
    .map(([nome, v]) => ({ label: nome, valor: v.valor, qtd: v.qtd }))
    .sort((a, b) => b.valor - a.valor).slice(0, 5)

  const FORMA_LABEL = { pix: 'Pix', dinheiro: 'Dinheiro', cartao_debito: 'Débito', cartao_credito: 'Crédito' }
  const FORMA_COR = { pix: '#15803D', dinheiro: '#D4AF37', cartao_debito: '#3B82F6', cartao_credito: '#8B2655' }
  const formaMap = {}
  pagamentos.filter(p => p.status === 'pago').forEach(p => {
    formaMap[p.forma] = (formaMap[p.forma] || 0) + (p.valor || 0)
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

  return (
    <div style={s.page}>
      {/* Navegação de período */}
      <div style={s.periodoNav}>
        <button style={s.navBtn} onClick={() => setPeriodoSel(subMonths(periodoSel, 1))}><ChevronLeft size={18} /></button>
        <div style={s.periodoLabel}>{periodoLabel}</div>
        <button style={s.navBtn} onClick={() => setPeriodoSel(addMonths(periodoSel, 1))}><ChevronRight size={18} /></button>
        <button style={s.exportBtn} onClick={handleExportarPDF} disabled={exportando} title="PDF do mês">
          <FileDown size={14} />
          {exportando ? '...' : 'Mês'}
          {!temAcesso('exportPDF') && <ProBadge />}
        </button>
        <button style={s.exportBtnAnual} onClick={handleExportarAnual} disabled={exportandoAnual} title="PDF anual">
          <Calendar size={14} />
          {exportandoAnual ? '...' : `Ano ${periodoSel.getFullYear()}`}
          {!temAcesso('exportPDF') && <ProBadge />}
        </button>
      </div>

      {/* ── Tabs ── */}
      <div style={tabs.bar}>
        {[
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
        })}
      </div>

      {/* ── ABA: Resumo ── */}
      {tab === 'resumo' && (
        <div style={s.tabContent}>
          {/* KPIs */}
          <div style={s.grid4}>
            <div style={{ ...s.card, borderTop: '3px solid var(--green)' }}>
              <div style={s.cardLabel}><DollarSign size={11} /> Recebido</div>
              <div style={{ ...s.cardValue, color: 'var(--green)' }}>R$ {recebido.toFixed(0)}</div>
              <div style={s.cardSub}>{qtdPagos} pagamento{qtdPagos !== 1 ? 's' : ''}</div>
            </div>
            <div style={{ ...s.card, borderTop: '3px solid #B91C1C' }}>
              <div style={s.cardLabel}><Receipt size={11} /> Despesas</div>
              <div style={{ ...s.cardValue, color: '#B91C1C' }}>R$ {totalDespesas.toFixed(0)}</div>
              <div style={s.cardSub}>{despesas.length} lançamento{despesas.length !== 1 ? 's' : ''}</div>
            </div>
            <div style={{ ...s.card, borderTop: `3px solid ${pendente > 0 ? 'var(--amber)' : 'var(--border2)'}` }}>
              <div style={s.cardLabel}>⏰ A receber</div>
              <div style={{ ...s.cardValue, color: pendente > 0 ? 'var(--amber)' : 'var(--text3)' }}>R$ {pendente.toFixed(0)}</div>
              <div style={s.cardSub}>{pagamentos.filter(p => p.status === 'pendente').length} pendente{pagamentos.filter(p => p.status === 'pendente').length !== 1 ? 's' : ''}</div>
            </div>
            <div style={{ ...s.card, borderTop: `3px solid ${lucro >= 0 ? 'var(--gold, #D4AF37)' : '#B91C1C'}`, background: lucro >= 0 ? 'linear-gradient(135deg, #FEFCE8, var(--surface))' : 'linear-gradient(135deg, #FEF2F2, var(--surface))' }}>
              <div style={s.cardLabel}>{lucro >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />} Lucro líquido</div>
              <div style={{ ...s.cardValue, color: lucro >= 0 ? 'var(--gold, #B7791F)' : '#B91C1C' }}>R$ {lucro.toFixed(0)}</div>
              <div style={s.cardSub}>{margemLucro.toFixed(0)}% de margem</div>
            </div>
          </div>

          {/* DRE */}
          <div style={s.dreCard}>
            <div style={s.dreTitulo}>📊 DRE — {periodoLabel}</div>
            <div style={s.dreLinha}>
              <span>(+) Receitas recebidas</span>
              <span style={{ ...s.mono, color: 'var(--green)' }}>R$ {recebido.toFixed(2)}</span>
            </div>
            <div style={s.dreLinha}>
              <span>(−) Despesas totais</span>
              <span style={{ ...s.mono, color: '#B91C1C' }}>− R$ {totalDespesas.toFixed(2)}</span>
            </div>
            <div style={s.dreDivider} />
            <div style={{ ...s.dreLinha, ...s.dreTotal }}>
              <span>(=) Lucro líquido</span>
              <span style={{ ...s.mono, color: lucro >= 0 ? 'var(--green)' : '#B91C1C', fontSize: 16 }}>R$ {lucro.toFixed(2)}</span>
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
          </div>
        </div>
      )}

      {/* ── ABA: Análises ── */}
      {tab === 'analises' && (
        <div style={s.tabContent}>
          <div style={s.graficosGrid}>
            <div style={s.graficoCard}>
              <div style={s.graficoTitulo}>Receita dos últimos 6 meses</div>
              <BarChart data={dadosReceita6m} cor="#15803D" prefixo="R$ " height={160} />
            </div>

            {dadosDespesas.length > 0 && (
              <div style={s.graficoCard}>
                <div style={s.graficoTitulo}>Despesas por categoria</div>
                <DonutChart data={dadosDespesas} size={160} centerLabel={`R$ ${totalDespesas.toFixed(0)}`} centerSub="total" />
              </div>
            )}

            <div style={s.graficoCard}>
              <div style={s.graficoTitulo}>Como você recebeu</div>
              {dadosFormas.length === 0
                ? <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 13, padding: 30 }}>Sem dados</div>
                : <DonutChart data={dadosFormas} size={160} centerLabel={`R$ ${recebido.toFixed(0)}`} centerSub="recebido" />
              }
            </div>

            <div style={{ ...s.graficoCard, gridColumn: '1 / -1' }}>
              <div style={s.graficoTitulo}>Top serviços do mês (por receita)</div>
              <HBarChart data={topServicos} cor="var(--pink)" formatValor={(v) => `R$ ${v.toFixed(0)}`} />
            </div>
          </div>
        </div>
      )}

      {/* ── ABA: Receitas ── */}
      {tab === 'receitas' && (
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

          <div style={s.filtros}>
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
                      R$ {(p.valor ?? 0).toFixed(2).replace('.', ',')}
                    </div>
                    <button style={{ ...s.statusBtn, ...(pago ? s.statusPago : s.statusPendente) }} onClick={() => togglePago(p)}>
                      {pago ? '✓ Pago' : '⏳ Pendente'}
                    </button>
                  </div>
                </div>
              )
            })
          }
        </div>
      )}

      {/* ── ABA: Despesas ── */}
      {tab === 'despesas' && (
        <div style={s.tabContent}>
          <div style={s.colHeader}>
            <div style={s.colTitulo}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#B91C1C' }} />
              Despesas ({despesas.length})
            </div>
            <button style={s.addBtnSmall} onClick={abrirNovaDespesa}>
              <Plus size={13} /> Despesa
            </button>
          </div>

          {despesas.length === 0
            ? <div style={s.empty}>Nenhuma despesa registrada</div>
            : despesas.map(d => {
              const cat = CATEGORIAS.find(c => c.id === d.categoria)
              return (
                <div key={d.id} style={s.finCard}>
                  <div style={{ ...s.catBadge, background: (cat?.cor || '#888') + '22', color: cat?.cor || '#888' }}>
                    {cat?.icon || '📦'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={s.finNome}>{d.descricao}</div>
                    <div style={s.finSub}>
                      {cat?.label || d.categoria} · {format(new Date(d.data + 'T12:00:00'), 'dd/MM', { locale: ptBR })}
                      {d.recorrente && ' · 🔁 mensal'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ ...s.finValor, color: '#B91C1C' }}>− R$ {(d.valor ?? 0).toFixed(2).replace('.', ',')}</div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 4, justifyContent: 'flex-end' }}>
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
        <div style={s.overlay} onClick={() => setShowModal(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
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
            <div style={s.row}>
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
          </div>
        </div>
      )}

      {/* Modal Despesa */}
      {showDespesaModal && (
        <div style={s.overlay} onClick={fecharDespesaModal}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalTitle}>{editandoDespesa ? '✏️ Editar despesa' : '📉 Nova despesa'}</div>
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
            <div style={s.row}>
              <div style={{ ...s.field, flex: 1 }}>
                <label style={s.label}>Valor (R$) *</label>
                <input style={{ ...s.input, fontFamily: "'JetBrains Mono', monospace" }} type="number" step="0.01" placeholder="0,00" value={formDespesa.valor} onChange={e => setFormDespesa({ ...formDespesa, valor: e.target.value })} />
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
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text2)', cursor: 'pointer' }}>
              <input type="checkbox" checked={formDespesa.recorrente} onChange={e => setFormDespesa({ ...formDespesa, recorrente: e.target.checked })} />
              🔁 Despesa mensal recorrente
            </label>
            <div style={s.field}>
              <label style={s.label}>Observações</label>
              <input style={s.input} placeholder="Opcional..." value={formDespesa.observacoes} onChange={e => setFormDespesa({ ...formDespesa, observacoes: e.target.value })} />
            </div>
            <button style={s.btnPrimary} onClick={salvarDespesa} disabled={savingDespesa}>{savingDespesa ? 'Salvando...' : editandoDespesa ? 'Salvar alterações' : 'Registrar despesa'}</button>
            <button style={s.btnSecondary} onClick={fecharDespesaModal}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}

const s = {
  page: { padding: 16, paddingBottom: 80 },
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
  statusPago: { background: 'var(--green-bg)', color: 'var(--green)' },
  statusPendente: { background: 'var(--amber-bg)', color: 'var(--amber)' },
  miniIconBtn: { width: 22, height: 22, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  empty: { color: 'var(--text3)', fontSize: 13, textAlign: 'center', padding: '24px 0', background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border2)' },
  /* Modal */
  overlay: { position: 'fixed', inset: 0, background: 'rgba(24,7,18,0.52)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
  modal: { background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '90vh', overflowY: 'auto' },
  modalTitle: { fontSize: 17, fontWeight: 700, marginBottom: 4 },
  field: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: { fontSize: 12, fontWeight: 600, color: 'var(--text2)' },
  input: { padding: '10px 13px', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', fontSize: 14, background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit' },
  row: { display: 'flex', gap: 10 },
  btnPrimary: { background: 'var(--pink)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', padding: '13px', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 4, boxShadow: 'var(--shadow-pink)', transition: 'background 0.15s' },
  btnSecondary: { background: 'var(--surface2)', color: 'var(--text2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', padding: '12px', fontSize: 14, fontWeight: 500, cursor: 'pointer' },
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
