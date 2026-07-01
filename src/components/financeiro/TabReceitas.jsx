import { useState, useMemo } from 'react'
import { Plus, Check, Filter } from 'lucide-react'
import WaIcon from '../common/WaIcon'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { formatBRL, linkWhatsApp, validarTelefone } from '../../lib/formatters'
import { aplicarVariaveis } from '../../lib/mensagens'
import { useAssinatura } from '../../contexts/AssinaturaContext'
import { s } from '../../pages/Financeiro.styles'

const FORMA_LABEL = {
  pix: 'Pix', dinheiro: 'Dinheiro',
  cartao_debito: 'Débito', cartao_credito: 'Crédito', sem: 'Sem forma',
}

const FILTROS_FORMA = [
  { id: 'todas', label: 'Todas' },
  { id: 'pix', label: 'Pix' },
  { id: 'dinheiro', label: 'Dinheiro' },
  { id: 'cartao_debito', label: 'Débito' },
  { id: 'cartao_credito', label: 'Crédito' },
]

// Colunas desktop: cliente | serviço | forma | valor | data | ações
const GRID = 'minmax(0,1.6fr) minmax(0,1.1fr) minmax(0,0.9fr) minmax(0,1fr) minmax(0,1fr) 120px'

const thStyle = {
  fontSize: 10, fontWeight: 700, color: '#8B2655',
  textTransform: 'uppercase', letterSpacing: '0.6px',
}

function getDiffLabel(data) {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const d = new Date(data + 'T00:00:00')
  const diff = Math.round((d - hoje) / 86400000)
  if (diff < 0) return diff === -1 ? 'ontem' : `${Math.abs(diff)}d atrás`
  if (diff === 0) return 'hoje'
  if (diff === 1) return 'amanhã'
  return `em ${diff}d`
}

