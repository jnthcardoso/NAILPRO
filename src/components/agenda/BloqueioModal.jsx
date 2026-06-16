import Modal from '../common/Modal'
import { Lock } from 'lucide-react'
import { s } from '../../pages/Agenda.styles'

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] // índice = getDay() (0=Dom)

// Modal para criar/editar um bloqueio de horário (compromisso pessoal / dia
// indisponível), com opção de repetir toda semana em dias escolhidos.
// Apresentacional: recebe estado e handlers do componente Agenda.
export default function BloqueioModal({
  formBloqueio, setFormBloqueio, profissionais, gerenciaTudo, saving, onSalvar, onCancelar, editando,
}) {
  const f = formBloqueio
  const diaInteiro = f.dia_inteiro
  const semanal = f.recorrencia === 'semanal'
  const set = (patch) => setFormBloqueio({ ...f, ...patch })

  const toggleDia = (d) => {
    const atuais = f.dias_semana || []
    set({ dias_semana: atuais.includes(d) ? atuais.filter(x => x !== d) : [...atuais, d].sort() })
  }

  return (
    <Modal onClose={onCancelar} boxStyle={s.modal}>
      <div style={s.modalTitle}>
        <Lock size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
        {editando ? 'Editar bloqueio' : 'Bloquear horário'}
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 12 }}>
        O período bloqueado não aparece como livre no seu link de agendamento.
      </div>

      {/* Repetir toda semana */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 10px', cursor: 'pointer', fontSize: 13.5, fontWeight: 600, color: 'var(--text2)' }}>
        <input type="checkbox" checked={semanal}
          onChange={e => set({ recorrencia: e.target.checked ? 'semanal' : 'nenhuma' })} />
        Repetir toda semana
      </label>

      {semanal && (
        <div style={s.field}>
          <label style={s.label}>Dias da semana</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {DIAS.map((nome, d) => {
              const ativo = (f.dias_semana || []).includes(d)
              return (
                <button key={d} type="button" onClick={() => toggleDia(d)}
                  style={{ padding: '7px 11px', borderRadius: 'var(--radius-pill)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                    background: ativo ? 'var(--pink-light)' : 'var(--surface2)', color: ativo ? 'var(--pink)' : 'var(--text2)',
                    border: '1px solid ' + (ativo ? 'var(--pink-mid)' : 'var(--border2)') }}>
                  {nome}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div style={s.field}>
        <label style={s.label}>{semanal ? 'A partir de' : 'Data'}</label>
        <input style={s.input} type="date" value={f.data}
          onChange={e => set({ data: e.target.value })} />
      </div>

      {semanal && (
        <div style={s.field}>
          <label style={s.label}>Repetir até (opcional)</label>
          <input style={s.input} type="date" value={f.data_fim || ''}
            onChange={e => set({ data_fim: e.target.value })} />
          <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 4 }}>Deixe em branco para repetir sem data de fim.</div>
        </div>
      )}

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 12px', cursor: 'pointer', fontSize: 13.5, fontWeight: 600, color: 'var(--text2)' }}>
        <input type="checkbox" checked={diaInteiro}
          onChange={e => set({ dia_inteiro: e.target.checked })} />
        Dia inteiro
      </label>

      {!diaInteiro && (
        <div style={s.row}>
          <div style={{ ...s.field, flex: 1 }}>
            <label style={s.label}>Início</label>
            <input style={s.input} type="time" value={f.horario_inicio}
              onChange={e => set({ horario_inicio: e.target.value })} />
          </div>
          <div style={{ ...s.field, flex: 1 }}>
            <label style={s.label}>Fim</label>
            <input style={s.input} type="time" value={f.horario_fim}
              onChange={e => set({ horario_fim: e.target.value })} />
          </div>
        </div>
      )}

      {gerenciaTudo && profissionais.length > 1 && (
        <div style={s.field}>
          <label style={s.label}>Para quem</label>
          <select style={s.input} value={f.profissional_id}
            onChange={e => set({ profissional_id: e.target.value })}>
            <option value="">Salão inteiro</option>
            {profissionais.map(p => (
              <option key={p.id} value={p.id}>{p.nome}{p.papel === 'dona' ? ' (dona)' : p.papel === 'recepcionista' ? ' (recepção)' : ''}</option>
            ))}
          </select>
        </div>
      )}

      <div style={s.field}>
        <label style={s.label}>Motivo (opcional)</label>
        <input style={s.input} placeholder="Ex.: almoço, médico, psicóloga..." maxLength={80}
          value={f.motivo}
          onChange={e => set({ motivo: e.target.value })} />
        <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 4 }}>Aparece na agenda no lugar de "Bloqueado".</div>
      </div>

      <button style={s.btnPrimary} onClick={onSalvar} disabled={saving}>{saving ? 'Salvando...' : (editando ? 'Salvar alterações' : 'Bloquear')}</button>
      <button style={s.btnSecondary} onClick={onCancelar}>Cancelar</button>
    </Modal>
  )
}
