import { useState } from 'react'
import { format, addMonths } from 'date-fns'
import { X } from 'lucide-react'
import Modal from '../common/Modal'
import { s } from '../../pages/Financeiro.styles'
import { CATEGORIAS, FORMAS_PAGAMENTO } from '../../pages/Financeiro.constants'

const EMOJIS_CAT = [
  '💄','💅','💆','🧴','✂️','💈','🪮','🪥','🧼','🛁',
  '🧹','🏪','🛒','📦','🧾','💰','💳','📊','🎁','🎀',
  '👗','👠','🪷','🌸','✨','💡','⚡','🌊','🏠','🚗',
  '🍽️','📱','💻','🔧','🔑','💊','📌','🗓️','🎵','🐾',
]

function isDataPassada(dataStr) {
  if (!dataStr) return false
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  return new Date(dataStr + 'T00:00:00') < hoje
}

const segWrap = {
  display: 'flex', borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border2)', overflow: 'hidden',
}

function SegBtn({ label, ativo, cor, onClick, borderRight }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1, padding: '9px 6px', fontSize: 12, fontWeight: 700,
        cursor: 'pointer', fontFamily: 'inherit', border: 'none',
        borderRight: borderRight ? '1px solid var(--border2)' : 'none',
        background: ativo ? (cor || 'var(--pink)') : 'var(--surface)',
        color: ativo ? 'white' : 'var(--text3)',
        transition: 'background 0.15s',
      }}
    >
      {label}
    </button>
  )
}

function Toggle({ checked, onChange }) {
  return (
    <div
      onClick={() => onChange(!checked)}
      style={{
        width: 36, height: 20, borderRadius: 10,
        background: checked ? 'var(--pink)' : 'var(--border2)',
        cursor: 'pointer', position: 'relative',
        transition: 'background 0.2s', flexShrink: 0,
      }}
    >
      <div style={{
        position: 'absolute', top: 3,
        left: checked ? 19 : 3,
        width: 14, height: 14, borderRadius: '50%',
        background: 'white', transition: 'left 0.2s',
      }} />
    </div>
  )
}

