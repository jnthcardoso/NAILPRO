import Modal from '../common/Modal'
import { UserPlus } from 'lucide-react'
import { s } from '../../pages/Agenda.styles'
import { formatTelefone, unformatTelefone } from '../../lib/formatters'

// Modal de criação de um novo agendamento (inclui "nova cliente rápida").
// Apresentacional: recebe estado e handlers do componente Agenda.
export default function NovoAgendamentoModal({
  form, setForm, clientes, servicosPadrao, profissionais, gerenciaTudo,
  showNovaCliente, setShowNovaCliente, formCliente, setFormCliente,
  savingCliente, salvarNovaCliente, saving, onSalvar, onCancelar,
}) {
  return (
    <Modal onClose={onCancelar} boxStyle={s.modal}>
      <div style={s.modalTitle}>Novo agendamento</div>

      <div style={s.field}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <label style={s.label}>Cliente</label>
          <button style={s.linkBtn} onClick={() => setShowNovaCliente(true)}><UserPlus size={13} /> Nova cliente</button>
        </div>
        <select style={s.input} value={form.cliente_id} onChange={e => setForm({ ...form, cliente_id: e.target.value })}>
          <option value="">Selecionar cliente</option>
          {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </div>

      {showNovaCliente && (
        <div style={s.miniForm}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--pink)', marginBottom: 8 }}>Nova cliente rápida</div>
          <input style={s.input} placeholder="Nome *" value={formCliente.nome} onChange={e => setFormCliente({ ...formCliente, nome: e.target.value })} />
          <input style={{ ...s.input, marginTop: 8 }} placeholder="(51) 99999-9999" value={formatTelefone(formCliente.telefone)} onChange={e => setFormCliente({ ...formCliente, telefone: unformatTelefone(e.target.value) })} inputMode="numeric" />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button style={{ ...s.btnPrimary, flex: 1, padding: '9px' }} onClick={salvarNovaCliente} disabled={savingCliente}>{savingCliente ? 'Salvando...' : 'Salvar'}</button>
            <button style={{ ...s.btnSecondary, flex: 1, padding: '9px' }} onClick={() => setShowNovaCliente(false)}>Cancelar</button>
          </div>
        </div>
      )}

      <div style={s.field}>
        <label style={s.label}>Serviço</label>
        <input style={s.input} placeholder="Ex: Gel francês, Manutenção..." value={form.servico} onChange={e => setForm({ ...form, servico: e.target.value })} />
        {servicosPadrao.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 5 }}>
            {servicosPadrao.map(sv => (
              <button key={sv} style={{ ...s.actionBtn, flexShrink: 0, background: form.servico === sv ? 'var(--pink-light)' : 'var(--surface2)', color: form.servico === sv ? 'var(--pink)' : 'var(--text2)', border: '1px solid ' + (form.servico === sv ? 'var(--pink-mid)' : 'var(--border2)') }} onClick={() => setForm({ ...form, servico: sv })}>
                {sv}
              </button>
            ))}
          </div>
        )}
      </div>
      <div style={s.row}>
        <div style={{ ...s.field, flex: 1 }}>
          <label style={s.label}>Data</label>
          <input style={s.input} type="date" value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} />
        </div>
        <div style={{ ...s.field, flex: 1 }}>
          <label style={s.label}>Horário</label>
          <input style={s.input} type="time" value={form.horario} onChange={e => setForm({ ...form, horario: e.target.value })} />
        </div>
      </div>
      <div style={s.row}>
        <div style={{ ...s.field, flex: 1, minWidth: 0 }}>
          <label style={s.label}>Valor (R$)</label>
          <input style={{ ...s.input, width: '100%', fontFamily: "'JetBrains Mono', monospace" }} type="number" placeholder="0,00" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} />
        </div>
        <div style={{ ...s.field, flex: 1, minWidth: 0 }}>
          <label style={s.label}>Status</label>
          <select style={{ ...s.input, width: '100%' }} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
            <option value="pendente">Aguardando</option>
            <option value="confirmado">Confirmada</option>
          </select>
        </div>
      </div>
      {gerenciaTudo && profissionais.length > 1 && (
        <div style={s.field}>
          <label style={s.label}>Profissional</label>
          <select style={s.input} value={form.profissional_id} onChange={e => setForm({ ...form, profissional_id: e.target.value })}>
            <option value="">Selecionar profissional</option>
            {profissionais.map(p => <option key={p.id} value={p.id}>{p.nome}{p.papel === 'dona' ? ' (dona)' : p.papel === 'recepcionista' ? ' (recepção)' : ''}</option>)}
          </select>
        </div>
      )}
      <div style={s.field}>
        <label style={s.label}>Observações</label>
        <input style={s.input} placeholder="Opcional..." value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} />
      </div>
      <button style={s.btnPrimary} onClick={onSalvar} disabled={saving}>{saving ? 'Salvando...' : 'Salvar agendamento'}</button>
      <button style={s.btnSecondary} onClick={onCancelar}>Cancelar</button>
    </Modal>
  )
}
