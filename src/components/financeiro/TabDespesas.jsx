import { useState, useMemo, Fragment } from 'react'
import { Plus, Pencil, X, Check, Filter } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { formatBRL } from '../../lib/formatters'
import { s } from '../../pages/Financeiro.styles'

function getUrgencia(data) {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const d = new Date(data + 'T12:00:00')
  const diff = Math.round((d - hoje) / 86400000)
  if (diff < 0) return 'late'
  if (diff <= 7) return 'soon'
  return 'ok'
}

function getDiffLabel(data) {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const d = new Date(data + 'T12:00:00')
  const diff = Math.round((d - hoje) / 86400000)
  if (diff < 0) return diff === -1 ? 'ontem' : `${Math.abs(diff)}d atrás`
  if (diff === 0) return 'hoje'
  if (diff === 1) return 'amanhã'
  return `em ${diff}d`
}

const FILTROS = [
  { id: 'todas',       label: 'Todas' },
  { id: 'salao',       label: '🏢 Salão' },
  { id: 'pessoal',     label: '👤 Pessoal' },
  { id: 'recorrentes', label: '🔁 Recorrentes' },
  { id: 'preencher',   label: '⚠️ A preencher' },
]

// Mesmo padrão da tabela de Clientes: grid de frações fixas (espaçamento
// uniforme, colunas não encolhem ao conteúdo), gap 0, padding por célula.
// Cabeçalho e conteúdo compartilham o mesmo grid → alinham na mesma borda.
const GRID = '1.6fr 1fr 0.9fr 1fr 1fr 1.1fr'
const MINGRID = 680

// Célula de cabeçalho — idêntica ao módulo Clientes
const thCell = {
  fontSize: 10, fontWeight: 700, color: 'var(--text3)',
  textTransform: 'uppercase', letterSpacing: '0.5px',
  padding: '8px 10px',
  background: 'var(--surface2)',
  borderBottom: '1px solid var(--border)',
  whiteSpace: 'nowrap',
}