export default function DespesaModal({
  editandoDespesa, formDespesa, setFormDespesa,
  showNovaCat, setShowNovaCat, categoriasCustom, novaCat, setNovaCat,
  salvarNovaCategoria, savingCat, excluirCategoria,
  temAcesso, savingDespesa, onSalvar, onClose,
}) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)

  const mostrarStatus = temAcesso('contasAPagar')
  const aPagar = !formDespesa.pago
  const alertaDataPassada = mostrarStatus && aPagar && isDataPassada(formDespesa.data)

  function toggleRecorrente(checked) {
    setFormDespesa(f => ({
      ...f,
      recorrente: checked,
      valor_variavel: checked ? f.valor_variavel : false,
      recorrente_ate: checked && !f.recorrente_ate
        ? format(addMonths(new Date((f.data || format(new Date(), 'yyyy-MM-dd')) + 'T12:00:00'), 12), 'yyyy-MM-dd')
        : f.recorrente_ate,
    }))
  }

  return (
    <Modal onClose={onClose} boxStyle={s.modalCentro}>
      <div style={s.modalTitle}>{editandoDespesa ? '✏️ Editar despesa' : '📉 Nova despesa'}</div>

      {/* Linha 1: Quem paga? + Situação — lado a lado */}
      <div style={{ display: 'grid', gridTemplateColumns: mostrarStatus ? '1fr 1fr' : '1fr', gap: 10 }}>
        <div style={s.field}>
          <label style={s.label}>Quem paga?</label>
          <div style={segWrap}>
            <SegBtn
              label="🏠 Salão" borderRight
              ativo={(formDespesa.tipo || 'salao') === 'salao'}
              onClick={() => setFormDespesa({ ...formDespesa, tipo: 'salao' })}
            />
            <SegBtn
              label="👤 Pessoal"
              ativo={(formDespesa.tipo || 'salao') === 'pessoal'}
              onClick={() => setFormDespesa({ ...formDespesa, tipo: 'pessoal' })}
            />
          </div>
        </div>

        {mostrarStatus && (
          <div style={s.field}>
            <label style={s.label}>Situação</label>
            <div style={segWrap}>
              <SegBtn
                label="⏳ A pagar" borderRight
                ativo={aPagar}
                onClick={() => setFormDespesa({ ...formDespesa, pago: false })}
              />
              <SegBtn
                label="✅ Já paguei"
                ativo={!aPagar}
                cor="#059669"
                onClick={() => setFormDespesa({ ...formDespesa, pago: true })}
              />
            </div>
          </div>
        )}
      </div>

      {/* Aviso: data passada + a pagar */}
      {alertaDataPassada && (
        <div style={{ fontSize: 12, color: '#92400E', background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 8, padding: '8px 12px' }}>
          ⚠️ A data já passou — se você já pagou, troque para <strong>Já paguei</strong>.
        </div>
      )}

      <div style={s.field}>
        <label style={s.label}>Descrição *</label>
        <input
          style={s.input}
          placeholder="Ex: Conta de luz"
          value={formDespesa.descricao}
          onChange={e => setFormDespesa({ ...formDespesa, descricao: e.target.value })}
        />
      </div>

      <div style={s.field}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={s.label}>Categoria *</label>
          <button type="button" onClick={() => setShowNovaCat(v => !v)} style={s.novaCatLink}>
            {showNovaCat ? '× Fechar' : '+ Nova categoria'}
          </button>
        </div>
        <select style={s.input} value={formDespesa.categoria} onChange={e => setFormDespesa({ ...formDespesa, categoria: e.target.value })}>
          <optgroup label="Padrão">
            {CATEGORIAS.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
          </optgroup>
          {categoriasCustom.length > 0 && (
            <optgroup label="Minhas categorias">
              {categoriasCustom.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
            </optgroup>
          )}
        </select>

        {showNovaCat && (
          <div style={s.novaCatPanel}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              {/* Botão de emoji com picker */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(v => !v)}
                  title="Escolher ícone"
                  style={{
                    width: 44, height: 44, fontSize: 22, borderRadius: 'var(--radius-sm)',
                    border: '1px solid ' + (showEmojiPicker ? 'var(--pink)' : 'var(--border2)'),
                    background: 'var(--surface)', cursor: 'pointer', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {novaCat.icon || '📦'}
                </button>
              </div>
              <input
                style={{ ...s.input, flex: 1, minWidth: 0 }}
                value={novaCat.label}
                onChange={e => setNovaCat({ ...novaCat, label: e.target.value })}
                placeholder="Nome da categoria"
              />
            </div>

            {/* Grade de emojis */}
            {showEmojiPicker && (
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 2,
                padding: '8px', background: 'var(--surface)', borderRadius: 8,
                border: '1px solid var(--border2)',
              }}>
                {EMOJIS_CAT.map(e => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => { setNovaCat({ ...novaCat, icon: e }); setShowEmojiPicker(false) }}
                    style={{
                      fontSize: 20, padding: '4px', borderRadius: 6, border: 'none',
                      background: novaCat.icon === e ? 'var(--pink-light, #f9e8f0)' : 'transparent',
                      cursor: 'pointer', lineHeight: 1,
                    }}
                    title={e}
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}

            <button type="button" style={{ ...s.addBtnSmall, justifyContent: 'center', padding: '8px 12px' }} onClick={salvarNovaCategoria} disabled={savingCat}>
              {savingCat ? 'Salvando...' : 'Criar categoria'}
            </button>
            {categoriasCustom.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 2, borderTop: '1px dashed var(--border)', paddingTop: 8 }}>
                {categoriasCustom.map(c => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--text2)' }}>
                    <span>{c.icon} {c.label}</span>
                    <button type="button" onClick={() => excluirCategoria(c)} style={{ ...s.miniIconBtn, color: '#B91C1C' }} title="Excluir categoria"><X size={11} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Valor + Data (label muda conforme situação) */}
      <div className="form-row-stack" style={s.row}>
        <div style={{ ...s.field, flex: 1 }}>
          <label style={s.label}>Valor (R$){formDespesa.recorrente && formDespesa.valor_variavel ? '' : ' *'}</label>
          <input
            style={{ ...s.input, fontFamily: "'JetBrains Mono', monospace" }}
            type="number" step="0.01"
            placeholder={formDespesa.recorrente && formDespesa.valor_variavel ? 'pode deixar em branco' : '0,00'}
            value={formDespesa.valor}
            onChange={e => setFormDespesa({ ...formDespesa, valor: e.target.value })}
          />
        </div>
        <div style={{ ...s.field, flex: 1 }}>
          <label style={s.label}>{mostrarStatus && aPagar ? 'Vencimento *' : 'Data do pagamento *'}</label>
          <input
            style={s.input}
            type="date"
            value={formDespesa.data}
            onChange={e => setFormDespesa({ ...formDespesa, data: e.target.value })}
          />
        </div>
      </div>

      <div style={s.field}>
        <label style={s.label}>Forma de pagamento</label>
        <select style={s.input} value={formDespesa.forma_pagamento} onChange={e => setFormDespesa({ ...formDespesa, forma_pagamento: e.target.value })}>
          {FORMAS_PAGAMENTO.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </div>

      {/* Divisor + Recorrente */}
      <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0 8px' }} />

      {editandoDespesa ? (
        formDespesa.recorrente && (
          <div style={{ fontSize: 12, color: 'var(--text3)', background: 'var(--surface2)', borderRadius: 8, padding: '8px 12px' }}>
            🔁 Faz parte de uma despesa recorrente{formDespesa.valor_variavel ? ' (valor varia todo mês)' : ''}. Editar aqui altera só este mês.
          </div>
        )
      ) : (
        <>
          {/* Toggle de recorrente */}
          <div
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: formDespesa.recorrente ? 10 : 0 }}
            onClick={() => toggleRecorrente(!formDespesa.recorrente)}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>🔁 Despesa recorrente</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>Repete todo mês automaticamente</div>
            </div>
            <Toggle checked={formDespesa.recorrente} onChange={toggleRecorrente} />
          </div>

          {/* Card de opções de recorrência */}
          {formDespesa.recorrente && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 14px', background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text2)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formDespesa.valor_variavel}
                  onChange={e => setFormDespesa({ ...formDespesa, valor_variavel: e.target.checked })}
                />
                💧 O valor muda todo mês
              </label>
              {formDespesa.valor_variavel && (
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: -6 }}>
                  Os meses futuros entrarão em branco para você preencher na hora.
                </div>
              )}
              <div style={s.field}>
                <label style={s.label}>Repetir até *</label>
                <input style={s.input} type="date" value={formDespesa.recorrente_ate} onChange={e => setFormDespesa({ ...formDespesa, recorrente_ate: e.target.value })} />
              </div>
            </div>
          )}
        </>
      )}

      <div style={{ ...s.field, marginTop: 8 }}>
        <label style={s.label}>Observações</label>
        <input style={s.input} placeholder="Opcional..." value={formDespesa.observacoes} onChange={e => setFormDespesa({ ...formDespesa, observacoes: e.target.value })} />
      </div>

      <button style={s.btnPrimary} onClick={onSalvar} disabled={savingDespesa}>
        {savingDespesa ? 'Salvando...' : editandoDespesa ? 'Salvar alterações' : 'Registrar despesa'}
      </button>
      <button style={s.btnSecondary} onClick={onClose}>Cancelar</button>
    </Modal>
  )
}
