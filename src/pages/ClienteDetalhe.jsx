import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Phone, Calendar, DollarSign, Archive, RotateCcw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default function ClienteDetalhe() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { confirmar, sucesso, erro } = useToast()
  const [cliente, setCliente] = useState(null)
  const [historico, setHistorico] = useState([])
  const [arquivando, setArquivando] = useState(false)

  useEffect(() => { if (user && id) { loadCliente(); loadHistorico() } }, [user, id])

  async function loadCliente() {
    const { data } = await supabase.from('clientes').select('*').eq('id', id).maybeSingle()
    setCliente(data)
  }

  async function loadHistorico() {
    const { data } = await supabase.from('agendamentos')
      .select('*, pagamentos(status, valor, forma)')
      .eq('cliente_id', id)
      .order('data', { ascending: false })
      .order('horario', { ascending: false })
      .limit(50)
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
    const { error } = await supabase.from('clientes').update({ arquivada: arquivar }).eq('id', id)
    setArquivando(false)
    if (error) { erro('Erro: ' + error.message); return }
    if (arquivar) {
      sucesso('Cliente arquivada')
      navigate('/clientes')
    } else {
      sucesso('Cliente reativada')
      setCliente({ ...cliente, arquivada: false })
    }
  }

  // Resumo do histórico
  const realizados = historico.filter(h => h.status === 'realizado')
  const cancelados = historico.filter(h => h.status === 'cancelado')
  const totalRecebido = historico.reduce((acc, h) => {
    const pago = h.pagamentos?.[0]
    return acc + (pago?.status === 'pago' ? (pago.valor || h.valor || 0) : 0)
  }, 0)
  const ticketMedio = realizados.length ? totalRecebido / realizados.length : 0

  if (!cliente) return <div style={{ padding: 24, color: 'var(--text3)' }}>Carregando...</div>

  return (
    <div style={s.page}>
      <div style={s.topBar}>
        <button style={s.backBtn} onClick={() => navigate(-1)}><ArrowLeft size={20} /></button>
        <span style={s.topTitle}>Perfil da cliente</span>
        <div style={{ width: 32 }} />
      </div>

      <div style={s.profile}>
        <div style={s.avatar}>{getInitials(cliente.nome)}</div>
        <div style={s.profileName}>{cliente.nome}</div>
        {/* VIP badge: Gold + Noir */}
        {(cliente.total_visitas || 0) >= 10 && (
          <span style={s.vipBadge}>✦ VIP</span>
        )}
        {cliente.telefone && (
          <a href={`https://wa.me/55${cliente.telefone.replace(/\D/g, '')}`} style={s.wppBtn} target="_blank" rel="noopener noreferrer">
            <Phone size={14} /> {cliente.telefone}
          </a>
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
          <div style={s.statValue}>R$ {(cliente.total_gasto || 0).toFixed(0)}</div>
          <div style={s.statLabel}>total gasto</div>
        </div>
        <div style={s.statCard}>
          <Calendar size={18} color="var(--text3)" />
          <div style={s.statValue}>
            {cliente.ultimo_atendimento ? format(new Date(cliente.ultimo_atendimento), 'dd/MM') : '—'}
          </div>
          <div style={s.statLabel}>última vez</div>
        </div>
      </div>

      {cliente.observacoes && (
        <div style={s.obs}>
          <div style={s.obsTitle}>Observações</div>
          <div style={s.obsText}>{cliente.observacoes}</div>
        </div>
      )}

      {/* Resumo do histórico */}
      {historico.length > 0 && (
        <div style={s.resumoGrid}>
          <div style={s.resumoCard}>
            <div style={s.resumoValor}>{realizados.length}</div>
            <div style={s.resumoLabel}>atendimentos</div>
          </div>
          <div style={s.resumoCard}>
            <div style={{ ...s.resumoValor, color: 'var(--green)' }}>R$ {totalRecebido.toFixed(0)}</div>
            <div style={s.resumoLabel}>recebido</div>
          </div>
          <div style={s.resumoCard}>
            <div style={s.resumoValor}>R$ {ticketMedio.toFixed(0)}</div>
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
              const pag = h.pagamentos?.[0]
              const pago = pag?.status === 'pago'
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
                    {!cancelado && (h.valor > 0 || pag) && (
                      <div style={s.tlPagRow}>
                        <span style={s.histValor}>R$ {(pag?.valor ?? h.valor ?? 0).toFixed(2).replace('.', ',')}</span>
                        {pag && (
                          <span style={{ ...s.badge, ...(pago ? s.badgePago : s.badgePendente) }}>
                            {pago ? '✓ Pago' : '⏳ Pendente'}{pag.forma ? ` · ${FORMA_LABEL[pag.forma] || pag.forma}` : ''}
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
          {arquivando ? '...' : cliente.arquivada ? 'Reativar cliente' : 'Arquivar cliente'}
        </button>
      </div>
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
  avatar: { width: 76, height: 76, borderRadius: '50%', background: 'var(--pink-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800, color: 'var(--pink)', marginBottom: 4, boxShadow: '0 4px 16px rgba(139,38,85,0.18)' },
  profileName: { fontSize: 20, fontWeight: 700 },
  /* VIP badge: Gold + Noir */
  vipBadge: { fontSize: 12, padding: '3px 12px', borderRadius: 'var(--radius-pill)', background: 'var(--gold)', color: 'var(--text)', fontWeight: 700, letterSpacing: '0.2px' },
  wppBtn: { display: 'flex', alignItems: 'center', gap: 5, background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid #86EFAC', borderRadius: 'var(--radius-pill)', padding: '7px 15px', fontSize: 13, fontWeight: 600 },
  statsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 },
  statCard: { background: 'var(--surface)', borderRadius: 'var(--radius-sm)', padding: '13px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)' },
  statValue: { fontFamily: "'JetBrains Mono', monospace", fontSize: 15, fontWeight: 500, color: 'var(--text)' },
  statLabel: { fontSize: 11, color: 'var(--text3)', fontWeight: 500 },
  obs: { background: 'var(--surface)', borderRadius: 'var(--radius-sm)', padding: '13px 15px', marginBottom: 16, boxShadow: 'var(--shadow-xs)', border: '1px solid var(--border)' },
  obsTitle: { fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 },
  obsText: { fontSize: 13, color: 'var(--text2)', lineHeight: 1.55 },
  sectionTitle: { fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px', margin: '0 0 12px' },
  cancelInfo: { color: '#B91C1C', fontWeight: 600 },
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
