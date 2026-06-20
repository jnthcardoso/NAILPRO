import { format, startOfMonth, endOfMonth, eachMonthOfInterval } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { formatMoeda } from './formatters'

const COR = {
  receita:  [21, 128, 61],
  despesa:  [185, 28, 28],
  primaria: [139, 38, 85],
  rodape:   [30, 41, 59],
  linhaAlt: [251, 246, 248],
}

const FORMA_LABEL_PDF = {
  pix: 'Pix', dinheiro: 'Dinheiro',
  cartao_debito: 'Débito', cartao_credito: 'Crédito', boleto: 'Boleto',
}

const FILTRO_DESPESA_LABEL = {
  todas: 'Todas', salao: 'Do salão', pessoal: 'Pessoal', a_pagar: 'A pagar',
  salao_pago: 'Salão — pagas', salao_apagar: 'Salão — a pagar',
  pessoal_pago: 'Pessoal — pagas', pessoal_apagar: 'Pessoal — a pagar',
  recorrentes: 'Recorrentes', preencher: 'A preencher',
}

async function carregarJsPDF() {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  return { jsPDF, autoTable }
}

function cabecalho(doc, titulo, subtitulo) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(titulo, 14, 18)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.text(subtitulo, 14, 27)
}

function slugPeriodo(label) {
  return label.replace(/[^\w]/g, '-').toLowerCase()
}

function corLucro(lucro) {
  return lucro >= 0 ? COR.receita : COR.despesa
}

function catLabel(categorias, id) {
  return categorias?.find(c => c.id === id)?.label || 'Categoria removida'
}

export async function exportarPDFMensal(pagamentos, despesas, periodoLabel, categorias) {
  const { jsPDF, autoTable } = await carregarJsPDF()
  const doc = new jsPDF()
  cabecalho(doc, 'Lumen — Relatório Financeiro', periodoLabel)

  const pagos = pagamentos.filter(p => p.status === 'pago')
  const recebido = pagos.reduce((s, p) => s + p.valor, 0)
  const pendente = pagamentos.filter(p => p.status === 'pendente').reduce((s, p) => s + p.valor, 0)
  const qtd = pagos.length
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
  doc.setTextColor(...corLucro(lucro))
  doc.text(`LUCRO LÍQUIDO: R$ ${formatMoeda(lucro)}`, 14, 64)
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'normal')
  doc.text(`Ticket médio: R$ ${formatMoeda(ticket)} (${qtd} atendimentos)`, 14, 71)

  if (pagamentos.length) {
    autoTable(doc, {
      startY: 78,
      head: [['Data', 'Cliente', 'Serviço', 'Forma', 'Valor', 'Status']],
      body: pagamentos.map(p => [
        format(new Date(p.data + 'T12:00:00'), 'dd/MM/yyyy'),
        p.agendamentos?.clientes?.nome || '—',
        p.agendamentos?.servico || '—',
        FORMA_LABEL_PDF[p.forma] || p.forma,
        `R$ ${formatMoeda(p.valor)}`,
        p.status === 'pago' ? 'Pago' : 'Pendente',
      ]),
      foot: [['', '', '', 'TOTAL RECEBIDO', `R$ ${formatMoeda(recebido)}`, pendente > 0 ? `+ R$ ${formatMoeda(pendente)} pend.` : '']],
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: COR.primaria },
      footStyles: { fillColor: COR.rodape, textColor: 255, fontStyle: 'bold', fontSize: 9 },
      didDrawPage: (data) => {
        if (data.pageNumber === 1) {
          doc.setFontSize(11)
          doc.setFont('helvetica', 'bold')
          doc.text('RECEITAS', 14, 76)
        }
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
        catLabel(categorias, d.categoria),
        d.descricao,
        `R$ ${formatMoeda(d.valor)}`,
      ]),
      foot: [['', '', 'TOTAL DESPESAS', `R$ ${formatMoeda(totalDespesas)}`]],
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: COR.despesa },
      footStyles: { fillColor: COR.rodape, textColor: 255, fontStyle: 'bold', fontSize: 9 },
    })

    const finalYDespesas = doc.lastAutoTable?.finalY || 90
    const margemFinal = recebido > 0 ? ((lucro / recebido) * 100).toFixed(1) : '0.0'
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...corLucro(lucro))
    doc.text(`LUCRO LÍQUIDO DO PERÍODO: R$ ${formatMoeda(lucro)} (margem ${margemFinal}%)`, 14, finalYDespesas + 12)
    doc.setTextColor(0, 0, 0)
  }

  doc.save(`lumen-financeiro-${slugPeriodo(periodoLabel)}.pdf`)
}

