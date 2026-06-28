import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Phone, Calendar, DollarSign, Archive, RotateCcw, Pencil, Mail, Trash2, AlertCircle, CheckCircle } from 'lucide-react'
import WaIcon from '../components/common/WaIcon'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useSalao } from '../contexts/SalaoContext'
import { useToast } from '../contexts/ToastContext'
import { format, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { formatTelefone, unformatTelefone, validarEmail, validarTelefone, validarNome, formatBRL, linkWhatsApp } from '../lib/formatters'
import { useAssinatura } from '../contexts/AssinaturaContext'
import { MSG_RETORNO_PADRAO, MSG_COBRANCA_PADRAO, aplicarVariaveis } from '../lib/mensagens'
import Modal from '../components/common/Modal'
import { inputBase, labelBase, btnPrimaryBase, btnSecondaryBase } from '../lib/ui'
import { DIAS_RETORNO_PADRAO, VISITAS_VIP } from '../lib/constants'
import { traduzErro } from '../lib/erros'

export default function ClienteDetalhe() {
  const { id } = useParams()
  const { user } = useAuth()
  const { salaoId, gerenciaTudo } = useSalao()
  const navigate = useNavigate()
  const { confirmar, sucesso, erro } = useToast()
  const { temAcesso } = useAssinatura()
  const [cliente, setCliente] = useState(null)
  const [config, setConfig] = useState({ msg_retorno: MSG_RETORNO_PADRAO, msg_cobranca: MSG_COBRANCA_PADRAO, chave_pix: '', nome_salao: '' })
  const [historico, setHistorico] = useState([])
  const [histLimite, setHistLimite] = useState(10)
  const [filtroTimeline, setFiltroTimeline] = useState('todos')
  const [arquivando, setArquivando] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [form, setForm] = useState({ nome: '', telefone: '', email: '', data_nascimento: '', observacoes: '', dias_retorno: '' })
  const [erros, setErros] = useState({})
  const [savingEdit, setSavingEdit] = useState(false)

  useEffect(() => { if (user && id && salaoId) { setHistLimite(10); loadCliente(); loadHistorico(); loadConfig() } }, [user, id, salaoId])

  async function loadConfig() {
    const { data } = await supabase.from('configuracoes')
      .select('msg_retorno, msg_cobranca, chave_pix, nome_salao').eq('salao_id', salaoId).maybeSingle()
    if (data) setConfig({
      msg_retorno: data.msg_retorno || MSG_RETORNO_PADRAO,
      msg_cobranca: data.msg_cobranca || MSG_COBRANCA_PADRAO,
      chave_pix: data.chave_pix || '',
      nome_salao: data.nome_salao || '',
    })
  }

  async function loadCliente() {
    const { data, error } = await supabase.from('clientes').select('*').eq('id', id).eq('salao_id', salaoId).maybeSingle()
    if (error) { erro(traduzErro(error, 'Não foi possível carregar a cliente.')); return }
    if (!data) { navigate('/app/clientes'); return }
    setCliente(data)
  }

  function abrirEdicao() {
    setForm({
      nome: cliente.nome || '',
      telefone: cliente.telefone || '',
      email: cliente.email || '',
      data_nascimento: cliente.data_nascimento || '',
      observacoes: cliente.observacoes || '',
      dias_retorno: cliente.dias_retorno != null ? String(cliente.dias_retorno) : '',
    })
    setErros({})
    setShowEdit(true)
  }

  async function salvarEdicao() {
    const novosErros = {}
    if (!validarNome(form.nome)) novosErros.nome = 'Nome inválido (mín. 2 caracteres)'
    if (form.telefone && !validarTelefone(form.telefone)) novosErros.telefone = 'WhatsApp deve ter 10 ou 11 dígitos'
    if (form.email && !validarEmail(form.email)) novosErros.email = 'E-mail inválido'
    const dr = form.dias_retorno === '' ? null : parseInt(form.dias_retorno, 10)
    if (dr != null && (!Number.isFinite(dr) || dr < 1 || dr > 365)) novosErros.dias_retorno = 'Informe entre 1 e 365 dias'
    if (Object.keys(novosErros).length > 0) { setErros(novosErros); return }

    setSavingEdit(true)
    const updates = {
      nome: form.nome.trim(),
      telefone: unformatTelefone(form.telefone) || null,
      email: form.email.trim() || null,
      data_nascimento: form.data_nascimento || null,
      observacoes: form.observacoes.trim() || null,
      dias_retorno: dr,
    }
    const { error } = await supabase.from('clientes').update(updates).eq('id', id).eq('salao_id', salaoId)
    setSavingEdit(false)
    if (error) { erro(traduzErro(error, 'Não foi possível salvar as alterações.')); return }
    setCliente({ ...cliente, ...updates })
    setShowEdit(false)
    sucesso('Cliente atualizada')
  }

  async function loadHistorico() {
    const { data, error } = await supabase.from('agendamentos')
      .select('*, pagamentos(status, valor, forma)')
      .eq('cliente_id', id)
      .eq('salao_id', salaoId)
      .order('data', { ascending: false })
      .order('horario', { ascending: false })
    if (error) { erro(traduzErro(error, 'Não foi possível carregar o histórico.')); return }
    setHistorico(data || [])
  }

  async function toggleArquivar() {
    const arquivar = !cliente.arquivada
    if (arquivar) {
      const ok = await confirmar({
        titulo: 'Arquivar cliente?',
        mensagem: `${cliente.nome} sairá da lista de clientes, mas o histórico fica salvo. Você pode reativar quando quiser.`,
        confirmarLabel: 'Arquivar',
        tipo: 'aviso',
      })
      if (!ok) return
    }
    setArquivando(true)
    const { error } = await supabase.from('clientes').update({ arquivada: arquivar }).eq('id', id).eq('salao_id', salaoId)
    setArquivando(false)
    if (error) { erro(traduzErro(error, 'Não foi possível concluir a ação.')); return }
    if (arquivar) {
      sucesso('Cliente arquivada')
      navigate('/app/clientes')
    } else {
      sucesso('Cliente reativada')
      setCliente({ ...cliente, arquivada: false })
    }
  }

  async function excluirCliente() {
    if (historico.length > 0) {
      erro(`Esta cliente tem ${historico.length} atendimento(s) no histórico — não dá pra excluir de vez. Ela continua arquivada.`)
      return
    }
    const ok = await confirmar({
      titulo: 'Excluir esta cliente para sempre?',
      mensagem: `${cliente.nome} será removida definitivamente. Esta ação não pode ser desfeita.`,
      confirmarLabel: 'Sim, excluir', cancelarLabel: 'Cancelar', tipo: 'perigo',
    })
    if (!ok) return
    const { error } = await supabase.from('clientes').delete().eq('id', id).eq('salao_id', salaoId)
    if (error) { erro(traduzErro(error, 'Não foi possível excluir a cliente.')); return }
    sucesso('Cliente excluída')
    navigate('/app/clientes')
  }

  // ── Cálculos do histórico ──
  const somaPagos = (h) => (h.pagamentos || [])
    .filter(p => p.status === 'pago')
    .reduce((s, p) => s + (p.valor || 0), 0)
  const realizados = historico.filter(h => h.status === 'realizado')
  const cancelados = historico.filter(h => h.status === 'cancelado')
  const totalRecebido = realizados.reduce((acc, h) => acc + somaPagos(h), 0)
  const ticketMedio = realizados.length ? totalRecebido / realizados.length : 0
  const hoje = format(new Date(), 'yyyy-MM-dd')
  const proximoAgendamento = historico
    .filter(h => (h.status === 'pendente' || h.status === 'agendado' || h.status === 'confirmado') && h.data >= hoje)
    .sort((a, b) => a.data.localeCompare(b.data) || (a.horario || '').localeCompare(b.horario || ''))[0] ?? null

  if (!cliente) return <div style={{ padding: 24, color: 'var(--text3)' }}>Carregando...</div>

  // ── Status de retorno ──
  const cicloRetorno = cliente.dias_retorno ?? DIAS_RETORNO_PADRAO
  const diasSemVoltar = cliente.ultimo_atendimento
    ? differenceInDays(new Date(), new Date(cliente.ultimo_atendimento + 'T12:00:00'))
    : null
  const retornoPendente = diasSemVoltar != null && diasSemVoltar >= cicloRetorno
  const msgRetorno = aplicarVariaveis(config.msg_retorno || MSG_RETORNO_PADRAO, { nome: cliente.nome, salao: config.nome_salao })

  // ── A receber ──
  const aReceber = historico
    .filter(h => h.status !== 'cancelado')
    .flatMap(h => (h.pagamentos || []).filter(p => p.status === 'pendente').map(p => ({ valor: p.valor || 0, servico: h.servico })))
  const totalAReceber = aReceber.reduce((s, p) => s + p.valor, 0)
  const servicoCobranca = aReceber.length === 1 ? aReceber[0].servico : ''
  const msgCobranca = aplicarVariaveis(config.msg_cobranca || MSG_COBRANCA_PADRAO, {
    nome: cliente.nome, salao: config.nome_salao, servico: servicoCobranca, valor: formatBRL(totalAReceber), pix: config.chave_pix,
  })

  // ── Aniversário ──
  const nascDate = cliente.data_nascimento ? new Date(cliente.data_nascimento + 'T12:00:00') : null

  // ── Timeline paginada com filtro ──
  const FILTROS_TIMELINE = [
    { id: 'todos',      label: 'Todos' },
    { id: 'realizados', label: 'Realizados' },
    { id: 'agendados',  label: 'Agendados' },
    { id: 'cancelados', label: 'Cancelados' },
  ]
  const historicoFiltrado = filtroTimeline === 'todos' ? historico
    : filtroTimeline === 'realizados' ? historico.filter(h => h.status === 'realizado')
    : filtroTimeline === 'agendados'  ? historico.filter(h => ['pendente', 'agendado', 'confirmado'].includes(h.status))
    : historico.filter(h => h.status === 'cancelado')
  const historicoVisivel = historicoFiltrado.slice(0, histLimite)
  const temMaisHistorico = historicoFiltrado.length > histLimite

  // ── Flags de visibilidade da seção Situação ──
  const temRetorno = diasSemVoltar != null
  const temSituacao = temRetorno || proximoAgendamento || totalAReceber > 0

  return (
    <div style={s.page}>
      {/* TopBar */}
      <div style={s.topBar}>
        <button style={s.backBtn} onClick={() => navigate(-1)}><ArrowLeft size={20} /></button>
        <span style={s.topTitle}>Perfil da cliente</span>
        <button style={s.editBtn} onClick={abrirEdicao} title="Editar cliente"><Pencil size={17} /></button>
      </div>

      {/* ── Identificação ── */}
      <div style={s.profile}>
        <div style={s.profileName}>{cliente.nome}</div>
        {(cliente.total_visitas || 0) >= VISITAS_VIP && (
          <span style={s.vipBadge}>✦ VIP</span>
        )}
        {cliente.telefone && (
          <a href={linkWhatsApp(cliente.telefone, retornoPendente ? msgRetorno : '')} style={s.wppBtn} target="_blank" rel="noopener noreferrer">
            <WaIcon size={14} /> {formatTelefone(cliente.telefone)}
          </a>
        )}
        {cliente.email && (
          <a href={`mailto:${cliente.email}`} style={s.emailLink}>
            <Mail size={13} /> {cliente.email}
          </a>
        )}
        {nascDate && (
          <div style={s.emailLink}>🎂 Aniversário em {format(nascDate, 'dd/MM')}</div>
        )}
      </div>

      {/* ── Situação ── */}
      <div style={s.sectionTitle}>situação</div>
      <div style={s.situacaoCard}>
        {/* Status de retorno */}
        {temRetorno && (
          <div style={s.situRow}>
            <div style={{ ...s.situIcon, background: retornoPendente ? '#FEE2E2' : '#DCFCE7' }}>
              {retornoPendente
                ? <AlertCircle size={14} color="#B91C1C" />
                : <CheckCircle size={14} color="#15803D" />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={s.situLabel}>Retorno</div>
              <div style={{ ...s.situValor, color: retornoPendente ? '#B91C1C' : '#15803D' }}>
                {retornoPendente ? `Pendente há ${diasSemVoltar} dias` : 'Em dia'}
              </div>
            </div>
            {retornoPendente && cliente.telefone && (
              <a href={linkWhatsApp(cliente.telefone, msgRetorno)} target="_blank" rel="noreferrer" style={s.chamarBtn}>
                Chamar
              </a>
            )}
          </div>
        )}

        {/* Próximo agendamento */}
        {proximoAgendamento && (
          <>
            {temRetorno && <div style={s.situDivider} />}
            <div style={s.situRow}>
              <div style={{ ...s.situIcon, background: 'var(--pink-light)' }}>
                <Calendar size={14} color="var(--pink)" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={s.situLabel}>Próximo agendamento</div>
                <div style={{ ...s.situValor, color: 'var(--pink)' }}>
                  {format(new Date(proximoAgendamento.data + 'T12:00:00'), "EEE, dd/MM", { locale: ptBR })} · {proximoAgendamento.horario?.slice(0, 5)}
                </div>
              </div>
              <span style={s.badgeAzul}>
                {format(new Date(proximoAgendamento.data + 'T12:00:00'), 'dd/MM', { locale: ptBR })}
              </span>
            </div>
          </>
        )}

        {/* A receber */}
        {totalAReceber > 0 && (
          <>
            {(temRetorno || proximoAgendamento) && <div style={s.situDivider} />}
            <div style={s.situRow}>
              <div style={{ ...s.situIcon, background: '#FEF3C7' }}>
                <DollarSign size={14} color="#92400E" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={s.situLabel}>A receber</div>
                <div style={{ ...s.situValor, color: '#92400E' }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{formatBRL(totalAReceber)}</span>
                  <span style={{ fontSize: 11, color: '#B45309', marginLeft: 5 }}>
                    · {aReceber.length} pendente{aReceber.length > 1 ? 's' : ''}
                  </span>
                </div>
              </div>
              {cliente.telefone && temAcesso('cobrancaWhatsapp') && (
                <a href={linkWhatsApp(cliente.telefone, msgCobranca)} target="_blank" rel="noreferrer" style={s.cobrarBtn}>Cobrar</a>
              )}
            </div>
          </>
        )}

        {/* Sem histórico ainda */}
        {!temSituacao && (
          <div style={{ padding: '14px 4px', color: 'var(--text3)', fontSize: 13, textAlign: 'center' }}>
            Nenhuma visita registrada ainda
          </div>
        )}
      </div>

      {/* ── Histórico (métricas) ── */}
      {historico.length > 0 && (
        <>
          <div style={s.sectionTitle}>
            histórico{!gerenciaTudo ? ' · seus dados' : ''}
          </div>
          <div className="metricas-grid" style={s.metricasGrid}>
            <div style={s.metricaCard}>
              <div style={s.metricaValor}>{realizados.length}</div>
              <div style={s.metricaLabel}>atendimentos</div>
            </div>
            <div style={s.metricaCard}>
              <div style={{ ...s.metricaValor, color: 'var(--green)' }}>{formatBRL(totalRecebido)}</div>
              <div style={s.metricaLabel}>recebido</div>
            </div>
            <div style={s.metricaCard}>
              <div style={s.metricaValor}>{formatBRL(ticketMedio)}</div>
              <div style={s.metricaLabel}>ticket médio</div>
            </div>
            <div style={s.metricaCard}>
              <div style={s.metricaValor}>
                {cliente.ultimo_atendimento
                  ? format(new Date(cliente.ultimo_atendimento + 'T12:00:00'), 'dd/MM')
                  : '—'}
              </div>
              <div style={s.metricaLabel}>última vez</div>
            </div>
          </div>
        </>
      )}

      {/* ── Informações ── */}
      <div style={s.sectionTitle}>informações</div>
      {cliente.observacoes && (
        <div style={s.obs}>
          <div style={s.obsTitle}>Observações</div>
          <div style={s.obsText}>{cliente.observacoes}</div>
        </div>
      )}
      <div style={s.retornoCard} onClick={abrirEdicao}>
        <div style={{ flex: 1 }}>
          <div style={s.obsTitle}>Retorno previsto</div>
          <div style={s.retornoSub}>
            {cliente.dias_retorno != null
              ? `Alerta de retorno a cada ${cliente.dias_retorno} dias`
              : `Padrão de ${DIAS_RETORNO_PADRAO} dias`}
          </div>
        </div>
        <div style={s.retornoBadge}>
          {cliente.dias_retorno ?? DIAS_RETORNO_PADRAO}<span style={s.retornoUnidade}> dias</span>
        </div>
      </div>

      {/* ── Linha do tempo ── */}
      <div style={s.sectionTitle}>linha do tempo</div>
      <div style={s.tlFiltros}>
        {FILTROS_TIMELINE.map(f => {
          const count = f.id === 'todos' ? historico.length
            : f.id === 'realizados' ? realizados.length
            : f.id === 'agendados'  ? historico.filter(h => ['pendente', 'agendado', 'confirmado'].includes(h.status)).length
            : cancelados.length
          if (count === 0 && f.id !== 'todos') return null
          const ativo = filtroTimeline === f.id
          return (
            <button
              key={f.id}
              style={{ ...s.tlChip, ...(ativo ? s.tlChipAtivo : {}) }}
              onClick={() => { setFiltroTimeline(f.id); setHistLimite(10) }}
            >
              {f.label}
              <span style={{ ...s.tlChipBadge, ...(ativo ? s.tlChipBadgeAtivo : {}) }}>{count}</span>
            </button>
          )
        })}
      </div>

      {historicoFiltrado.length === 0
        ? <div style={s.empty}>Nenhum atendimento registrado</div>
        : (
          <div style={s.timeline}>
            {historicoVisivel.map((h, i) => {
              const st = HIST_STATUS[h.status] || HIST_STATUS.pendente
              const pagamentos = h.pagamentos || []
              const pagos = pagamentos.filter(p => p.status === 'pago')
              const temPag = pagamentos.length > 0
              const pago = temPag && pagos.length === pagamentos.length
              const valorPago = pagos.reduce((s, p) => s + (p.valor || 0), 0)
              const valorExibido = pagos.length ? valorPago : (h.valor ?? 0)
              const formasPagas = [...new Set(pagos.map(p => FORMA_LABEL[p.forma] || p.forma).filter(Boolean))].join(' + ')
              const cancelado = h.status === 'cancelado'
              const ultimo = i === historicoVisivel.length - 1
              return (
                <div key={h.id} style={s.tlRow}>
                  <div style={s.tlGutter}>
                    <span style={{ ...s.tlDot, background: st.cor, borderColor: st.cor }} />
                    {!ultimo && <span style={s.tlLine} />}
                  </div>
                  <div style={{ ...s.tlCard, ...(cancelado ? { opacity: 0.6 } : {}) }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ ...s.histService, ...(cancelado ? { textDecoration: 'line-through' } : {}) }}>{h.servico}</div>
                        <div style={s.histDate}>
                          {format(new Date(h.data + 'T12:00:00'), "dd 'de' MMM yyyy", { locale: ptBR })}
                          {h.horario && ` · ${h.horario.slice(0, 5)}`}
                        </div>
                      </div>
                      <span style={{ ...s.badge, background: st.bg, color: st.cor }}>{st.label}</span>
                    </div>
                    {!cancelado && (h.valor > 0 || temPag) && (
                      <div style={s.tlPagRow}>
                        <span style={s.histValor}>{formatBRL(valorExibido)}</span>
                        {temPag && (
                          <span style={{ ...s.badge, ...(pago ? s.badgePago : s.badgePendente) }}>
                            {pago ? '✓ Pago' : '⏳ Pendente'}{formasPagas ? ` · ${formasPagas}` : ''}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )
      }

      {temMaisHistorico && (
        <button style={s.verMaisHist} onClick={() => setHistLimite(l => l + 10)}>
          Ver mais atendimentos ({historicoFiltrado.length - histLimite} restantes)
        </button>
      )}

      {/* ── Arquivar / Reativar ── */}
      <div style={s.arquivarArea}>
        {cliente.arquivada && (
          <div style={s.arquivadaAviso}>Esta cliente está arquivada — não aparece na lista principal.</div>
        )}
        <button
          style={{ ...s.arquivarBtn, ...(cliente.arquivada ? s.reativarBtn : {}) }}
          onClick={toggleArquivar}
          disabled={arquivando}
        >
          {cliente.arquivada ? <RotateCcw size={15} /> : <Archive size={15} />}
          {arquivando ? 'Salvando...' : cliente.arquivada ? 'Reativar cliente' : 'Arquivar cliente'}
        </button>
        {cliente.arquivada && (
          <button style={s.excluirBtn} onClick={excluirCliente} disabled={arquivando}>
            <Trash2 size={15} /> Excluir definitivamente
          </button>
        )}
      </div>

      {/* ── Modal de edição ── */}
      {showEdit && (
        <Modal onClose={() => setShowEdit(false)} variant="responsive" boxStyle={s.modal}>
          <div style={s.modalTitle}>Editar cliente</div>
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
          <div style={s.field}>
            <label style={s.label}>Data de nascimento</label>
            <input style={s.input} type="date" value={form.data_nascimento} onChange={e => setForm({ ...form, data_nascimento: e.target.value })} />
          </div>
          <div style={s.field}>
            <label style={s.label}>Observações</label>
            <input style={s.input} placeholder="Preferências, alergias..." value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} />
          </div>
          <div style={s.field}>
            <label style={s.label}>Retorno a cada (dias)</label>
            <input
              style={{ ...s.input, ...(erros.dias_retorno ? s.inputErro : {}) }}
              type="number"
              min="1"
              max="365"
              inputMode="numeric"
              placeholder={`Padrão (${DIAS_RETORNO_PADRAO} dias)`}
              value={form.dias_retorno}
              onChange={e => { setForm({ ...form, dias_retorno: e.target.value }); setErros({ ...erros, dias_retorno: null }) }}
            />
            {erros.dias_retorno
              ? <span style={s.erroMsg}>{erros.dias_retorno}</span>
              : <span style={s.hint}>Deixe em branco para usar o padrão de {DIAS_RETORNO_PADRAO} dias.</span>}
          </div>
          <button style={s.btnPrimary} onClick={salvarEdicao} disabled={savingEdit}>{savingEdit ? 'Salvando...' : 'Salvar alterações'}</button>
          <button style={s.btnSecondary} onClick={() => setShowEdit(false)}>Cancelar</button>
        </Modal>
      )}
    </div>
  )
}

const HIST_STATUS = {
  agendado:   { label: 'Agendada',   cor: '#1D4ED8', bg: '#DBEAFE' },
  realizado:  { label: 'Realizado',  cor: '#5B21B6', bg: '#EDE9FE' },
  confirmado: { label: 'Confirmada', cor: '#15803D', bg: '#DCFCE7' },
  pendente:   { label: 'Aguardando', cor: '#92400E', bg: '#FEF3C7' },
  cancelado:  { label: 'Cancelado',  cor: '#B91C1C', bg: '#FEE2E2' },
}

const FORMA_LABEL = { pix: 'Pix', dinheiro: 'Dinheiro', cartao_debito: 'Débito', cartao_credito: 'Crédito' }

const s = {
  page: { padding: 16, paddingBottom: 80 },
  topBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  backBtn: { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 9, cursor: 'pointer', color: 'var(--text)', display: 'flex', padding: '6px 8px' },
  topTitle: { fontSize: 15, fontWeight: 700 },
  editBtn: { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 9, cursor: 'pointer', color: 'var(--text)', display: 'flex', padding: '6px 8px' },

  // Identificação
  profile: { display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 20, gap: 7 },
  profileName: { fontSize: 20, fontWeight: 700 },
  vipBadge: { fontSize: 12, padding: '3px 12px', borderRadius: 'var(--radius-pill)', background: 'var(--gold)', color: 'var(--text)', fontWeight: 700, letterSpacing: '0.2px' },
  wppBtn: { display: 'flex', alignItems: 'center', gap: 5, background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid #86EFAC', borderRadius: 'var(--radius-pill)', padding: '7px 15px', fontSize: 13, fontWeight: 600 },
  emailLink: { display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text3)', fontSize: 12.5, fontWeight: 500, textDecoration: 'none', marginTop: 2 },

  // Situação
  sectionTitle: { fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px', margin: '0 0 10px' },
  situacaoCard: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '2px 15px', marginBottom: 20, boxShadow: 'var(--shadow-xs)' },
  situRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0' },
  situIcon: { width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  situLabel: { fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 2 },
  situValor: { fontSize: 13, fontWeight: 600 },
  situDivider: { height: 1, background: 'var(--border)', marginLeft: 42 },
  chamarBtn: { flexShrink: 0, background: 'var(--pink)', color: 'white', border: 'none', borderRadius: 'var(--radius-pill)', padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', fontFamily: 'inherit' },
  badgeAzul: { flexShrink: 0, fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: 'var(--pink)', background: 'var(--pink-light)', borderRadius: 'var(--radius-pill)', padding: '4px 10px' },
  cobrarBtn: { flexShrink: 0, background: 'var(--green, #15803D)', color: 'white', border: 'none', borderRadius: 'var(--radius-pill)', padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', fontFamily: 'inherit' },

  // Métricas (4 cards — gridTemplateColumns via CSS class .metricas-grid)
  metricasGrid: { display: 'grid', gap: 10, marginBottom: 20 },
  metricaCard: { background: 'var(--surface)', borderRadius: 'var(--radius-sm)', padding: '13px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, boxShadow: 'var(--shadow-xs)', border: '1px solid var(--border)' },
  metricaValor: { fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 700, color: 'var(--text)', lineHeight: 1 },
  metricaLabel: { fontSize: 10, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' },

  // Informações
  obs: { background: 'var(--surface)', borderRadius: 'var(--radius-sm)', padding: '13px 15px', marginBottom: 10, boxShadow: 'var(--shadow-xs)', border: '1px solid var(--border)' },
  obsTitle: { fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 },
  obsText: { fontSize: 13, color: 'var(--text2)', lineHeight: 1.55 },
  retornoCard: { display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface)', borderRadius: 'var(--radius-sm)', padding: '13px 15px', marginBottom: 20, boxShadow: 'var(--shadow-xs)', border: '1px solid var(--border)', cursor: 'pointer' },
  retornoSub: { fontSize: 13, color: 'var(--text2)', marginTop: 4 },
  retornoBadge: { flexShrink: 0, fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 700, color: 'var(--pink)', background: 'var(--pink-light)', borderRadius: 'var(--radius-pill)', padding: '6px 14px' },
  retornoUnidade: { fontSize: 11, color: 'var(--text3)', fontWeight: 600 },

  // Linha do tempo
  tlFiltros: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 },
  tlChip: { display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border2)', background: 'var(--surface)', fontSize: 12, fontWeight: 600, color: 'var(--text2)', cursor: 'pointer', fontFamily: 'inherit' },
  tlChipAtivo: { background: 'var(--pink)', color: 'white', borderColor: 'var(--pink)' },
  tlChipBadge: { fontSize: 10, fontWeight: 700, background: 'var(--border2)', color: 'var(--text3)', borderRadius: 10, padding: '1px 6px' },
  tlChipBadgeAtivo: { background: 'rgba(255,255,255,0.25)', color: 'white' },
  cancelInfo: { color: '#B91C1C', fontWeight: 600 },
  timeline: { display: 'flex', flexDirection: 'column' },
  tlRow: { display: 'flex', gap: 12 },
  tlGutter: { display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: 14 },
  tlDot: { width: 13, height: 13, borderRadius: '50%', border: '3px solid', background: 'white', marginTop: 4, flexShrink: 0, boxShadow: '0 0 0 3px var(--surface)' },
  tlLine: { width: 2, flex: 1, background: 'var(--border2)', marginTop: 2, minHeight: 14 },
  tlCard: { flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '11px 14px', marginBottom: 12, boxShadow: 'var(--shadow-xs)' },
  tlPagRow: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 },
  histService: { fontSize: 14, fontWeight: 600 },
  histDate: { fontSize: 12, color: 'var(--text3)', marginTop: 2 },
  histValor: { fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 500, color: 'var(--pink)' },
  badge: { fontSize: 11, padding: '2px 9px', borderRadius: 'var(--radius-pill)', fontWeight: 600 },
  badgePago: { background: 'var(--green-bg)', color: 'var(--green)' },
  badgePendente: { background: 'var(--amber-bg)', color: 'var(--amber)' },
  empty: { color: 'var(--text3)', fontSize: 14, textAlign: 'center', padding: '24px 0' },
  verMaisHist: { width: '100%', padding: '11px', background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 600, color: 'var(--text2)', cursor: 'pointer', marginTop: 4, fontFamily: 'inherit' },

  // Arquivar
  arquivarArea: { marginTop: 24, paddingTop: 16, borderTop: '1px dashed var(--border2)', display: 'flex', flexDirection: 'column', gap: 10 },
  arquivadaAviso: { fontSize: 12, color: '#92400E', background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 'var(--radius-sm)', padding: '9px 12px', textAlign: 'center' },
  arquivarBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: 'var(--surface2)', color: 'var(--text2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', padding: '11px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  reativarBtn: { background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid #86EFAC' },
  excluirBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: 'transparent', color: 'var(--red)', border: '1px solid #FCA5A5', borderRadius: 'var(--radius-sm)', padding: '11px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },

  // Modal de edição
  modal: { background: 'var(--surface)', padding: '18px 18px 20px', width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '92vh', overflowY: 'auto' },
  modalTitle: { fontSize: 16, fontWeight: 700, marginBottom: 2 },
  field: { display: 'flex', flexDirection: 'column', gap: 3 },
  label: labelBase,
  input: { ...inputBase, padding: '9px 12px', outline: 'none', transition: 'border 0.15s' },
  inputErro: { border: '1.5px solid #FCA5A5', background: '#FEF2F2' },
  erroMsg: { fontSize: 11, color: '#B91C1C', fontWeight: 600, marginTop: 2 },
  hint: { fontSize: 11, color: 'var(--text3)', marginTop: 1 },
  btnPrimary: { ...btnPrimaryBase, padding: '12px' },
  btnSecondary: { ...btnSecondaryBase, padding: '10px' },
}
