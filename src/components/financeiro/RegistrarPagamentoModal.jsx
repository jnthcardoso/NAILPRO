import { format } from 'date-fns'
import Modal from '../common/Modal'
import { s } from '../../pages/Financeiro.styles'

// Modal de registro de pagamento avulso (opcionalmente ligado a um atendimento).
// Apresentacional: recebe estado e handlers do componente Financeiro.
export default function RegistrarPagamentoModal({ form, setForm, agendamentos, saving, onSalvar, onClose }) {
  return (
    <Modal onClose={onClose} variant="sheet" boxStyle={s.modal}>
      <div style={s.modalTitle}>💰 Registrar pagamento</div>
      <div style={s.field}>
        <label style={s.label}>Atendimento (opcional)</label>
        <select style={s.input} value={form.agendamento_id} onChange={e => setForm({ ...form, agendamento_id: e.target.value })}>
          <option value="">Selecionar atendimento</option>
          {agendamentos.map(a => (
            <option key={a.id} value={a.id}>{a.clientes?.nome} — {a.servico} ({format(new Date(a.data + 'T12:00:00'), 'dd/MM')})</option>
          ))}
        </select>
      </div>
      <div style={s.row}>
        <div style={{ ...s.field, flex: 1 }}>
          <label style={s.label}>Valor (R$) *</label>
          <input style={{ ...s.input, fontFamily: "'JetBrains Mono', monospace" }} type="number" placeholder="0,00" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} />
        </div>
        <div style={{ ...s.field, flex: 1 }}>
          <label style={s.label}>Forma</label>
          <select style={s.input} value={form.forma} onChange={e => setForm({ ...form, forma: e.target.value })}>
            <option value="pix">Pix</option>
            <option value="dinheiro">Dinheiro</option>
            <option value="cartao_debito">Débito</option>
            <option value="cartao_credito">Crédito</option>
          </select>
        </div>
      </div>
      <div className="form-row-stack" style={s.row}>
        <div style={{ ...s.field, flex: 1 }}>
          <label style={s.label}>Status</label>
          <select style={s.input} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
            <option value="pago">Pago</option>
            <option value="pendente">Pendente</option>
          </select>
        </div>
        <div style={{ ...s.field, flex: 1 }}>
          <label style={s.label}>Data</label>
          <input style={s.input} type="date" value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} />
        </div>
      </div>
      <button style={s.btnPrimary} onClick={onSalvar} disabled={saving}>{saving ? 'Salvando...' : 'Registrar'}</button>
      <button style={s.btnSecondary} onClick={onClose}>Cancelar</button>
    </Modal>
  )
}
