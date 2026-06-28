import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, AlertCircle, CheckCircle2, Clock, ChevronRight, MessageCircle, Pencil, Crown, Upload, Download, Info } from 'lucide-react'
// xlsx é carregado sob demanda (só ao importar/baixar modelo) — mantém a tela de Clientes leve.
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useSalao } from '../contexts/SalaoContext'
import { useAssinatura } from '../contexts/AssinaturaContext'
import { useToast } from '../contexts/ToastContext'
import { UpgradeModal } from '../components/common/UpgradeBlock'
import Modal from '../components/common/Modal'
import { CardSkeleton } from '../components/common/Skeleton'
import EmptyState from '../components/common/EmptyState'
import { inputBase, labelBase, btnPrimaryBase, btnSecondaryBase } from '../lib/ui'
import { formatTelefone, unformatTelefone, validarEmail, validarTelefone, validarNome, linkWhatsApp, dataParaDate, formatBRL } from '../lib/formatters'
import { MSG_ANIVERSARIO_PADRAO, MSG_RETORNO_PADRAO, aplicarVariaveis } from '../lib/mensagens'
import { traduzErro } from '../lib/erros'
import { differenceInDays, format } from 'date-fns'
import { DIAS_RETORNO_PADRAO, VISITAS_VIP } from '../lib/constants'

const FILTROS_VALIDOS = ['todas', 'vip', 'sumidas', 'sem_visita', 'aniversariantes', 'arquivadas']

// Funções puras — fora do componente para não serem recriadas a cada render
const parseUADate = (d) => d ? dataParaDate(d) : null
const normalizar = (txt) => String(txt).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const diaAniv = (c) => { const d = dataParaDate(c.data_nascimento); return d ? d.getDate() : 99 }
const aniversarioHoje = (c) => {
  const d = dataParaDate(c.data_nascimento); const n = new Date()
  return !!d && d.getMonth() === n.getMonth() && d.getDate() === n.getDate()
}
const parabensEnviadoEsteAno = (c) =>
  !!c.parabens_enviado_em && new Date(c.parabens_enviado_em).getFullYear() === new Date().getFullYear()
function estaSumida(c) {
  if (!c.ultimo_atendimento) return false
  const limite = c.dias_retorno ?? DIAS_RETORNO_PADRAO
  return differenceInDays(new Date(), parseUADate(c.ultimo_atendimento)) >= limite
}