// Recebe os dados já buscados — a query fica em Financeiro.jsx (precisa de salaoId/userId).
export async function exportarPDFAnual(pags, desps, ano) {
  const { jsPDF, autoTable } = await carregarJsPDF()
  const doc = new jsPDF()
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text(`Lumen — Relatório Anual ${ano}`, 14, 18)

  const meses = eachMonthOfInterval({ start: new Date(ano, 0, 1), end: new Date(ano, 11, 31) })
  const linhasMeses = meses.map(m => {
    const ini = format(startOfMonth(m), 'yyyy-MM-dd')
    const fimM = format(endOfMonth(m), 'yyyy-MM-dd')
    const receita = pags.filter(p => p.data >= ini && p.data <= fimM).reduce((s, p) => s + p.valor, 0)
    const despesa = desps.filter(d => d.data >= ini && d.data <= fimM).reduce((s, d) => s + d.valor, 0)
    const lucro = receita - despesa
    return [
      format(m, 'MMMM', { locale: ptBR }),
      `R$ ${formatMoeda(receita)}`,
      `R$ ${formatMoeda(despesa)}`,
      `R$ ${formatMoeda(lucro)}`,
      receita > 0 ? `${((lucro / receita) * 100).toFixed(1)}%` : '—',
    ]
  })

  const totalReceita = pags.reduce((s, p) => s + p.valor, 0)
  const totalDespesa = desps.reduce((s, d) => s + d.valor, 0)
  const totalLucro = totalReceita - totalDespesa

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text(`Período: Janeiro a Dezembro de ${ano}`, 14, 27)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text(`RECEITA TOTAL: R$ ${formatMoeda(totalReceita)}`, 14, 38)
  doc.text(`DESPESA TOTAL: R$ ${formatMoeda(totalDespesa)}`, 14, 45)
  doc.setTextColor(...corLucro(totalLucro))
  doc.text(`LUCRO LÍQUIDO: R$ ${formatMoeda(totalLucro)}`, 14, 52)
  doc.setTextColor(0, 0, 0)

  autoTable(doc, {
    startY: 60,
    head: [['Mês', 'Receita', 'Despesas', 'Lucro', 'Margem']],
    body: linhasMeses,
    foot: [['TOTAL ANUAL', `R$ ${formatMoeda(totalReceita)}`, `R$ ${formatMoeda(totalDespesa)}`, `R$ ${formatMoeda(totalLucro)}`, totalReceita > 0 ? `${((totalLucro / totalReceita) * 100).toFixed(1)}%` : '—']],
    styles: { fontSize: 10, cellPadding: 4 },
    headStyles: { fillColor: COR.primaria, fontSize: 10 },
    footStyles: { fillColor: COR.rodape, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: COR.linhaAlt },
  })

  doc.save(`lumen-relatorio-anual-${ano}.pdf`)
}

