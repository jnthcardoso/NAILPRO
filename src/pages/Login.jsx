import { useState } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { NailProLogo } from '../components/common/Brand'
import { validarEmail, validarSenha, validarNome } from '../lib/formatters'

export default function Login() {
  const { user, signIn, signUp } = useAuth()
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [aceitouTermos, setAceitouTermos] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (user) return <Navigate to="/" replace />

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
      const { error } = await signUp(form.email, form.password, form.name)
      if (error) setError(error.message)
    }
    setLoading(false)
  }

  return (
    <div style={s.root}>
      <div className="fade-in" style={s.card}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
          <NailProLogo size={36} variant="reverso" layout="horizontal" />
        </div>
        <p style={s.sub}>gestão simples para nail designers</p>

        <div style={s.tabs}>
          <button 
            style={{ ...s.tab, ...(mode === 'login' ? s.tabActive : {}) }} 
            onClick={() => setMode('login')}
          >
            Entrar
          </button>
          <button 
            style={{ ...s.tab, ...(mode === 'signup' ? s.tabActive : {}) }} 
            onClick={() => setMode('signup')}
          >
            Criar conta
          </button>
        </div>

        <form onSubmit={handle} style={s.form}>
          {mode === 'signup' && (
            <div style={s.field}>
              <label style={s.label}>Seu nome</label>
              <input 
                style={s.input} 
                type="text" 
                placeholder="Ex: Camila Souza" 
                required 
                value={form.name} 
                onChange={e => setForm({ ...form, name: e.target.value })} 
              />
            </div>
          )}
          <div style={s.field}>
            <label style={s.label}>E-mail</label>
            <input 
              style={s.input} 
              type="email" 
              placeholder="seu@email.com" 
              required 
              value={form.email} 
              onChange={e => setForm({ ...form, email: e.target.value })} 
            />
          </div>
          <div style={s.field}>
            <label style={s.label}>Senha</label>
            <input 
              style={s.input} 
              type="password" 
              placeholder="••••••••" 
              required 
              value={form.password} 
              onChange={e => setForm({ ...form, password: e.target.value })} 
            />
          </div>
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
          {error && <div style={s.error}>{error}</div>}
          <button
            style={s.btn}
            type="submit"
            disabled={loading}
          >
            {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar minha conta'}
          </button>
        </form>

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
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'radial-gradient(circle at top, #2C1422 0%, var(--brand-dark-bg, #170D14) 100%)',
    padding: 20,
  },
  card: {
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 24,
    padding: '40px 32px',
    width: '100%',
    maxWidth: 390,
    border: '1px solid rgba(255, 255, 255, 0.07)',
    boxShadow: '0 24px 64px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
  },
  sub: { 
    textAlign: 'center', 
    fontSize: 13, 
    color: 'rgba(255, 255, 255, 0.55)', 
    marginTop: 6,
    marginBottom: 28,
    fontFamily: "'Instrument Serif', serif",
    fontStyle: 'italic',
    letterSpacing: '0.5px'
  },
  tabs: { 
    display: 'flex', 
    background: 'rgba(255, 255, 255, 0.04)', 
    borderRadius: 'var(--radius-sm)', 
    padding: 3, 
    marginBottom: 24, 
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
  form: { display: 'flex', flexDirection: 'column', gap: 18 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { 
    fontSize: 12, 
    fontWeight: 600, 
    color: 'rgba(255, 255, 255, 0.85)',
    letterSpacing: '0.3px'
  },
  input: { 
    padding: '12px 16px', 
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
  btn: {
    background: 'var(--gold, #E6C260)',
    color: 'var(--brand-dark-bg, #170D14)',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    padding: '14px 0',
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
    marginTop: 8,
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
    marginTop: 24,
    fontSize: 12,
  },
  footerLink: {
    color: 'rgba(255,255,255,0.5)',
    textDecoration: 'none',
    fontWeight: 500,
  },
}
