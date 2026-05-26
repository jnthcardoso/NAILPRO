import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, Plus, X, Copy, Check, ExternalLink } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { initTokenClient, conectarGoogle, desconectarGoogle } from '../lib/googleCalendar'

const SUGERIDOS = ['Manutenção', 'Alongamento gel', 'Fibra de vidro', 'Pedicure', 'Manicure', 'Gel francês', 'Esmaltação', 'Nail art', 'Baby boomer', 'Encapsulamento']
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const DURACOES = [30, 45, 60, 90, 120]

function slugify(text) {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export default function Configuracoes() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    nome_salao: '',
    whatsapp: '',
    meta_mensal: 4000,
    servicos_padrao: [],
    agenda_publica_ativa: false,
    slug: '',
    horario_inicio: '09:00',
    horario_fim: '18:00',
    duracao_atendimento: 60,
    dias_semana: [1, 2, 3, 4, 5],
    google_conectado: false,
  })
  const [novoServico, setNovoServico] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const [slugErro, setSlugErro] = useState('')

  useEffect(() => { if (user) loadConfig() }, [user])

  async function loadConfig() {
    const { data } = await supabase.from('configuracoes').select('*').eq('user_id', user.id).single()
    if (data) {
      setForm({
        nome_salao: data.nome_salao || '',
        whatsapp: data.whatsapp || '',
        meta_mensal: data.meta_mensal || 4000,
        servicos_padrao: data.servicos_padrao || [],
        agenda_publica_ativa: data.agenda_publica_ativa || false,
        slug: data.slug || '',
        horario_inicio: data.horario_inicio?.slice(0, 5) || '09:00',
        horario_fim: data.horario_fim?.slice(0, 5) || '18:00',
        duracao_atendimento: data.duracao_atendimento || 60,
        dias_semana: data.dias_semana || [1, 2, 3, 4, 5],
        google_conectado: data.google_conectado || false,
      })
    }
  }

  async function salvar() {
    if (form.agenda_publica_ativa && !form.slug) {
      setSlugErro('Defina um link para ativar a agenda pública')
      return
    }
    setSaving(true)
    const { error } = await supabase.from('configuracoes').upsert({ user_id: user.id, ...form })
    setSaving(false)
    if (error?.code === '23505') {
      setSlugErro('Este link já está em uso, escolha outro')
      return
    }
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

  function toggleDia(d) {
    setForm(f => ({
      ...f,
      dias_semana: f.dias_semana.includes(d)
        ? f.dias_semana.filter(x => x !== d)
        : [...f.dias_semana, d].sort(),
    }))
  }

  function gerarSlug() {
    const base = slugify(form.nome_salao || user?.email?.split('@')[0] || 'meu-salao')
    setForm(f => ({ ...f, slug: base }))
    setSlugErro('')
  }

  function copiarLink() {
    navigator.clipboard.writeText(linkPublico)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const [googleLoading, setGoogleLoading] = useState(false)
  const [googleErro, setGoogleErro] = useState('')

  function waitForGIS() {
    return new Promise((resolve) => {
      if (window.google?.accounts?.oauth2) { resolve(); return }
      const check = setInterval(() => {
        if (window.google?.accounts?.oauth2) { clearInterval(check); resolve() }
      }, 200)
      setTimeout(() => { clearInterval(check); resolve() }, 5000)
    })
  }

  async function handleConectarGoogle() {
    setGoogleLoading(true)
    setGoogleErro('')
    try {
      await waitForGIS()
      initTokenClient()
      await conectarGoogle()
      await supabase.from('configuracoes').upsert({ user_id: user.id, google_conectado: true }, { onConflict: 'user_id' })
      setForm(f => ({ ...f, google_conectado: true }))
    } catch (e) {
      setGoogleErro('Não foi possível conectar. Verifique o Client ID e tente novamente.')
    } finally {
      setGoogleLoading(false)
    }
  }

  async function handleDesconectarGoogle() {
    desconectarGoogle()
    await supabase.from('configuracoes').update({ google_conectado: false }).eq('user_id', user.id)
    setForm(f => ({ ...f, google_conectado: false }))
  }

  async function handleLogout() {
    await signOut()
    navigate('/login', { replace: true })
  }

  const linkPublico = `${window.location.origin}/agendar/${form.slug}`

  return (
    <div style={s.page}>

      {/* ── Perfil ──────────────────────────── */}
      <div style={s.section}>
        <div style={s.sectionTitle}>perfil do salão</div>
        <div style={s.field}>
          <label style={s.label}>Nome do salão / profissional</label>
          <input style={s.input} placeholder="Ex: Studio Nail by Ana" value={form.nome_salao}
            onChange={e => setForm({ ...form, nome_salao: e.target.value })} />
        </div>
        <div style={s.field}>
          <label style={s.label}>WhatsApp (com DDD, sem espaços)</label>
          <input style={s.input} placeholder="51999999999" value={form.whatsapp}
            onChange={e => setForm({ ...form, whatsapp: e.target.value })} />
          <div style={s.hint}>Usado para enviar lembretes às clientes</div>
        </div>
      </div>

      {/* ── Metas ───────────────────────────── */}
      <div style={s.section}>
        <div style={s.sectionTitle}>metas</div>
        <div style={s.field}>
          <label style={s.label}>Meta mensal de receita (R$)</label>
          <input style={s.input} type="number" placeholder="4000" value={form.meta_mensal}
            onChange={e => setForm({ ...form, meta_mensal: parseFloat(e.target.value) || 0 })} />
          <div style={s.hint}>Aparece na barra de progresso do Dashboard</div>
        </div>
      </div>

      {/* ── Serviços padrão ─────────────────── */}
      <div style={s.section}>
        <div style={s.sectionTitle}>serviços padrão</div>
        <div style={s.hint}>Aparecem como atalho ao criar agendamentos e na agenda online</div>
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
          <input style={{ ...s.input, flex: 1 }} placeholder="Nome do serviço..."
            value={novoServico} onChange={e => setNovoServico(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addServico(novoServico) }} />
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

      {/* ── Agenda Online ───────────────────── */}
      <div style={s.section}>
        <div style={s.sectionTitle}>agenda online para clientes</div>

        {/* Toggle ativar */}
        <div style={s.toggleRow} onClick={() => setForm(f => ({ ...f, agenda_publica_ativa: !f.agenda_publica_ativa }))}>
          <div>
            <div style={s.toggleLabel}>Ativar agendamento público</div>
            <div style={s.hint}>Clientes agendam pelo link, sem precisar te chamar</div>
          </div>
          <div style={{ ...s.toggle, ...(form.agenda_publica_ativa ? s.toggleOn : {}) }}>
            <div style={{ ...s.toggleThumb, ...(form.agenda_publica_ativa ? s.toggleThumbOn : {}) }} />
          </div>
        </div>

        {/* Link personalizado */}
        <div style={s.field}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={s.label}>Link de agendamento</label>
            <button style={s.linkBtn} onClick={gerarSlug}>Gerar automático</button>
          </div>
          <div style={s.slugRow}>
            <div style={s.slugPrefix}>/agendar/</div>
            <input
              style={{ ...s.input, flex: 1, borderRadius: '0 8px 8px 0', borderLeft: 'none' }}
              placeholder="meu-salao"
              value={form.slug}
              onChange={e => { setForm(f => ({ ...f, slug: slugify(e.target.value) })); setSlugErro('') }}
            />
          </div>
          {slugErro && <span style={s.erro}>{slugErro}</span>}
          {form.slug && (
            <div style={s.linkPreview}>
              <span style={s.linkPreviewText}>{linkPublico}</span>
              <button style={s.iconBtn} onClick={copiarLink} title="Copiar link">
                {copied ? <Check size={14} color="#2E7D32" /> : <Copy size={14} />}
              </button>
              <a href={linkPublico} target="_blank" rel="noopener noreferrer" style={s.iconBtn} title="Abrir link">
                <ExternalLink size={14} />
              </a>
            </div>
          )}
        </div>

        {/* Horários */}
        <div style={s.row}>
          <div style={{ ...s.field, flex: 1 }}>
            <label style={s.label}>Início do atendimento</label>
            <input style={s.input} type="time" value={form.horario_inicio}
              onChange={e => setForm(f => ({ ...f, horario_inicio: e.target.value }))} />
          </div>
          <div style={{ ...s.field, flex: 1 }}>
            <label style={s.label}>Fim do atendimento</label>
            <input style={s.input} type="time" value={form.horario_fim}
              onChange={e => setForm(f => ({ ...f, horario_fim: e.target.value }))} />
          </div>
        </div>

        {/* Duração por atendimento */}
        <div style={s.field}>
          <label style={s.label}>Duração por atendimento</label>
          <div style={s.chipsRow}>
            {DURACOES.map(d => (
              <button
                key={d}
                style={{ ...s.chipSug, ...(form.duracao_atendimento === d ? s.chipActive : {}), cursor: 'pointer' }}
                onClick={() => setForm(f => ({ ...f, duracao_atendimento: d }))}
              >
                {d} min
              </button>
            ))}
          </div>
        </div>

        {/* Dias de funcionamento */}
        <div style={s.field}>
          <label style={s.label}>Dias de funcionamento</label>
          <div style={s.diasRow}>
            {DIAS.map((d, i) => (
              <button
                key={i}
                style={{ ...s.diaBtn, ...(form.dias_semana.includes(i) ? s.diaBtnActive : {}) }}
                onClick={() => toggleDia(i)}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Google Agenda ───────────────────── */}
      <div style={s.section}>
        <div style={s.sectionTitle}>Google Agenda</div>
        <div style={s.googleCard}>
          <svg width="22" height="22" viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
            <path fill="#4285F4" d="M45.5 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h12.1c-.5 2.7-2.1 5-4.5 6.5v5.4h7.3c4.3-3.9 6.6-9.7 6.6-15.6z"/>
            <path fill="#34A853" d="M24 46c6.1 0 11.2-2 14.9-5.5l-7.3-5.4c-2 1.4-4.6 2.2-7.6 2.2-5.8 0-10.8-3.9-12.5-9.2H4v5.6C7.7 41.5 15.3 46 24 46z"/>
            <path fill="#FBBC04" d="M11.5 28.1c-.5-1.4-.7-2.8-.7-4.1s.2-2.8.7-4.1V14.3H4C2.4 17.4 1.5 20.6 1.5 24s.9 6.6 2.5 9.7l7.5-5.6z"/>
            <path fill="#EA4335" d="M24 10.8c3.3 0 6.2 1.1 8.5 3.3l6.4-6.4C35.2 4.1 30.1 2 24 2 15.3 2 7.7 6.5 4 14.3l7.5 5.6c1.7-5.3 6.7-9.1 12.5-9.1z"/>
          </svg>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
              {form.google_conectado ? 'Google Agenda conectado ✓' : 'Conectar Google Agenda'}
            </div>
            <div style={s.hint}>
              {form.google_conectado
                ? 'Agendamentos são sincronizados automaticamente'
                : 'Ao criar ou cancelar um agendamento, o Google Agenda é atualizado'}
            </div>
            {googleErro && <div style={{ ...s.hint, color: 'var(--red)', marginTop: 4 }}>{googleErro}</div>}
          </div>
          {form.google_conectado
            ? <button style={s.googleDesconBtn} onClick={handleDesconectarGoogle}>Desconectar</button>
            : <button style={s.googleConBtn} onClick={handleConectarGoogle} disabled={googleLoading}>
                {googleLoading ? '...' : 'Conectar'}
              </button>
          }
        </div>
        {!import.meta.env.VITE_GOOGLE_CLIENT_ID && (
          <div style={{ ...s.hint, color: 'var(--amber, #B45309)', marginTop: 6 }}>
            ⚠ VITE_GOOGLE_CLIENT_ID não configurado no .env
          </div>
        )}
      </div>

      <button
        style={{ ...s.btnPrimary, ...(saved ? s.btnSaved : {}) }}
        onClick={salvar}
        disabled={saving || saved}
      >
        {saved ? '✓ Configurações salvas!' : saving ? 'Salvando...' : 'Salvar configurações'}
      </button>

      <div style={s.divider} />

      {/* ── Conta ───────────────────────────── */}
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
  hint: { fontSize: 11, color: 'var(--text3)', marginTop: 2, marginBottom: 4 },
  input: { padding: '9px 12px', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', fontSize: 14, outline: 'none', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit' },
  row: { display: 'flex', gap: 10 },
  chipsRow: { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  chipActive: { display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--pink-light)', color: 'var(--pink)', border: '1px solid var(--pink-mid)', borderRadius: 'var(--radius-pill)', padding: '4px 10px', fontSize: 12, fontWeight: 500 },
  chipX: { background: 'none', border: 'none', color: 'var(--pink)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 },
  chipSug: { display: 'inline-flex', alignItems: 'center', background: 'var(--surface2)', color: 'var(--text2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-pill)', padding: '4px 10px', fontSize: 12, fontWeight: 500, cursor: 'pointer' },
  addRow: { display: 'flex', gap: 8, marginBottom: 8 },
  addBtn: { background: 'var(--pink)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', padding: '0 14px', display: 'flex', alignItems: 'center', cursor: 'pointer', flexShrink: 0 },
  /* Toggle */
  toggleRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', marginBottom: 12, cursor: 'pointer', border: '1px solid var(--border)' },
  toggleLabel: { fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 },
  toggle: { width: 44, height: 24, borderRadius: 12, background: 'var(--border2)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 },
  toggleOn: { background: 'var(--pink)' },
  toggleThumb: { position: 'absolute', top: 3, left: 3, width: 18, height: 18, borderRadius: '50%', background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' },
  toggleThumbOn: { left: 23 },
  /* Slug */
  slugRow: { display: 'flex', alignItems: 'stretch' },
  slugPrefix: { padding: '9px 10px', background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: '8px 0 0 8px', fontSize: 13, color: 'var(--text3)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center' },
  linkPreview: { display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', marginTop: 4 },
  linkPreviewText: { flex: 1, fontSize: 12, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', display: 'flex', alignItems: 'center', padding: 2, flexShrink: 0 },
  linkBtn: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--pink)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 },
  erro: { fontSize: 11, color: 'var(--red)', fontWeight: 500 },
  /* Dias */
  diasRow: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  diaBtn: { padding: '6px 10px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border2)', background: 'var(--surface2)', fontSize: 12, fontWeight: 500, cursor: 'pointer', color: 'var(--text2)' },
  diaBtnActive: { background: 'var(--pink)', color: 'white', border: '1px solid var(--pink)' },
  /* Save */
  btnPrimary: { width: '100%', background: 'var(--pink)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', padding: '12px', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 4, transition: 'background 0.2s' },
  btnSaved: { background: 'var(--green)' },
  divider: { height: 1, background: 'var(--border)', margin: '20px 0' },
  infoRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '0.5px solid var(--border)' },
  infoLabel: { fontSize: 13, color: 'var(--text3)' },
  infoValue: { fontSize: 13, fontWeight: 500, color: 'var(--text)' },
  logoutBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'var(--red-bg)', color: 'var(--red)', border: '0.5px solid #FFCDD2', borderRadius: 'var(--radius-sm)', padding: '11px 16px', fontSize: 14, fontWeight: 500, cursor: 'pointer', width: '100%', marginTop: 12 },
  googleCard: { display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '13px 14px' },
  googleConBtn: { background: '#4285F4', color: 'white', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 },
  googleDesconBtn: { background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid #FFCDD2', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 },
}
