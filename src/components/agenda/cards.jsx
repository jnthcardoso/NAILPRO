import { s } from '../../pages/Agenda.styles'
import { STATUS, FORMAS, temPagamentoPendente, PAG_PENDENTE_COR, PAG_PENDENTE_BG } from '../../pages/Agenda.constants'
import { formatBRL } from '../../lib/formatters'

// Cards de agendamento usados nas views da Agenda. Apresentacionais:
// recebem o agendamento e um callback onSelect (abre o drawer de detalhe).

// Card compacto para view Semana
export function CardCompacto({ ag, onSelect }) {
  const st = STATUS[ag.status] || STATUS.pendente
  const pend = temPagamentoPendente(ag)
  const cor = pend ? PAG_PENDENTE_COR : st.border
  return (
    <div style={{ ...s.cardCompacto, borderLeftColor: cor, ...(pend ? { background: PAG_PENDENTE_BG } : {}) }} onClick={() => onSelect(ag)}>
      <div style={s.cardCompactoHora}>{ag.horario?.slice(0, 5)}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={s.cardCompactoNome}>{ag.clientes?.nome?.split(' ')[0]}</div>
        <div style={s.cardCompactoServ}>{ag.servico}</div>
      </div>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: cor, flexShrink: 0 }} />
    </div>
  )
}

// Card completo para view Dia
export function CardDia({ ag, onSelect }) {
  const st = STATUS[ag.status] || STATUS.pendente
  const pag = ag.pagamentos?.[0]
  const pend = temPagamentoPendente(ag)
  return (
    <div style={{ ...s.card, borderLeftColor: pend ? PAG_PENDENTE_COR : st.border, cursor: 'pointer', ...(pend ? { background: PAG_PENDENTE_BG } : {}) }} onClick={() => onSelect(ag)}>
      <div style={s.cardHeader}>
        <div style={s.cardTime}>{ag.horario?.slice(0, 5)}</div>
        <div style={{ flex: 1 }}>
          <div style={s.cardName}>{ag.clientes?.nome}</div>
          <div style={s.cardService}>{ag.servico}</div>
        </div>
        <span style={{ ...s.badge, background: st.bg, color: st.color }}>{st.label}</span>
      </div>
      {ag.valor > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={s.cardValor}>{formatBRL(ag.valor)}</div>
          {pag && (
            <span style={{ ...s.badge, background: pag.status === 'pago' ? '#DCFCE7' : '#FEF3C7', color: pag.status === 'pago' ? '#15803D' : '#92400E', fontSize: 10 }}>
              {pag.status === 'pago' ? '✓ Pago' : '⏳ Pendente'} · {FORMAS.find(f => f.value === pag.forma)?.label.split(' ')[1] || pag.forma}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// Card para resultados de busca (mostra a data, pois cruza todas as datas)
export function CardBusca({ ag, onSelect }) {
  const st = STATUS[ag.status] || STATUS.pendente
  const pag = ag.pagamentos?.[0]
  const pend = temPagamentoPendente(ag)
  const [y, m, d] = ag.data.split('-')
  return (
    <div style={{ ...s.card, borderLeftColor: pend ? PAG_PENDENTE_COR : st.border, cursor: 'pointer', ...(pend ? { background: PAG_PENDENTE_BG } : {}) }} onClick={() => onSelect(ag)}>
      <div style={s.cardHeader}>
        <div style={s.cardDataBusca}>
          <span style={s.cardDataBuscaDia}>{d}/{m}</span>
          <span style={s.cardDataBuscaHora}>{ag.horario?.slice(0, 5)}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={s.cardName}>{ag.clientes?.nome}</div>
          <div style={s.cardService}>{ag.servico}</div>
        </div>
        <span style={{ ...s.badge, background: st.bg, color: st.color }}>{st.label}</span>
      </div>
      {ag.valor > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={s.cardValor}>{formatBRL(ag.valor)}</div>
          {pag && (
            <span style={{ ...s.badge, background: pag.status === 'pago' ? '#DCFCE7' : '#FEF3C7', color: pag.status === 'pago' ? '#15803D' : '#92400E', fontSize: 10 }}>
              {pag.status === 'pago' ? '✓ Pago' : '⏳ Pendente'}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