export default function TabDespesas({
  temAcesso, isDesktop,
  salaoPagas, salaoPagasArr, salaoAPagar, salaoAPagarArr,
  pessoalPagas, pessoalPagasArr, pessoalAPagar, pessoalAPagarArr,
  totalDespesasSalao, totalDespesasPessoal, despesasSalaoArr, despesasPessoalArr,
  categoriasTodas,
  abrirNovaDespesa, abrirEditarDespesa, excluirDespesa, abrirConfirmarPagarDespesa,
  filtroDespesa, setFiltroDespesa, toggleFiltroCard, despesasVisiveis,
}) {
  const [subAba, setSubAba] = useState('apagar')
  const [filtroLocal, setFiltroLocal] = useState('todas')
  const [showFiltro, setShowFiltro] = useState(false)

  const findCat = (id) => categoriasTodas.find(c => c.id === id)

  const totalAPagar = (salaoAPagar || 0) + (pessoalAPagar || 0)
  const totalPago   = (salaoPagas  || 0) + (pessoalPagas  || 0)

  const apagar = useMemo(() =>
    [...(salaoAPagarArr || []), ...(pessoalAPagarArr || [])]
      .sort((a, b) => new Date(a.data) - new Date(b.data)),
    [salaoAPagarArr, pessoalAPagarArr]
  )

  const pagas = useMemo(() =>
    [...(salaoPagasArr || []), ...(pessoalPagasArr || [])]
      .sort((a, b) => new Date(b.data) - new Date(a.data)),
    [salaoPagasArr, pessoalPagasArr]
  )

  function aplicarFiltro(arr) {
    switch (filtroLocal) {
      case 'salao':        return arr.filter(d => d.tipo !== 'pessoal')
      case 'pessoal':      return arr.filter(d => d.tipo === 'pessoal')
      case 'recorrentes':  return arr.filter(d => d.recorrente)
      case 'preencher':    return arr.filter(d => d.valor_a_preencher)
      default:             return arr
    }
  }

  const lista      = aplicarFiltro(subAba === 'apagar' ? apagar : pagas)
  const isPago     = subAba === 'pagas'
  const totalLista = lista.reduce((acc, d) => acc + (d.valor || 0), 0)

  return (
    <div style={s.tabContent}>

      {/* Cards de resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ background: '#FFFBEB', borderRadius: 'var(--radius-sm)', padding: '12px 14px', border: '1px solid #FDE68A' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 3 }}>Total a pagar</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 700, color: '#B45309', lineHeight: 1 }}>{formatBRL(totalAPagar)}</div>
          <div style={{ fontSize: 10, color: '#92400E', marginTop: 4 }}>{apagar.length} conta{apagar.length !== 1 ? 's' : ''} em aberto</div>
        </div>
        <div style={{ background: '#F0FDF4', borderRadius: 'var(--radius-sm)', padding: '12px 14px', border: '1px solid #BBF7D0' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#14532D', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 3 }}>Total pago</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 700, color: '#15803D', lineHeight: 1 }}>{formatBRL(totalPago)}</div>
          <div style={{ fontSize: 10, color: '#14532D', marginTop: 4 }}>{pagas.length} lançamento{pagas.length !== 1 ? 's' : ''}</div>
        </div>
      </div>

      {/* Sub-abas */}
      <div style={{ display: 'flex', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border)' }}>
        {[
          { id: 'apagar', label: 'A pagar', count: apagar.length, cor: '#F59E0B', bg: '#FFFBEB', text: '#92400E', countBg: '#FEF3C7' },
          { id: 'pagas',  label: 'Pagas',   count: pagas.length,  cor: '#22C55E', bg: '#F0FDF4', text: '#166534', countBg: '#DCFCE7' },
        ].map((t, i) => (
          <button
            key={t.id}
            onClick={() => setSubAba(t.id)}
            style={{
              flex: 1, padding: '10px 0', fontSize: 13, fontWeight: 500,
              cursor: 'pointer', fontFamily: 'inherit', border: 'none',
              borderRight: i === 0 ? '1px solid var(--border)' : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              background: subAba === t.id ? t.bg : 'var(--surface)',
              color: subAba === t.id ? t.text : 'var(--text3)',
              transition: 'all 0.15s',
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: t.cor, flexShrink: 0 }} />
            {t.label}
            <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 20, background: t.countBg, color: subAba === t.id ? t.text : 'var(--text3)' }}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Linha de ações */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button style={s.addBtnSmall} onClick={abrirNovaDespesa}>
          <Plus size={13} /> Nova despesa
        </button>
        <button
          onClick={() => setShowFiltro(f => !f)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 12px', borderRadius: 'var(--radius-pill)',
            fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            border: '1px solid ' + (showFiltro || filtroLocal !== 'todas' ? 'var(--pink)' : 'var(--border2)'),
            background: showFiltro || filtroLocal !== 'todas' ? 'var(--pink)' : 'var(--surface)',
            color: showFiltro || filtroLocal !== 'todas' ? 'white' : 'var(--text3)',
          }}
        >
          <Filter size={12} />
          Filtrar
          {filtroLocal !== 'todas' && (
            <span style={{ background: 'rgba(255,255,255,0.3)', borderRadius: 20, padding: '0 5px', fontSize: 10 }}>1</span>
          )}
        </button>
      </div>

      {/* Pills de filtro */}
      {showFiltro && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FILTROS.map(f => (
            <button
              key={f.id}
              onClick={() => setFiltroLocal(f.id)}
              style={{
                padding: '5px 12px', borderRadius: 'var(--radius-pill)',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                border: '1px solid ' + (filtroLocal === f.id ? 'var(--pink)' : 'var(--border2)'),
                background: filtroLocal === f.id ? 'var(--pink)' : 'var(--surface)',
                color: filtroLocal === f.id ? 'white' : 'var(--text3)',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Lista */}
      {lista.length === 0 ? (
        <div style={s.empty}>
          {filtroLocal !== 'todas'
            ? 'Nenhuma despesa com este filtro'
            : subAba === 'apagar'
              ? 'Nenhuma conta a pagar 🎉'
              : 'Nenhuma despesa paga neste período'}
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>

          {isDesktop ? (
            /* ── Desktop: mesmo padrão da tabela de Clientes ─────────────────────
               Grid de frações fixas (espaçamento uniforme) compartilhado entre
               cabeçalho e linhas, gap 0, padding por célula. Cabeçalho e conteúdo
               de cada coluna alinham na mesma borda. */
            <div style={{
              display: 'grid',
              gridTemplateColumns: GRID,
              minWidth: MINGRID,
              alignItems: 'center',
            }}>
              {/* Cabeçalho */}
              <div style={thCell}>Descrição</div>
              <div style={thCell}>Categoria</div>
              <div style={thCell}>Tipo</div>
              <div style={thCell}>{isPago ? 'Pago em' : 'Vencimento'}</div>
              <div style={{ ...thCell, textAlign: 'right' }}>Valor</div>
              <div style={{ ...thCell, textAlign: 'right' }}>Ações</div>

              {/* Linhas de dados */}
              {lista.map((d, idx) => {
                const cat       = findCat(d.categoria)
                const urg       = isPago ? 'done' : getUrgencia(d.data)
                const dataD     = new Date(d.data + 'T12:00:00')
                const isLast    = idx === lista.length - 1
                const isPessoal = d.tipo === 'pessoal'
                const corUrg    = urg === 'late' ? '#B91C1C' : urg === 'soon' ? '#B45309' : 'var(--text2)'
                const bordaLateral = isPago ? '#22C55E' : urg === 'late' ? '#EF4444' : urg === 'soon' ? '#F59E0B' : '#22C55E'

                const td = {
                  padding: '10px 10px',
                  borderBottom: isLast ? 'none' : '1px solid var(--border)',
                }

                const tipoBadge = isPessoal
                  ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: '#EDE9FE', color: '#5B21B6', whiteSpace: 'nowrap' }}>👤 Pessoal</span>
                  : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: '#FCE7F3', color: '#9D174D', whiteSpace: 'nowrap' }}>🏢 Salão</span>

                const extraBadges = (d.recorrente || d.valor_a_preencher) ? (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 3 }}>
                    {d.recorrente && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 10, fontWeight: 500, padding: '1px 6px', borderRadius: 20, background: 'var(--surface2)', color: 'var(--text3)', border: '1px solid var(--border2)' }}>🔁 mensal</span>}
                    {d.valor_a_preencher && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 10, fontWeight: 500, padding: '1px 6px', borderRadius: 20, background: '#FEF3C7', color: '#92400E' }}>⚠ a preencher</span>}
                  </div>
                ) : null

                const valorEl = d.valor_a_preencher
                  ? <span style={{ fontSize: 11, fontWeight: 700, color: '#92400E' }}>⚠ preencher</span>
                  : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: isPago ? 'var(--text3)' : '#B91C1C', whiteSpace: 'nowrap' }}>
                      {isPago && <Check size={12} color="#15803D" strokeWidth={2.5} />}
                      {isPago ? '' : '− '}{formatBRL(d.valor ?? 0)}
                    </span>

                return (
                  <Fragment key={d.id}>
                    {/* Descrição — carrega borda lateral da linha inteira */}
                    <div style={{ ...td, minWidth: 0, borderLeft: `3px solid ${bordaLateral}` }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: isPago ? 'var(--text2)' : 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {d.descricao}
                      </div>
                      {extraBadges}
                    </div>
                    {/* Categoria */}
                    <div style={{ ...td, fontSize: 12, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
                      {cat?.label || '—'}
                    </div>
                    {/* Tipo */}
                    <div style={{ ...td, display: 'flex', alignItems: 'center' }}>
                      {tipoBadge}
                    </div>
                    {/* Data */}
                    <div style={{ ...td, whiteSpace: 'nowrap' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: isPago ? 'var(--text3)' : corUrg }}>
                        {format(dataD, 'dd/MM', { locale: ptBR })}
                      </div>
                      {!isPago && (
                        <div style={{ fontSize: 10, color: urg === 'late' ? '#B91C1C' : 'var(--text3)', marginTop: 2 }}>
                          {getDiffLabel(d.data)}
                        </div>
                      )}
                    </div>
                    {/* Valor */}
                    <div style={{ ...td, textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                      {valorEl}
                    </div>
                    {/* Ações */}
                    <div style={{ ...td, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                      {!isPago && !d.valor_a_preencher && temAcesso('contasAPagar') && (
                        <button style={s.pagarBtn} onClick={() => abrirConfirmarPagarDespesa(d)}>
                          <Check size={11} /> Pagar
                        </button>
                      )}
                      <button style={s.miniIconBtn} onClick={() => abrirEditarDespesa(d)} title="Editar">
                        <Pencil size={11} />
                      </button>
                    </div>
                  </Fragment>
                )
              })}
            </div>
          ) : (
            /* ── Mobile ─────────────────────────────────────────────────────── */
            lista.map((d, idx) => {
              const cat       = findCat(d.categoria)
              const urg       = isPago ? 'done' : getUrgencia(d.data)
              const dataD     = new Date(d.data + 'T12:00:00')
              const isLast    = idx === lista.length - 1
              const isPessoal = d.tipo === 'pessoal'
              const corUrg    = urg === 'late' ? '#B91C1C' : urg === 'soon' ? '#B45309' : 'var(--text2)'
              const bordaLateral = isPago ? '#22C55E' : urg === 'late' ? '#EF4444' : urg === 'soon' ? '#F59E0B' : '#22C55E'

              const tipoBadge = isPessoal
                ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: '#EDE9FE', color: '#5B21B6', whiteSpace: 'nowrap' }}>👤 Pessoal</span>
                : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: '#FCE7F3', color: '#9D174D', whiteSpace: 'nowrap' }}>🏢 Salão</span>

              const valorEl = d.valor_a_preencher
                ? <span style={{ fontSize: 11, fontWeight: 700, color: '#92400E' }}>⚠ preencher</span>
                : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: isPago ? 'var(--text3)' : '#B91C1C' }}>
                    {isPago && <Check size={12} color="#15803D" strokeWidth={2.5} />}
                    {isPago ? '' : '− '}{formatBRL(d.valor ?? 0)}
                  </span>

              return (
                <div
                  key={d.id}
                  style={{
                    background: 'var(--surface)',
                    borderBottom: isLast ? 'none' : '0.5px solid var(--border)',
                    borderLeft: `3px solid ${bordaLateral}`,
                    display: 'grid',
                    gridTemplateColumns: '44px 1fr auto',
                    alignItems: 'center',
                    padding: '11px 12px',
                    gap: 10,
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                    <span style={{ fontSize: 18, fontWeight: 700, lineHeight: 1, color: isPago ? 'var(--text3)' : corUrg }}>{format(dataD, 'dd')}</span>
                    <span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', color: isPago ? 'var(--text3)' : corUrg }}>{format(dataD, 'MMM', { locale: ptBR })}</span>
                    {!isPago && urg !== 'ok' && (
                      <span style={{ fontSize: 9, color: urg === 'late' ? '#B91C1C' : '#B45309', fontWeight: 600, marginTop: 2, textAlign: 'center', lineHeight: 1.1 }}>{getDiffLabel(d.data)}</span>
                    )}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: isPago ? 'var(--text2)' : 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.descricao}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>{cat?.label || ''}</div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 3 }}>
                      {tipoBadge}
                      {d.recorrente && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 10, fontWeight: 500, padding: '1px 6px', borderRadius: 20, background: 'var(--surface2)', color: 'var(--text3)', border: '1px solid var(--border2)' }}>🔁 mensal</span>}
                      {d.valor_a_preencher && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 10, fontWeight: 500, padding: '1px 6px', borderRadius: 20, background: '#FEF3C7', color: '#92400E' }}>⚠ a preencher</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                    {valorEl}
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      {!isPago && !d.valor_a_preencher && temAcesso('contasAPagar') && (
                        <button style={s.pagarBtn} onClick={() => abrirConfirmarPagarDespesa(d)}><Check size={11} /> Pagar</button>
                      )}
                      <button style={s.miniIconBtn} onClick={() => abrirEditarDespesa(d)} title="Editar"><Pencil size={11} /></button>
                      <button style={{ ...s.miniIconBtn, color: '#B91C1C', borderColor: '#FCA5A5', background: 'rgba(185,28,28,0.06)' }} onClick={() => excluirDespesa(d)} title="Excluir"><X size={11} /></button>
                    </div>
                  </div>
                </div>
              )
            })
          )}

          {/* Rodapé */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '8px 16px', background: 'var(--surface2)', borderTop: '1px solid var(--border)',
            fontSize: 11, fontWeight: 700, color: 'var(--text3)',
          }}>
            <span>{lista.length} {subAba === 'apagar' ? 'conta' : 'lançamento'}{lista.length !== 1 ? 's' : ''}</span>
            <span>Total: {formatBRL(totalLista)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
