import { CheckCircle, XCircle, Calendar, CreditCard, MessageCircle, Pencil, User, Lock, Trash2 } from 'lucide-react'
import Modal from '../common/Modal'
import { s } from '../../pages/Agenda.styles'
import { STATUS, resumoPagamento } from '../../pages/Agenda.constants'
import { formatBRL, linkWhatsApp, dataBR } from '../../lib/formatters'

// Monta o link de WhatsApp com a mensagem de confirmação do horário.
function buildWhatsAppConfirm(ag) {
  const nome = ag.clientes?.nome || ''
  const telefone = (ag.clientes?.telefone || '').replace(/\D/g, '')
  if (!telefone) return null
  const [y, m, d] = ag.data.split('-')
  const dataFmt = `${d}/${m}`
  const horario = ag.horario?.slice(0, 5)
  const msg = `Olá ${nome}! Confirmando seu horário para ${dataFmt} às ${horario} - ${ag.servico}. Pode confirmar presença? 💅`
  return linkWhatsApp(telefone, msg)
}

// Drawer (modal) de detalhe de um agendamento, com as ações de status,
// pagamento, edição, WhatsApp e cancelamento. Apresentacional: a lógica fica
// no componente Agenda e chega via callbacks já compostos.
export default function DetalheAgendamentoDrawer({
  ag, onClose, onConfirmar, onRealizar, onCancelar, onEditar, onRegistrarPagamento, onExcluirBloqueio,
}) {
  // Bloqueio de horário: detalhe simplificado, só com a opção de remover.
  if (ag.tipo === 'bloqueio') {
    const periodo = ag.dia_inteiro
      ? 'Dia inteiro'
      : `${ag.horario?.slice(0, 5)} às ${ag.horario_fim?.slice(0, 5)}`
    return (
      <Modal onClose={onClose} boxStyle={s.modal}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Lock size={17} color="var(--text2)" />
          <div style={{ fontSize: 17, fontWeight: 700 }}>Horário bloqueado</div>
        </div>
        <div style={{ background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, justifyContent: 'space-between' }}>
            <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
              <Calendar size={14} color="var(--text3)" />
              <span style={{ color: 'var(--text2)', fontWeight: 500 }}>{dataBR(ag.data)} · {periodo}</span>
            </span>
            {ag.profissional?.nome && (
              <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', fontSize: 11.5, fontWeight: 600, color: 'var(--pink)', background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 999, padding: '2px 8px', whiteSpace: 'nowrap' }}>
                <User size={12} />{ag.profissional.nome}
              </span>
            )}
          </div>
          {ag.motivo && <div style={{ fontSize: 12.5, color: 'var(--text3)', fontStyle: 'italic' }}>{ag.motivo}</div>}
        </div>
        <button style={{ ...s.btnSecondary, color: '#B91C1C', borderColor: '#FCA5A5' }} onClick={() => onExcluirBloqueio(ag.bloqueioId)}>
          <Trash2 size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Remover bloqueio
        </button>
        <button style={s.btnSecondary} onClick={onClose}>Fechar</button>
      </Modal>
    )
  }

  const st = STATUS[ag.status] || STATUS.pendente
  const pag = resumoPagamento(ag)
  const waConfirm = buildWhatsAppConfirm(ag)
  const tel = (ag.clientes?.telefone || '').replace(/\D/g, '')
  const waDirectUrl = tel ? linkWhatsApp(tel) : null
  const dataFmt = dataBR(ag.data)

  return (
    <Modal onClose={onClose} boxStyle={s.modal}>
      {/* Header do drawer */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{ag.clientes?.nome}</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>{ag.servico}</div>
        </div>
        <span style={{ ...s.badge, background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>{st.label}</span>
      </div>

      {/* Infos */}
      <div style={{ background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, justifyContent: 'space-between' }}>
          <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
            <Calendar size={14} color="var(--text3)" />
            <span style={{ color: 'var(--text2)', fontWeight: 500 }}>{dataFmt} · {ag.horario?.slice(0, 5)}</span>
          </span>
          {/* Nome da profissional — facilita saber de quem é o atendimento sem filtrar */}
          {ag.profissional?.nome && (
            <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', fontSize: 11.5, fontWeight: 600, color: 'var(--pink)', background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 999, padding: '2px 8px', whiteSpace: 'nowrap' }}>
              <User size={12} />{ag.profissional.nome}
            </span>
          )}
        </div>
        {ag.valor > 0 && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
            <CreditCard size={14} color="var(--text3)" />
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: 'var(--pink)' }}>
              {formatBRL(ag.valor)}
            </span>
            {pag && (
              <span style={{ ...s.badge, background: pag.pago ? '#DCFCE7' : '#FEF3C7', color: pag.pago ? '#15803D' : '#92400E', fontSize: 10 }}>
                {pag.pago ? '✓ Pago' : '⏳ Pendente'} · {pag.formas}
              </span>
            )}
          </div>
        )}
        {ag.observacoes && (
          <div style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic' }}>{ag.observacoes}</div>
        )}
      </div>

      {/* Ações de status */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {ag.status === 'pendente' && (
          <button style={{ ...s.btnPrimary, background: '#15803D', boxShadow: 'none' }} onClick={onConfirmar}>
            <CheckCircle size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />Confirmar agendamento
          </button>
        )}
        {ag.status !== 'realizado' && ag.status !== 'cancelado' && (
          <button style={{ ...s.btnPrimary, background: '#5B21B6', boxShadow: 'none' }} onClick={onRealizar}>
            <CheckCircle size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />Marcar como realizado
          </button>
        )}
      </div>

      {/* Ações secundárias */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button style={{ ...s.actionBtn, background: 'var(--surface2)', color: 'var(--text2)', border: '1px solid var(--border2)', flex: '1 1 auto' }}
          onClick={onRegistrarPagamento}>
          <CreditCard size={13} />{pag ? 'Editar pagamento' : 'Registrar pagamento'}
        </button>
        <button style={{ ...s.actionBtn, background: 'var(--surface2)', color: 'var(--text2)', border: '1px solid var(--border2)', flex: '1 1 auto' }}
          onClick={onEditar}>
          <Pencil size={13} />Editar
        </button>
      </div>

      {/* WhatsApp */}
      {(waConfirm || waDirectUrl) && (
        <div style={{ display: 'flex', gap: 8 }}>
          {waConfirm && (
            <a href={waConfirm} target="_blank" rel="noopener noreferrer"
              style={{ ...s.actionBtn, background: '#DCFCE7', color: '#15803D', border: '1px solid #4ADE80', flex: 1, textDecoration: 'none', justifyContent: 'center' }}>
              <MessageCircle size={13} />Confirmar via WA
            </a>
          )}
          {waDirectUrl && (
            <a href={waDirectUrl} target="_blank" rel="noopener noreferrer"
              style={{ ...s.actionBtn, background: 'var(--surface2)', color: 'var(--text2)', border: '1px solid var(--border2)', flex: 1, textDecoration: 'none', justifyContent: 'center' }}>
              <MessageCircle size={13} />Abrir WA
            </a>
          )}
        </div>
      )}

      {/* Cancelar agendamento */}
      {ag.status !== 'cancelado' && (
        <button style={{ ...s.btnSecondary, color: '#B91C1C', borderColor: '#FCA5A5' }}
          onClick={onCancelar}>
          <XCircle size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Cancelar agendamento
        </button>
      )}
      <button style={s.btnSecondary} onClick={onClose}>Fechar</button>
    </Modal>
  )
}
