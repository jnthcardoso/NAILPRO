import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const { user, signIn, signUp } = useAuth()
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (user) return <Navigate to="/" replace />

  const handle = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
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
      <div style={s.card}>
        <div style={s.logo}>nail<span style={{ color: 'var(--pink)' }}>pro</span></div>
        <p style={s.sub}>Gestão simples para nail designers</p>
        <div style={s.tabs}>
          <button style={{ ...s.tab, ...(mode === 'login' ? s.tabActive : {}) }} onClick={() => setMode('login')}>Entrar</button>
          <button style={{ ...s.tab, ...(mode === 'signup' ? s.tabActive : {}) }} onClick={() => setMode('signup')}>Criar conta</button>
        </div>
        <form onSubmit={handle} style={s.form}>
          {mode === 'signup' && (
            <div style={s.field}>
              <label style={s.label}>Seu nome</label>
              <input style={s.input} type="text" placeholder="Ex: Camila Souza" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
          )}
          <div style={s.field}>
            <label style={s.label}>E-mail</label>
            <input style={s.input} type="email" placeholder="seu@email.com" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div style={s.field}>
            <label style={s.label}>Senha</label>
            <input style={s.input} type="password" placeholder="••••••••" required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          </div>
          {error && <div style={s.error}>{error}</div>}
          <button style={s.btn} type="submit" disabled={loading}>
            {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar minha conta'}
          </button>
        </form>
      </div>
    </div>
  )
}

const s = {
  root: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #FCE4EC 0%, #F8BBD0 50%, #FAFAFA 100%)', padding: 20 },
  card: { background: 'white', borderRadius: 20, padding: '32px 28px', width: '100%', maxWidth: 380, boxShadow: '0 8px 32px rgba(194,24,91,0.12)' },
  logo: { fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 600, textAlign: 'center', color: '#1A1A1A', letterSpacing: '-1px', marginBottom: 6 },
  sub: { textAlign: 'center', fontSize: 13, color: 'var(--text3)', marginBottom: 24 },
  tabs: { display: 'flex', background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', padding: 3, marginBottom: 24, gap: 3 },
  tab: { flex: 1, padding: '8px 0', borderRadius: 6, fontSize: 13, fontWeight: 500, background: 'transparent', color: 'var(--text3)', border: 'none', cursor: 'pointer' },
  tabActive: { background: 'white', color: 'var(--pink)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
  form: { display: 'flex', flexDirection: 'column', gap: 14 },
  field: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: { fontSize: 12, fontWeight: 500, color: 'var(--text2)' },
  input: { padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border2)', fontSize: 14, color: 'var(--text)', outline: 'none' },
  error: { background: 'var(--red-bg)', color: 'var(--red)', fontSize: 13, padding: '8px 12px', borderRadius: 'var(--radius-sm)' },
  btn: { background: 'var(--pink)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', padding: '12px 0', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 4 },
}