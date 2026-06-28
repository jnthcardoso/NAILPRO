import { Plus, MessageCircle, Check } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { formatBRL, linkWhatsApp, validarTelefone } from '../../lib/formatters'
import { aplicarVariaveis } from '../../lib/mensagens'
import { useAssinatura } from '../../contexts/AssinaturaContext'
import { s } from '../../pages/Financeiro.styles'

const FORMA_LABEL = {
  pix: 'Pix', dinheiro: 'Dinheiro',
  cartao_debito: 'Débito', cartao_credito: 'Crédito', sem: 'Sem forma registrada',
}

export default function TabReceitas({
  filtrados, filtro, setFiltro, cobranca, setShowModal,
  marcarCobrado, reverterParaPendente, abrirConfirmarPago,
}) {
  const { temAcesso } = useAssinatura()

  return (
    <div style={s.tabContent}>
      <div style={s.colHeader}>
        <div style={s.colTitulo}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)' }} />
          Receitas ({filtrados.length})
        </div>
        <button style={s.addBtnSmall} onClick={() => setShowModal(true)}>
          <Plus size={13} /> Pagamento
        </button>
      </div>

      <div style={s.filtros} className="fin-filtros-receita">
        {['todos', 'pago', 'pendente'].map(f => (
          <button key={f} style={{ ...s.filtroBtn, ...(filtro === f ? s.filtroBtnActive : {}) }} onClick={() => setFiltro(f)}>
            {f === 'todos' ? 'Todos' : f === 'pago' ? 'Pagos' : 'Pendentes'}
          </button>
        ))}
      </div>

      {filtrados.length === 0
        ? <div style={s.empty}>Nenhum lançamento encontrado</div>
        : filtrados.map(p => {
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
          return (
            <div key={p.id} style={s.finCard}>
              <div style={{ ...s.dot, background: pago ? 'var(--green)' : '#F59E0B' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={s.finNome}>{p.agendamentos?.clientes?.nome || '—'}</div>
                <div style={s.finSub}>
                  {p.agendamentos?.servico || '—'} · {format(new Date(p.data + 'T12:00:00'), 'dd/MM', { locale: ptBR })}
                  {' · '}{FORMA_LABEL[p.forma] || p.forma}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ ...s.finValor, color: pago ? 'var(--green)' : 'var(--amber)' }}>
                  {formatBRL(p.valor ?? 0)}
                </div>
                <div style={{ display: 'flex', gap: 5, marginTop: 3, justifyContent: 'flex-end' }}>
                  {podeCobrar && (
                    <a
                      style={cobrado ? s.cobradoBtn : s.cobrarBtn}
                      href={linkWhatsApp(tel, msgCobranca)}
                      target="_blank" rel="noreferrer"
                      onClick={() => marcarCobrado(p)}
                      title={cobrado ? 'Cobrança já enviada — toque para reenviar' : 'Cobrar pelo WhatsApp'}
                    >
                      {cobrado ? <><Check size={11} /> Cobrado</> : <><MessageCircle size={11} /> Cobrar</>}
                    </a>
                  )}
                  <button style={{ ...s.statusBtn, ...(pago ? s.statusPago : s.statusPendente) }} onClick={() => pago ? reverterParaPendente(p) : abrirConfirmarPago(p)}>
                    {pago ? '✓ Pago' : '⏳ Pendente'}
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
