import { useEffect, useState } from 'react'
import { Plus, FileDown, ChevronLeft, ChevronRight, Crown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useAssinatura } from '../contexts/AssinaturaContext'
import { UpgradeModal, ProBadge } from '../components/common/UpgradeBlock'
import { format, startOfMonth, endOfMonth, addMonths, subMonths, eachMonthOfInterval } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import BarChart, { HBarChart } from '../components/charts/BarChart'
import DonutChart from '../components/charts/DonutChart'

async function exportarPDF(pagamentos, periodoLabel) {
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

  doc.setFontSize(10)
  doc.text(`Recebido: R$ ${recebido.toFixed(2).replace('.', ',')}   |   A receber: R$ ${pendente.toFixed(2).replace('.', ',')}   |   Ticket médio: R$ ${ticket.toFixed(2).replace('.', ',')}`, 14, 35)

  autoTable(doc, {
    startY: 42,
    head: [['Data', 'Cliente', 'Serviço', 'Forma', 'Valor', 'Status']],
    body: pagamentos.map(p => [
      format(new Date(p.data + 'T12:00:00'), 'dd/MM/yyyy'),
      p.agendamentos?.clientes?.nome || '—',
      p.agendamentos?.servico || '—',
      { pix: 'Pix', dinheiro: 'Dinheiro', cartao_debito: 'Débito', cartao_credito: 'Crédito' }[p.forma] || p.forma,
      `R$ ${p.valor.toFixed(2).replace('.', ',')}`,
      p.status === 'pago' ? 'Pago' : 'Pendente',
    ]),
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [139, 38, 85] },
    alternateRowStyles: { fillColor: [251, 246, 248] },
  })

  doc.save(`nailpro-financeiro-${periodoLabel.replace(/[^\w]/g, '-').toLowerCase()}.pdf`)
}