export default function TabReceitas({
  pendentes: pendentesProp, recebidas: recebidasProp, filtro, setFiltro, cobranca, setShowModal, isDesktop,
  marcarCobrado, reverterParaPendente, abrirConfirmarPago,
}) {
  const { temAcesso } = useAssinatura()
  const [filtroForma, setFiltroForma] = useState('todas')
  const [showFiltro, setShowFiltro] = useState(false)

  // "A receber" vem de TODOS os meses (global); "Recebidas" fica presa ao
  // período navegado — a dona não perde de vista uma cobrança antiga.
  const pendentes = useMemo(() =>
    [...pendentesProp].sort((a, b) => new Date(a.data) - new Date(b.data)),
    [pendentesProp]
  )
  const recebidas = useMemo(() =>
    [...recebidasProp].sort((a, b) => new Date(b.data) - new Date(a.data)),
    [recebidasProp]
  )

  const totalAReceber = pendentes.reduce((acc, p) => acc + (p.valor || 0), 0)
  const totalRecebido = recebidas.reduce((acc, p) => acc + (p.valor || 0), 0)

  const subAba = filtro === 'pago' ? 'pago' : 'pendente'
  function aplicarFiltroForma(arr) {
    if (filtroForma === 'todas') return arr
    return arr.filter(p => (p.forma || 'sem') === filtroForma)
  }
  const lista = aplicarFiltroForma(subAba === 'pendente' ? pendentes : recebidas)
  const isPago = subAba === 'pago'
  const totalLista = lista.reduce((acc, p) => acc + (p.valor || 0), 0)

  return (
    <div style={s.tabContent}>

      {/* Cards de resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ background: '#FFFBEB', borderRadius: 'var(--radius-sm)', padding: '12px 14px', border: '1px solid #FDE68A' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 3 }}>Total a receber <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>(todos os meses)</span></div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 700, color: '#B45309', lineHeight: 1 }}>{formatBRL(totalAReceber)}</div>
          <div style={{ fontSize: 10, color: '#92400E', marginTop: 4 }}>{pendentes.length} pendente{pendentes.length !== 1 ? 's' : ''}</div>
        </div>
        <div style={{ background: '#F0FDF4', borderRadius: 'var(--radius-sm)', padding: '12px 14px', border: '1px solid #BBF7D0' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#14532D', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 3 }}>Total recebido <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>(neste período)</span></div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 700, color: '#15803D', lineHeight: 1 }}>{formatBRL(totalRecebido)}</div>
          <div style={{ fontSize: 10, color: '#14532D', marginTop: 4 }}>{recebidas.length} lançamento{recebidas.length !== 1 ? 's' : ''}</div>
        </div>
      </div>

      {/* Sub-abas */}
      <div style={{ display: 'flex', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border)' }}>
        {[
          { id: 'pendente', label: 'A receber', count: pendentes.length, cor: '#F59E0B', bg: '#FFFBEB', text: '#92400E', countBg: '#FEF3C7' },
          { id: 'pago',     label: 'Recebidas', count: recebidas.length, cor: '#22C55E', bg: '#F0FDF4', text: '#166534', countBg: '#DCFCE7' },
        ].map((t, i) => (
          <button
            key={t.id}
            onClick={() => setFiltro(t.id)}
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
        <button style={s.addBtnSmall} onClick={() => setShowModal(true)}>
          <Plus size={13} /> Pagamento
        </button>
        <button
          onClick={() => setShowFiltro(f => !f)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 12px', borderRadius: 'var(--radius-pill)',
            fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            border: '1px solid ' + (showFiltro || filtroForma !== 'todas' ? 'var(--pink)' : 'var(--border2)'),
            background: showFiltro || filtroForma !== 'todas' ? 'var(--pink)' : 'var(--surface)',
            color: showFiltro || filtroForma !== 'todas' ? 'white' : 'var(--text3)',
          }}
        >
          <Filter size={12} />
          Filtrar
          {filtroForma !== 'todas' && (
            <span style={{ background: 'rgba(255,255,255,0.3)', borderRadius: 20, padding: '0 5px', fontSize: 10 }}>1</span>
          )}
        </button>
      </div>

      {/* Pills de filtro */}
      {showFiltro && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FILTROS_FORMA.map(f => (
            <button
              key={f.id}
              onClick={() => setFiltroForma(f.id)}
              style={{
                padding: '5px 12px', borderRadius: 'var(--radius-pill)',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                border: '1px solid ' + (filtroForma === f.id ? 'var(--pink)' : 'var(--border2)'),
                background: filtroForma === f.id ? 'var(--pink)' : 'var(--surface)',
                color: filtroForma === f.id ? 'white' : 'var(--text3)',
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
          {filtroForma !== 'todas'
            ? 'Nenhum lançamento com este filtro'
            : subAba === 'pendente'
              ? 'Nenhuma cobrança pendente 🎉'
              : 'Nenhum recebimento neste período'}
        </div>
      ) : (
        <div style={{ borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid #e8c4d0' }}>

          {/* Cabeçalho desktop */}
          {isDesktop && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: GRID,
              alignItems: 'center',
              background: '#f9edf2',
              borderBottom: '1px solid #e8c4d0',
              padding: '9px 16px',
              gap: 12,
            }}>
              <div style={thStyle}>Cliente</div>
              <div style={{ ...thStyle, textAlign: 'center' }}>Serviço</div>
              <div style={{ ...thStyle, textAlign: 'center' }}>Forma</div>
              <div style={{ ...thStyle, textAlign: 'right' }}>Valor</div>
              <div style={{ ...thStyle, textAlign: 'center' }}>{isPago ? 'Recebido em' : 'Data'}</div>
              <div style={{ ...thStyle, textAlign: 'right' }}>Ações</div>
            </div>
          )}

          {lista.map((p, idx) => {
            const pago = p.status === 'pago'
            const tel = p.agendamentos?.clientes?.telefone
            const podeCobrar = !pago && validarTelefone(tel) && temAcesso('cobrancaWhatsapp')
            const cobrado = !!p.cobranca_enviada_em
            const msgCobranca = aplicarVariaveis(cobranca.template, {
              nome: p.agendamentos?.clientes?.nome || '',
              salao: cobranca.nomeSalao,
              servico: p.agendamentos?.servico || '',
              valor: formatBRL(p.valor ?? 0),
              pix: cobranca.chavePix,
            })
            const isLast = idx === lista.length - 1
            const dataP = new Date(p.data + 'T12:00:00')
            const atrasada = !pago && getDiffLabel(p.data).includes('atrás')

            const valorEl = (
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: pago ? 'var(--green)' : '#B45309' }}>
                {formatBRL(p.valor ?? 0)}
              </span>
            )

            const formaBadge = (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: '#E0F2FE', color: '#0369A1', whiteSpace: 'nowrap' }}>
                {FORMA_LABEL[p.forma] || p.forma || 'Sem forma'}
              </span>
            )

            const acoes = (
              <div style={{ display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                {podeCobrar && (
                  <a
                    style={cobrado ? s.cobradoBtn : s.cobrarBtn}
                    href={linkWhatsApp(tel, msgCobranca)}
                    target="_blank" rel="noreferrer"
                    onClick={() => marcarCobrado(p)}
                    title={cobrado ? 'Cobrança já enviada — toque para reenviar' : 'Cobrar pelo WhatsApp'}
                  >
                    {cobrado ? <><Check size={11} /> Cobrado</> : <><WaIcon size={11} /> Cobrar</>}
                  </a>
                )}
                <button style={{ ...s.statusBtn, ...(pago ? s.statusPago : s.statusPendente) }} onClick={() => pago ? reverterParaPendente(p) : abrirConfirmarPago(p)}>
                  {pago ? '✓ Recebido' : '⏳ Pendente'}
                </button>
              </div>
            )

            const rowBase = {
              background: 'var(--surface)',
              borderBottom: isLast ? 'none' : '0.5px solid var(--border)',
              borderLeft: `3px solid ${pago ? '#22C55E' : atrasada ? '#EF4444' : '#F59E0B'}`,
            }

            if (isDesktop) {
              return (
                <div
                  key={p.id}
                  style={{
                    ...rowBase,
                    display: 'grid',
                    gridTemplateColumns: GRID,
                    alignItems: 'center',
                    padding: '10px 16px',
                    gap: 12,
                  }}
                >
                  {/* Cliente */}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: pago ? 'var(--text2)' : 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.agendamentos?.clientes?.nome || '—'}
                    </div>
                  </div>
                  {/* Serviço */}
                  <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>{p.agendamentos?.servico || '—'}</div>
                  {/* Forma */}
                  <div style={{ display: 'flex', justifyContent: 'center' }}>{formaBadge}</div>
                  {/* Valor */}
                  <div style={{ textAlign: 'right' }}>{valorEl}</div>
                  {/* Data */}
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: pago ? 'var(--text3)' : atrasada ? '#B91C1C' : 'var(--text2)' }}>
                      {format(dataP, 'dd/MM', { locale: ptBR })}
                    </div>
                    {!pago && (
                      <div style={{ fontSize: 10, color: atrasada ? '#B91C1C' : 'var(--text3)', marginTop: 2 }}>
                        {getDiffLabel(p.data)}
                      </div>
                    )}
                  </div>
                  {/* Ações */}
                  <div>{acoes}</div>
                </div>
              )
            }

            // Mobile
            return (
              <div
                key={p.id}
                style={{
                  ...rowBase,
                  display: 'grid',
                  gridTemplateColumns: '44px 1fr auto',
                  alignItems: 'center',
                  padding: '11px 12px',
                  gap: 10,
                }}
              >
                {/* Data */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                  <span style={{ fontSize: 18, fontWeight: 700, lineHeight: 1, color: pago ? 'var(--text3)' : atrasada ? '#B91C1C' : 'var(--text2)' }}>
                    {format(dataP, 'dd')}
                  </span>
                  <span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', color: pago ? 'var(--text3)' : atrasada ? '#B91C1C' : 'var(--text2)' }}>
                    {format(dataP, 'MMM', { locale: ptBR })}
                  </span>
                </div>
                {/* Cliente + serviço */}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: pago ? 'var(--text2)' : 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.agendamentos?.clientes?.nome || '—'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>{p.agendamentos?.servico || ''}</div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 3 }}>
                    {formaBadge}
                    {!pago && atrasada && (
                      <span style={{ fontSize: 10, color: '#B91C1C', fontWeight: 600 }}>{getDiffLabel(p.data)}</span>
                    )}
                  </div>
                </div>
                {/* Valor + ações */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                  {valorEl}
                  {acoes}
                </div>
              </div>
            )
          })}

          {/* Rodapé */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '8px 16px', background: '#f9edf2', borderTop: '1px solid #e8c4d0',
            fontSize: 11, fontWeight: 700, color: '#8B2655',
          }}>
            <span>{lista.length} lançamento{lista.length !== 1 ? 's' : ''}</span>
            <span>Total: {formatBRL(totalLista)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
