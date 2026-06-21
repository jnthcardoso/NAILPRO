import Modal from '../common/Modal'
import { formatBRL } from '../../lib/formatters'
import { s } from '../../pages/Financeiro.styles'
import { FORMAS_PAGAMENTO } from '../../pages/Financeiro.constants'

// Modal de confirmação de pagamento de uma despesa "a pagar" (contas a pagar).
// Apresentacional: recebe estado e handlers do componente Financeiro.
export default function ConfirmarPagarDespesaModal({ despesa, formPagarDespesa, setFormPagarDespesa, savingPagarDespesa, onConfirmar, onClose }) {
  return (
    <Modal onClose={onClose} boxStyle={s.modalCentro}>
      <div style={s.modalTitle}>💸 Confirmar pagamento</div>
      <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', fontSize: 13 }}>
        <div style={{ fontWeight: 700, color: 'var(--text)' }}>{despesa.descricao}</div>
        <div style={{ color: '#B91C1C', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, marginTop: 2 }}>− {formatBRL(despesa.valor)}</div>
      </div>
      <div style={s.field}>
        <label style={s.label}>Forma de pagamento</label>
        <select style={s.input} value={formPagarDespesa.forma_pagamento} onChange={e => setFormPagarDespesa({ ...formPagarDespesa, forma_pagamento: e.target.value })}>
          {FORMAS_PAGAMENTO.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </div>
      <button style={s.btnPrimary} onClick={onConfirmar} disabled={savingPagarDespesa}>
        {savingPagarDespesa ? 'Salvando...' : '✓ Confirmar pagamento'}
      </button>
      <button style={s.btnSecondary} onClick={onClose}>Cancelar</button>
    </Modal>
  )
}
