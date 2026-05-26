import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, ChevronLeft, Check, Sparkles, MessageCircle, Scissors, Target, Users, Calendar, ArrowRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const SERVICOS_SUGERIDOS = [
  'Manutenção', 'Alongamento gel', 'Fibra de vidro', 'Pedicure',
  'Manicure', 'Gel francês', 'Esmaltação', 'Nail art', 'Baby boomer', 'Encapsulamento'
]

const METAS_SUGERIDAS = [
  { valor: 2000, label: 'R$ 2.000', sub: 'iniciante' },
  { valor: 4000, label: 'R$ 4.000', sub: 'em crescimento' },
  { valor: 6000, label: 'R$ 6.000', sub: 'consolidada' },
  { valor: 10000, label: 'R$ 10.000', sub: 'profissional' },
]

export default function BemVindo() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    nome_salao: '',
    whatsapp: '',
    servicos_padrao: [],
    meta_mensal: 4000,
  })

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] ?? 'você'

  useEffect(() => {
    if (!user) navigate('/login')
  }, [user, navigate])

  function toggleServico(sv) {
    setForm(f => ({
      ...f,
      servicos_padrao: f.servicos_padrao.includes(sv)
        ? f.servicos_padrao.filter(x => x !== sv)
        : [...f.servicos_padrao, sv]
    }))
  }

  async function finalizar() {
    setSaving(true)
    await supabase.from('configuracoes').upsert({
      user_id: user.id,
      nome_salao: form.nome_salao,
      whatsapp: form.whatsapp.replace(/\D/g, ''),
      servicos_padrao: form.servicos_padrao,
      meta_mensal: form.meta_mensal,
      onboarding_completo: true,
    })
    setSaving(false)
    navigate('/')
  }

  function pularTudo() {
    if (confirm('Tem certeza? Você pode configurar depois nas Configurações.')) {
      supabase.from('configuracoes').upsert({
        user_id: user.id,
        onboarding_completo: true,
      }).then(() => navigate('/'))
    }
  }

  const totalSteps = 5
  const progresso = ((step + 1) / totalSteps) * 100

  return (
    <div style={s.page}>
      <div style={s.container}>

        {/* Progress bar */}
        <div style={s.topBar}>
          <div style={s.progressTrack}>
            <div style={{ ...s.progressFill, width: `${progresso}%` }} />
          </div>
          <button style={s.skipBtn} onClick={pularTudo}>Pular</button>
        </div>

        {/* Passo 0: Boas-vindas */}
        {step === 0 && (
          <div style={s.stepBox}>
            <div style={s.iconCircle}><Sparkles size={32} color="white" /></div>
            <h1 style={s.title}>oi {firstName}, bem-vinda ao <span style={{ color: 'var(--pink)' }}>nailpro</span></h1>
            <p style={s.subtitle}>
              Vamos configurar seu espaço em 4 passos rápidos.<br />
              Leva menos de 1 minuto. ✨
            </p>
            <div style={s.featuresList}>
              <div style={s.featureRow}><Calendar size={16} color="var(--pink)" /> Gerencie sua agenda</div>
              <div style={s.featureRow}><Users size={16} color="var(--pink)" /> Acompanhe suas clientes</div>
              <div style={s.featureRow}><Target size={16} color="var(--pink)" /> Bata suas metas</div>
              <div style={s.featureRow}><MessageCircle size={16} color="var(--pink)" /> WhatsApp integrado</div>
            </div>
            <button style={s.btnPrimary} onClick={() => setStep(1)}>
              Vamos começar <ArrowRight size={16} />
            </button>
          </div>
        )}

        {/* Passo 1: Nome do salão */}
        {step === 1 && (
          <div style={s.stepBox}>
            <div style={s.stepNumber}>Passo 1 de 4</div>
            <h1 style={s.title}>Como sua marca aparece?</h1>
            <p style={s.subtitle}>É como suas clientes vão te reconhecer.</p>
            <input
              style={s.input}
              placeholder="Ex: Studio Nail by Ana"
              value={form.nome_salao}
              onChange={e => setForm(f => ({ ...f, nome_salao: e.target.value }))}
              autoFocus
            />
            <div style={s.hint}>Pode ser o nome do seu salão ou o seu nome profissional.</div>
            <div style={s.btnRow}>
              <button style={s.btnGhost} onClick={() => setStep(0)}>
                <ChevronLeft size={16} /> Voltar
              </button>
              <button
                style={{ ...s.btnPrimary, opacity: form.nome_salao.trim() ? 1 : 0.5 }}
                onClick={() => form.nome_salao.trim() && setStep(2)}
                disabled={!form.nome_salao.trim()}
              >
                Continuar <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Passo 2: WhatsApp */}
        {step === 2 && (
          <div style={s.stepBox}>
            <div style={s.stepNumber}>Passo 2 de 4</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
              <MessageCircle size={28} color="#25D366" />
            </div>
            <h1 style={s.title}>Seu WhatsApp?</h1>
            <p style={s.subtitle}>
              Vamos usar pra enviar lembretes às suas clientes<br />
              e facilitar contato direto pelo app.
            </p>
            <input
              style={s.input}
              placeholder="(51) 99999-9999"
              value={form.whatsapp}
              onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))}
              autoFocus
              type="tel"
            />
            <div style={s.hint}>Com DDD. Não publicamos seu número.</div>
            <div style={s.btnRow}>
              <button style={s.btnGhost} onClick={() => setStep(1)}>
                <ChevronLeft size={16} /> Voltar
              </button>
              <button style={s.btnPrimary} onClick={() => setStep(3)}>
                Continuar <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Passo 3: Serviços */}
        {step === 3 && (
          <div style={s.stepBox}>
            <div style={s.stepNumber}>Passo 3 de 4</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
              <Scissors size={28} color="var(--pink)" />
            </div>
            <h1 style={s.title}>O que você faz?</h1>
            <p style={s.subtitle}>
              Selecione seus serviços. Vão virar atalhos na hora de agendar.<br />
              <strong style={{ color: 'var(--pink)' }}>Escolha pelo menos 3.</strong>
            </p>
            <div style={s.chipsGrid}>
              {SERVICOS_SUGERIDOS.map(sv => {
                const ativo = form.servicos_padrao.includes(sv)
                return (
                  <button
                    key={sv}
                    style={{ ...s.servicoChip, ...(ativo ? s.servicoChipActive : {}) }}
                    onClick={() => toggleServico(sv)}
                  >
                    {ativo && <Check size={13} />} {sv}
                  </button>
                )
              })}
            </div>
            <div style={s.hint}>
              {form.servicos_padrao.length === 0 && 'Nenhum selecionado'}
              {form.servicos_padrao.length === 1 && '1 serviço · selecione mais 2'}
              {form.servicos_padrao.length === 2 && '2 serviços · só mais 1!'}
              {form.servicos_padrao.length >= 3 && `${form.servicos_padrao.length} serviços selecionados ✓`}
            </div>
            <div style={s.btnRow}>
              <button style={s.btnGhost} onClick={() => setStep(2)}>
                <ChevronLeft size={16} /> Voltar
              </button>
              <button
                style={{ ...s.btnPrimary, opacity: form.servicos_padrao.length >= 3 ? 1 : 0.5 }}
                onClick={() => form.servicos_padrao.length >= 3 && setStep(4)}
                disabled={form.servicos_padrao.length < 3}
              >
                Continuar <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Passo 4: Meta */}
        {step === 4 && (
          <div style={s.stepBox}>
            <div style={s.stepNumber}>Passo 4 de 4</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
              <Target size={28} color="var(--pink)" />
            </div>
            <h1 style={s.title}>Sua meta mensal?</h1>
            <p style={s.subtitle}>
              Quanto você quer faturar por mês?<br />
              <span style={{ fontSize: 12 }}>Você pode mudar isso depois.</span>
            </p>
            <div style={s.metasGrid}>
              {METAS_SUGERIDAS.map(m => (
                <button
                  key={m.valor}
                  style={{ ...s.metaCard, ...(form.meta_mensal === m.valor ? s.metaCardActive : {}) }}
                  onClick={() => setForm(f => ({ ...f, meta_mensal: m.valor }))}
                >
                  <div style={s.metaValor}>{m.label}</div>
                  <div style={s.metaSub}>{m.sub}</div>
                </button>
              ))}
            </div>
            <div style={{ marginTop: 10 }}>
              <div style={s.label}>Ou defina outro valor:</div>
              <input
                style={{ ...s.input, fontFamily: "'JetBrains Mono', monospace" }}
                type="number"
                placeholder="R$ 5000"
                value={form.meta_mensal}
                onChange={e => setForm(f => ({ ...f, meta_mensal: parseFloat(e.target.value) || 0 }))}
              />
            </div>
            <div style={s.btnRow}>
              <button style={s.btnGhost} onClick={() => setStep(3)}>
                <ChevronLeft size={16} /> Voltar
              </button>
              <button
                style={{ ...s.btnPrimary, opacity: form.meta_mensal > 0 ? 1 : 0.5 }}
                onClick={() => form.meta_mensal > 0 && finalizar()}
                disabled={saving || form.meta_mensal === 0}
              >
                {saving ? 'Salvando...' : 'Finalizar configuração'} <Check size={16} />
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

const s = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #FBF6F8 0%, #FFF0F5 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  container: {
    width: '100%',
    maxWidth: 520,
    background: 'var(--surface)',
    borderRadius: 24,
    padding: '28px 24px',
    boxShadow: '0 20px 60px rgba(139,38,85,0.15)',
    border: '1px solid var(--border)',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    background: 'var(--border)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, var(--pink) 0%, var(--pink-dark, #5E1839) 100%)',
    borderRadius: 3,
    transition: 'width 0.4s ease',
  },
  skipBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text3)',
    fontSize: 12,
    cursor: 'pointer',
    fontWeight: 500,
  },
  stepBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, var(--pink) 0%, #C73B6F 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 4px',
    boxShadow: '0 8px 20px rgba(139,38,85,0.3)',
  },
  stepNumber: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text3)',
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
    textAlign: 'center',
  },
  title: {
    fontFamily: "'Instrument Serif', serif",
    fontStyle: 'italic',
    fontSize: 28,
    fontWeight: 400,
    color: 'var(--text)',
    textAlign: 'center',
    margin: 0,
    lineHeight: 1.2,
  },
  subtitle: {
    fontSize: 14,
    color: 'var(--text2)',
    textAlign: 'center',
    margin: 0,
    lineHeight: 1.5,
  },
  featuresList: {
    background: 'var(--surface2)',
    borderRadius: 12,
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    margin: '4px 0',
  },
  featureRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: 13,
    color: 'var(--text2)',
    fontWeight: 500,
  },
  input: {
    padding: '13px 16px',
    border: '1.5px solid var(--border2)',
    borderRadius: 12,
    fontSize: 15,
    background: 'var(--surface)',
    color: 'var(--text)',
    outline: 'none',
    fontFamily: 'inherit',
    width: '100%',
    boxSizing: 'border-box',
  },
  hint: {
    fontSize: 11,
    color: 'var(--text3)',
    textAlign: 'center',
    fontWeight: 500,
    margin: '4px 0',
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text2)',
    marginBottom: 6,
  },
  chipsGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    margin: '4px 0',
  },
  servicoChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '8px 14px',
    borderRadius: 'var(--radius-pill)',
    border: '1.5px solid var(--border2)',
    background: 'var(--surface)',
    color: 'var(--text2)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s',
    fontFamily: 'inherit',
  },
  servicoChipActive: {
    background: 'var(--pink-light)',
    color: 'var(--pink)',
    border: '1.5px solid var(--pink)',
    fontWeight: 700,
  },
  metasGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
    margin: '4px 0',
  },
  metaCard: {
    padding: '16px 12px',
    borderRadius: 14,
    border: '1.5px solid var(--border2)',
    background: 'var(--surface)',
    cursor: 'pointer',
    transition: 'all 0.15s',
    fontFamily: 'inherit',
  },
  metaCardActive: {
    border: '1.5px solid var(--pink)',
    background: 'var(--pink-light)',
    boxShadow: '0 4px 12px rgba(139,38,85,0.15)',
  },
  metaValor: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 18,
    fontWeight: 700,
    color: 'var(--pink)',
  },
  metaSub: {
    fontSize: 11,
    color: 'var(--text3)',
    marginTop: 2,
  },
  btnRow: {
    display: 'flex',
    gap: 10,
    marginTop: 8,
  },
  btnPrimary: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    background: 'linear-gradient(135deg, var(--pink) 0%, #C73B6F 100%)',
    color: 'white',
    border: 'none',
    borderRadius: 12,
    padding: '14px 18px',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 6px 16px rgba(139,38,85,0.3)',
    transition: 'transform 0.15s',
    fontFamily: 'inherit',
  },
  btnGhost: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    background: 'transparent',
    color: 'var(--text2)',
    border: '1.5px solid var(--border2)',
    borderRadius: 12,
    padding: '14px 18px',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
}
