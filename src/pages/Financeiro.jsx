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
import { CardSkeleton } from '../components/common/Skeleton'
import PagamentoModal from '../components/agenda/PagamentoModal'
import RegistrarPagamentoModal from '../components/financeiro/RegistrarPagamentoModal'
import ProLaboreModal from '../components/financeiro/ProLaboreModal'
import DespesaModal from '../components/financeiro/DespesaModal'
import ConfirmarPagarDespesaModal from '../components/financeiro/ConfirmarPagarDespesaModal'
import { format, startOfMonth, endOfMonth, addMonths, subMonths, eachMonthOfInterval, startOfYear, endOfYear, endOfWeek } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import BarChart, { HBarChart } from '../components/charts/BarChart'
import DonutChart from '../components/charts/DonutChart'
import { useToast } from '../contexts/ToastContext'
import { traduzErro } from '../lib/erros'
import { exportarPDFResumo, exportarPDFReceitas, exportarPDFDespesas, exportarPDFAnalises, exportarPDFAnual } from '../lib/pdfExporter'
import { comTimeout } from '../lib/queryUtils'
import { s, tabs } from './Financeiro.styles'
import { CATEGORIAS, FORMAS_PAGAMENTO } from './Financeiro.constants'

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
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [pagamentos, setPagamentos] = useState([])
  const [despesas, setDespesas] = useState([])
  const [pagamentos6m, setPagamentos6m] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [showDespesaModal, setShowDespesaModal] = useState(false)
  const [editandoDespesa, setEditandoDespesa] = useState(null)
  // Categorias personalizadas criadas pelo salão (somam-se às 14 fixas).
  const [categoriasCustom, setCategoriasCustom] = useState([])
  const [showNovaCat, setShowNovaCat] = useState(false)
  const [novaCat, setNovaCat] = useState({ label: '', icon: '📦', cor: '#8B2655' })
  const [savingCat, setSavingCat] = useState(false)
  const [agendamentos, setAgendamentos] = useState([])
  // Previsão = receita futura (agendamentos pendentes/confirmados a partir de hoje).
  const [previsao, setPrevisao] = useState({ entraMes: 0, qtdEntraMes: 0 })
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ agendamento_id: '', valor: '', status: 'pendente', forma: 'pix', data: format(new Date(), 'yyyy-MM-dd') })
  const [formDespesa, setFormDespesa] = useState({ descricao: '', categoria: 'produtos', valor: '', data: format(new Date(), 'yyyy-MM-dd'), forma_pagamento: 'pix', recorrente: false, valor_variavel: false, recorrente_ate: '', observacoes: '', pago: false, tipo: 'salao' })
  const [saving, setSaving] = useState(false)
  const [savingDespesa, setSavingDespesa] = useState(false)
  // Confirmar pagamento de despesa a pagar (modal de confirmação).
  const [despesaParaPagar, setDespesaParaPagar] = useState(null)
  const [formPagarDespesa, setFormPagarDespesa] = useState({ forma_pagamento: 'pix' })
  const [savingPagarDespesa, setSavingPagarDespesa] = useState(false)
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
  // Layout 2 faixas só no computador; no celular mantém as faixas empilhadas.
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 769)
  // Config de cobrança (chave Pix + modelo da mensagem) — usada no botão "Cobrar".
  const [cobranca, setCobranca] = useState({ chavePix: '', template: MSG_COBRANCA_PADRAO, nomeSalao: '' })
  // Pró-labore ("meu salário"): valor mensal que a dona tira pra ela.
  const [proLabore, setProLabore] = useState(0)
  const [showProLabore, setShowProLabore] = useState(false)
  const [proLaboreInput, setProLaboreInput] = useState('')
  const [savingProLabore, setSavingProLabore] = useState(false)
  // Linhas do DRE que podem expandir a lista de lançamentos (pagas / a pagar / pessoal).
  const [dreAberto, setDreAberto] = useState({})
  const toggleDre = (k) => setDreAberto(p => ({ ...p, [k]: !p[k] }))
  const [searchParams] = useSearchParams()

  // Alterna entre layout celular e computador ao redimensionar a janela.
  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 769)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

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
    loadCategorias()
  }, [salaoId])

  async function loadCategorias() {
    const { data } = await supabase.from('categorias_despesa').select('*').order('label')
    setCategoriasCustom(data || [])
  }

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
    try {
      const { data, error } = await comTimeout(
        supabase.from('pagamentos').select('*, agendamentos(servico, status, clientes(nome, telefone))')
          .eq('salao_id', salaoId).gte('data', inicio).lte('data', fim)
          .order('data', { ascending: false }).limit(2000)
      )
      if (error) { toastErro(traduzErro(error, 'Não foi possível carregar os pagamentos.')); return }
      // Pagamento de atendimento CANCELADO não é receita (some do perfil da cliente
      // pelo mesmo motivo). Avulso (sem agendamento) continua contando.
      setPagamentos((data || []).filter(p => p.agendamentos?.status !== 'cancelado'))

      const inicio6m = format(startOfMonth(subMonths(refDate, 5)), 'yyyy-MM-dd')
      const fim6m = format(endOfMonth(refDate), 'yyyy-MM-dd')
      const { data: data6m } = await supabase.from('pagamentos')
        .select('data, valor, status, agendamentos(status)').eq('salao_id', salaoId).eq('status', 'pago')
        .gte('data', inicio6m).lte('data', fim6m).limit(6000)
      setPagamentos6m((data6m || []).filter(p => p.agendamentos?.status !== 'cancelado'))
    } catch (err) {
      toastErro(err.message || 'Não foi possível carregar os pagamentos.')
    }
  }

  // Previsão de receita: o que AINDA vai entrar (agendamentos pendentes/confirmados
  // de hoje em diante). Independe do período selecionado — é sempre "daqui pra frente".
  async function loadPrevisao() {
    // Previsão de RECEITA: atendimentos agendados que ainda vão acontecer neste mês
    // (de hoje até o fim do mês). Mostrado num card no Resumo.
    const hoje = format(new Date(), 'yyyy-MM-dd')
    const fimMes = format(endOfMonth(new Date()), 'yyyy-MM-dd')
    // "Vai entrar" só conta atendimentos SEM pagamento ainda. Se já tem pagamento
    // (pago → já está em "recebido"; pendente → já está em "a receber"), não conta
    // de novo — evita dupla contagem na "Previsão de fechamento".
    const { data: ags } = await supabase
      .from('agendamentos').select('valor, pagamentos(status)')
      .eq('salao_id', salaoId)
      .gte('data', hoje).lte('data', fimMes)
      .in('status', ['pendente', 'confirmado'])
    const arr = (ags || []).filter(a => (a.pagamentos || []).length === 0)
    setPrevisao({ entraMes: arr.reduce((acc, a) => acc + (a.valor || 0), 0), qtdEntraMes: arr.length })
  }

  async function loadDespesas() {
    const { inicio, fim } = getRange()
    // Dona/recepção veem as despesas do salão; a profissional vê só as DELA
    // (privadas, gravadas com salao_id NULL e identificadas pelo user_id).
    let q = supabase.from('despesas')
      .select('*')
      .gte('data', inicio).lte('data', fim).order('data', { ascending: false }).limit(500)
    q = gerenciaTudo ? q.eq('salao_id', salaoId) : q.eq('user_id', user.id)
    try {
      const { data, error } = await comTimeout(q)
      if (error) { toastErro(traduzErro(error, 'Não foi possível carregar as despesas.')); return }
      setDespesas(data || [])
    } catch (err) {
      toastErro(err.message || 'Não foi possível carregar as despesas.')
    }
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

  async function salvarNovaCategoria() {
    const label = novaCat.label.trim()
    if (!label) { toastErro('Dê um nome para a categoria'); return }
    setSavingCat(true)
    const { data, error } = await supabase.from('categorias_despesa')
      .insert({ salao_id: salaoId, user_id: user.id, label, icon: novaCat.icon?.trim() || '📦', cor: novaCat.cor || '#525252' })
      .select().single()
    setSavingCat(false)
    if (error) { toastErro(traduzErro(error, 'Não foi possível criar a categoria.')); return }
    setCategoriasCustom(prev => [...prev, data])
    setFormDespesa(f => ({ ...f, categoria: data.id }))
    setShowNovaCat(false)
    setNovaCat({ label: '', icon: '📦', cor: '#8B2655' })
    sucesso('Categoria criada ✓')
  }

  async function excluirCategoria(cat) {
    const ok = await confirmar({
      titulo: 'Excluir esta categoria?',
      mensagem: `${cat.icon} ${cat.label} — despesas já lançadas com ela continuam, mas ficam sem categoria.`,
      confirmarLabel: 'Sim, excluir',
      tipo: 'perigo',
    })
    if (!ok) return
    const { error } = await supabase.from('categorias_despesa').delete().eq('id', cat.id).eq('salao_id', salaoId)
    if (error) { toastErro(traduzErro(error, 'Não foi possível excluir a categoria.')); return }
    setCategoriasCustom(prev => prev.filter(c => c.id !== cat.id))
    if (formDespesa.categoria === cat.id) setFormDespesa(f => ({ ...f, categoria: 'produtos' }))
    sucesso('Categoria excluída')
  }

  function abrirNovaDespesa() {
    setEditandoDespesa(null)
    setFormDespesa({ descricao: '', categoria: 'produtos', valor: '', data: format(new Date(), 'yyyy-MM-dd'), forma_pagamento: 'pix', recorrente: false, valor_variavel: false, recorrente_ate: '', observacoes: '', pago: false, tipo: 'salao' })
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
    setShowNovaCat(false)
    setFormDespesa({ descricao: '', categoria: 'produtos', valor: '', data: format(new Date(), 'yyyy-MM-dd'), forma_pagamento: 'pix', recorrente: false, valor_variavel: false, recorrente_ate: '', observacoes: '', pago: false, tipo: 'salao' })
  }

  // Abre modal de confirmação de pagamento da despesa.
  function abrirConfirmarPagarDespesa(despesa) {
    setFormPagarDespesa({ forma_pagamento: despesa.forma_pagamento || 'pix' })
    setDespesaParaPagar(despesa)
  }

  // Confirma o pagamento após revisão no modal.
  async function confirmarPagarDespesa() {
    if (!despesaParaPagar) return
    setSavingPagarDespesa(true)
    const q = supabase.from('despesas').update({ pago: true, forma_pagamento: formPagarDespesa.forma_pagamento }).eq('id', despesaParaPagar.id)
    const { error } = await (gerenciaTudo ? q.eq('salao_id', salaoId) : q.eq('user_id', user.id))
    setSavingPagarDespesa(false)
    if (error) { toastErro(traduzErro(error, 'Não foi possível marcar como paga.')); return }
    const despesaPaga = despesaParaPagar
    setDespesaParaPagar(null)
    loadDespesas()
    sucesso('Conta marcada como paga ✓', {
      acaoLabel: 'Desfazer',
      acao: async () => {
        const uq = supabase.from('despesas').update({ pago: false }).eq('id', despesaPaga.id)
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
