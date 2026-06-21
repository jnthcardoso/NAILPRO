import Modal from '../common/Modal'
import { s } from '../../pages/Financeiro.styles'

// Modal do pró-labore (salário da dona) — entra no DRE como "(−) Seu salário".
// Apresentacional: recebe estado e handlers do componente Financeiro.
export default function ProLaboreModal({ proLaboreInput, setProLaboreInput, savingProLabore, onSalvar, onClose }) {
  return (
    <Modal onClose={onClose} variant="sheet" boxStyle={s.modal}>
      <div style={s.modalTitle}>💜 Seu salário (pró-labore)</div>
      <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5, marginBottom: 4 }}>
        Quanto você tira pra você por mês? Entra no DRE como "(−) Seu salário" e mostra quanto <strong>sobra pra reinvestir</strong> no negócio.
      </div>
      <div style={s.field}>
        <label style={s.label}>Valor por mês (R$)</label>
        <input style={{ ...s.input, fontFamily: "'JetBrains Mono', monospace" }} type="number" step="0.01" placeholder="0,00" value={proLaboreInput} onChange={e => setProLaboreInput(e.target.value)} />
        <div style={{ fontSize: 11, color: 'var(--text3)' }}>Deixe em 0 para não mostrar essa linha.</div>
      </div>
      <button style={s.btnPrimary} onClick={onSalvar} disabled={savingProLabore}>{savingProLabore ? 'Salvando...' : 'Salvar'}</button>
      <button style={s.btnSecondary} onClick={onClose}>Cancelar</button>
    </Modal>
  )
}
