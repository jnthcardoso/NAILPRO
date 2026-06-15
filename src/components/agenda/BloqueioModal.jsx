import Modal from '../common/Modal'
import { Lock } from 'lucide-react'
import { s } from '../../pages/Agenda.styles'

// Modal para criar um bloqueio de horário (compromisso pessoal / dia indisponível).
// Apresentacional: recebe estado e handlers do componente Agenda.
// Em conta com equipe, mostra o seletor "profissional ou salão inteiro".
export default function BloqueioModal({
  formBloqueio, setFormBloqueio, profissionais, gerenciaTudo, saving, onSalvar, onCancelar,
}) {
  const diaInteiro = formBloqueio.dia_inteiro
  return (
    <Modal onClose={onCancelar} boxStyle={s.modal}>
      <div style={s.modalTitle}><Lock size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />Bloquear horário</div>
      <div style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 12 }}>
        O período bloqueado não aparece como livre no seu link de agendamento.
      </div>

      <div style={s.field}>
        <label style={s.label}>Data</label>
        <input style={s.input} type="date" value={formBloqueio.data}
          onChange={e => setFormBloqueio({ ...formBloqueio, data: e.target.value })} />
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 12px', cursor: 'pointer', fontSize: 13.5, fontWeight: 600, color: 'var(--text2)' }}>
        <input type="checkbox" checked={diaInteiro}
          onChange={e => setFormBloqueio({ ...formBloqueio, dia_inteiro: e.target.checked })} />
        Dia inteiro
      </label>

      {!diaInteiro && (
        <div style={s.row}>
          <div style={{ ...s.field, flex: 1 }}>
            <label style={s.label}>Início</label>
            <input style={s.input} type="time" value={formBloqueio.horario_inicio}
              onChange={e => setFormBloqueio({ ...formBloqueio, horario_inicio: e.target.value })} />
          </div>
          <div style={{ ...s.field, flex: 1 }}>
            <label style={s.label}>Fim</label>
            <input style={s.input} type="time" value={formBloqueio.horario_fim}
              onChange={e => setFormBloqueio({ ...formBloqueio, horario_fim: e.target.value })} />
          </div>
        </div>
      )}

      {gerenciaTudo && profissionais.length > 1 && (
        <div style={s.field}>
          <label style={s.label}>Para quem</label>
          <select style={s.input} value={formBloqueio.profissional_id}
            onChange={e => setFormBloqueio({ ...formBloqueio, profissional_id: e.target.value })}>
            <option value="">Salão inteiro</option>
            {profissionais.map(p => (
              <option key={p.id} value={p.id}>{p.nome}{p.papel === 'dona' ? ' (dona)' : p.papel === 'recepcionista' ? ' (recepção)' : ''}</option>
            ))}
          </select>
        </div>
      )}

      <div style={s.field}>
        <label style={s.label}>Motivo (opcional)</label>
        <input style={s.input} placeholder="Ex.: almoço, médico, folga..." maxLength={80}
          value={formBloqueio.motivo}
          onChange={e => setFormBloqueio({ ...formBloqueio, motivo: e.target.value })} />
      </div>

      <button style={s.btnPrimary} onClick={onSalvar} disabled={saving}>{saving ? 'Salvando...' : 'Bloquear'}</button>
      <button style={s.btnSecondary} onClick={onCancelar}>Cancelar</button>
    </Modal>
  )
}
