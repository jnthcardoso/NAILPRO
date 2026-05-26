import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, Plus, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const SUGERIDOS = ['Manutenção', 'Alongamento gel', 'Fibra de vidro', 'Pedicure', 'Manicure', 'Gel francês', 'Esmaltação', 'Nail art', 'Baby boomer', 'Encapsulamento']

export default function Configuracoes() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ nome_salao: '', whatsapp: '', meta_mensal: 4000, servicos_padrao: [] })
  const [novoServico, setNovoServico] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => { if (user) loadConfig() }, [user])

  async function loadConfig() {
    const { data } = await supabase.from('configuracoes').select('*').eq('user_id', user.id).single()
    if (data) setForm({
      nome_salao: data.nome_salao || '',
      whatsapp: data.whatsapp || '',
      meta_mensal: data.meta_mensal || 4000,
      servicos_padrao: data.servicos_padrao || [],
    })
  }

  async function salvar() {
    setSaving(true)
    await supabase.from('configuracoes').upsert({ user_id: user.id, ...form })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  function addServico(nome) {
    const n = nome.trim()
    if (!n || form.servicos_padrao.includes(n)) { setNovoServico(''); return }
    setForm(f => ({ ...f, servicos_padrao: [...f.servicos_padrao, n] }))
    setNovoServico('')
  }

  function removeServico(nome) {
    setForm(f => ({ ...f, servicos_padrao: f.servicos_padrao.filter(x => x !== nome) }))
  }

  async function handleLogout() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div style={s.page}>

      <div style={s.section}>
        <div style={s.sectionTitle}>perfil do salão</div>
        <div style={s.field}>
          <label style={s.label}>Nome do salão / profissional</label>
          <input style={s.input} placeholder="Ex: Studio Nail by Ana" value={form.nome_salao} onChange={e => setForm({ ...form, nome_salao: e.target.value })} />
        </div>
        <div style={s.field}>
          <label style={s.label}>WhatsApp (com DDD, sem espaços)</label>
          <input style={s.input} placeholder="51999999999" value={form.whatsapp} onChange={e => setForm({ ...form, whatsapp: e.target.value })} />
          <div style={s.hint}>Usado para enviar lembretes às clientes</div>
        </div>
      </div>

      <div style={s.section}>
        <div style={s.sectionTitle}>metas</div>
        <div style={s.field}>
          <label style={s.label}>Meta mensal de receita (R$)</label>
          <input style={s.input} type="number" placeholder="4000" value={form.meta_mensal} onChange={e => setForm({ ...form, meta_mensal: parseFloat(e.target.value) || 0 })} />
          <div style={s.hint}>Aparece na barra de progresso do Dashboard</div>
        </div>
      </div>

      <div style={s.section}>
        <div style={s.sectionTitle}>serviços padrão</div>
        <div style={s.hint}>Aparecem como atalho ao criar agendamentos</div>
        {form.servicos_padrao.length > 0 && (
          <div style={s.chipsRow}>
            {form.servicos_padrao.map(sv => (
              <div key={sv} style={s.chipActive}>
                {sv}
                <button style={s.chipX} onClick={() => removeServico(sv)}><X size={11} /></button>
              </div>
            ))}
          </div>
        )}
        <div style={s.addRow}>
          <input
            style={{ ...s.input, flex: 1 }}
            placeholder="Nome do serviço..."
            value={novoServico}
            onChange={e => setNovoServico(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addServico(novoServico) }}
          />
          <button style={s.addBtn} onClick={() => addServico(novoServico)}><Plus size={16} /></button>
        </div>
        {SUGERIDOS.filter(sv => !form.servicos_padrao.includes(sv)).length > 0 && (
          <>
            <div style={{ ...s.hint, marginBottom: 6 }}>Sugestões rápidas:</div>
            <div style={s.chipsRow}>
              {SUGERIDOS.filter(sv => !form.servicos_padrao.includes(sv)).map(sv => (
                <div key={sv} style={s.chipSug} onClick={() => addServico(sv)}>+ {sv}</div>
              ))}
            </div>
          </>
        )}
      </div>

      <button style={{ ...s.btnPrimary, ...(saved ? s.btnSaved : {}) }} onClick={salvar} disabled={saving || saved}>
        {saved ? '✓ Configurações salvas!' : saving ? 'Salvando...' : 'Salvar configurações'}
      </button>

      <div style={s.divider} />

      <div style={s.section}>
        <div style={s.sectionTitle}>conta</div>
        <div style={s.infoRow}>
          <span style={s.infoLabel}>E-mail</span>
          <span style={s.infoValue}>{user?.email}</span>
        </div>
        <button style={s.logoutBtn} onClick={handleLogout}>
          <LogOut size={15} /> Sair da conta
        </button>
      </div>

    </div>
  )
}

const s = {
  page: { padding: 16, paddingBottom: 80 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 12 },
  field: { display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 },
  label: { fontSize: 12, fontWeight: 500, color: 'var(--text2)' },
  hint: { fontSize: 11, color: 'var(--text3)', marginTop: 2, marginBottom: 8 },
  input: { padding: '9px 12px', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', fontSize: 14, outline: 'none', background: 'var(--surface)', color: 'var(--text)' },
  chipsRow: { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  chipActive: { display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--pink-light)', color: 'var(--pink)', border: '1px solid var(--pink-mid)', borderRadius: 'var(--radius-pill)', padding: '4px 10px', fontSize: 12, fontWeight: 500 },
  chipX: { background: 'none', border: 'none', color: 'var(--pink)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 },
  chipSug: { display: 'inline-flex', alignItems: 'center', background: 'var(--surface2)', color: 'var(--text2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-pill)', padding: '4px 10px', fontSize: 12, fontWeight: 500, cursor: 'pointer' },
  addRow: { display: 'flex', gap: 8, marginBottom: 10 },
  addBtn: { background: 'var(--pink)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', padding: '0 14px', display: 'flex', alignItems: 'center', cursor: 'pointer', flexShrink: 0 },
  btnPrimary: { width: '100%', background: 'var(--pink)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', padding: '12px', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 4, transition: 'background 0.2s' },
  btnSaved: { background: 'var(--green)' },
  divider: { height: 1, background: 'var(--border)', margin: '20px 0' },
  infoRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '0.5px solid var(--border)' },
  infoLabel: { fontSize: 13, color: 'var(--text3)' },
  infoValue: { fontSize: 13, fontWeight: 500, color: 'var(--text)' },
  logoutBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'var(--red-bg)', color: 'var(--red)', border: '0.5px solid #FFCDD2', borderRadius: 'var(--radius-sm)', padding: '11px 16px', fontSize: 14, fontWeight: 500, cursor: 'pointer', width: '100%', marginTop: 12 },
}
