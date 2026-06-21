import { format, addMonths } from 'date-fns'
import { X } from 'lucide-react'
import Modal from '../common/Modal'
import { s } from '../../pages/Financeiro.styles'
import { CATEGORIAS, FORMAS_PAGAMENTO } from '../../pages/Financeiro.constants'

// Modal de criação/edição de despesa (inclui bolso salão×pessoal, categorias
// personalizadas, contas a pagar e recorrência). Apresentacional: recebe estado
// e handlers do componente Financeiro.
export default function DespesaModal({
  editandoDespesa, formDespesa, setFormDespesa,
  showNovaCat, setShowNovaCat, categoriasCustom, novaCat, setNovaCat,
  salvarNovaCategoria, savingCat, excluirCategoria,
  temAcesso, savingDespesa, onSalvar, onClose,
}) {
  return (
    <Modal onClose={onClose} boxStyle={s.modalCentro}>
      <div style={s.modalTitle}>{editandoDespesa ? '✏️ Editar despesa' : '📉 Nova despesa'}</div>

      {/* Bolso: do salão (custo do negócio) × pessoal (gasto da dona) */}
      <div style={s.field}>
        <label style={s.label}>De quem é esse gasto?</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {[{ id: 'salao', label: '🏢 Do salão' }, { id: 'pessoal', label: '👤 Pessoal' }].map(o => {
            const ativo = (formDespesa.tipo || 'salao') === o.id
            return (
              <button key={o.id} type="button" onClick={() => setFormDespesa({ ...formDespesa, tipo: o.id })}
                style={{ flex: 1, padding: '9px 12px', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid ' + (ativo ? 'var(--pink)' : 'var(--border2)'), background: ativo ? 'var(--pink)' : 'var(--surface)', color: ativo ? 'white' : 'var(--text3)' }}>
                {o.label}
              </button>
            )
          })}
        </div>
        {(formDespesa.tipo || 'salao') === 'pessoal' && (
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>Gasto seu (não conta no lucro do salão — vai pro "seu bolso").</div>
        )}
      </div>

      <div style={s.field}>
        <label style={s.label}>Descrição *</label>
        <input style={s.input} placeholder="Ex: Conta de luz" value={formDespesa.descricao} onChange={e => setFormDespesa({ ...formDespesa, descricao: e.target.value })} />
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
            <div style={{ display: 'flex', gap: 8 }}>
              <input style={{ ...s.input, width: 52, textAlign: 'center', flexShrink: 0, padding: '10px 4px' }} value={novaCat.icon} onChange={e => setNovaCat({ ...novaCat, icon: e.target.value })} placeholder="📦" maxLength={2} title="Emoji da categoria" />
              <input style={{ ...s.input, flex: 1, minWidth: 0 }} value={novaCat.label} onChange={e => setNovaCat({ ...novaCat, label: e.target.value })} placeholder="Nome da categoria" />
            </div>
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
      <div className="form-row-stack" style={s.row}>
        <div style={{ ...s.field, flex: 1 }}>
          <label style={s.label}>Valor (R$){formDespesa.recorrente && formDespesa.valor_variavel ? '' : ' *'}</label>
          <input style={{ ...s.input, fontFamily: "'JetBrains Mono', monospace" }} type="number" step="0.01" placeholder={formDespesa.recorrente && formDespesa.valor_variavel ? 'pode deixar em branco' : '0,00'} value={formDespesa.valor} onChange={e => setFormDespesa({ ...formDespesa, valor: e.target.value })} />
        </div>
        <div style={{ ...s.field, flex: 1 }}>
          <label style={s.label}>Data *</label>
          <input style={s.input} type="date" value={formDespesa.data} onChange={e => setFormDespesa({ ...formDespesa, data: e.target.value })} />
        </div>
      </div>
      <div style={s.field}>
        <label style={s.label}>Forma de pagamento</label>
        <select style={s.input} value={formDespesa.forma_pagamento} onChange={e => setFormDespesa({ ...formDespesa, forma_pagamento: e.target.value })}>
          {FORMAS_PAGAMENTO.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </div>

      {/* Já paga × conta a pagar (Pro/Salão) — vencimento = data acima */}
      {temAcesso('contasAPagar') && (
        <>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text2)', cursor: 'pointer' }}>
            <input type="checkbox" checked={formDespesa.pago} onChange={e => setFormDespesa({ ...formDespesa, pago: e.target.checked })} />
            ✅ Já paguei essa conta
          </label>
          {!formDespesa.pago && (
            <div style={{ fontSize: 12, color: '#92400E', background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 8, padding: '8px 12px' }}>
              💸 Vai entrar em <strong>Contas a pagar</strong> com vencimento em {formDespesa.data ? format(new Date(formDespesa.data + 'T12:00:00'), 'dd/MM') : 'na data acima'}.
              {formDespesa.recorrente && !editandoDespesa && ' Os próximos meses também já nascem a pagar.'}
            </div>
          )}
        </>
      )}

      {editandoDespesa ? (
        formDespesa.recorrente && (
          <div style={{ fontSize: 12, color: 'var(--text3)', background: 'var(--surface2)', borderRadius: 8, padding: '8px 12px' }}>
            🔁 Faz parte de uma despesa recorrente{formDespesa.valor_variavel ? ' (valor varia todo mês)' : ''}. Editar aqui altera só este mês.
          </div>
        )
      ) : (
        <>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text2)', cursor: 'pointer' }}>
            <input type="checkbox" checked={formDespesa.recorrente} onChange={e => {
              const checked = e.target.checked
              setFormDespesa(f => ({
                ...f,
                recorrente: checked,
                valor_variavel: checked ? f.valor_variavel : false,
                recorrente_ate: checked && !f.recorrente_ate
                  ? format(addMonths(new Date((f.data || format(new Date(), 'yyyy-MM-dd')) + 'T12:00:00'), 12), 'yyyy-MM-dd')
                  : f.recorrente_ate,
              }))
            }} />
            🔁 Despesa mensal recorrente
          </label>
          {formDespesa.recorrente && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '10px 12px', background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text2)', cursor: 'pointer' }}>
                <input type="checkbox" checked={formDespesa.valor_variavel} onChange={e => setFormDespesa({ ...formDespesa, valor_variavel: e.target.checked })} />
                💧 O valor muda todo mês (futuros entram em branco pra preencher)
              </label>
              <div style={s.field}>
                <label style={s.label}>Repetir até *</label>
                <input style={s.input} type="date" value={formDespesa.recorrente_ate} onChange={e => setFormDespesa({ ...formDespesa, recorrente_ate: e.target.value })} />
              </div>
            </div>
          )}
        </>
      )}
      <div style={s.field}>
        <label style={s.label}>Observações</label>
        <input style={s.input} placeholder="Opcional..." value={formDespesa.observacoes} onChange={e => setFormDespesa({ ...formDespesa, observacoes: e.target.value })} />
      </div>
      <button style={s.btnPrimary} onClick={onSalvar} disabled={savingDespesa}>{savingDespesa ? 'Salvando...' : editandoDespesa ? 'Salvar alterações' : 'Registrar despesa'}</button>
      <button style={s.btnSecondary} onClick={onClose}>Cancelar</button>
    </Modal>
  )
}