export async function exportarPDFResumo({ periodoLabel, recebido, pendente, qtdPagos, totalDespesasSalao, salaoPagas, salaoAPagar, totalDespesasPessoal, proLabore, mostraProLabore, lucro, margemLucro, despesasSalaoArr, salaoPagasArr, salaoAPagarArr, categorias }) {
  const { jsPDF, autoTable } = await carregarJsPDF()
  const doc = new jsPDF()
  cabecalho(doc, 'Lumen — DRE / Resumo Financeiro', periodoLabel)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('INDICADORES DO PERÍODO', 14, 38)
  doc.setFont('helvetica', 'normal')
  doc.text(`Receita recebida: R$ ${formatMoeda(recebido)} (${qtdPagos} pagamentos)`, 14, 45)
  doc.text(`A receber: R$ ${formatMoeda(pendente)}`, 14, 51)
  doc.text(`Despesas do salão: R$ ${formatMoeda(totalDespesasSalao)}`, 14, 57)
  if (totalDespesasPessoal > 0) doc.text(`Gastos pessoais: R$ ${formatMoeda(totalDespesasPessoal)}`, 14, 63)

  const dreY = totalDespesasPessoal > 0 ? 74 : 68
  doc.setFont('helvetica', 'bold')
  doc.text('DRE — DEMONSTRATIVO DE RESULTADO', 14, dreY)
  const dreLinhas = [
    ['(+) Receitas recebidas', `R$ ${formatMoeda(recebido)}`],
    salaoAPagar > 0
      ? ['(−) Despesas do salão — pagas', `R$ ${formatMoeda(salaoPagas)}`]
      : ['(−) Despesas do salão', `R$ ${formatMoeda(totalDespesasSalao)}`],
  ]
  if (salaoAPagar > 0) dreLinhas.push(['(−) Contas a pagar (vai sair)', `R$ ${formatMoeda(salaoAPagar)}`])
  if (mostraProLabore && proLabore > 0) dreLinhas.push(['(−) Pró-labore (seu salário)', `R$ ${formatMoeda(proLabore)}`])
  dreLinhas.push(['(=) Lucro líquido', `R$ ${formatMoeda(lucro)}`])
  dreLinhas.push(['Margem de lucro', `${margemLucro.toFixed(1)}%`])

  autoTable(doc, {
    startY: dreY + 4,
    body: dreLinhas,
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
    didParseCell: (data) => {
      if (data.row.index === dreLinhas.length - 2) {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fillColor = lucro >= 0 ? [220, 252, 231] : [254, 226, 226]
      }
    },
  })

  const allDespSalao = salaoAPagar > 0 ? [...salaoPagasArr, ...salaoAPagarArr] : despesasSalaoArr
  if (allDespSalao.length) {
    const yDesp = doc.lastAutoTable.finalY + 10
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('DESPESAS DO SALÃO', 14, yDesp)
    autoTable(doc, {
      startY: yDesp + 4,
      head: [['Data', 'Categoria', 'Descrição', 'Valor', 'Status']],
      body: allDespSalao.map(d => [
        format(new Date(d.data + 'T12:00:00'), 'dd/MM/yyyy'),
        catLabel(categorias, d.categoria),
        d.descricao,
        `R$ ${formatMoeda(d.valor)}`,
        d.pago === false ? 'A pagar' : 'Paga',
      ]),
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: COR.primaria },
    })
  }

  doc.save(`lumen-resumo-${slugPeriodo(periodoLabel)}.pdf`)
}

export async function exportarPDFReceitas(filtrados, periodoLabel, filtro) {
  const { jsPDF, autoTable } = await carregarJsPDF()
  const doc = new jsPDF()
  cabecalho(doc, 'Lumen — Receitas', `${periodoLabel}${filtro !== 'todos' ? ` · Filtro: ${filtro === 'pago' ? 'Pagos' : 'Pendentes'}` : ''}`)

  const totalPago = filtrados.filter(p => p.status === 'pago').reduce((s, p) => s + p.valor, 0)
  const totalPendente = filtrados.filter(p => p.status === 'pendente').reduce((s, p) => s + p.valor, 0)
  doc.setFontSize(10)
  doc.text(`Total recebido: R$ ${formatMoeda(totalPago)}  |  A receber: R$ ${formatMoeda(totalPendente)}`, 14, 35)

  autoTable(doc, {
    startY: 40,
    head: [['Data', 'Cliente', 'Serviço', 'Forma', 'Valor', 'Status']],
    body: filtrados.map(p => [
      format(new Date(p.data + 'T12:00:00'), 'dd/MM/yyyy'),
      p.agendamentos?.clientes?.nome || '—',
      p.agendamentos?.servico || '—',
      FORMA_LABEL_PDF[p.forma] || p.forma || '—',
      `R$ ${formatMoeda(p.valor)}`,
      p.status === 'pago' ? 'Pago' : 'Pendente',
    ]),
    foot: [['', '', '', 'TOTAL RECEBIDO', `R$ ${formatMoeda(totalPago)}`, totalPendente > 0 ? `+ R$ ${formatMoeda(totalPendente)} pend.` : '']],
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: COR.receita },
    footStyles: { fillColor: COR.rodape, textColor: 255, fontStyle: 'bold', fontSize: 9 },
  })

  doc.save(`lumen-receitas-${slugPeriodo(periodoLabel)}.pdf`)
}

