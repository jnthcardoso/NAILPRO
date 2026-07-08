import { useState } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { LumenLogo } from '../components/common/Brand'
import GoogleIcon from '../components/common/GoogleIcon'
import { validarEmail, validarSenha } from '../lib/formatters'
import { s } from './auth/authStyles'

export default function Login() {
  const { user, signIn, signInWithGoogle, resetPassword } = useAuth()

  // Compat: links antigos usavam /login?modo=cadastro — manda pra tela dedicada,
  // preservando outros parâmetros (ex: ?indicacao=...).
  const params = new URLSearchParams(window.location.search)
  if (params.get('modo') === 'cadastro') {
    params.delete('modo')
    const resto = params.toString()
    return <Navigate to={`/criar${resto ? `?${resto}` : ''}`} replace />
  }

  const [mode, setMode] = useState('login') // 'login' | 'recuperar'
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  if (user) return <Navigate to="/app" replace />

  const handleGoogle = async () => {
    setError(''); setMsg('')
    setGoogleLoading(true)
    const { error } = await signInWithGoogle()
    if (error) {
      setError('Não foi possível continuar com o Google. Tente novamente.')
      setGoogleLoading(false)
    }
  }

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

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    if (!validarEmail(form.email)) { setError('Digite um e-mail válido.'); return }
    if (!validarSenha(form.password)) { setError('A senha deve ter no mínimo 6 caracteres.'); return }
    setLoading(true)
    const { error } = await signIn(form.email, form.password)
    if (error) setError('E-mail ou senha incorretos.')
    setLoading(false)
  }

  return (
    <div style={s.root}>
      <div className="fade-in" style={s.card}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <LumenLogo size={32} variant="reverso" layout="horizontal" />
        </div>

        {mode === 'recuperar' ? (
          <>
            <h1 style={s.title}>Redefinir senha</h1>
            <p style={s.subtitle}>Enviamos um link para você criar uma nova senha</p>
            <form onSubmit={handleRecuperar} style={s.form}>
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
          </>
        ) : (
          <>
            <h1 style={s.title}>Entrar na Lumen</h1>
            <p style={s.subtitle}>Acesse sua conta para continuar</p>

            <button type="button" style={s.btnGoogle} onClick={handleGoogle} disabled={googleLoading}>
              <GoogleIcon size={18} />
              {googleLoading ? 'Redirecionando...' : 'Entrar com Google'}
            </button>

            <div style={s.divider}><span style={s.dividerLine} /><span style={s.dividerText}>ou</span><span style={s.dividerLine} /></div>

            <form onSubmit={handleLogin} style={s.form}>
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
                  autoComplete="current-password"
                  required
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                />
              </div>
              <button type="button" style={s.esqueciBtn} onClick={() => irPara('recuperar')}>
                Esqueci minha senha
              </button>
              {error && <div role="alert" aria-live="assertive" style={s.error}>{error}</div>}
              {msg && <div style={s.success}>{msg}</div>}
              <button style={s.btn} type="submit" disabled={loading}>
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
            </form>

            <p style={s.switchRow}>
              Não tem uma conta?{' '}
              <Link to="/criar" style={s.switchLink}>Criar conta</Link>
            </p>
          </>
        )}

        <div style={{ textAlign: 'center', marginTop: 14 }}>
          <Link to="/" style={s.voltar}>
            <ChevronLeft size={13} strokeWidth={2} />
            voltar ao site
          </Link>
        </div>

        <div style={s.footer}>
          <Link to="/termos" style={s.footerLink}>Termos</Link>
          <span style={{ opacity: 0.3 }}>·</span>
          <Link to="/privacidade" style={s.footerLink}>Privacidade</Link>
        </div>
      </div>
    </div>
  )
}