export default function Clientes() {
  const { user } = useAuth()
  const { salaoId } = useSalao()
  const navigate = useNavigate()
  const { plano, dentroDoLimite } = useAssinatura()
  const { sucesso, erro } = useToast()
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [buscaInput, setBuscaInput] = useState('')
  const [busca, setBusca] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const diasAlerta = DIAS_RETORNO_PADRAO
  // Permite chegar já filtrada por link (ex.: aviso → /app/clientes?filtro=aniversariantes)
  const [filtro, setFiltro] = useState(() => {
    const p = new URLSearchParams(window.location.search).get('filtro')
    return FILTROS_VALIDOS.includes(p) ? p : 'todas'
  })
  // Mensagem de aniversário (editável em Configurações) p/ pré-preencher o WhatsApp
  const [configMsg, setConfigMsg] = useState({ msg_aniversario: MSG_ANIVERSARIO_PADRAO, msg_retorno: MSG_RETORNO_PADRAO, nome_salao: '' })
  // Cards que abriram o WhatsApp e aguardam a confirmação "Já enviei" do parabéns
  const [aguardandoParabens, setAguardandoParabens] = useState(() => new Set())
  const [ordenacao, setOrdenacao] = useState('nome')
  const [pagina, setPagina] = useState(1)
  const [form, setForm] = useState({ nome: '', telefone: '', email: '', data_nascimento: '', observacoes: '', dias_retorno: '' })
  const [erros, setErros] = useState({})
  const [saving, setSaving] = useState(false)
  // Importação de clientes (planilha)
  const [showImport, setShowImport] = useState(false)
  const [importLinhas, setImportLinhas] = useState([])
  const [importResumo, setImportResumo] = useState(null)
  const [importNomeArquivo, setImportNomeArquivo] = useState('')
  const [importando, setImportando] = useState(false)
  const [dadosExtras, setDadosExtras] = useState({ proximoMap: {}, canceladosMap: {}, pendentesMap: {} })
  const [showEditModal, setShowEditModal] = useState(false)
  const [clienteEditando, setClienteEditando] = useState(null)
  const [formEdit, setFormEdit] = useState({ nome: '', telefone: '', email: '', data_nascimento: '', observacoes: '', dias_retorno: '' })
  const [errosEdit, setErrosEdit] = useState({})
  const [savingEdit, setSavingEdit] = useState(false)

  const ITENS_POR_PAGINA = 20

  const ativas = useMemo(() => clientes.filter(c => !c.arquivada), [clientes])
  const arquivadas = useMemo(() => clientes.filter(c => c.arquivada), [clientes])
  const limiteClientes = plano?.limites?.clientes ?? Infinity
  const noLimite = limiteClientes !== Infinity && ativas.length >= limiteClientes
  const perto = limiteClientes !== Infinity && ativas.length >= limiteClientes - 5 && !noLimite

  useEffect(() => { if (salaoId) { loadClientes(); loadConfigMsg(); loadDadosExtras() } }, [salaoId])

  // Debounce na busca (300ms)
  useEffect(() => {
    const timer = setTimeout(() => { setBusca(buscaInput); setPagina(1) }, 300)
    return () => clearTimeout(timer)
  }, [buscaInput])

  // Reset paginação quando filtro/ordenação muda
  useEffect(() => { setPagina(1) }, [filtro, ordenacao])

  async function loadClientes() {
    const { data, error } = await supabase.from('clientes').select('id, nome, telefone, email, observacoes, ultimo_atendimento, total_visitas, total_gasto, arquivada, dias_retorno, data_nascimento, parabens_enviado_em').eq('salao_id', salaoId).order('nome')
    setLoading(false)
    if (error) { erro(traduzErro(error, 'Não foi possível carregar as clientes.')); return }
    setClientes(data || [])
  }

  async function loadConfigMsg() {
    const { data } = await supabase.from('configuracoes')
      .select('msg_aniversario, msg_retorno, nome_salao').eq('salao_id', salaoId).maybeSingle()
    if (data) setConfigMsg({
      msg_aniversario: data.msg_aniversario || MSG_ANIVERSARIO_PADRAO,
      msg_retorno: data.msg_retorno || MSG_RETORNO_PADRAO,
      nome_salao: data.nome_salao || '',
    })
  }

  async function loadDadosExtras() {
    const hoje = format(new Date(), 'yyyy-MM-dd')
    const [proxRes, cancelRes, pendRes] = await Promise.all([
      supabase.from('agendamentos').select('cliente_id, data, horario')
        .eq('salao_id', salaoId).in('status', ['pendente', 'agendado', 'confirmado']).gte('data', hoje)
        .order('data').order('horario'),
      supabase.from('agendamentos').select('cliente_id')
        .eq('salao_id', salaoId).eq('status', 'cancelado'),
      supabase.from('pagamentos').select('agendamentos!inner(cliente_id, salao_id)')
        .eq('status', 'pendente').eq('agendamentos.salao_id', salaoId),
    ])
    const proximoMap = {}
    proxRes.data?.forEach(a => { if (!proximoMap[a.cliente_id]) proximoMap[a.cliente_id] = a })
    const canceladosMap = {}
    cancelRes.data?.forEach(a => { canceladosMap[a.cliente_id] = (canceladosMap[a.cliente_id] || 0) + 1 })
    const pendentesMap = {}
    pendRes.data?.forEach(p => {
      const cid = p.agendamentos?.cliente_id
      if (cid) pendentesMap[cid] = (pendentesMap[cid] || 0) + 1
    })
    setDadosExtras({ proximoMap, canceladosMap, pendentesMap })
  }

  async function salvarCliente() {
    const novosErros = {}
    if (!validarNome(form.nome)) novosErros.nome = 'Nome inválido (mín. 2 caracteres)'
    if (form.telefone && !validarTelefone(form.telefone)) novosErros.telefone = 'WhatsApp deve ter 10 ou 11 dígitos'
    if (form.email && !validarEmail(form.email)) novosErros.email = 'E-mail inválido'
    const diasRetorno = form.dias_retorno === '' ? null : parseInt(form.dias_retorno, 10)
    if (form.dias_retorno !== '' && (!Number.isFinite(diasRetorno) || diasRetorno < 1 || diasRetorno > 365)) {
      novosErros.dias_retorno = 'Informe entre 1 e 365 dias'
    }
    if (Object.keys(novosErros).length > 0) { setErros(novosErros); return }

    // Evita duplicar cliente pelo mesmo WhatsApp (já existia no import; faltava aqui).
    const telLimpo = unformatTelefone(form.telefone)
    if (telLimpo) {
      const jaExiste = clientes.find(c => unformatTelefone(c.telefone) === telLimpo)
      if (jaExiste) {
        setErros({ telefone: `Já existe uma cliente com esse WhatsApp: ${jaExiste.nome}` })
        return
      }
    }

    // 🔒 Bloqueio de limite no Starter
    if (noLimite) {
      setShowModal(false)
      setShowUpgrade(true)
      return
    }
    setSaving(true)
    const { error } = await supabase.from('clientes').insert({
      ...form,
      telefone: unformatTelefone(form.telefone),
      // Campos opcionais vazios devem ir como null (data vazia quebra o tipo 'date').
      data_nascimento: form.data_nascimento || null,
      email: form.email || null,
      dias_retorno: diasRetorno,
      user_id: user.id,
      salao_id: salaoId,
    })
    setSaving(false)
    if (error) { erro(traduzErro(error, 'Não foi possível cadastrar a cliente.')); return }
    setShowModal(false)
    setForm({ nome: '', telefone: '', email: '', data_nascimento: '', observacoes: '', dias_retorno: '' })
    setErros({})
    sucesso('Cliente cadastrada')
    loadClientes()
  }

  function abrirModalNova() {
    if (noLimite) {
      setShowUpgrade(true)
      return
    }
    setShowModal(true)
  }

  // ── Importação de clientes (planilha .xlsx/.csv) ──────────────────────
  // Pega o valor da 1ª coluna cujo cabeçalho contém um dos candidatos (já normalizados)
  function valorColuna(row, candidatos) {
    const keys = Object.keys(row)
    for (const cand of candidatos) {
      const k = keys.find(key => normalizar(key).includes(cand))
      if (k != null && row[k] != null && String(row[k]).trim() !== '') return row[k]
    }
    return ''
  }
  // Aceita Date (Excel), dd/mm/aaaa e aaaa-mm-dd → 'aaaa-mm-dd'; senão null
  function parseDataImport(v) {
    if (!v) return null
    if (v instanceof Date && !isNaN(v)) {
      return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`
    }
    const str = String(v).trim()
    let m = str.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/)
    if (m) { let [, d, mo, y] = m; if (y.length === 2) y = (Number(y) > 30 ? '19' : '20') + y; return `${y.padStart(4, '0')}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}` }
    m = str.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/)
    if (m) { const [, y, mo, d] = m; return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}` }
    return null
  }

  async function baixarModeloClientes() {
    const XLSX = await import('xlsx')
    const ws = XLSX.utils.aoa_to_sheet([
      ['Nome', 'WhatsApp', 'Nascimento', 'E-mail', 'Observações', 'Retorno (dias)'],
      ['Maria Silva', '54999990000', '15/03/1990', '', 'Alergia a acetona', '30'],
      ['Ana Souza', '51988887777', '22/11/1985', 'ana@email.com', 'Prefere gel', ''],
    ])
    ws['!cols'] = [{ wch: 22 }, { wch: 16 }, { wch: 14 }, { wch: 22 }, { wch: 26 }, { wch: 14 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Clientes')
    XLSX.writeFile(wb, 'modelo-clientes-lumen.xlsx')
  }

  async function processarArquivoImport(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportNomeArquivo(file.name)
    try {
      const XLSX = await import('xlsx')
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array', cellDates: true })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
      const existentesTel = new Set((clientes || []).map(c => (c.telefone || '').replace(/\D/g, '')).filter(Boolean))
      const vistosTel = new Set()
      const validas = []
      let semNome = 0, duplicadas = 0
      for (const row of rows) {
        const nome = String(valorColuna(row, ['nome', 'cliente'])).trim()
        if (!nome) { semNome++; continue }
        const tel = unformatTelefone(String(valorColuna(row, ['whatsapp', 'telefone', 'celular', 'fone', 'contato'])))
        if (tel && (existentesTel.has(tel) || vistosTel.has(tel))) { duplicadas++; continue }
        if (tel) vistosTel.add(tel)
        const ret = parseInt(valorColuna(row, ['retorno']), 10)
        validas.push({
          nome: nome.slice(0, 120),
          telefone: tel || null,
          email: String(valorColuna(row, ['mail'])).trim() || null,
          data_nascimento: parseDataImport(valorColuna(row, ['nascimento', 'aniversario', 'nasc'])),
          observacoes: String(valorColuna(row, ['observ', 'obs'])).trim() || null,
          dias_retorno: ret > 0 ? ret : null,
        })
      }
      setImportLinhas(validas)
      setImportResumo({ total: rows.length, validas: validas.length, semNome, duplicadas })
    } catch (err) {
      erro('Não consegui ler o arquivo. Use o modelo (.xlsx) ou um .csv simples.')
    }
    e.target.value = ''
  }

  function fecharImport() {
    setShowImport(false); setImportLinhas([]); setImportResumo(null); setImportNomeArquivo('')
  }

  async function confirmarImportacao() {
    if (!importLinhas.length) return
    setImportando(true)
    let aInserir = importLinhas, cortadas = 0
    const limite = plano?.limites?.clientes ?? Infinity
    if (limite !== Infinity) {
      const espaco = Math.max(0, limite - ativas.length)
      if (importLinhas.length > espaco) { aInserir = importLinhas.slice(0, espaco); cortadas = importLinhas.length - espaco }
    }
    if (!aInserir.length) {
      setImportando(false)
      erro(`Seu plano (${plano?.nome}) já está no limite de ${limite} clientes. Faça upgrade pra importar mais.`)
      return
    }
    const payload = aInserir.map(c => ({ ...c, salao_id: salaoId, user_id: user.id }))
    const { error } = await supabase.from('clientes').insert(payload)
    setImportando(false)
    if (error) { erro(traduzErro(error, 'Não foi possível importar a planilha.')); return }
    await loadClientes()
    fecharImport()
    sucesso(`${aInserir.length} cliente(s) importada(s)!${cortadas ? ` (${cortadas} não couberam no limite do plano)` : ''}`)
  }

  // ── Aniversariantes do mês ──
  const mesAtual = new Date().getMonth()
  const ehAniversarianteMes = (c) => { const d = dataParaDate(c.data_nascimento); return !!d && d.getMonth() === mesAtual }

  const sumidas = useMemo(() => ativas.filter(estaSumida), [ativas])
  const vips = useMemo(() => ativas.filter(c => c.total_visitas >= VISITAS_VIP), [ativas])
  const semVisita = useMemo(() => ativas.filter(c => !c.ultimo_atendimento), [ativas])
  const aniversariantes = useMemo(() => ativas.filter(ehAniversarianteMes), [ativas, mesAtual])

  const filtradas = useMemo(() => (filtro === 'arquivadas' ? arquivadas : ativas)
    .filter(c => {
      if (busca) {
        const bn = normalizar(busca)
        const bd = busca.replace(/\D/g, '')
        const achouNome = normalizar(c.nome).includes(bn)
        const achouTel = bd && (c.telefone || '').replace(/\D/g, '').includes(bd)
        if (!achouNome && !achouTel) return false
      }
      if (filtro === 'vip') return c.total_visitas >= VISITAS_VIP
      if (filtro === 'sumidas') return estaSumida(c)
      if (filtro === 'sem_visita') return !c.ultimo_atendimento
      if (filtro === 'aniversariantes') return ehAniversarianteMes(c)
      return true
    })
    .sort((a, b) => {
      if (filtro === 'aniversariantes') return diaAniv(a) - diaAniv(b)
      if (ordenacao === 'gasto') return (b.total_gasto || 0) - (a.total_gasto || 0)
      if (ordenacao === 'visitas') return (b.total_visitas || 0) - (a.total_visitas || 0)
      if (ordenacao === 'recente') {
        if (!a.ultimo_atendimento && !b.ultimo_atendimento) return 0
        if (!a.ultimo_atendimento) return 1
        if (!b.ultimo_atendimento) return -1
        return parseUADate(b.ultimo_atendimento) - parseUADate(a.ultimo_atendimento)
      }
      return a.nome.localeCompare(b.nome)
    }), [ativas, arquivadas, filtro, busca, ordenacao, mesAtual])

  const filtradaExibidas = filtradas.slice(0, pagina * ITENS_POR_PAGINA)
  const temMais = filtradas.length > pagina * ITENS_POR_PAGINA

  function handleWhatsApp(e, c) {
    e.stopPropagation()
    const tel = (c.telefone || '').replace(/\D/g, '')
    if (!tel) return
    // Cliente com retorno pendente já abre o WhatsApp com a mensagem de retorno
    // pronta (mesma editável em Configurações). As demais abrem o chat normal.
    const msg = estaSumida(c)
      ? aplicarVariaveis(configMsg.msg_retorno || MSG_RETORNO_PADRAO, { nome: c.nome, salao: configMsg.nome_salao })
      : ''
    window.open(linkWhatsApp(tel, msg), '_blank')
  }

  // WhatsApp já com a mensagem de aniversário pronta (usada na aba Aniversários).
  // Abre o WhatsApp e põe o card em "aguardando confirmação" — só registra como
  // enviado quando a usuária confirmar (fechar a aba sem mandar não conta).
  function enviarParabens(e, c) {
    e.stopPropagation()
    const tel = (c.telefone || '').replace(/\D/g, '')
    if (!tel) return
    const msg = aplicarVariaveis(configMsg.msg_aniversario || MSG_ANIVERSARIO_PADRAO, { nome: c.nome, salao: configMsg.nome_salao })
    window.open(linkWhatsApp(tel, msg), '_blank')
    setAguardandoParabens(prev => new Set(prev).add(c.id))
  }

  async function confirmarParabens(e, c) {
    e.stopPropagation()
    setAguardandoParabens(prev => { const n = new Set(prev); n.delete(c.id); return n })
    const { error } = await supabase.from('clientes')
      .update({ parabens_enviado_em: new Date().toISOString() })
      .eq('id', c.id).eq('salao_id', salaoId)
    if (error) { erro(traduzErro(error, 'Não consegui registrar a ação.')); return }
    setClientes(prev => prev.map(x => x.id === c.id ? { ...x, parabens_enviado_em: new Date().toISOString() } : x))
    sucesso('Parabéns registrado 🎂')
  }

  function cancelarParabens(e, c) {
    e.stopPropagation()
    setAguardandoParabens(prev => { const n = new Set(prev); n.delete(c.id); return n })
  }

  function abrirEditModal(c) {
    setClienteEditando(c)
    setFormEdit({
      nome: c.nome || '',
      telefone: c.telefone || '',
      email: c.email || '',
      data_nascimento: c.data_nascimento || '',
      observacoes: c.observacoes || '',
      dias_retorno: c.dias_retorno != null ? String(c.dias_retorno) : '',
    })
    setErrosEdit({})
    setShowEditModal(true)
  }

  async function salvarEdicaoRapida() {
    const novosErros = {}
    if (!validarNome(formEdit.nome)) novosErros.nome = 'Nome inválido (mín. 2 caracteres)'
    if (formEdit.telefone && !validarTelefone(formEdit.telefone)) novosErros.telefone = 'WhatsApp deve ter 10 ou 11 dígitos'
    if (formEdit.email && !validarEmail(formEdit.email)) novosErros.email = 'E-mail inválido'
    const dr = formEdit.dias_retorno === '' ? null : parseInt(formEdit.dias_retorno, 10)
    if (dr != null && (!Number.isFinite(dr) || dr < 1 || dr > 365)) novosErros.dias_retorno = 'Informe entre 1 e 365 dias'
    if (Object.keys(novosErros).length > 0) { setErrosEdit(novosErros); return }
    const telLimpo = unformatTelefone(formEdit.telefone)
    if (telLimpo) {
      const jaExiste = clientes.find(c => c.id !== clienteEditando.id && unformatTelefone(c.telefone) === telLimpo)
      if (jaExiste) { setErrosEdit({ telefone: `Já existe uma cliente com esse WhatsApp: ${jaExiste.nome}` }); return }
    }
    setSavingEdit(true)
    const updates = {
      nome: formEdit.nome.trim(),
      telefone: unformatTelefone(formEdit.telefone) || null,
      email: formEdit.email.trim() || null,
      data_nascimento: formEdit.data_nascimento || null,
      observacoes: formEdit.observacoes.trim() || null,
      dias_retorno: dr,
    }
    const { error } = await supabase.from('clientes').update(updates).eq('id', clienteEditando.id).eq('salao_id', salaoId)
    setSavingEdit(false)
    if (error) { erro(traduzErro(error, 'Não foi possível salvar.')); return }
    setClientes(prev => prev.map(c => c.id === clienteEditando.id ? { ...c, ...updates } : c))
    setShowEditModal(false)
    sucesso('Cliente atualizada')
  }

  return (
    <div style={s.page}>
      <div style={s.topRow}>
        <div style={s.searchBar}>
          <Search size={16} color="var(--text3)" />
          <input style={s.searchInput} placeholder="Buscar cliente..." value={buscaInput} onChange={e => setBuscaInput(e.target.value)} />
        </div>
        <button style={s.btnImportar} onClick={() => setShowImport(true)}>
          <Upload size={14} /> Importar
        </button>
        <button style={s.btnNova} onClick={abrirModalNova}>
          <Plus size={14} /> Nova
        </button>
      </div>

      {/* Aviso de limite (Starter) */}
      {(perto || noLimite) && (
        <div
          onClick={() => navigate('/planos')}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: noLimite ? 'linear-gradient(135deg, #FEF2F2, #FEE2E2)' : 'linear-gradient(135deg, #FEF3C7, #FDE68A)',
            border: '1px solid ' + (noLimite ? '#FCA5A5' : '#FCD34D'),
            borderRadius: 'var(--radius-sm)', padding: '11px 14px', marginBottom: 12,
            cursor: 'pointer', boxShadow: 'var(--shadow-xs)',
          }}
        >
          <Crown size={18} color={noLimite ? '#B91C1C' : '#D97706'} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, fontSize: 12 }}>
            <div style={{ fontWeight: 700, color: noLimite ? '#7F1D1D' : '#78350F' }}>
              {noLimite
                ? `Você atingiu o limite de ${limiteClientes} clientes do plano ${plano?.nome}`
                : `${ativas.length} de ${limiteClientes} clientes (${plano?.nome})`}
            </div>
            <div style={{ color: noLimite ? '#991B1B' : '#92400E', marginTop: 2 }}>
              Faça upgrade pro Pro pra cadastrar clientes ilimitadas →
            </div>
          </div>
        </div>
      )}

      {/* Mini stats */}
      <div style={s.statsRow}>
        <div style={s.statCard}>
          <div style={s.statNum}>{ativas.length}</div>
          <div style={s.statLabel}>Total de clientes</div>
        </div>
        <div style={{ ...s.statCard, cursor: semVisita.length ? 'pointer' : 'default' }} onClick={() => semVisita.length && setFiltro(filtro === 'sem_visita' ? 'todas' : 'sem_visita')}>
          <div style={{ ...s.statNum, color: semVisita.length ? '#1D4ED8' : 'var(--text3)' }}>{semVisita.length}</div>
          <div style={s.statLabel}>Novas clientes</div>
        </div>
        <div style={{ ...s.statCard, cursor: sumidas.length ? 'pointer' : 'default' }} onClick={() => sumidas.length && setFiltro(filtro === 'sumidas' ? 'todas' : 'sumidas')}>
          <div style={{ ...s.statNum, color: sumidas.length ? 'var(--red, #B91C1C)' : 'var(--text3)' }}>{sumidas.length}</div>
          <div style={s.statLabel}>Retorno</div>
        </div>
      </div>

      {/* Computador: chips + ordenar (escondido no celular via CSS) */}
      <div className="clientes-filtros-chips">
        <div style={s.filtrosChips}>
          {[
            { id: 'todas', label: 'Todas' },
            { id: 'vip', label: '✦ VIP' },
            { id: 'sumidas', label: '⏰ Retorno' },
            { id: 'sem_visita', label: '🆕 Novas' },
            ...(aniversariantes.length ? [{ id: 'aniversariantes', label: `🎂 Aniversários (${aniversariantes.length})` }] : []),
            ...(arquivadas.length ? [{ id: 'arquivadas', label: `🗄 Arquivadas (${arquivadas.length})` }] : []),
          ].map(f => (
            <button
              key={f.id}
              style={{ ...s.filtroChip, ...(filtro === f.id ? s.filtroChipAtivo : {}) }}
              onClick={() => setFiltro(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <select style={s.sortSelect} value={ordenacao} onChange={e => setOrdenacao(e.target.value)}>
          <option value="nome">A–Z</option>
          <option value="gasto">Maior gasto</option>
          <option value="visitas">Mais visitas</option>
          <option value="recente">Mais recente</option>
        </select>
      </div>

      {/* Celular: menus compactos (escondido no computador via CSS) */}
      <div className="clientes-filtros-selects">
        <div style={{ ...s.selectGroup, flex: 1.8 }}>
          <span style={s.selectLabel}>Mostrar</span>
          <select style={s.filtroSelect} value={filtro} onChange={e => setFiltro(e.target.value)}>
            <option value="todas">Todas ({ativas.length})</option>
            <option value="vip">✦ VIP ({vips.length})</option>
            <option value="sumidas">⏰ Retorno ({sumidas.length})</option>
            <option value="sem_visita">🆕 Novas ({semVisita.length})</option>
            {(aniversariantes.length > 0 || filtro === 'aniversariantes') &&
              <option value="aniversariantes">🎂 Aniversários ({aniversariantes.length})</option>}
            {(arquivadas.length > 0 || filtro === 'arquivadas') &&
              <option value="arquivadas">🗄 Arquivadas ({arquivadas.length})</option>}
          </select>
        </div>
        <div style={{ ...s.selectGroup, flex: 1 }}>
          <span style={s.selectLabel}>Ordenar</span>
          <select style={s.filtroSelect} value={ordenacao} onChange={e => setOrdenacao(e.target.value)}>
            <option value="nome">A–Z</option>
            <option value="gasto">Maior gasto</option>
            <option value="visitas">Mais visitas</option>
            <option value="recente">Mais recente</option>
          </select>
        </div>
      </div>

      {loading ? <CardSkeleton count={5} /> : <>
      <div style={s.sectionTitle}>{filtradas.length} cliente{filtradas.length !== 1 ? 's' : ''}</div>

      {filtradas.length > 0 && (
        <div style={s.tableWrap}>
          {/* Cabeçalho */}
          <div style={s.tableHead}>
            <div style={s.thStatus}>
              Status
              <Info size={11} color="var(--text3)" style={{ marginLeft: 3, verticalAlign: 'middle', cursor: 'help', flexShrink: 0 }} title="✓ Verde = retorno em dia · ⏰ Âmbar = nova (sem visita) · ! Vermelho = retorno pendente" />
            </div>
            <div style={s.thNome}>Nome</div>
            <div style={s.thTel}>Telefone</div>
            <div style={s.thHist}>
              Histórico
              <Info size={11} color="var(--text3)" style={{ marginLeft: 3, verticalAlign: 'middle', cursor: 'help', flexShrink: 0 }} title="Verde = atendimentos realizados · Vermelho = cancelamentos · Âmbar = pagamentos a receber" />
            </div>
            <div style={s.thData}>Último atend.</div>
            <div style={s.thData}>Próximo atend.</div>
            <div style={s.thOpt}>Edição</div>
          </div>

          {filtradaExibidas.map(c => {
            const sumida = estaSumida(c)
            const diasPassados = c.ultimo_atendimento ? differenceInDays(new Date(), parseUADate(c.ultimo_atendimento)) : null
            const prox = dadosExtras.proximoMap[c.id]
            const cancelados = dadosExtras.canceladosMap[c.id] || 0
            const aReceber = dadosExtras.pendentesMap[c.id] || 0

            return (
              <div key={c.id} style={s.tableRow} onClick={() => navigate(`/app/clientes/${c.id}`)}>
                {/* Status */}
                <div style={s.tdStatus}>
                  {sumida
                    ? <AlertCircle size={15} color="#B91C1C" />
                    : !c.ultimo_atendimento
                      ? <Clock size={15} color="#D97706" />
                      : <CheckCircle2 size={15} color="#15803D" />}
                </div>

                {/* Nome + tags */}
                <div style={s.tdNome}>
                  <div style={s.rowName}>{c.nome}</div>
                  <div style={s.rowTags}>
                    {filtro === 'aniversariantes' && aniversarioHoje(c) && <span style={s.tagHoje}>🎂 hoje!</span>}
                    {filtro === 'aniversariantes' && parabensEnviadoEsteAno(c) && !aguardandoParabens.has(c.id) && <span style={s.tagParabens}>✓ parabéns</span>}
                    {sumida && <span style={s.tagSumida}>Sumida</span>}
                    {c.total_visitas >= VISITAS_VIP && <span style={s.tagVip}>✦ VIP</span>}
                    {!c.ultimo_atendimento && <span style={s.tagNew}>Nova</span>}
                  </div>
                </div>

                {/* Telefone com ícone WA inline */}
                <div style={s.tdTel} onClick={e => e.stopPropagation()}>
                  {c.telefone ? (
                    filtro === 'aniversariantes' && aguardandoParabens.has(c.id) ? (
                      <div style={s.confirmWrap}>
                        <button style={s.btnConfirmei} onClick={e => confirmarParabens(e, c)}>✓ Enviei</button>
                        <button style={s.btnNaoEnviei} onClick={e => cancelarParabens(e, c)}>Não</button>
                      </div>
                    ) : (
                      <button
                        style={filtro === 'aniversariantes' && parabensEnviadoEsteAno(c) ? s.telBtnEnviado : s.telBtn}
                        onClick={e => filtro === 'aniversariantes' ? enviarParabens(e, c) : handleWhatsApp(e, c)}
                        title={filtro === 'aniversariantes' ? (parabensEnviadoEsteAno(c) ? 'Reenviar parabéns' : 'Enviar parabéns') : (sumida ? 'Chamar de volta' : 'Abrir WhatsApp')}
                      >
                        <MessageCircle size={13} style={{ flexShrink: 0, color: filtro === 'aniversariantes' && parabensEnviadoEsteAno(c) ? 'var(--text3)' : '#15803D' }} />
                        <span style={s.telNum}>{formatTelefone(c.telefone)}</span>
                      </button>
                    )
                  ) : <span style={s.noData}>—</span>}
                </div>

                {/* Histórico: realizados / cancelados / a receber */}
                <div style={s.tdHist}>
                  <span style={s.hpGreen}>{c.total_visitas || 0}</span>
                  <span style={s.hpRed}>{cancelados}</span>
                  <span style={s.hpAmber}>{aReceber}</span>
                </div>

                {/* Último atendimento */}
                <div style={s.tdData}>
                  {c.ultimo_atendimento ? (
                    <>
                      <div style={{ ...s.dataValor, ...(sumida ? { color: '#B91C1C', fontWeight: 600 } : {}) }}>
                        {format(parseUADate(c.ultimo_atendimento), 'dd/MM/yy')}
                      </div>
                      <div style={{ ...s.dataRel, ...(sumida ? { color: '#B91C1C' } : {}) }}>
                        há {diasPassados}d
                      </div>
                    </>
                  ) : <span style={s.noData}>—</span>}
                </div>

                {/* Próximo atendimento */}
                <div style={s.tdData}>
                  {prox ? (
                    <>
                      <div style={s.dataValor}>{format(dataParaDate(prox.data), 'dd/MM/yy')}</div>
                      <div style={s.dataRel}>{prox.horario?.slice(0, 5)}</div>
                    </>
                  ) : <span style={s.noData}>—</span>}
                </div>

                {/* Opções */}
                <div style={s.tdOpt} onClick={e => e.stopPropagation()}>
                  <button style={s.editBtn} onClick={e => { e.stopPropagation(); abrirEditModal(c) }} title="Editar">
                    <Pencil size={13} />
                  </button>
                  <ChevronRight size={13} color="var(--text3)" />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {filtradas.length === 0 && (
        busca
          ? <EmptyState titulo={`Nenhuma cliente encontrada para "${busca}"`} sub="Tente outro nome ou WhatsApp." />
          : <EmptyState
              icon={<Plus size={26} />}
              titulo="Você ainda não tem clientes"
              sub="Cadastre a primeira para começar a agendar e registrar atendimentos."
              cta="Cadastrar primeira cliente"
              onCta={abrirModalNova}
            />
      )}
      </>}

      {temMais && (
        <button style={s.verMaisBtn} onClick={() => setPagina(p => p + 1)}>
          Ver mais ({filtradas.length - pagina * ITENS_POR_PAGINA} restantes)
        </button>
      )}

      <button className="fab-btn" onClick={abrirModalNova} aria-label="Nova cliente">
        <Plus size={22} color="white" />
      </button>

      <UpgradeModal
        aberto={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        titulo="Limite de clientes atingido"
        descricao={`Você atingiu o limite de ${limiteClientes} clientes do plano ${plano?.nome}. Faça upgrade pro Pro pra cadastrar quantas clientes quiser.`}
      />

      {showModal && (
        <Modal onClose={() => setShowModal(false)} variant="sheet" boxStyle={s.modal}>
            <div style={s.modalTitle}>Nova cliente</div>
            <div style={s.field}>
              <label style={s.label}>Nome *</label>
              <input
                style={{ ...s.input, ...(erros.nome ? s.inputErro : {}) }}
                placeholder="Nome completo"
                value={form.nome}
                onChange={e => { setForm({ ...form, nome: e.target.value }); setErros({ ...erros, nome: null }) }}
              />
              {erros.nome && <span style={s.erroMsg}>{erros.nome}</span>}
            </div>
            <div style={s.field}>
              <label style={s.label}>WhatsApp</label>
              <input
                style={{ ...s.input, ...(erros.telefone ? s.inputErro : {}) }}
                placeholder="(51) 99999-9999"
                value={formatTelefone(form.telefone)}
                onChange={e => { setForm({ ...form, telefone: e.target.value }); setErros({ ...erros, telefone: null }) }}
                inputMode="numeric"
              />
              {erros.telefone && <span style={s.erroMsg}>{erros.telefone}</span>}
            </div>
            <div style={s.field}>
              <label style={s.label}>E-mail</label>
              <input
                style={{ ...s.input, ...(erros.email ? s.inputErro : {}) }}
                type="email"
                placeholder="opcional"
                value={form.email}
                onChange={e => { setForm({ ...form, email: e.target.value }); setErros({ ...erros, email: null }) }}
              />
              {erros.email && <span style={s.erroMsg}>{erros.email}</span>}
            </div>
            <div style={s.field}><label style={s.label}>Data de nascimento</label><input style={s.input} type="date" value={form.data_nascimento} onChange={e => setForm({ ...form, data_nascimento: e.target.value })} /></div>
            <div style={s.field}><label style={s.label}>Observações</label><input style={s.input} placeholder="Preferências, alergias..." value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} /></div>
            <div style={s.field}>
              <label style={s.label}>Retorno a cada (dias)</label>
              <input
                style={{ ...s.input, ...(erros.dias_retorno ? s.inputErro : {}) }}
                type="number"
                min="1"
                max="365"
                inputMode="numeric"
                placeholder={`Padrão (${diasAlerta} dias)`}
                value={form.dias_retorno}
                onChange={e => { setForm({ ...form, dias_retorno: e.target.value }); setErros({ ...erros, dias_retorno: null }) }}
              />
              {erros.dias_retorno
                ? <span style={s.erroMsg}>{erros.dias_retorno}</span>
                : <span style={s.hint}>Deixe em branco para usar o padrão de {diasAlerta} dias.</span>}
            </div>
            <button style={s.btnPrimary} onClick={salvarCliente} disabled={saving}>{saving ? 'Salvando...' : 'Cadastrar cliente'}</button>
            <button style={s.btnSecondary} onClick={() => { setShowModal(false); setErros({}) }}>Cancelar</button>
        </Modal>
      )}

      {showImport && (
        <Modal onClose={fecharImport} variant="sheet" boxStyle={s.modal}>
          <div style={s.modalTitle}>Importar clientes</div>
          <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5, margin: '0 0 14px' }}>
            Tem uma lista de clientes (caderno, planilha do celular)? Baixe o modelo, preencha e suba aqui — todas de uma vez.
          </p>

          <button style={{ ...s.btnSecondary, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }} onClick={baixarModeloClientes}>
            <Download size={15} /> Baixar planilha modelo (.xlsx)
          </button>

          <label style={s.uploadBox}>
            <input type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={processarArquivoImport} />
            <Upload size={20} color="var(--pink)" />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{importNomeArquivo || 'Escolher arquivo (.xlsx ou .csv)'}</span>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>Colunas: Nome, WhatsApp, Nascimento, E-mail, Observações, Retorno</span>
          </label>

          {importResumo && (
            <div style={s.importResumo}>
              <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 14 }}>✅ {importResumo.validas} cliente(s) prontas pra importar</div>
              {importResumo.duplicadas > 0 && <div style={{ marginTop: 3 }}>• {importResumo.duplicadas} já cadastradas (puladas pelo telefone)</div>}
              {importResumo.semNome > 0 && <div style={{ marginTop: 3 }}>• {importResumo.semNome} linha(s) sem nome (ignoradas)</div>}
            </div>
          )}

          <button style={s.btnPrimary} onClick={confirmarImportacao} disabled={importando || !importLinhas.length}>
            {importando ? 'Importando...' : importLinhas.length ? `Importar ${importLinhas.length} cliente(s)` : 'Selecione um arquivo'}
          </button>
          <button style={s.btnSecondary} onClick={fecharImport}>Cancelar</button>
        </Modal>
      )}

      {showEditModal && clienteEditando && (
        <Modal onClose={() => setShowEditModal(false)} variant="sheet" boxStyle={s.modal}>
          <div style={s.modalTitle}>Editar cliente</div>
          <div style={s.field}>
            <label style={s.label}>Nome *</label>
            <input
              style={{ ...s.input, ...(errosEdit.nome ? s.inputErro : {}) }}
              placeholder="Nome completo"
              value={formEdit.nome}
              onChange={e => { setFormEdit({ ...formEdit, nome: e.target.value }); setErrosEdit({ ...errosEdit, nome: null }) }}
            />
            {errosEdit.nome && <span style={s.erroMsg}>{errosEdit.nome}</span>}
          </div>
          <div style={s.field}>
            <label style={s.label}>WhatsApp</label>
            <input
              style={{ ...s.input, ...(errosEdit.telefone ? s.inputErro : {}) }}
              placeholder="(51) 99999-9999"
              value={formatTelefone(formEdit.telefone)}
              onChange={e => { setFormEdit({ ...formEdit, telefone: e.target.value }); setErrosEdit({ ...errosEdit, telefone: null }) }}
              inputMode="numeric"
            />
            {errosEdit.telefone && <span style={s.erroMsg}>{errosEdit.telefone}</span>}
          </div>
          <div style={s.field}>
            <label style={s.label}>E-mail</label>
            <input
              style={{ ...s.input, ...(errosEdit.email ? s.inputErro : {}) }}
              type="email" placeholder="opcional"
              value={formEdit.email}
              onChange={e => { setFormEdit({ ...formEdit, email: e.target.value }); setErrosEdit({ ...errosEdit, email: null }) }}
            />
            {errosEdit.email && <span style={s.erroMsg}>{errosEdit.email}</span>}
          </div>
          <div style={s.field}><label style={s.label}>Data de nascimento</label><input style={s.input} type="date" value={formEdit.data_nascimento} onChange={e => setFormEdit({ ...formEdit, data_nascimento: e.target.value })} /></div>
          <div style={s.field}><label style={s.label}>Observações</label><input style={s.input} placeholder="Preferências, alergias..." value={formEdit.observacoes} onChange={e => setFormEdit({ ...formEdit, observacoes: e.target.value })} /></div>
          <div style={s.field}>
            <label style={s.label}>Retorno a cada (dias)</label>
            <input
              style={{ ...s.input, ...(errosEdit.dias_retorno ? s.inputErro : {}) }}
              type="number" min="1" max="365" inputMode="numeric"
              placeholder={`Padrão (${diasAlerta} dias)`}
              value={formEdit.dias_retorno}
              onChange={e => { setFormEdit({ ...formEdit, dias_retorno: e.target.value }); setErrosEdit({ ...errosEdit, dias_retorno: null }) }}
            />
            {errosEdit.dias_retorno
              ? <span style={s.erroMsg}>{errosEdit.dias_retorno}</span>
              : <span style={s.hint}>Deixe em branco para usar o padrão de {diasAlerta} dias.</span>}
          </div>
          <button style={s.btnPrimary} onClick={salvarEdicaoRapida} disabled={savingEdit}>{savingEdit ? 'Salvando...' : 'Salvar alterações'}</button>
          <button style={s.btnSecondary} onClick={() => setShowEditModal(false)}>Cancelar</button>
        </Modal>
      )}
    </div>
  )
}

const s = {
  page: { padding: 16, paddingBottom: 80 },
  sectionTitle: { fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px', margin: '0 0 8px' },
  topRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 },
  searchBar: { display: 'flex', alignItems: 'center', gap: 8, flex: 1, background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', padding: '10px 13px', boxShadow: 'var(--shadow-xs)' },
  searchInput: { border: 'none', outline: 'none', flex: 1, fontSize: 14, background: 'transparent', color: 'var(--text)' },
  chipsRow: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  chip: { display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid #FECACA', borderRadius: 'var(--radius-pill)', padding: '5px 12px', fontSize: 12, fontWeight: 500, cursor: 'pointer' },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 },
  statCard: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', textAlign: 'center', boxShadow: 'var(--shadow-xs)', transition: 'border 0.15s' },
  statNum: { fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 700, color: 'var(--text)', lineHeight: 1 },
  statLabel: { fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginTop: 3 },
  // Chips (computador)
  filtrosChips: { display: 'flex', gap: 6, flex: 1, flexWrap: 'wrap' },
  filtroChip: { flexShrink: 0, padding: '6px 12px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border2)', background: 'var(--surface)', color: 'var(--text2)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'all 0.15s' },
  filtroChipAtivo: { background: 'var(--pink)', color: 'white', border: '1px solid var(--pink)', boxShadow: 'var(--shadow-pink)' },
  sortSelect: { flexShrink: 0, padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border2)', background: 'var(--surface)', color: 'var(--text2)', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', outline: 'none' },
  // Menus compactos (celular)
  selectGroup: { minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 },
  selectLabel: { fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', paddingLeft: 2 },
  filtroSelect: { width: '100%', height: 42, boxSizing: 'border-box', padding: '0 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border2)', background: 'var(--surface)', color: 'var(--text2)', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', outline: 'none' },
  // ── Tabela de clientes (7 colunas) ──
  tableWrap: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflowX: 'auto', boxShadow: 'var(--shadow-sm)' },
  tableHead: { display: 'grid', gridTemplateColumns: '0.55fr 1.3fr 1.1fr 1fr 1fr 1fr 0.55fr', gap: 0, alignItems: 'center', padding: '0', borderBottom: '1px solid var(--border)', background: 'var(--surface2)', minWidth: 680 },
  thStatus: { fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '8px 10px' },
  thNome: { fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '8px 10px' },
  thTel: { fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '8px 10px' },
  thHist: { fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '8px 10px' },
  thData: { fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '8px 10px' },
  thOpt: { fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '8px 10px', textAlign: 'right' },
  tableRow: { display: 'grid', gridTemplateColumns: '0.55fr 1.3fr 1.1fr 1fr 1fr 1fr 0.55fr', gap: 0, alignItems: 'center', padding: '0', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.1s', minWidth: 680 },
  tdStatus: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 10px' },
  tdNome: { minWidth: 0, padding: '10px 10px' },
  rowName: { fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  rowTags: { display: 'flex', gap: 4, marginTop: 3, flexWrap: 'wrap' },
  tdTel: { minWidth: 0, padding: '10px 10px' },
  telBtn: { display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', color: 'var(--text2)', maxWidth: '100%' },
  telBtnEnviado: { display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', color: 'var(--text3)', maxWidth: '100%' },
  telNum: { fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  tdHist: { display: 'flex', alignItems: 'center', gap: 4, padding: '10px 10px' },
  hpGreen: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 26, fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 20, background: '#eaf3de', color: '#3b6d11' },
  hpRed: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 26, fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 20, background: '#fcebeb', color: '#a32d2d' },
  hpAmber: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 26, fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 20, background: '#faeeda', color: '#854f0b' },
  tdData: { padding: '10px 10px' },
  dataValor: { fontSize: 12, color: 'var(--text2)' },
  dataRel: { fontSize: 11, color: 'var(--text3)', marginTop: 1 },
  noData: { fontSize: 12, color: 'var(--text3)' },
  tdOpt: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3, padding: '10px 10px' },
  editBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 'var(--radius-sm)', background: 'none', border: '1px solid var(--border2)', cursor: 'pointer', color: 'var(--text3)', flexShrink: 0, fontFamily: 'inherit' },
  confirmWrap: { display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 },
  btnConfirmei: { background: 'var(--green, #15803D)', color: 'white', border: 'none', borderRadius: 'var(--radius-pill)', padding: '6px 12px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  btnNaoEnviei: { background: 'transparent', color: 'var(--text3)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-pill)', padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  tagParabens: { fontSize: 10, padding: '2px 8px', borderRadius: 'var(--radius-pill)', background: '#DCFCE7', color: '#15803D', fontWeight: 700 },
  verMaisBtn: { width: '100%', padding: '12px', background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 600, color: 'var(--text2)', cursor: 'pointer', marginBottom: 16, fontFamily: 'inherit' },
  tagSumida: { fontSize: 10, padding: '2px 8px', borderRadius: 'var(--radius-pill)', background: 'var(--red-bg)', color: 'var(--red)', fontWeight: 600 },
  tagVip: { fontSize: 10, padding: '2px 8px', borderRadius: 'var(--radius-pill)', background: 'var(--gold)', color: 'var(--text)', fontWeight: 700, letterSpacing: '0.2px' },
  tagNew: { fontSize: 10, padding: '2px 6px', borderRadius: 'var(--radius-pill)', background: '#E6F1FB', color: '#185fa5', fontWeight: 600 },
  tagHoje: { fontSize: 10, padding: '2px 8px', borderRadius: 'var(--radius-pill)', background: '#FAE8FF', color: '#86198F', fontWeight: 700 },
  empty: { padding: '40px 0', textAlign: 'center' },
  modal: { background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '90vh', overflowY: 'auto' },
  modalTitle: { fontSize: 17, fontWeight: 700, marginBottom: 4 },
  btnImportar: { display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, whiteSpace: 'nowrap', background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-pill)', padding: '9px 14px', fontSize: 12.5, fontWeight: 700, color: 'var(--pink)', cursor: 'pointer', fontFamily: 'inherit', boxShadow: 'var(--shadow-xs)' },
  btnNova: { display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, whiteSpace: 'nowrap', background: 'var(--pink)', border: 'none', borderRadius: 'var(--radius-pill)', padding: '9px 16px', fontSize: 12.5, fontWeight: 700, color: 'white', cursor: 'pointer', fontFamily: 'inherit' },
  uploadBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, textAlign: 'center', border: '2px dashed var(--border2)', borderRadius: 'var(--radius-sm)', padding: '20px 14px', cursor: 'pointer', background: 'var(--surface2)', marginBottom: 12 },
  importResumo: { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', fontSize: 12.5, color: 'var(--text2)', marginBottom: 12 },
  field: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: labelBase,
  input: { ...inputBase, outline: 'none', transition: 'border 0.15s' },
  inputErro: { border: '1.5px solid #FCA5A5', background: '#FEF2F2' },
  erroMsg: { fontSize: 11, color: '#B91C1C', fontWeight: 600, marginTop: 4 },
  hint: { fontSize: 11, color: 'var(--text3)', marginTop: 2 },
  btnPrimary: btnPrimaryBase,
  btnSecondary: btnSecondaryBase,
}
