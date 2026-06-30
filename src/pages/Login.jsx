import { useState } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { LumenLogo } from '../components/common/Brand'
import { validarEmail, validarSenha, validarNome } from '../lib/formatters'
import { trackCadastro } from '../lib/analytics'

export default function Login() {
  const { user, signIn, signUp, resetPassword } = useAuth()
  // Se vier com ?modo=cadastro (ex: botão "Começar grátis" da landing), abre signup direto
  const [mode, setMode] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('modo') === 'cadastro' ? 'signup' : 'login'
  })
  const [form, setForm] = useState(() => {
    // Pré-preenche "quem indicou" se a pessoa chegou por um link ?indicacao=...
    const indic = new URLSearchParams(window.location.search).get('indicacao') || ''
    return { name: '', email: '', password: '', indicadoPor: indic }
  })
  const [aceitouTermos, setAceitouTermos] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('') // mensagem de sucesso (ex: recuperação enviada)

  if (user) return <Navigate to="/app" replace />

  const handleRecuperar = async (e) => {
    e.preventDefault()
    setError(''); setMsg('')
    if (!validarEmail(form.email)) { setError('Digite um e-mail válido.'); return }
    setLoading(true)
    const { error } = await resetPassword(form.email)
    setLoading(false)
    if (error) { setError('Não foi possível enviar. Tente novamente.'); return }
    setMsg('Pronto! Se este e-mail tiver conta, enviamos um link para redefinir a senha. Confira sua caixa de entrada (e o spam).')
  }

  const irPara = (novoModo) => { setMode(novoModo); setError(''); setMsg('') }

  const handle = async (e) => {
    e.preventDefault()
    setError('')

    // Validações
    if (!validarEmail(form.email)) {
      setError('Digite um e-mail válido.')
      return
    }
    if (!validarSenha(form.password)) {
      setError('A senha deve ter no mínimo 6 caracteres.')
      return
    }
    if (mode === 'signup') {
      if (!validarNome(form.name)) {
        setError('Digite seu nome completo.')
        return
      }
      if (!aceitouTermos) {
        setError('Você precisa aceitar os Termos de Uso e a Política de Privacidade.')
        return
      }
    }
    setLoading(true)
    if (mode === 'login') {
      const { error } = await signIn(form.email, form.password)
      if (error) setError('E-mail ou senha incorretos.')
    } else {
      const { data, error } = await signUp(form.email, form.password, form.name, form.indicadoPor)
      if (error) {
        // Traduz a causa mais comum; evita expor a mensagem técnica em inglês.
        setError(/already registered|already exists|user already/i.test(error.message)
          ? 'Este e-mail já tem conta. Tente entrar.'
          : /rate limit|too many|after \d+ seconds/i.test(error.message)
          ? 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.'
          : 'Não foi possível criar a conta. Tente novamente.')
      } else {
        trackCadastro()
        // Com confirmação de e-mail ligada, o Supabase não devolve sessão:
        // a pessoa precisa clicar no link enviado por e-mail antes de entrar.
        // Sem sessão e sem aviso, ela ficaria travada nesta tela.
        if (!data?.session) {
          setMode('login')
          setMsg('Conta criada! Enviamos um link de confirmação para o seu e-mail. Confira sua caixa de entrada (e o spam) e clique no link para ativar a conta e entrar.')
        }
      }
    }
    setLoading(false)
  }

  return (
    <div style={s.root}>
      <div className="fade-in" style={s.card}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
          <LumenLogo size={32} variant="reverso" layout="horizontal" />
        </div>
        <p style={s.sub}>iluminando a gestão, impulsionando o seu talento</p>
        <div style={{ textAlign: 'center', marginBottom: 6 }}>
          <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 12, color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>
            <ChevronLeft size={13} strokeWidth={2} />
            voltar ao site
          </Link>
        </div>

        {mode !== 'recuperar' && (
          <div style={s.tabs}>
            <button
              style={{ ...s.tab, ...(mode === 'login' ? s.tabActive : {}) }}
              onClick={() => irPara('login')}
            >
              Entrar
            </button>
            <button
              style={{ ...s.tab, ...(mode === 'signup' ? s.tabActive : {}) }}
              onClick={() => irPara('signup')}
            >
              Criar conta
            </button>
          </div>
        )}

        {mode === 'recuperar' ? (
          <form onSubmit={handleRecuperar} style={s.form}>
            <p style={s.recuperarTexto}>
              Informe o e-mail da sua conta e enviaremos um link para você criar uma nova senha.
            </p>
            <div style={s.field}>
              <label htmlFor="rec-email" style={s.label}>E-mail</label>
              <input
                id="rec-email"
                style={s.input}
                type="email"
                placeholder="seu@email.com"
                autoComplete="email"
                required
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
              />
            </div>
            {error && <div role="alert" aria-live="assertive" style={s.error}>{error}</div>}
            {msg && <div style={s.success}>{msg}</div>}
            <button style={s.btn} type="submit" disabled={loading}>
              {loading ? 'Enviando...' : 'Enviar link de recuperação'}
            </button>
            <button type="button" style={s.linkBtn} onClick={() => irPara('login')}>
              ← Voltar para o login
            </button>
          </form>
        ) : (
          <form onSubmit={handle} style={s.form}>
            {mode === 'signup' && (
              <div style={s.field}>
                <label htmlFor="login-name" style={s.label}>Seu nome</label>
                <input
                  id="login-name"
                  style={s.input}
                  type="text"
                  placeholder="Ex: Camila Souza"
                  autoComplete="name"
                  required
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                />
              </div>
            )}
            <div style={s.field}>
              <label htmlFor="login-email" style={s.label}>E-mail</label>
              <input
                id="login-email"
                style={s.input}
                type="email"
                placeholder="seu@email.com"
                autoComplete="email"
                required
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div style={s.field}>
              <label htmlFor="login-password" style={s.label}>Senha</label>
              <input
                id="login-password"
                style={s.input}
                type="password"
                placeholder="••••••••"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
              />
            </div>
            {mode === 'login' && (
              <button type="button" style={s.esqueciBtn} onClick={() => irPara('recuperar')}>
                Esqueci minha senha
              </button>
            )}
            {mode === 'signup' && (
              <div style={s.field}>
                <label htmlFor="login-indicacao" style={s.label}>Quem te indicou? <span style={{ opacity: 0.6, fontWeight: 400 }}>(opcional)</span></label>
                <input
                  id="login-indicacao"
                  style={s.input}
                  type="text"
                  placeholder="Nome ou WhatsApp de quem indicou"
                  value={form.indicadoPor}
                  onChange={e => setForm({ ...form, indicadoPor: e.target.value })}
                />
              </div>
            )}
            {mode === 'signup' && (
              <label style={s.termosRow}>
                <input
                  type="checkbox"
                  checked={aceitouTermos}
                  onChange={e => setAceitouTermos(e.target.checked)}
                  style={s.checkbox}
                />
                <span>
                  Li e aceito os{' '}
                  <Link to="/termos" target="_blank" style={s.linkTermos}>Termos de Uso</Link>
                  {' '}e a{' '}
                  <Link to="/privacidade" target="_blank" style={s.linkTermos}>Política de Privacidade</Link>.
                </span>
              </label>
            )}
            {error && <div role="alert" aria-live="assertive" style={s.error}>{error}</div>}
            {msg && <div style={s.success}>{msg}</div>}
            <button
              style={s.btn}
              type="submit"
              disabled={loading}
            >
              {loading ? (mode === 'login' ? 'Entrando...' : 'Criando conta...') : mode === 'login' ? 'Entrar' : 'Criar minha conta'}
            </button>
          </form>
        )}

        <div style={s.footer}>
          <Link to="/termos" style={s.footerLink}>Termos</Link>
          <span style={{ opacity: 0.3 }}>·</span>
          <Link to="/privacidade" style={s.footerLink}>Privacidade</Link>
        </div>
      </div>
    </div>
  )
}

