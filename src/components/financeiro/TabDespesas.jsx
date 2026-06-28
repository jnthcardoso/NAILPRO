import { Plus, Pencil, X, Check } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { formatBRL } from '../../lib/formatters'
import { s } from '../../pages/Financeiro.styles'

export default function TabDespesas({
  temAcesso, filtroDespesa, setFiltroDespesa, toggleFiltroCard,
  despesasVisiveis, categoriasTodas,
  salaoPagas, salaoPagasArr, salaoAPagar, salaoAPagarArr,
  pessoalPagas, pessoalPagasArr, pessoalAPagar, pessoalAPagarArr,
  totalDespesasSalao, totalDespesasPessoal, despesasSalaoArr, despesasPessoalArr,
  abrirNovaDespesa, abrirEditarDespesa, excluirDespesa, abrirConfirmarPagarDespesa,
}) {
  const findCat = (id) => categoriasTodas.find(c => c.id === id)

  return (
    <div style={s.tabContent}>
      {/* Cards de resumo por bolso */}
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
  )
}