export async function exportarPDFDespesas(despesasVisiveis, periodoLabel, filtroDespesa, categorias) {
  const { jsPDF, autoTable } = await carregarJsPDF()
  const doc = new jsPDF()
  const filtroLabel = FILTRO_DESPESA_LABEL[filtroDespesa] || 'Todas'
  cabecalho(doc, 'Lumen — Despesas', `${periodoLabel} · Filtro: ${filtroLabel}`)

  const total = despesasVisiveis.reduce((s, d) => s + (d.valor || 0), 0)
  doc.setFontSize(10)
  doc.text(`Total: R$ ${formatMoeda(total)} (${despesasVisiveis.length} lançamentos)`, 14, 35)

  autoTable(doc, {
    startY: 40,
    head: [['Data', 'Categoria', 'Descrição', 'Bolso', 'Valor', 'Status']],
    body: despesasVisiveis.map(d => [
      format(new Date(d.data + 'T12:00:00'), 'dd/MM/yyyy'),
      catLabel(categorias, d.categoria),
      d.descricao,
      d.tipo === 'pessoal' ? 'Pessoal' : 'Salão',
      `R$ ${formatMoeda(d.valor)}`,
      d.pago === false ? 'A pagar' : 'Paga',
    ]),
    foot: [['', '', '', '', `R$ ${formatMoeda(total)}`, '']],
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: COR.despesa },
    footStyles: { fillColor: COR.rodape, textColor: 255, fontStyle: 'bold', fontSize: 9 },
  })

  doc.save(`lumen-despesas-${slugPeriodo(periodoLabel)}.pdf`)
}

export async function exportarPDFAnalises({ periodoLabel, recebido, totalDespesasSalao, lucro, topServicos, dadosFormas, dadosDespesas }) {
  const { jsPDF, autoTable } = await carregarJsPDF()
  const doc = new jsPDF()
  cabecalho(doc, 'Lumen — Análises', periodoLabel)
  doc.setFontSize(10)
  doc.text(`Receita: R$ ${formatMoeda(recebido)}  |  Despesas: R$ ${formatMoeda(totalDespesasSalao)}  |  Lucro: R$ ${formatMoeda(lucro)}`, 14, 35)

  if (topServicos.length) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('TOP SERVIÇOS POR RECEITA', 14, 45)
    autoTable(doc, {
      startY: 49,
      head: [['Serviço', 'Atendimentos', 'Receita']],
      body: topServicos.map(s => [s.label, s.qtd, `R$ ${formatMoeda(s.valor)}`]),
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: COR.primaria },
    })
  }

  if (dadosFormas.length) {
    const y2 = (doc.lastAutoTable?.finalY || 49) + 10
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('FORMAS DE PAGAMENTO', 14, y2)
    autoTable(doc, {
      startY: y2 + 4,
      head: [['Forma', 'Valor']],
      body: dadosFormas.map(f => [f.label, `R$ ${formatMoeda(f.valor)}`]),
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: COR.receita },
    })
  }

  if (dadosDespesas.length) {
    const y3 = (doc.lastAutoTable?.finalY || 49) + 10
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('DESPESAS POR CATEGORIA', 14, y3)
    autoTable(doc, {
      startY: y3 + 4,
      head: [['Categoria', 'Valor']],
      body: dadosDespesas.map(d => [d.label, `R$ ${formatMoeda(d.valor)}`]),
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: COR.despesa },
    })
  }

  doc.save(`lumen-analises-${slugPeriodo(periodoLabel)}.pdf`)
}