const s = {
  root: {
    minHeight: '100vh',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'radial-gradient(circle at top, #2C1422 0%, var(--brand-dark-bg, #170D14) 100%)',
    padding: 20,
    overflowY: 'auto',
  },
  card: {
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 24,
    padding: '24px 28px',
    width: '100%',
    maxWidth: 390,
    margin: 'auto',
    border: '1px solid rgba(255, 255, 255, 0.07)',
    boxShadow: '0 24px 64px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
  },
  sub: {
    textAlign: 'center',
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.55)',
    marginTop: 4,
    marginBottom: 14,
    fontFamily: "'Instrument Serif', serif",
    fontStyle: 'italic',
    letterSpacing: '0.5px'
  },
  tabs: {
    display: 'flex',
    background: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 'var(--radius-sm)',
    padding: 3,
    marginBottom: 16,
    gap: 3,
    border: '1px solid rgba(255, 255, 255, 0.06)'
  },
  tab: { 
    flex: 1, 
    padding: '10px 0', 
    borderRadius: 8, 
    fontSize: 13, 
    fontWeight: 500, 
    background: 'transparent', 
    color: 'rgba(255, 255, 255, 0.6)', 
    border: 'none', 
    cursor: 'pointer', 
    transition: 'all 0.2s ease',
    fontFamily: "'Bricolage Grotesque', sans-serif"
  },
  tabActive: { 
    background: 'var(--gold, #E6C260)', 
    color: 'var(--brand-dark-bg, #170D14)', 
    boxShadow: 'var(--shadow-gold)', 
    fontWeight: 800 
  },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  field: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: { 
    fontSize: 12, 
    fontWeight: 600, 
    color: 'rgba(255, 255, 255, 0.85)',
    letterSpacing: '0.3px'
  },
  input: {
    padding: '11px 14px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid rgba(255, 255, 255, 0.1)', 
    fontSize: 14, 
    color: '#FFFFFF', 
    background: 'rgba(255, 255, 255, 0.04)',
    outline: 'none',
    transition: 'all 0.22s ease',
  },
  error: {
    background: 'rgba(185, 28, 28, 0.15)',
    color: '#FF8A8A',
    fontSize: 13,
    padding: '10px 14px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid rgba(185, 28, 28, 0.3)',
    fontWeight: 500
  },
  success: {
    background: 'rgba(21, 128, 61, 0.18)',
    color: '#86EFAC',
    fontSize: 13,
    padding: '10px 14px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid rgba(21,128,61,0.35)',
    fontWeight: 500,
    lineHeight: 1.5,
  },
  recuperarTexto: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 1.55,
    margin: '0 0 2px',
  },
  esqueciBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--gold, #E6C260)',
    fontSize: 12.5,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    alignSelf: 'flex-end',
    padding: 0,
    marginTop: -4,
  },
  linkBtn: {
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: 'inherit',
    marginTop: 2,
  },
  btn: {
    background: 'var(--gold, #E6C260)',
    color: 'var(--brand-dark-bg, #170D14)',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    padding: '13px 0',
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
    marginTop: 4,
    boxShadow: 'var(--shadow-gold)',
    transition: 'all 0.2s ease',
    fontFamily: "'Bricolage Grotesque', sans-serif",
  },
  termosRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    cursor: 'pointer',
    lineHeight: 1.5,
    padding: '4px 0',
  },
  checkbox: {
    width: 16,
    height: 16,
    marginTop: 2,
    cursor: 'pointer',
    accentColor: 'var(--gold, #E6C260)',
    flexShrink: 0,
  },
  linkTermos: {
    color: 'var(--gold, #E6C260)',
    textDecoration: 'underline',
    fontWeight: 600,
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 16,
    fontSize: 12,
  },
  footerLink: {
    color: 'rgba(255,255,255,0.5)',
    textDecoration: 'none',
    fontWeight: 500,
  },
}
