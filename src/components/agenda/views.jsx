import { Calendar, Search } from 'lucide-react'
import {
  format, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  eachDayOfInterval, isSameMonth, isToday,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { s } from '../../pages/Agenda.styles'
import { STATUS, temPagamentoPendente, PAG_PENDENTE_COR, PAG_PENDENTE_BG } from '../../pages/Agenda.constants'
import { CardCompacto, CardDia, CardBusca } from './cards'

// Views de calendário da Agenda. Apresentacionais: recebem a lista ja filtrada
// (agendamentosBase) e callbacks. onSelect abre o drawer de detalhe.

export function ViewDia({ agendamentosBase, dataSel, onSelect, onAddDia }) {
  const dia = agendamentosBase.filter(a => a.data === format(dataSel, 'yyyy-MM-dd'))
  if (dia.length === 0) return (
    <div style={s.empty}>
      <Calendar size={34} color="var(--text3)" style={{ marginBottom: 10 }} />
      <p style={{ color: 'var(--text3)', fontSize: 14 }}>Nenhum agendamento neste dia</p>
      <button style={s.emptyBtn} onClick={onAddDia}>
        + Adicionar agendamento
      </button>
    </div>
  )
  return dia.map(ag => <CardDia key={ag.id} ag={ag} onSelect={onSelect} />)
}

export function ViewSemana({ agendamentosBase, dataSel, onSelect }) {
  const dias = eachDayOfInterval({ start: startOfWeek(dataSel, { locale: ptBR }), end: endOfWeek(dataSel, { locale: ptBR }) })
  return (
    <div style={s.weekColunas}>
      {dias.map(dia => {
        const agsDia = agendamentosBase.filter(a => a.data === format(dia, 'yyyy-MM-dd'))
        const hoje = isToday(dia)
        return (
          <div key={dia.toISOString()} style={s.weekColuna}>
            <div style={{ ...s.weekColunaHeader, ...(hoje ? s.weekColunaHeaderHoje : {}) }}>
              <span style={{ ...s.weekColunaDia, ...(hoje ? { color: 'var(--pink)' } : {}) }}>
                {format(dia, 'EEE', { locale: ptBR })}
              </span>
              <span style={{ ...s.weekColunaNum, ...(hoje ? { color: 'var(--pink)', fontWeight: 700 } : {}) }}>
                {format(dia, 'd')}
              </span>
              {agsDia.length > 0 && (
                <span style={{ fontSize: 9, fontWeight: 700, color: hoje ? 'var(--pink)' : 'var(--text3)' }}>
                  {agsDia.length}
                </span>
              )}
            </div>
            {agsDia.length === 0
              ? <div style={s.weekColunaSemAg}>—</div>
              : agsDia.map(ag => <CardCompacto key={ag.id} ag={ag} onSelect={onSelect} />)
            }
          </div>
        )
      })}
    </div>
  )
}

export function ViewMes({ agendamentosBase, dataSel, diaSelecionadoMes, setDiaSelecionadoMes, onSelect }) {
  const isMobile = window.innerWidth < 769
  const inicio = startOfMonth(dataSel)
  const fim = endOfMonth(dataSel)
  const dias = eachDayOfInterval({ start: startOfWeek(inicio, { locale: ptBR }), end: endOfWeek(fim, { locale: ptBR }) })
  const semanas = []
  for (let i = 0; i < dias.length; i += 7) semanas.push(dias.slice(i, i + 7))
  const agsDiaSel = diaSelecionadoMes ? agendamentosBase.filter(a => a.data === diaSelecionadoMes) : []

  // Mobile: initial de cada dia da semana; Desktop: nome curto
  const headerDias = isMobile
    ? ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
    : ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

  return (
    <div>
      <div style={{ ...s.calHeader, gap: isMobile ? 0 : undefined }}>
        {headerDias.map((d, i) => (
          <div key={i} style={{ ...s.calHeaderCell, fontSize: isMobile ? 11 : 10 }}>{d}</div>
        ))}
      </div>
      {semanas.map((semana, si) => (
        <div key={si} style={{ ...s.calRow, gap: isMobile ? 1 : 1 }}>
          {semana.map(dia => {
            const agsDia = agendamentosBase.filter(a => a.data === format(dia, 'yyyy-MM-dd'))
            const hoje = isToday(dia)
            const doMes = isSameMonth(dia, dataSel)
            const datStr = format(dia, 'yyyy-MM-dd')
            const selecionado = diaSelecionadoMes === datStr
            return (
              <div
                key={dia.toISOString()}
                style={{
                  ...s.calCell,
                  ...(!doMes ? s.calCellOut : {}),
                  ...(hoje ? s.calCellHoje : {}),
                  ...(selecionado ? s.calCellSel : {}),
                  ...(isMobile ? { minHeight: 52, padding: '4px 3px' } : {}),
                }}
                onClick={() => setDiaSelecionadoMes(selecionado ? null : datStr)}
              >
                {/* Número do dia */}
                {isMobile ? (
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: hoje ? 700 : 400,
                    background: hoje ? 'var(--pink)' : selecionado ? 'var(--pink-light)' : 'transparent',
                    color: hoje ? '#fff' : selecionado ? 'var(--pink)' : doMes ? 'var(--text)' : 'var(--text3)',
                    margin: '0 auto 3px',
                  }}>
                    {format(dia, 'd')}
                  </div>
                ) : (
                  <div style={{ ...s.calNum, ...(hoje ? s.calNumHoje : {}) }}>{format(dia, 'd')}</div>
                )}

                {/* Mobile: dots coloridos por status */}
                {isMobile ? (
                  agsDia.length > 0 && (
                    <div style={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                      {agsDia.slice(0, 3).map((ag, i) => {
                        if (ag.tipo === 'bloqueio') return <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#94A3B8', display: 'block', flexShrink: 0 }} />
                        const st = STATUS[ag.status] || STATUS.pendente
                        const cor = temPagamentoPendente(ag) ? PAG_PENDENTE_COR : st.border
                        return <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: cor, display: 'block', flexShrink: 0 }} />
                      })}
                      {agsDia.length > 3 && (
                        <span style={{ fontSize: 8, color: 'var(--text3)', fontWeight: 700, lineHeight: '6px' }}>+{agsDia.length - 3}</span>
                      )}
                    </div>
                  )
                ) : (
                  /* Desktop: text cards */
                  <>
                    {agsDia.slice(0, 2).map((ag, i) => {
                      if (ag.tipo === 'bloqueio') return <div key={i} style={{ ...s.calEvent, background: '#F1F5F9', color: '#64748B' }}>🔒 {ag.dia_inteiro ? 'Dia todo' : ag.horario?.slice(0, 5)}</div>
                      const st = STATUS[ag.status] || STATUS.pendente
                      const pend = temPagamentoPendente(ag)
                      return <div key={i} style={{ ...s.calEvent, background: pend ? PAG_PENDENTE_BG : st.bg, color: pend ? PAG_PENDENTE_COR : st.color }}>{ag.horario?.slice(0, 5)} {ag.clientes?.nome?.split(' ')[0]}</div>
                    })}
                    {agsDia.length > 2 && <div style={s.calMore}>+{agsDia.length - 2}</div>}
                  </>
                )}
              </div>
            )
          })}
        </div>
      ))}

      {diaSelecionadoMes && (
        <div style={{ marginTop: 16 }}>
          <div style={s.sectionTitle}>
            {format(new Date(diaSelecionadoMes + 'T12:00'), "EEEE, dd 'de' MMMM", { locale: ptBR })}
            {isToday(new Date(diaSelecionadoMes + 'T12:00')) && <span style={s.hojeChip}>hoje</span>}
          </div>
          {agsDiaSel.length === 0
            ? <div style={s.empty}><p style={{ color: 'var(--text3)', fontSize: 14 }}>Nenhum agendamento</p></div>
            : agsDiaSel.map(ag => <CardDia key={ag.id} ag={ag} onSelect={onSelect} />)
          }
        </div>
      )}
    </div>
  )
}

export function ViewBusca({ buscando, resultados, busca, onSelect }) {
  if (buscando) return <div style={s.empty}><p style={{ color: 'var(--text3)', fontSize: 14 }}>Buscando...</p></div>
  if (resultados.length === 0) return (
    <div style={s.empty}>
      <Search size={34} color="var(--text3)" style={{ marginBottom: 10 }} />
      <p style={{ color: 'var(--text3)', fontSize: 14 }}>Nenhum agendamento encontrado para "{busca.trim()}"</p>
    </div>
  )
  return (
    <div>
      <div style={s.buscaResumo}>{resultados.length} resultado{resultados.length > 1 ? 's' : ''} (todas as datas)</div>
      {resultados.map(ag => <CardBusca key={ag.id} ag={ag} onSelect={onSelect} />)}
    </div>
  )
}
