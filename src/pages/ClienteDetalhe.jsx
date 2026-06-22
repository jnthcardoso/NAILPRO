import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Phone, Calendar, DollarSign, Archive, RotateCcw, Pencil, Mail } from 'lucide-react'
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
  const [arquivando, setArquivando] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [form, setForm] = useState({ nome: '', telefone: '', email: '', data_nascimento: '', observacoes: '', dias_retorno: '' })
  const [erros, setErros] = useState({})
  const [savingEdit, setSavingEdit] = useState(false)

  useEffect(() => { if (user && id && salaoId) { loadCliente(); loadHistorico(); loadConfig() } }, [user, id, salaoId])

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
    if (error) { erro(traduzErro(error, 'Não foi possível carregar a cliente.')); return } // erro de rede ≠ cliente inexistente
    if (!data) { navigate('/app/clientes'); return } // Bloqueia acesso a clientes de outros salões
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
    // Sem limite: o resumo (atendimentos/recebido/ticket) precisa do histórico
    // completo da cliente pra bater com os totais do topo.
    const { data, error } = await supabase.from('agendamentos')
      .select('*, pagamentos(status, valor, forma)')
      .eq('cliente_id', id)
      .order('data', { ascending: false })
      .order('horario', { ascending: false })
    if (error) { erro(traduzErro(error, 'Não foi possível carregar o histórico.')); return }
    setHistorico(data || [])
  }

  function getInitials(nome) {
    return nome?.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase() || '??'
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

  // Resumo do histórico
  // Um atendimento pode ter 2 pagamentos (pago em 2 formas) — soma TODOS os pagos,
  // não só o primeiro, senão o recebido/ticket da cliente fica subestimado.
  const somaPagos = (h) => (h.pagamentos || [])
    .filter(p => p.status === 'pago')
    .reduce((s, p) => s + (p.valor || 0), 0)
  const realizados = historico.filter(h => h.status === 'realizado')
  const cancelados = historico.filter(h => h.status === 'cancelado')
  // Recebido e ticket usam a MESMA base (só realizados), pra bater com o "total gasto"
  // do topo e não inflar o ticket com pagamento de atendimento não-realizado.
  const totalRecebido = realizados.reduce((acc, h) => acc + somaPagos(h), 0)
  const ticketMedio = realizados.length ? totalRecebido / realizados.length : 0

  if (!cliente) return <div style={{ padding: 24, color: 'var(--text3)' }}>Carregando...</div>

  // ── Status de retorno (#3) ──
  const cicloRetorno = cliente.dias_retorno ?? DIAS_RETORNO_PADRAO
  const diasSemVoltar = cliente.ultimo_atendimento
    ? differenceInDays(new Date(), new Date(cliente.ultimo_atendimento + 'T12:00:00'))
    : null
  const retornoPendente = diasSemVoltar != null && diasSemVoltar >= cicloRetorno
  const msgRetorno = aplicarVariaveis(config.msg_retorno || MSG_RETORNO_PADRAO, { nome: cliente.nome, salao: config.nome_salao })

  // ── A receber desta cliente (#4): pagamentos pendentes (exceto cancelados) ──
  const aReceber = historico
    .filter(h => h.status !== 'cancelado')
    .flatMap(h => (h.pagamentos || []).filter(p => p.status === 'pendente').map(p => ({ valor: p.valor || 0, servico: h.servico })))
  const totalAReceber = aReceber.reduce((s, p) => s + p.valor, 0)
  const servicoCobranca = aReceber.length === 1 ? aReceber[0].servico : ''
  const msgCobranca = aplicarVariaveis(config.msg_cobranca || MSG_COBRANCA_PADRAO, {
    nome: cliente.nome, salao: config.nome_salao, servico: servicoCobranca, valor: formatBRL(totalAReceber), pix: config.chave_pix,
  })

  // ── Aniversário (#9) ──
  const nascDate = cliente.data_nascimento ? new Date(cliente.data_nascimento + 'T12:00:00') : null

  return (
    <div style={s.page}>
      <div style={s.topBar}>
        <button style={s.backBtn} onClick={() => navigate(-1)}><ArrowLeft size={20} /></button>
        <span style={s.topTitle}>Perfil da cliente</span>
        <button style={s.editBtn} onClick={abrirEdicao} title="Editar cliente"><Pencil size={17} /></button>
      </div>

      <div style={s.profile}>
        <div style={s.avatar}>{getInitials(cliente.nome)}</div>
        <div style={s.profileName}>{cliente.nome}</div>
        {/* VIP badge: Gold + Noir */}
        {(cliente.total_visitas || 0) >= VISITAS_VIP && (
          <span style={s.vipBadge}>✦ VIP</span>
        )}
        {cliente.telefone && (
          <a href={linkWhatsApp(cliente.telefone, retornoPendente ? msgRetorno : '')} style={s.wppBtn} target="_blank" rel="noopener noreferrer">
            <Phone size={14} /> {formatTelefone(cliente.telefone)}
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
        {cliente.ultimo_atendimento && (
          <span style={retornoPendente ? s.statusPend : s.statusEmDia}>
            {retornoPendente ? `⚠️ Retorno pendente há ${diasSemVoltar} dias` : '✓ Retorno em dia'}
          </span>
        )}
      </div>

      <div style={s.statsGrid}>
        <div style={s.statCard}>
          <Calendar size={18} color="var(--pink)" />
          <div style={s.statValue}>{cliente.total_visitas || 0}</div>
          <div style={s.statLabel}>visitas</div>
        </div>
        <div style={s.statCard}>
          <DollarSign size={18} color="var(--green)" />
          <div style={s.statValue}>{formatBRL(cliente.total_gasto || 0)}</div>
          <div style={s.statLabel}>total gasto</div>
        </div>
        <div style={s.statCard}>
          <Calendar size={18} color="var(--text3)" />
          <div style={s.statValue}>
            {cliente.ultimo_atendimento ? format(new Date(cliente.ultimo_atendimento + 'T12:00:00'), 'dd/MM') : '—'}
          </div>
          <div style={s.statLabel}>última vez</div>
        </div>
      </div>

      {/* Profissional vê o histórico só dos atendimentos dela (RLS); os cards acima
          são do salão inteiro. Avisa pra não parecer número errado. */}
      {!gerenciaTudo && (
        <div style={s.escopoNota}>Resumo geral do salão</div>
      )}

      {cliente.observacoes && (
        <div style={s.obs}>
          <div style={s.obsTitle}>Observações</div>
          <div style={s.obsText}>{cliente.observacoes}</div>
        </div>
      )}

      {/* Ciclo de retorno individual */}
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

      {/* A receber desta cliente (#4) */}
      {totalAReceber > 0 && (
        <div style={s.aReceberCard}>
          <div style={{ flex: 1 }}>
            <div style={s.obsTitle}>A receber desta cliente</div>
            <div style={s.aReceberValor}>
              {formatBRL(totalAReceber)}
              <span style={s.aReceberQtd}> · {aReceber.length} pendente{aReceber.length > 1 ? 's' : ''}</span>
            </div>
          </div>
          {cliente.telefone && temAcesso('cobrancaWhatsapp') && (
            <a href={linkWhatsApp(cliente.telefone, msgCobranca)} target="_blank" rel="noreferrer" style={s.cobrarBtn}>Cobrar</a>
          )}
        </div>
      )}

      {/* Resumo do histórico */}
      {historico.length > 0 && !gerenciaTudo && (
        <div style={s.resumoEscopoTitulo}>Seus atendimentos com esta cliente</div>
      )}
      {historico.length > 0 && (
        <div style={s.resumoGrid}>
          <div style={s.resumoCard}>
            <div style={s.resumoValor}>{realizados.length}</div>
            <div style={s.resumoLabel}>atendimentos</div>
          </div>
          <div style={s.resumoCard}>
            <div style={{ ...s.resumoValor, color: 'var(--green)' }}>{formatBRL(totalRecebido)}</div>
            <div style={s.resumoLabel}>recebido</div>
          </div>
          <div style={s.resumoCard}>
            <div style={s.resumoValor}>{formatBRL(ticketMedio)}</div>
            <div style={s.resumoLabel}>ticket médio</div>
          </div>
        </div>
      )}

      <div style={s.sectionTitle}>
        linha do tempo
        {cancelados.length > 0 && <span style={s.cancelInfo}> · {cancelados.length} cancelado{cancelados.length > 1 ? 's' : ''}</span>}
      </div>

      {historico.length === 0
        ? <div style={s.empty}>Nenhum atendimento registrado</div>
        : (
          <div style={s.timeline}>
            {historico.map((h, i) => {
              const st = HIST_STATUS[h.status] || HIST_STATUS.pendente
              const pagamentos = h.pagamentos || []
              const pagos = pagamentos.filter(p => p.status === 'pago')
              const temPag = pagamentos.length > 0
              // quitado só quando TODOS os pagamentos do atendimento estão pagos
              const pago = temPag && pagos.length === pagamentos.length
              const valorPago = pagos.reduce((s, p) => s + (p.valor || 0), 0)
              const valorExibido = pagos.length ? valorPago : (h.valor ?? 0)
              const formasPagas = [...new Set(pagos.map(p => FORMA_LABEL[p.forma] || p.forma).filter(Boolean))].join(' + ')
              const cancelado = h.status === 'cancelado'
              const ultimo = i === historico.length - 1
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

      {/* Arquivar / Reativar */}
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
      </div>

      {/* ── Modal de edição ───────────────────── */}
      {showEdit && (
        <Modal onClose={() => setShowEdit(false)} boxStyle={s.modal}>
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
  profile: { display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 20, gap: 7 },
  avatar: { width: 76, height: 76, borderRadius: '50%', background: 'var(--pink-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800, color: 'var(--pink)', marginBottom: 4, boxShadow: '0 4px 16px rgba(var(--pink-rgb),0.18)' },
  profileName: { fontSize: 20, fontWeight: 700 },
  /* VIP badge: Gold + Noir */
  vipBadge: { fontSize: 12, padding: '3px 12px', borderRadius: 'var(--radius-pill)', background: 'var(--gold)', color: 'var(--text)', fontWeight: 700, letterSpacing: '0.2px' },
  wppBtn: { display: 'flex', alignItems: 'center', gap: 5, background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid #86EFAC', borderRadius: 'var(--radius-pill)', padding: '7px 15px', fontSize: 13, fontWeight: 600 },
  emailLink: { display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text3)', fontSize: 12.5, fontWeight: 500, textDecoration: 'none', marginTop: 2 },
  statusPend: { fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 'var(--radius-pill)', background: 'var(--red-bg)', color: 'var(--red)', marginTop: 4 },
  statusEmDia: { fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 'var(--radius-pill)', background: 'var(--green-bg)', color: 'var(--green)', marginTop: 4 },
  aReceberCard: { display: 'flex', alignItems: 'center', gap: 12, background: 'var(--amber-bg)', borderRadius: 'var(--radius-sm)', padding: '13px 15px', marginBottom: 16, border: '1px solid #FCD34D' },
  aReceberValor: { fontFamily: "'JetBrains Mono', monospace", fontSize: 17, fontWeight: 700, color: '#92400E', marginTop: 3 },
  aReceberQtd: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, fontWeight: 600, color: '#B45309' },
  cobrarBtn: { flexShrink: 0, background: 'var(--green, #15803D)', color: 'white', border: 'none', borderRadius: 'var(--radius-pill)', padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', fontFamily: 'inherit' },
  statsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 },
  statCard: { background: 'var(--surface)', borderRadius: 'var(--radius-sm)', padding: '13px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)' },
  statValue: { fontFamily: "'JetBrains Mono', monospace", fontSize: 15, fontWeight: 500, color: 'var(--text)' },
  statLabel: { fontSize: 11, color: 'var(--text3)', fontWeight: 500 },
  obs: { background: 'var(--surface)', borderRadius: 'var(--radius-sm)', padding: '13px 15px', marginBottom: 16, boxShadow: 'var(--shadow-xs)', border: '1px solid var(--border)' },
  obsTitle: { fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 },
  obsText: { fontSize: 13, color: 'var(--text2)', lineHeight: 1.55 },
  retornoCard: { display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface)', borderRadius: 'var(--radius-sm)', padding: '13px 15px', marginBottom: 16, boxShadow: 'var(--shadow-xs)', border: '1px solid var(--border)', cursor: 'pointer' },
  retornoSub: { fontSize: 13, color: 'var(--text2)', marginTop: 4 },
  retornoBadge: { flexShrink: 0, fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 700, color: 'var(--pink)', background: 'var(--pink-light)', borderRadius: 'var(--radius-pill)', padding: '6px 14px' },
  retornoUnidade: { fontSize: 11, color: 'var(--text3)', fontWeight: 600 },
  editBtn: { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 9, cursor: 'pointer', color: 'var(--text)', display: 'flex', padding: '6px 8px' },
  /* Modal de edição */
  modal: { background: 'var(--surface)', borderRadius: 18, padding: '18px 18px 20px', width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '92vh', overflowY: 'auto' },
  modalTitle: { fontSize: 16, fontWeight: 700, marginBottom: 2 },
  field: { display: 'flex', flexDirection: 'column', gap: 3 },
  label: labelBase,
  input: { ...inputBase, padding: '9px 12px', outline: 'none', transition: 'border 0.15s' },
  inputErro: { border: '1.5px solid #FCA5A5', background: '#FEF2F2' },
  erroMsg: { fontSize: 11, color: '#B91C1C', fontWeight: 600, marginTop: 2 },
  hint: { fontSize: 11, color: 'var(--text3)', marginTop: 1 },
  btnPrimary: { ...btnPrimaryBase, padding: '12px' },
  btnSecondary: { ...btnSecondaryBase, padding: '10px' },
  sectionTitle: { fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px', margin: '0 0 12px' },
  cancelInfo: { color: '#B91C1C', fontWeight: 600 },
  escopoNota: { fontSize: 11, color: 'var(--text3)', textAlign: 'center', marginTop: -8, marginBottom: 16, fontWeight: 500 },
  resumoEscopoTitulo: { fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 },
  resumoGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 18 },
  resumoCard: { background: 'var(--surface)', borderRadius: 'var(--radius-sm)', padding: '12px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, boxShadow: 'var(--shadow-xs)', border: '1px solid var(--border)' },
  resumoValor: { fontFamily: "'JetBrains Mono', monospace", fontSize: 17, fontWeight: 700, color: 'var(--text)', lineHeight: 1 },
  resumoLabel: { fontSize: 10, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' },
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
  arquivarArea: { marginTop: 24, paddingTop: 16, borderTop: '1px dashed var(--border2)', display: 'flex', flexDirection: 'column', gap: 10 },
  arquivadaAviso: { fontSize: 12, color: '#92400E', background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 'var(--radius-sm)', padding: '9px 12px', textAlign: 'center' },
  arquivarBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: 'var(--surface2)', color: 'var(--text2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', padding: '11px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  reativarBtn: { background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid #86EFAC' },
}
