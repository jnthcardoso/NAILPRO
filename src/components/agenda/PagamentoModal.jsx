import Modal from '../common/Modal'
import { s } from '../../pages/Agenda.styles'
import { FORMAS } from '../../pages/Agenda.constants'
import { formatBRL } from '../../lib/formatters'

// Modal de registro de pagamento de um agendamento (1 ou 2 formas).
// Apresentacional: recebe estado e handlers do componente Agenda.
export default function PagamentoModal({
  agSelecionado, formPag, setFormPag, savingPag, pagModalObrigatorio,
  onSalvar, onFechar,
}) {
  return (
    <Modal onClose={onFechar} boxStyle={s.modal}>
      <div style={s.modalTitle}>💳 Registrar pagamento</div>

      <div style={s.pagInfo}>
        <div style={s.pagCliente}>{agSelecionado.clientes?.nome}</div>
        <div style={s.pagServico}>{agSelecionado.servico} · {agSelecionado.data}</div>
      </div>

      {/* Toggle: 1 forma ou 2 formas */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button
          style={{ ...s.statusBtn2, flex: 1, ...(formPag.modo === 'simples' ? s.statusPagoActive : {}) }}
          onClick={() => setFormPag({ ...formPag, modo: 'simples', valor2: '' })}
        >
          1 forma
        </button>
        <button
          style={{ ...s.statusBtn2, flex: 1, ...(formPag.modo === 'duplo' ? { background: '#EDE9FE', color: '#5B21B6', border: '1.5px solid #A78BFA' } : {}) }}
          onClick={() => {
            const totalAtual = parseFloat(formPag.valor) || 0
            const metade = totalAtual > 0 ? (totalAtual / 2).toFixed(2) : ''
            setFormPag({ ...formPag, modo: 'duplo', valor: metade, valor2: metade })
          }}
        >
          2 formas
        </button>
      </div>

      {/* Forma 1 */}
      <div style={s.field}>
        <label style={s.label}>{formPag.modo === 'duplo' ? '1ª forma — Valor (R$)' : 'Valor (R$)'}</label>
        <input
          style={{ ...s.input, fontFamily: "'JetBrains Mono', monospace" }}
          type="number" placeholder="0,00"
          value={formPag.valor}
          onChange={e => setFormPag({ ...formPag, valor: e.target.value })}
        />
      </div>
      <div style={s.field}>
        <label style={s.label}>{formPag.modo === 'duplo' ? '1ª forma de pagamento' : 'Forma de pagamento'}</label>
        <div style={s.formasGrid}>
          {FORMAS.map(f => (
            <button key={f.value}
              style={{ ...s.formaBtn, ...(formPag.forma === f.value ? s.formaBtnActive : {}) }}
              onClick={() => setFormPag({ ...formPag, forma: f.value })}
            >{f.label}</button>
          ))}
        </div>
      </div>

      {/* Forma 2 (só no modo duplo) */}
      {formPag.modo === 'duplo' && (
        <>
          <div style={{ height: 1, background: 'var(--border)', margin: '4px 0 12px' }} />
          <div style={s.field}>
            <label style={s.label}>2ª forma — Valor (R$)</label>
            <input
              style={{ ...s.input, fontFamily: "'JetBrains Mono', monospace" }}
              type="number" placeholder="0,00"
              value={formPag.valor2}
              onChange={e => setFormPag({ ...formPag, valor2: e.target.value })}
            />
          </div>
          <div style={s.field}>
            <label style={s.label}>2ª forma de pagamento</label>
            <div style={s.formasGrid}>
              {FORMAS.map(f => (
                <button key={f.value}
                  style={{ ...s.formaBtn, ...(formPag.forma2 === f.value ? s.formaBtnActive : {}) }}
                  onClick={() => setFormPag({ ...formPag, forma2: f.value })}
                >{f.label}</button>
              ))}
            </div>
          </div>
          {/* Total */}
          {(parseFloat(formPag.valor) || 0) + (parseFloat(formPag.valor2) || 0) > 0 && (
            <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>
              Total: <strong style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {formatBRL((parseFloat(formPag.valor) || 0) + (parseFloat(formPag.valor2) || 0))}
              </strong>
            </div>
          )}
        </>
      )}

      <div style={s.field}>
        <label style={s.label}>Status</label>
        <div style={s.statusGrid}>
          <button style={{ ...s.statusBtn2, ...(formPag.status === 'pago' ? s.statusPagoActive : {}) }}
            onClick={() => setFormPag({ ...formPag, status: 'pago' })}>✓ Pago</button>
          <button style={{ ...s.statusBtn2, ...(formPag.status === 'pendente' ? s.statusPendenteActive : {}) }}
            onClick={() => setFormPag({ ...formPag, status: 'pendente' })}>⏳ Pendente</button>
        </div>
      </div>

      <button style={s.btnPrimary} onClick={onSalvar} disabled={savingPag}>
        {savingPag ? 'Salvando...' : 'Registrar pagamento'}
      </button>
      <button style={s.btnSecondary} onClick={onFechar}>
        {pagModalObrigatorio ? 'Registrar depois' : 'Fechar'}
      </button>
    </Modal>
  )
}
