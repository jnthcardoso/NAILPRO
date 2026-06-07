import { useEffect, useState } from 'react'
import { Calendar, Plug, Copy, Check, ExternalLink, Plus, X, Share2, User } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useSalao } from '../contexts/SalaoContext'
import { useToast } from '../contexts/ToastContext'
import { formatTelefone, unformatTelefone, linkWhatsAppCompleto } from '../lib/formatters'
import { initTokenClient, conectarGoogle, desconectarGoogle } from '../lib/googleCalendar'

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const DURACOES = [30, 45, 60, 90, 120]
const SUGERIDOS = ['Manutenção', 'Alongamento gel', 'Fibra de vidro', 'Pedicure', 'Manicure', 'Gel francês', 'Esmaltação', 'Nail art']

function slugify(text) {
  return (text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export default function MinhasConfiguracoes() {
  const { user } = useAuth()
  const { membro, membroId, salaoId, isProfissional } = useSalao()
  const { sucesso, erro: toastErro } = useToast()

  const [form, setForm] = useState({
    nome_exibicao: '',
    whatsapp: '',
    agenda_publica_ativa: false,
    slug: '',
    horario_inicio: '09:00',
    horario_fim: '18:00',
    duracao_atendimento: 60,
    dias_semana: [1, 2, 3, 4, 5],
    servicos_padrao: [],
    google_conectado: false,
  })
  const [novoServico, setNovoServico] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [slugErro, setSlugErro] = useState('')
  const [googleBusy, setGoogleBusy] = useState(false)

  useEffect(() => { if (membroId) loadConfig() }, [membroId])

  async function loadConfig() {
    setLoading(true)
    const { data } = await supabase.from('agenda_profissional').select('*').eq('membro_id', membroId).maybeSingle()
    if (data) {
      setForm({
        nome_exibicao: data.nome_exibicao || membro?.nome || '',
        whatsapp: data.whatsapp ? formatTelefone(data.whatsapp) : '',
        agenda_publica_ativa: data.agenda_publica_ativa || false,
        slug: data.slug || '',
        horario_inicio: data.horario_inicio?.slice(0, 5) || '09:00',
        horario_fim: data.horario_fim?.slice(0, 5) || '18:00',
        duracao_atendimento: data.duracao_atendimento || 60,
        dias_semana: data.dias_semana || [1, 2, 3, 4, 5],
        servicos_padrao: data.servicos_padrao || [],
        google_conectado: data.google_conectado || false,
      })
    } else {
      // Primeira vez: sugere nome e slug a partir do nome da manicure.
      const nome = membro?.nome || ''
      setForm(f => ({ ...f, nome_exibicao: nome, slug: slugify(nome) }))
    }
    setLoading(false)
  }

  function up(campo, valor) { setForm(f => ({ ...f, [campo]: valor })) }

  function toggleDia(i) {
    setForm(f => ({
      ...f,
      dias_semana: f.dias_semana.includes(i) ? f.dias_semana.filter(d => d !== i) : [...f.dias_semana, i].sort(),
    }))
  }

  function addServico(sv) {
    const v = (sv || '').trim()
    if (!v || form.servicos_padrao.includes(v)) return
    up('servicos_padrao', [...form.servicos_padrao, v])
    setNovoServico('')
  }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const linkPublico = form.slug ? `${baseUrl}/agendar/${form.slug}` : ''

  async function copiarLink() {
    if (!linkPublico) return
    try { await navigator.clipboard.writeText(linkPublico); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { /* ignore */ }
  }

  function compartilharWhatsapp() {
    if (!linkPublico) return
    const msg = `Oi! 💅 Agende seu horário comigo direto por aqui: ${linkPublico}`
    window.open(linkWhatsAppCompleto('', msg), '_blank')
  }

  // Verifica se o slug já está em uso (na agenda do salão ou de outra manicure).
  async function slugDisponivel(slug) {
    const [{ data: c }, { data: p }] = await Promise.all([
      supabase.from('configuracoes').select('slug').eq('slug', slug).maybeSingle(),
      supabase.from('agenda_profissional').select('membro_id').eq('slug', slug).maybeSingle(),
    ])
    if (c) return false
    if (p && p.membro_id !== membroId) return false
    return true
  }

  async function salvar() {
    setSlugErro('')
    const slug = slugify(form.slug)
    if (form.agenda_publica_ativa) {
      if (!slug || slug.length < 3) { setSlugErro('O link precisa de pelo menos 3 letras.'); return }
      const ok = await slugDisponivel(slug)
      if (!ok) { setSlugErro('Esse link já está em uso. Escolha outro.'); return }
    }
    setSaving(true)
    const { error } = await supabase.from('agenda_profissional').upsert({
      membro_id: membroId,
      user_id: user.id,
      salao_id: salaoId,
      nome_exibicao: form.nome_exibicao?.trim() || membro?.nome || 'Profissional',
      whatsapp: unformatTelefone(form.whatsapp) || null,
      agenda_publica_ativa: form.agenda_publica_ativa,
      slug: slug || null,
      horario_inicio: form.horario_inicio,
      horario_fim: form.horario_fim,
      duracao_atendimento: form.duracao_atendimento,
      dias_semana: form.dias_semana,
      servicos_padrao: form.servicos_padrao,
      google_conectado: form.google_conectado,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'membro_id' })
    setSaving(false)
    if (error) { toastErro('Erro ao salvar: ' + error.message); return }
    up('slug', slug)
    sucesso('Configurações salvas! ✨')
  }

  async function conectarGoogleAgenda() {
    setGoogleBusy(true)
    try {
      initTokenClient()
      await conectarGoogle()
      await supabase.from('agenda_profissional').upsert({
        membro_id: membroId, user_id: user.id, salao_id: salaoId, google_conectado: true, updated_at: new Date().toISOString(),
      }, { onConflict: 'membro_id' })
      up('google_conectado', true)
      sucesso('Google Agenda conectado! 📅')
    } catch (e) {
      toastErro('Não foi possível conectar o Google Agenda.')
    } finally { setGoogleBusy(false) }
  }

  async function desconectarGoogleAgenda() {
    desconectarGoogle()
    await supabase.from('agenda_profissional').update({ google_conectado: false }).eq('membro_id', membroId)
    up('google_conectado', false)
  }

  if (!isProfissional) {
    return <div style={s.page}><div style={s.card}>Esta página é exclusiva para profissionais.</div></div>
  }
  if (loading) return <div style={s.page}><div style={s.card}>Carregando...</div></div>

  return (
    <div style={s.page}>
      <h1 style={s.titulo}>Minhas configurações</h1>
      <p style={s.sub}>Conecte seu Google Agenda e divulgue seu link de agendamento.</p>

      {/* Dados pessoais */}
      <div style={s.card}>
        <div style={s.cardHeader}><User size={17} color="var(--pink)" /><span style={s.cardTitulo}>Meus dados</span></div>
        <label style={s.label}>Nome que aparece pra cliente</label>
        <input style={s.input} value={form.nome_exibicao} onChange={e => up('nome_exibicao', e.target.value)} placeholder="Ex.: Vivi Nails" />
        <label style={s.label}>Meu WhatsApp</label>
        <input style={s.input} value={form.whatsapp} onChange={e => up('whatsapp', formatTelefone(e.target.value))} placeholder="(54) 99999-9999" inputMode="numeric" />
      </div>

      {/* Agenda online (link próprio) */}
      <div style={s.card}>
        <div style={s.cardHeader}><Calendar size={17} color="var(--pink)" /><span style={s.cardTitulo}>Minha agenda online</span></div>
        <p style={s.cardDesc}>Ative seu link pra divulgar nas redes. A cliente marca sozinha e o horário cai direto na sua agenda da Lumen.</p>

        <div style={s.toggleRow} onClick={() => up('agenda_publica_ativa', !form.agenda_publica_ativa)}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>Agenda online ativa</span>
          <div style={{ ...s.toggle, ...(form.agenda_publica_ativa ? s.toggleOn : {}) }}>
            <div style={{ ...s.toggleThumb, ...(form.agenda_publica_ativa ? s.toggleThumbOn : {}) }} />
          </div>
        </div>

        {form.agenda_publica_ativa && (
          <>
            <label style={s.label}>Seu link</label>
            <div style={s.linkRow}>
              <span style={s.linkPrefix}>{baseUrl}/agendar/</span>
              <input style={s.linkInput} value={form.slug} onChange={e => up('slug', slugify(e.target.value))} placeholder="seu-nome" />
            </div>
            {slugErro && <div style={s.erro}>{slugErro}</div>}
            {linkPublico && (
              <div style={s.linkAcoes}>
                <button style={s.btnSec} onClick={copiarLink}>{copied ? <><Check size={14} /> Copiado</> : <><Copy size={14} /> Copiar link</>}</button>
                <button style={s.btnSec} onClick={compartilharWhatsapp}><Share2 size={14} /> Compartilhar</button>
                <a style={s.btnSec} href={linkPublico} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Abrir</a>
              </div>
            )}

            <label style={s.label}>Horário de atendimento</label>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input style={{ ...s.input, marginBottom: 0 }} type="time" value={form.horario_inicio} onChange={e => up('horario_inicio', e.target.value)} />
              <span style={{ color: 'var(--text3)' }}>até</span>
              <input style={{ ...s.input, marginBottom: 0 }} type="time" value={form.horario_fim} onChange={e => up('horario_fim', e.target.value)} />
            </div>

            <label style={s.label}>Duração de cada atendimento</label>
            <div style={s.chips}>
              {DURACOES.map(d => (
                <button key={d} style={{ ...s.chip, ...(form.duracao_atendimento === d ? s.chipOn : {}) }} onClick={() => up('duracao_atendimento', d)}>{d} min</button>
              ))}
            </div>

            <label style={s.label}>Dias que você atende</label>
            <div style={s.chips}>
              {DIAS.map((d, i) => (
                <button key={i} style={{ ...s.chip, ...(form.dias_semana.includes(i) ? s.chipOn : {}) }} onClick={() => toggleDia(i)}>{d}</button>
              ))}
            </div>

            <label style={s.label}>Seus serviços</label>
            <div style={s.chips}>
              {form.servicos_padrao.map(sv => (
                <span key={sv} style={{ ...s.chip, ...s.chipOn, cursor: 'default' }}>{sv}<X size={13} style={{ marginLeft: 5, cursor: 'pointer' }} onClick={() => up('servicos_padrao', form.servicos_padrao.filter(x => x !== sv))} /></span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input style={{ ...s.input, marginBottom: 0 }} value={novoServico} onChange={e => setNovoServico(e.target.value)} onKeyDown={e => e.key === 'Enter' && addServico(novoServico)} placeholder="Adicionar serviço" />
              <button style={s.btnSec} onClick={() => addServico(novoServico)}><Plus size={15} /></button>
            </div>
            <div style={{ ...s.chips, marginTop: 8 }}>
              {SUGERIDOS.filter(sv => !form.servicos_padrao.includes(sv)).map(sv => (
                <button key={sv} style={s.chipGhost} onClick={() => addServico(sv)}>+ {sv}</button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Google Agenda */}
      <div style={s.card}>
        <div style={s.cardHeader}><Plug size={17} color="var(--pink)" /><span style={s.cardTitulo}>Google Agenda</span></div>
        <p style={s.cardDesc}>Conecte sua conta Google: todo agendamento criado na Lumen aparece automaticamente no seu Google Agenda.</p>
        {form.google_conectado ? (
          <div style={s.googleRow}>
            <span style={s.googleOk}><Check size={15} /> Conectado</span>
            <button style={s.btnSec} onClick={desconectarGoogleAgenda}>Desconectar</button>
          </div>
        ) : (
          <button style={s.btnPrimary} onClick={conectarGoogleAgenda} disabled={googleBusy}>
            {googleBusy ? 'Conectando...' : 'Conectar Google Agenda'}
          </button>
        )}
      </div>

      <button style={{ ...s.btnPrimary, width: '100%' }} onClick={salvar} disabled={saving}>
        {saving ? 'Salvando...' : 'Salvar configurações'}
      </button>
    </div>
  )
}

const s = {
  page: { maxWidth: 640, margin: '0 auto', padding: '20px 18px 80px' },
  titulo: { fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontSize: 28, color: 'var(--text)', margin: '0 0 4px' },
  sub: { fontSize: 13, color: 'var(--text2)', margin: '0 0 20px' },
  card: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '18px 18px', marginBottom: 16, boxShadow: 'var(--shadow-xs)' },
  cardHeader: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 },
  cardTitulo: { fontSize: 15, fontWeight: 700, color: 'var(--text)' },
  cardDesc: { fontSize: 12.5, color: 'var(--text3)', lineHeight: 1.5, margin: '0 0 14px' },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', margin: '14px 0 6px' },
  input: { width: '100%', boxSizing: 'border-box', padding: '11px 12px', borderRadius: 10, border: '1px solid var(--border2)', background: 'var(--surface2)', fontSize: 14, color: 'var(--text)', fontFamily: 'inherit', marginBottom: 4 },
  toggleRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '8px 0' },
  toggle: { width: 44, height: 26, borderRadius: 13, background: 'var(--border2)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 },
  toggleOn: { background: 'var(--pink)' },
  toggleThumb: { width: 20, height: 20, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: 3, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' },
  toggleThumbOn: { left: 21 },
  linkRow: { display: 'flex', alignItems: 'center', border: '1px solid var(--border2)', borderRadius: 10, background: 'var(--surface2)', overflow: 'hidden' },
  linkPrefix: { fontSize: 12, color: 'var(--text3)', padding: '0 0 0 12px', whiteSpace: 'nowrap' },
  linkInput: { flex: 1, minWidth: 0, padding: '11px 12px 11px 2px', border: 'none', background: 'transparent', fontSize: 14, color: 'var(--text)', fontFamily: 'inherit', outline: 'none', fontWeight: 600 },
  linkAcoes: { display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  erro: { fontSize: 12, color: '#B91C1C', marginTop: 6 },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  chip: { display: 'inline-flex', alignItems: 'center', padding: '7px 13px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border2)', background: 'var(--surface2)', fontSize: 13, fontWeight: 600, color: 'var(--text2)', cursor: 'pointer', fontFamily: 'inherit' },
  chipOn: { background: 'var(--pink)', color: '#fff', borderColor: 'var(--pink)' },
  chipGhost: { display: 'inline-flex', alignItems: 'center', padding: '6px 11px', borderRadius: 'var(--radius-pill)', border: '1px dashed var(--border2)', background: 'transparent', fontSize: 12.5, color: 'var(--text3)', cursor: 'pointer', fontFamily: 'inherit' },
  btnSec: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 10, border: '1px solid var(--border2)', background: 'var(--surface)', fontSize: 13, fontWeight: 600, color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none' },
  btnPrimary: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '13px 18px', borderRadius: 12, border: 'none', background: 'var(--pink)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: 'var(--shadow-pink)' },
  googleRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  googleOk: { display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--green)', fontWeight: 700, fontSize: 14 },
}