export default function Financeiro() {
  const { user } = useAuth()
  const { temAcesso } = useAssinatura()
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [pagamentos, setPagamentos] = useState([])
  const [pagamentos6m, setPagamentos6m] = useState([])
  const [agendamentosMes, setAgendamentosMes] = useState([])
  const [agendamentos, setAgendamentos] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ agendamento_id: '', valor: '', status: 'pendente', forma: 'pix', data: format(new Date(), 'yyyy-MM-dd') })
  const [saving, setSaving] = useState(false)
  const [filtro, setFiltro] = useState('todos')
  const [periodoSel, setPeriodoSel] = useState(new Date())
  const [exportando, setExportando] = useState(false)

  useEffect(() => { if (user) { loadPagamentos(); loadAgendamentos() } }, [user, periodoSel])

  async function loadPagamentos() {
    const inicio = format(startOfMonth(periodoSel), 'yyyy-MM-dd')
    const fim = format(endOfMonth(periodoSel), 'yyyy-MM-dd')
    const { data } = await supabase.from('pagamentos').select('*, agendamentos(servico, clientes(nome))').eq('user_id', user.id).gte('data', inicio).lte('data', fim).order('data', { ascending: false })
    setPagamentos(data || [])

    // Últimos 6 meses para gráfico de receita histórica
    const inicio6m = format(startOfMonth(subMonths(periodoSel, 5)), 'yyyy-MM-dd')
    const { data: data6m } = await supabase.from('pagamentos')
      .select('data, valor, status')
      .eq('user_id', user.id)
      .eq('status', 'pago')
      .gte('data', inicio6m).lte('data', fim)
    setPagamentos6m(data6m || [])

    // Agendamentos do mês para top serviços
    const { data: ags } = await supabase.from('agendamentos')
      .select('servico, valor')
      .eq('user_id', user.id)
      .gte('data', inicio).lte('data', fim)
      .neq('status', 'cancelado')
    setAgendamentosMes(ags || [])
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
  }

  async function togglePago(pag) {
    await supabase.from('pagamentos').update({ status: pag.status === 'pago' ? 'pendente' : 'pago' }).eq('id', pag.id)
    loadPagamentos()
  }

  async function handleExportarPDF() {
    // 🔒 Bloqueio: PDF é feature Pro
    if (!temAcesso('exportPDF')) {
      setShowUpgrade(true)
      return
    }
    setExportando(true)
    try {
      await exportarPDF(pagamentos, periodoLabel)
    } catch (e) {
      console.error('PDF export error:', e)
      alert('Erro ao gerar PDF. Tente novamente.')
    }
    setExportando(false)
  }

  const recebido = pagamentos.filter(p => p.status === 'pago').reduce((s, p) => s + p.valor, 0)
  const pendente = pagamentos.filter(p => p.status === 'pendente').reduce((s, p) => s + p.valor, 0)
  const qtdPagos = pagamentos.filter(p => p.status === 'pago').length
  const ticketMedio = qtdPagos > 0 ? recebido / qtdPagos : 0
  const filtrados = filtro === 'todos' ? pagamentos : pagamentos.filter(p => p.status === filtro)
  const periodoLabel = format(periodoSel, "MMMM 'de' yyyy", { locale: ptBR })

  // ─── Dados dos gráficos ───
  // 1. Receita últimos 6 meses (bar chart)
  const meses6 = eachMonthOfInterval({ start: subMonths(periodoSel, 5), end: periodoSel })
  const dadosReceita6m = meses6.map(mes => {
    const ini = format(startOfMonth(mes), 'yyyy-MM-dd')
    const fim = format(endOfMonth(mes), 'yyyy-MM-dd')
    const total = pagamentos6m
      .filter(p => p.data >= ini && p.data <= fim)
      .reduce((s, p) => s + (p.valor || 0), 0)
    return { label: format(mes, 'MMM', { locale: ptBR }), valor: total }
  })

  // 2. Top 5 serviços do mês (HBar)
  const servicosMap = {}
  agendamentosMes.forEach(a => {
    if (!a.servico) return
    if (!servicosMap[a.servico]) servicosMap[a.servico] = { qtd: 0, valor: 0 }
    servicosMap[a.servico].qtd += 1
    servicosMap[a.servico].valor += a.valor || 0
  })
  const topServicos = Object.entries(servicosMap)
    .map(([nome, v]) => ({ label: nome, valor: v.valor, qtd: v.qtd }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 5)

  // 3. Distribuição forma pagamento (donut)
  const FORMA_LABEL = { pix: 'Pix', dinheiro: 'Dinheiro', cartao_debito: 'Débito', cartao_credito: 'Crédito' }
  const FORMA_COR = { pix: '#15803D', dinheiro: '#D4AF37', cartao_debito: '#3B82F6', cartao_credito: '#8B2655' }
  const formaMap = {}
  pagamentos.filter(p => p.status === 'pago').forEach(p => {
    formaMap[p.forma] = (formaMap[p.forma] || 0) + (p.valor || 0)
  })
  const dadosFormas = Object.entries(formaMap).map(([forma, valor]) => ({
    label: FORMA_LABEL[forma] || forma,
    valor,
    cor: FORMA_COR[forma] || '#888',
  }))

  return (
    <div style={s.page}>
      {/* Navegação de período */}
      <div style={s.periodoNav}>
        <button style={s.navBtn} onClick={() => setPeriodoSel(subMonths(periodoSel, 1))}><ChevronLeft size={18} /></button>
        <div style={s.periodoLabel}>{periodoLabel}</div>
        <button style={s.navBtn} onClick={() => setPeriodoSel(addMonths(periodoSel, 1))}><ChevronRight size={18} /></button>
        <button style={s.exportBtn} onClick={handleExportarPDF} disabled={exportando} title={temAcesso('exportPDF') ? 'Exportar PDF' : 'Disponível no plano Pro'}>
          <FileDown size={16} />
          {exportando ? '...' : 'PDF'}
          {!temAcesso('exportPDF') && <ProBadge />}
        </button>
      </div>

      {/* Cards de resumo */}
      <div style={s.grid3}>
        <div style={{ ...s.card, borderTop: '3px solid var(--green)' }}>
          <div style={s.cardLabel}>Recebido</div>
          <div style={{ ...s.cardValue, color: 'var(--green)', fontSize: 17 }}>
            R$ {recebido.toFixed(2).replace('.', ',')}
          </div>
          <div style={s.cardSub}>{qtdPagos} pagamento{qtdPagos !== 1 ? 's' : ''}</div>
        </div>
        <div style={{ ...s.card, borderTop: `3px solid ${pendente > 0 ? 'var(--amber)' : 'var(--border2)'}` }}>
          <div style={s.cardLabel}>A receber</div>
          <div style={{ ...s.cardValue, color: pendente > 0 ? 'var(--amber)' : 'var(--text3)', fontSize: 17 }}>
            R$ {pendente.toFixed(2).replace('.', ',')}
          </div>
          <div style={s.cardSub}>{pagamentos.filter(p => p.status === 'pendente').length} pendente{pagamentos.filter(p => p.status === 'pendente').length !== 1 ? 's' : ''}</div>
        </div>
        <div style={{ ...s.card, borderTop: '3px solid var(--pink)' }}>
          <div style={s.cardLabel}>Ticket médio</div>
          <div style={{ ...s.cardValue, color: 'var(--pink)', fontSize: 17 }}>
            R$ {ticketMedio.toFixed(0)}
          </div>
          <div style={s.cardSub}>por atendimento</div>
        </div>
      </div>

      {/* ── Análises (gráficos) ──────────────── */}
      <div style={{ marginBottom: 20 }}>
        <div style={s.sectionTitle}>📊 análises do mês</div>

        <div style={s.graficosGrid}>
          {/* Receita últimos 6 meses */}
          <div style={s.graficoCard}>
            <div style={s.graficoTitulo}>Receita dos últimos 6 meses</div>
            <BarChart data={dadosReceita6m} cor="#15803D" prefixo="R$ " height={140} />
          </div>

          {/* Distribuição formas pagamento */}
          <div style={s.graficoCard}>
            <div style={s.graficoTitulo}>Como você recebeu</div>
            {dadosFormas.length === 0
              ? <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 13, padding: 30 }}>Sem dados</div>
              : <DonutChart
                  data={dadosFormas}
                  size={140}
                  centerLabel={`R$ ${recebido.toFixed(0)}`}
                  centerSub="recebido"
                />
            }
          </div>

          {/* Top serviços */}
          <div style={{ ...s.graficoCard, gridColumn: '1 / -1' }}>
            <div style={s.graficoTitulo}>Top serviços do mês (por receita)</div>
            <HBarChart
              data={topServicos}
              cor="var(--pink)"
              formatValor={(v) => `R$ ${v.toFixed(0)}`}
            />
          </div>
        </div>
      </div>

      <div style={s.filtros}>
        {['todos', 'pago', 'pendente'].map(f => (
          <button key={f} style={{ ...s.filtroBtn, ...(filtro === f ? s.filtroBtnActive : {}) }} onClick={() => setFiltro(f)}>
            {f === 'todos' ? 'Todos' : f === 'pago' ? 'Pagos' : 'Pendentes'}
          </button>
        ))}
      </div>

      <div style={s.sectionTitle}>lançamentos ({filtrados.length})</div>

      {filtrados.length === 0
        ? <div style={s.empty}>Nenhum lançamento encontrado</div>
        : filtrados.map(p => {
          const pago = p.status === 'pago'
          return (
            <div key={p.id} style={s.finCard}>
              <div style={{ ...s.dot, background: pago ? 'var(--green)' : '#F59E0B' }} />
              <div style={{ flex: 1 }}>
                <div style={s.finNome}>{p.agendamentos?.clientes?.nome || '—'}</div>
                <div style={s.finSub}>
                  {p.agendamentos?.servico || '—'} · {format(new Date(p.data + 'T12:00:00'), 'dd/MM', { locale: ptBR })}
                  {' · '}{({ pix: 'Pix', dinheiro: 'Dinheiro', cartao_debito: 'Débito', cartao_credito: 'Crédito' }[p.forma] || p.forma)}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ ...s.finValor, color: pago ? 'var(--green)' : 'var(--amber)' }}>
                  R$ {p.valor.toFixed(2).replace('.', ',')}
                </div>
                <button style={{ ...s.statusBtn, ...(pago ? s.statusPago : s.statusPendente) }} onClick={() => togglePago(p)}>
                  {pago ? '✓ Pago' : '⏳ Pendente'}
                </button>
              </div>
            </div>
          )
        })
      }

      <button className="fab-btn" onClick={() => setShowModal(true)} aria-label="Registrar pagamento">
        <Plus size={22} color="white" />
      </button>

      <UpgradeModal
        aberto={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        titulo="Exportação PDF é Pro"
        descricao="Gere relatórios financeiros profissionais em PDF com 1 clique. Disponível no plano Pro."
      />

      {showModal && (
        <div style={s.overlay} onClick={() => setShowModal(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalTitle}>Registrar pagamento</div>
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
    </div>
  )
}

const s = {
  page: { padding: 16, paddingBottom: 80 },
  periodoNav: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', boxShadow: 'var(--shadow-xs)' },
  periodoLabel: { flex: 1, fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 14, fontWeight: 700, color: 'var(--text)', textTransform: 'capitalize', textAlign: 'center' },
  navBtn: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', display: 'flex', alignItems: 'center', padding: 4 },
  exportBtn: { display: 'flex', alignItems: 'center', gap: 5, background: 'var(--pink-light)', color: 'var(--pink)', border: '1px solid var(--pink-mid)', borderRadius: 8, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  sectionTitle: { fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px', margin: '0 0 10px' },
  grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 },
  card: { background: 'var(--surface)', borderRadius: 'var(--radius-sm)', padding: '12px 12px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)' },
  cardLabel: { fontSize: 10, color: 'var(--text3)', marginBottom: 5, fontWeight: 500 },
  cardValue: { fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 600, lineHeight: 1 },
  cardSub: { fontSize: 10, color: 'var(--text3)', marginTop: 4 },
  filtros: { display: 'flex', gap: 8, marginBottom: 18 },
  graficosGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 },
  graficoCard: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '14px 14px 10px', boxShadow: 'var(--shadow-xs)' },
  graficoTitulo: { fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 },
  filtroBtn: { padding: '7px 16px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border2)', background: 'var(--surface)', color: 'var(--text3)', fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' },
  filtroBtnActive: { background: 'var(--pink)', color: 'white', border: '1px solid var(--pink)', boxShadow: 'var(--shadow-pink)' },
  finCard: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', marginBottom: 9, display: 'flex', alignItems: 'center', gap: 10, boxShadow: 'var(--shadow-xs)' },
  dot: { width: 10, height: 10, borderRadius: '50%', flexShrink: 0 },
  finNome: { fontSize: 14, fontWeight: 600 },
  finSub: { fontSize: 12, color: 'var(--text3)', marginTop: 2 },
  finValor: { fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 500, marginBottom: 3 },
  statusBtn: { fontSize: 11, padding: '3px 10px', borderRadius: 'var(--radius-pill)', fontWeight: 600, border: 'none', cursor: 'pointer' },
  statusPago: { background: 'var(--green-bg)', color: 'var(--green)' },
  statusPendente: { background: 'var(--amber-bg)', color: 'var(--amber)' },
  empty: { color: 'var(--text3)', fontSize: 14, textAlign: 'center', padding: '28px 0' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(24,7,18,0.52)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
  modal: { background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 12 },
  modalTitle: { fontSize: 17, fontWeight: 700, marginBottom: 4 },
  field: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: { fontSize: 12, fontWeight: 600, color: 'var(--text2)' },
  input: { padding: '10px 13px', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', fontSize: 14, background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit' },
  row: { display: 'flex', gap: 10 },
  btnPrimary: { background: 'var(--pink)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', padding: '13px', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 4, boxShadow: 'var(--shadow-pink)', transition: 'background 0.15s' },
  btnSecondary: { background: 'var(--surface2)', color: 'var(--text2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', padding: '12px', fontSize: 14, fontWeight: 500, cursor: 'pointer' },
}
