import { useState } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { LumenLogo } from '../components/common/Brand'
import GoogleIcon from '../components/common/GoogleIcon'
import { validarEmail, validarSenha, validarNome } from '../lib/formatters'
import { trackCadastro } from '../lib/analytics'
import { s } from './auth/authStyles'
import { useAuthPageScroll } from './auth/useAuthPageScroll'

export default function CriarConta() {
  useAuthPageScroll()
  const { user, signUp, signInWithGoogle } = useAuth()
  const [form, setForm] = useState(() => {
    // Pré-preenche "quem indicou" se a pessoa chegou por um link ?indicacao=...
    const indic = new URLSearchParams(window.location.search).get('indicacao') || ''
    return { name: '', email: '', password: '', indicadoPor: indic }
  })
  const [aceitouTermos, setAceitouTermos] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')
  const [contaCriada, setContaCriada] = useState(false)

  if (user) return <Navigate to="/app" replace />

  const handleGoogle = async () => {
    setError('')
    setGoogleLoading(true)
    const { error } = await signInWithGoogle()
    if (error) {
      setError('Não foi possível continuar com o Google. Tente novamente.')
      setGoogleLoading(false)
    }
  }

  const handle = async (e) => {
    e.preventDefault()
    setError('')

    if (!validarEmail(form.email)) { setError('Digite um e-mail válido.'); return }
    if (!validarSenha(form.password)) { setError('A senha deve ter no mínimo 6 caracteres.'); return }
    if (!validarNome(form.name)) { setError('Digite seu nome completo.'); return }
    if (!aceitouTermos) { setError('Você precisa aceitar os Termos de Uso e a Política de Privacidade.'); return }

    setLoading(true)
    const { data, error } = await signUp(form.email, form.password, form.name, form.indicadoPor)
    if (error) {
      setError(/already registered|already exists|user already/i.test(error.message)
        ? 'Este e-mail já tem conta. Tente entrar.'
        : /rate limit|too many|after \d+ seconds/i.test(error.message)
        ? 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.'
        : 'Não foi possível criar a conta. Tente novamente.')
    } else {
      trackCadastro()
      // Com confirmação de e-mail ligada, o Supabase não devolve sessão:
      // a pessoa precisa clicar no link enviado por e-mail antes de entrar.
      if (!data?.session) setContaCriada(true)
    }
    setLoading(false)
  }

  return (
    <div style={s.root}>
      <Link to="/" style={s.voltar}>
        <ChevronLeft size={13} strokeWidth={2} />
        voltar ao site
      </Link>

      <div className="auth-wrap">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
          <LumenLogo size={32} variant="reverso" layout="horizontal" />
        </div>

        {!contaCriada && (
          <p style={s.switchTop}>
            Já tem uma conta? <Link to="/login" style={s.switchLink}>Entrar</Link>
          </p>
        )}

        <div className="fade-in auth-card" style={s.card}>
          {contaCriada ? (
            <>
              <h1 style={{ ...s.title, textAlign: 'center', marginTop: 8 }}>Confira seu e-mail</h1>
              <p style={{ ...s.subtitle, textAlign: 'center' }}>Falta um passo para ativar sua conta</p>
              <div style={s.success}>
                Conta criada! Enviamos um link de confirmação para o seu e-mail. Confira sua caixa de entrada (e o spam) e clique no link para ativar a conta e entrar.
              </div>
              <Link to="/login" style={{ ...s.btn, display: 'block', textAlign: 'center', textDecoration: 'none', marginTop: 12, boxSizing: 'border-box' }}>
                Ir para o login
              </Link>
            </>
          ) : (
            <div className="auth-columns">
              <div className="auth-col-form">
                <h1 style={{ ...s.title, marginBottom: 20 }}>Criar conta no Lumen</h1>

                <form onSubmit={handle} style={s.form}>
                  <div style={s.field}>
                    <label htmlFor="signup-name" style={s.label}>Seu nome</label>
                    <input
                      id="signup-name"
                      style={s.input}
                      type="text"
                      placeholder="Ex: Camila Souza"
                      autoComplete="name"
                      required
                      value={form.name}
                      onChange={e => setForm({ ...form, name: e.target.value })}
                    />
                  </div>
                  <div style={s.field}>
                    <label htmlFor="signup-email" style={s.label}>E-mail</label>
                    <input
                      id="signup-email"
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
                    <label htmlFor="signup-password" style={s.label}>Senha</label>
                    <input
                      id="signup-password"
                      style={s.input}
                      type="password"
                      placeholder="••••••••"
                      autoComplete="new-password"
                      required
                      value={form.password}
                      onChange={e => setForm({ ...form, password: e.target.value })}
                    />
                  </div>
                  <div style={s.field}>
                    <label htmlFor="signup-indicacao" style={s.label}>Quem te indicou? <span style={{ opacity: 0.6, fontWeight: 400 }}>(opcional)</span></label>
                    <input
                      id="signup-indicacao"
                      style={s.input}
                      type="text"
                      placeholder="Nome ou WhatsApp de quem indicou"
                      value={form.indicadoPor}
                      onChange={e => setForm({ ...form, indicadoPor: e.target.value })}
                    />
                  </div>
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
                  {error && <div role="alert" aria-live="assertive" style={s.error}>{error}</div>}
                  <button style={s.btn} type="submit" disabled={loading}>
                    {loading ? 'Criando conta...' : 'Criar minha conta'}
                  </button>
                </form>
              </div>

              <div className="auth-col-google">
                <div className="auth-google-icon" style={s.googleCircle}><GoogleIcon size={22} /></div>
                <h2 className="auth-google-title" style={s.googleTitle}>Comece em segundos</h2>
                <button type="button" style={s.btnGoogle} onClick={handleGoogle} disabled={googleLoading}>
                  <GoogleIcon size={18} />
                  {googleLoading ? 'Redirecionando...' : 'Criar conta com Google'}
                </button>
                <p style={s.consentGoogle}>
                  Ao continuar, você concorda com os{' '}
                  <Link to="/termos" target="_blank" style={s.linkTermos}>Termos de Uso</Link>
                  {' '}e a{' '}
                  <Link to="/privacidade" target="_blank" style={s.linkTermos}>Política de Privacidade</Link>.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
