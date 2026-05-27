import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, Plus, X, Copy, Check, ExternalLink, Camera, Crown, ChevronRight, Trash2, AlertTriangle, FileText, Lock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useAssinatura, formatPreco, PLANOS } from '../contexts/AssinaturaContext'
import { UpgradeModal, ProBadge } from '../components/common/UpgradeBlock'
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
  const { assinatura, plano, status, isTrialing, isActive, isExpired, trialAcabou, diasRestantesTrial, temAcesso } = useAssinatura()
  const [showUpgrade, setShowUpgrade] = useState({ aberto: false, feature: '' })
  const [showExcluir, setShowExcluir] = useState(false)
  const [confirmacaoExcluir, setConfirmacaoExcluir] = useState('')
  const [excluindo, setExcluindo] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(user?.user_metadata?.avatar_url || '')
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
    dias_retorno_alerta: 30,
    lembretes_ativos: true,
    mensagem_lembrete: 'Oi {nome}! 💅 Passando pra lembrar do seu horário amanhã ({data}) às {horario} - {servico}. Posso confirmar?',
  })
  const [novoServico, setNovoServico] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const [slugErro, setSlugErro] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmaSenha, setConfirmaSenha] = useState('')
  const [senhaSaving, setSenhaSaving] = useState(false)
  const [senhaMsg, setSenhaMsg] = useState(null)

  useEffect(() => { 
    if (user) {
      loadConfig() 
      setAvatarUrl(user.user_metadata?.avatar_url || '')
    }
  }, [user])

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
        dias_retorno_alerta: data.dias_retorno_alerta || 30,
        lembretes_ativos: data.lembretes_ativos !== false,
        mensagem_lembrete: data.mensagem_lembrete || 'Oi {nome}! 💅 Passando pra lembrar do seu horário amanhã ({data}) às {horario} - {servico}. Posso confirmar?',
      })
    }
  }

  function handleAvatarChange(e) {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const size = 150
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')

        const sourceSize = Math.min(img.width, img.height)
        const sourceX = (img.width - sourceSize) / 2
        const sourceY = (img.height - sourceSize) / 2

        ctx.drawImage(img, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size)

        const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
        setAvatarUrl(dataUrl)
      }
      img.src = event.target.result
    }
    reader.readAsDataURL(file)
  }

  async function salvar() {
    if (form.agenda_publica_ativa && !form.slug) {
      setSlugErro('Defina um link para ativar a agenda pública')
      return
    }
    setSaving(true)
    
    const { error: configError } = await supabase.from('configuracoes').upsert({ user_id: user.id, ...form })
    const { error: authError } = await supabase.auth.updateUser({
      data: { avatar_url: avatarUrl }
    })
    
    setSaving(false)
    if (configError?.code === '23505') {
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
    if (!temAcesso('googleCalendar')) {
      setShowUpgrade({ aberto: true, feature: 'Google Calendar' })
      return
    }
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

  async function alterarSenha() {
    if (!novaSenha || novaSenha.length < 6) {
      setSenhaMsg({ tipo: 'erro', texto: 'A senha deve ter pelo menos 6 caracteres' })
      return
    }
    if (novaSenha !== confirmaSenha) {
      setSenhaMsg({ tipo: 'erro', texto: 'As senhas não coincidem' })
      return
    }
    setSenhaSaving(true)
    const { error } = await supabase.auth.updateUser({ password: novaSenha })
    setSenhaSaving(false)
    if (error) {
      setSenhaMsg({ tipo: 'erro', texto: error.message })
    } else {
      setSenhaMsg({ tipo: 'ok', texto: 'Senha alterada com sucesso!' })
      setNovaSenha('')
      setConfirmaSenha('')
      setTimeout(() => setSenhaMsg(null), 3000)
    }
  }

  async function handleLogout() {
    await signOut()
    navigate('/login', { replace: true })
  }

  async function excluirConta() {
    if (confirmacaoExcluir !== 'EXCLUIR') {
      alert('Digite EXCLUIR (em maiúsculas) para confirmar.')
      return
    }
    setExcluindo(true)
    const { error } = await supabase.rpc('excluir_minha_conta')
    if (error) {
      setExcluindo(false)
      alert('Erro ao excluir: ' + error.message)
      return
    }
    await signOut()
    navigate('/login', { replace: true })
  }

  const linkPublico = `${window.location.origin}/agendar/${form.slug}`

  return (
    <div style={s.page}>

      {/* ── Minha Assinatura ────────────────── */}
      <div style={s.section}>
        <div style={s.sectionTitle}>minha assinatura</div>
        <div
          style={{
            background: isActive
              ? 'linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)'
              : trialAcabou || isExpired
                ? 'linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%)'
                : 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)',
            border: '1px solid ' + (isActive ? '#86EFAC' : trialAcabou || isExpired ? '#FCA5A5' : '#FCD34D'),
            borderRadius: 'var(--radius-sm)',
            padding: '14px 16px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
          onClick={() => navigate('/planos')}
        >
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: isActive ? '#15803D' : trialAcabou || isExpired ? '#B91C1C' : '#D97706',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Crown size={20} color="white" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
              Plano {plano?.nome || 'Pro'}
              {isTrialing && !trialAcabou && diasRestantesTrial != null && (
                <span style={{ fontSize: 11, fontWeight: 600, marginLeft: 8, padding: '2px 8px', background: 'rgba(0,0,0,0.1)', borderRadius: 'var(--radius-pill)' }}>
                  Teste • {diasRestantesTrial} {diasRestantesTrial === 1 ? 'dia' : 'dias'}
                </span>
              )}
              {isActive && (
                <span style={{ fontSize: 11, fontWeight: 600, marginLeft: 8, padding: '2px 8px', background: '#15803D', color: 'white', borderRadius: 'var(--radius-pill)' }}>
                  Ativo
                </span>
              )}
              {(trialAcabou || isExpired) && (
                <span style={{ fontSize: 11, fontWeight: 600, marginLeft: 8, padding: '2px 8px', background: '#B91C1C', color: 'white', borderRadius: 'var(--radius-pill)' }}>
                  Expirado
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 3 }}>
              {isActive && 'Sua assinatura está ativa. Aproveite!'}
              {isTrialing && !trialAcabou && `Você ainda tem ${diasRestantesTrial} ${diasRestantesTrial === 1 ? 'dia' : 'dias'} de teste grátis`}
              {(trialAcabou || isExpired) && 'Assine pra continuar usando todas as funcionalidades'}
            </div>
          </div>
          <ChevronRight size={18} color="var(--text2)" />
        </div>
      </div>

      {/* ── Perfil ──────────────────────────── */}
      <div style={s.section}>
        <div style={s.sectionTitle}>perfil do salão</div>
        
        {/* Foto de Perfil */}
        <div style={s.avatarUploadRow}>
          <div className="avatar-preview-container">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Foto de perfil" style={s.avatarPreviewImg} />
            ) : (
              <div style={s.avatarPlaceholder}>
                {form.nome_salao?.[0]?.toUpperCase() || user?.user_metadata?.full_name?.[0]?.toUpperCase() || 'J'}
              </div>
            )}
            <label className="avatar-overlay">
              <Camera size={18} />
              <input type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: 'none' }} />
            </label>
          </div>
          <div style={s.avatarInfo}>
            <div style={s.avatarTitle}>Foto de perfil da manicure</div>
            <div style={s.hint}>Clique na foto para alterar. Recomendado formato quadrado.</div>
            {avatarUrl && (
              <button style={s.avatarRemoveBtn} onClick={() => setAvatarUrl('')}>Remover foto</button>
            )}
          </div>
        </div>

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

      {/* ── Metas e Alertas ─────────────────── */}
      <div style={s.section}>
        <div style={s.sectionTitle}>metas e alertas</div>
        <div style={s.field}>
          <label style={s.label}>Meta mensal de receita (R$)</label>
          <input style={s.input} type="number" placeholder="4000" value={form.meta_mensal}
            onChange={e => setForm({ ...form, meta_mensal: parseFloat(e.target.value) || 0 })} />
          <div style={s.hint}>Aparece na barra de progresso do Dashboard</div>
        </div>
        <div style={s.field}>
          <label style={s.label}>Alerta de retorno (dias)</label>
          <input style={s.input} type="number" min="7" max="365" placeholder="30" value={form.dias_retorno_alerta}
            onChange={e => setForm({ ...form, dias_retorno_alerta: parseInt(e.target.value) || 30 })} />
          <div style={s.hint}>Clientes sem visita há mais de X dias aparecem como "para reativar"</div>
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

      {/* ── Lembretes WhatsApp ──────────────── */}
      <div style={s.section}>
        <div style={s.sectionTitle}>lembretes via WhatsApp</div>

        <div
          style={{ ...s.toggleRow, ...(temAcesso('lembretesWhatsapp') ? {} : { opacity: 0.7 }) }}
          onClick={() => {
            if (!temAcesso('lembretesWhatsapp')) {
              setShowUpgrade({ aberto: true, feature: 'Lembretes WhatsApp' })
              return
            }
            setForm(f => ({ ...f, lembretes_ativos: !f.lembretes_ativos }))
          }}
        >
          <div>
            <div style={s.toggleLabel}>
              Ativar painel de lembretes
              {!temAcesso('lembretesWhatsapp') && <span style={{ marginLeft: 6 }}><ProBadge /></span>}
            </div>
            <div style={s.hint}>Mostra agendamentos de amanhã no Dashboard com botão para enviar lembretes</div>
          </div>
          <div style={{ ...s.toggle, ...(form.lembretes_ativos && temAcesso('lembretesWhatsapp') ? s.toggleOn : {}) }}>
            <div style={{ ...s.toggleThumb, ...(form.lembretes_ativos && temAcesso('lembretesWhatsapp') ? s.toggleThumbOn : {}) }} />
          </div>
        </div>

        {form.lembretes_ativos && (
          <>
            <div style={s.field}>
              <label style={s.label}>Mensagem do lembrete</label>
              <textarea
                style={{ ...s.input, minHeight: 90, resize: 'vertical', fontFamily: 'inherit' }}
                value={form.mensagem_lembrete}
                onChange={e => setForm({ ...form, mensagem_lembrete: e.target.value })}
                placeholder="Oi {nome}! Lembrete: amanhã às {horario} - {servico}. Confirma?"
              />
              <div style={s.hint}>
                Use variáveis: <code style={{ background: 'var(--surface2)', padding: '1px 5px', borderRadius: 3 }}>{'{nome}'}</code>{' '}
                <code style={{ background: 'var(--surface2)', padding: '1px 5px', borderRadius: 3 }}>{'{data}'}</code>{' '}
                <code style={{ background: 'var(--surface2)', padding: '1px 5px', borderRadius: 3 }}>{'{horario}'}</code>{' '}
                <code style={{ background: 'var(--surface2)', padding: '1px 5px', borderRadius: 3 }}>{'{servico}'}</code>{' '}
                <code style={{ background: 'var(--surface2)', padding: '1px 5px', borderRadius: 3 }}>{'{salao}'}</code>
              </div>
            </div>

            <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 'var(--radius-sm)', padding: 12, marginTop: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#15803D', marginBottom: 6 }}>📱 Como funciona</div>
              <div style={{ fontSize: 12, color: '#166534', lineHeight: 1.5 }}>
                Todo dia, agendamentos de <strong>amanhã</strong> aparecem no Dashboard.
                Você clica em "Enviar" e abre o WhatsApp Web com a mensagem pronta — só apertar enviar.
                Quem já recebeu fica marcado para não enviar duas vezes.
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Agenda Online ───────────────────── */}
      <div style={s.section}>
        <div style={s.sectionTitle}>agenda online para clientes</div>

        {/* Toggle ativar */}
        <div
          style={{ ...s.toggleRow, ...(temAcesso('agendaPublica') ? {} : { opacity: 0.7 }) }}
          onClick={() => {
            if (!temAcesso('agendaPublica')) {
              setShowUpgrade({ aberto: true, feature: 'Agenda online' })
              return
            }
            setForm(f => ({ ...f, agenda_publica_ativa: !f.agenda_publica_ativa }))
          }}
        >
          <div>
            <div style={s.toggleLabel}>
              Ativar agendamento público
              {!temAcesso('agendaPublica') && <span style={{ marginLeft: 6 }}><ProBadge /></span>}
            </div>
            <div style={s.hint}>Clientes agendam pelo link, sem precisar te chamar</div>
          </div>
          <div style={{ ...s.toggle, ...(form.agenda_publica_ativa && temAcesso('agendaPublica') ? s.toggleOn : {}) }}>
            <div style={{ ...s.toggleThumb, ...(form.agenda_publica_ativa && temAcesso('agendaPublica') ? s.toggleThumbOn : {}) }} />
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

        {/* Alterar senha */}
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 8 }}>Alterar senha</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              style={s.input}
              type="password"
              placeholder="Nova senha (mín. 6 caracteres)"
              value={novaSenha}
              onChange={e => setNovaSenha(e.target.value)}
            />
            <input
              style={s.input}
              type="password"
              placeholder="Confirmar nova senha"
              value={confirmaSenha}
              onChange={e => setConfirmaSenha(e.target.value)}
            />
            {senhaMsg && (
              <div style={{ fontSize: 12, fontWeight: 600, color: senhaMsg.tipo === 'ok' ? 'var(--green)' : 'var(--red)' }}>
                {senhaMsg.texto}
              </div>
            )}
            <button
              style={{ ...s.btnPrimary, marginTop: 0, padding: '10px' }}
              onClick={alterarSenha}
              disabled={senhaSaving}
            >
              {senhaSaving ? 'Salvando...' : 'Alterar senha'}
            </button>
          </div>
        </div>

        {/* Links LGPD */}
        <div style={{ display: 'flex', gap: 10, marginTop: 12, marginBottom: 8 }}>
          <a
            href="/termos"
            target="_blank"
            rel="noreferrer"
            style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, padding: '10px 12px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', textDecoration: 'none', color: 'var(--text2)', fontSize: 12, fontWeight: 600 }}
          >
            <FileText size={14} /> Termos de Uso
          </a>
          <a
            href="/privacidade"
            target="_blank"
            rel="noreferrer"
            style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, padding: '10px 12px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', textDecoration: 'none', color: 'var(--text2)', fontSize: 12, fontWeight: 600 }}
          >
            <Lock size={14} /> Privacidade
          </a>
        </div>

        <button style={s.logoutBtn} onClick={handleLogout}>
          <LogOut size={15} /> Sair da conta
        </button>

        {/* Zona de perigo */}
        <div style={{ marginTop: 24, paddingTop: 18, borderTop: '1px dashed var(--border)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#B91C1C', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>
            zona de perigo
          </div>
          <button
            onClick={() => setShowExcluir(true)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'transparent', color: '#B91C1C', border: '1px solid #FCA5A5', borderRadius: 'var(--radius-sm)', padding: '11px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            <Trash2 size={14} /> Excluir minha conta permanentemente
          </button>
          <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 6, textAlign: 'center' }}>
            Esta ação remove todos os seus dados (LGPD Art. 18). É irreversível.
          </div>
        </div>
      </div>

      {/* Modal de confirmação de exclusão */}
      {showExcluir && (
        <div style={s.overlayDelete} onClick={() => !excluindo && setShowExcluir(false)}>
          <div style={s.modalDelete} onClick={e => e.stopPropagation()}>
            <div style={s.iconDelete}><AlertTriangle size={28} color="white" /></div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: '0 0 8px' }}>
              Tem certeza absoluta?
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5, margin: '0 0 16px', textAlign: 'center' }}>
              Esta ação é <strong style={{ color: '#B91C1C' }}>irreversível</strong>. Serão excluídos permanentemente:
            </p>
            <ul style={{ fontSize: 12, color: 'var(--text2)', paddingLeft: 20, marginBottom: 16 }}>
              <li>Sua conta e dados de perfil</li>
              <li>Todas as suas clientes cadastradas</li>
              <li>Todo seu histórico de agendamentos</li>
              <li>Todos os pagamentos e finanças</li>
              <li>Metas, configurações e assinatura</li>
            </ul>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>
              Para confirmar, digite <strong>EXCLUIR</strong> abaixo:
            </div>
            <input
              type="text"
              value={confirmacaoExcluir}
              onChange={e => setConfirmacaoExcluir(e.target.value)}
              placeholder="EXCLUIR"
              style={{ width: '100%', padding: '10px 13px', border: '1.5px solid #FCA5A5', borderRadius: 'var(--radius-sm)', fontSize: 14, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '2px', textAlign: 'center', marginBottom: 14, boxSizing: 'border-box', outline: 'none' }}
              autoFocus
            />
            <button
              onClick={excluirConta}
              disabled={excluindo || confirmacaoExcluir !== 'EXCLUIR'}
              style={{ width: '100%', background: confirmacaoExcluir === 'EXCLUIR' ? '#B91C1C' : '#FCA5A5', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', padding: '13px', fontSize: 14, fontWeight: 700, cursor: confirmacaoExcluir === 'EXCLUIR' ? 'pointer' : 'not-allowed', fontFamily: 'inherit', marginBottom: 6 }}
            >
              {excluindo ? 'Excluindo...' : 'Sim, excluir minha conta'}
            </button>
            <button
              onClick={() => { setShowExcluir(false); setConfirmacaoExcluir('') }}
              disabled={excluindo}
              style={{ width: '100%', background: 'transparent', color: 'var(--text3)', border: 'none', padding: '10px', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <UpgradeModal
        aberto={showUpgrade.aberto}
        onClose={() => setShowUpgrade({ aberto: false, feature: '' })}
        titulo={`${showUpgrade.feature} é Pro`}
        descricao={`Faça upgrade pro plano Pro pra desbloquear ${showUpgrade.feature} e todas as outras features premium.`}
      />

    </div>
  )
}

const s = {
  page: { padding: 16, paddingBottom: 80 },
  section: { marginBottom: 24 },
  avatarUploadRow: { 
    display: 'flex', 
    alignItems: 'center', 
    gap: 16, 
    marginBottom: 16, 
    background: 'var(--surface2)', 
    padding: '12px 14px', 
    borderRadius: 'var(--radius-sm)', 
    border: '1px solid var(--border)' 
  },
  avatarPreviewImg: { 
    width: '100%', 
    height: '100%', 
    objectFit: 'cover' 
  },
  avatarPlaceholder: { 
    fontSize: 24, 
    fontWeight: 800, 
    color: 'var(--pink)', 
    fontFamily: "'Bricolage Grotesque', sans-serif" 
  },
  avatarInfo: { 
    display: 'flex', 
    flexDirection: 'column', 
    gap: 2, 
    flex: 1 
  },
  avatarTitle: { 
    fontSize: 13, 
    fontWeight: 600, 
    color: 'var(--text)' 
  },
  avatarRemoveBtn: { 
    background: 'none', 
    border: 'none', 
    color: 'var(--red)', 
    fontSize: 11, 
    fontWeight: 600, 
    cursor: 'pointer', 
    padding: '4px 0 0', 
    alignSelf: 'flex-start', 
    transition: 'opacity 0.2s' 
  },
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
  overlayDelete: { position: 'fixed', inset: 0, background: 'rgba(24,7,18,0.75)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)' },
  modalDelete: { background: 'var(--surface)', borderRadius: 20, padding: '28px 24px', maxWidth: 440, width: '100%', textAlign: 'center', boxShadow: '0 24px 64px rgba(0,0,0,0.3)' },
  iconDelete: { width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, #B91C1C 0%, #DC2626 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 8px 20px rgba(185,28,28,0.3)' },
}
