import Modal from '../common/Modal'
import { s } from '../../pages/Agenda.styles'

// Modal de edição de um agendamento existente.
// Apresentacional: recebe estado e handlers do componente Agenda.
export default function EditarAgendamentoModal({
  formEdit, setFormEdit, clientes, servicosPadrao, profissionais,
  gerenciaTudo, savingEdit, onSalvar, onCancelar,
}) {
  return (
    <Modal onClose={onCancelar} boxStyle={s.modal}>
      <div style={s.modalTitle}>✏️ Editar agendamento</div>

      <div style={s.field}>
        <label style={s.label}>Cliente</label>
        <select style={s.input} value={formEdit.cliente_id} onChange={e => setFormEdit({ ...formEdit, cliente_id: e.target.value })}>
          <option value="">Selecionar cliente</option>
          {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </div>

      <div style={s.field}>
        <label style={s.label}>Serviço</label>
        <input style={s.input} placeholder="Ex: Gel francês, Manutenção..." value={formEdit.servico} onChange={e => setFormEdit({ ...formEdit, servico: e.target.value })} />
        {servicosPadrao.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 5 }}>
            {servicosPadrao.map(sv => (
              <button key={sv} style={{ ...s.actionBtn, flexShrink: 0, background: formEdit.servico === sv ? 'var(--pink-light)' : 'var(--surface2)', color: formEdit.servico === sv ? 'var(--pink)' : 'var(--text2)', border: '1px solid ' + (formEdit.servico === sv ? 'var(--pink-mid)' : 'var(--border2)') }} onClick={() => setFormEdit({ ...formEdit, servico: sv })}>
                {sv}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={s.row}>
        <div style={{ ...s.field, flex: 1 }}>
          <label style={s.label}>Data</label>
          <input style={s.input} type="date" value={formEdit.data} onChange={e => setFormEdit({ ...formEdit, data: e.target.value })} />
        </div>
        <div style={{ ...s.field, flex: 1 }}>
          <label style={s.label}>Horário</label>
          <input style={s.input} type="time" value={formEdit.horario} onChange={e => setFormEdit({ ...formEdit, horario: e.target.value })} />
        </div>
      </div>

      <div style={s.row}>
        <div style={{ ...s.field, flex: 1 }}>
          <label style={s.label}>Valor (R$)</label>
          <input style={{ ...s.input, fontFamily: "'JetBrains Mono', monospace" }} type="number" placeholder="0,00" value={formEdit.valor} onChange={e => setFormEdit({ ...formEdit, valor: e.target.value })} />
        </div>
        <div style={{ ...s.field, flex: 1 }}>
          <label style={s.label}>Status</label>
          <select style={s.input} value={formEdit.status} onChange={e => setFormEdit({ ...formEdit, status: e.target.value })}>
            <option value="pendente">Aguardando</option>
            <option value="confirmado">Confirmada</option>
            <option value="realizado">Realizado</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>
      </div>

      {gerenciaTudo && profissionais.length > 1 && (
        <div style={s.field}>
          <label style={s.label}>Profissional</label>
          <select style={s.input} value={formEdit.profissional_id} onChange={e => setFormEdit({ ...formEdit, profissional_id: e.target.value })}>
            <option value="">Selecionar profissional</option>
            {profissionais.map(p => <option key={p.id} value={p.id}>{p.nome}{p.papel === 'dona' ? ' (dona)' : p.papel === 'recepcionista' ? ' (recepção)' : ''}</option>)}
          </select>
        </div>
      )}

      <div style={s.field}>
        <label style={s.label}>Observações</label>
        <input style={s.input} placeholder="Opcional..." value={formEdit.observacoes} onChange={e => setFormEdit({ ...formEdit, observacoes: e.target.value })} />
      </div>

      <button style={s.btnPrimary} onClick={onSalvar} disabled={savingEdit}>{savingEdit ? 'Salvando...' : 'Salvar alterações'}</button>
      <button style={s.btnSecondary} onClick={onCancelar}>Cancelar</button>
    </Modal>
  )
}
