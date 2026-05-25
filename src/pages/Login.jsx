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
        <div style={s.logoWrap}>
          <div style={s.logoIcon}>💅</div>
          <div style={s.logo}>nail<span style={{ color: 'var(--pink)' }}>pro</span></div>
        </div>
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
  root: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #FCE7F3 0%, #FDF2F8 40%, #FDE8F4 100%)', padding: 20 },
  card: { background: 'white', borderRadius: 22, padding: '36px 28px', width: '100%', maxWidth: 390, boxShadow: '0 8px 40px rgba(190,24,93,0.14), 0 2px 12px rgba(26,10,18,0.06)' },
  logoWrap: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 4 },
  logoIcon: { fontSize: 28 },
  logo: { fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 700, color: 'var(--text)', letterSpacing: '-1px' },
  sub: { textAlign: 'center', fontSize: 13, color: 'var(--text3)', marginBottom: 28 },
  tabs: { display: 'flex', background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', padding: 3, marginBottom: 24, gap: 3, border: '1px solid var(--border)' },
  tab: { flex: 1, padding: '9px 0', borderRadius: 7, fontSize: 13, fontWeight: 500, background: 'transparent', color: 'var(--text3)', border: 'none', cursor: 'pointer', transition: 'all 0.15s' },
  tabActive: { background: 'white', color: 'var(--pink)', boxShadow: 'var(--shadow-xs)', fontWeight: 700 },
  form: { display: 'flex', flexDirection: 'column', gap: 15 },
  field: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: { fontSize: 12, fontWeight: 600, color: 'var(--text2)' },
  input: { padding: '11px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border2)', fontSize: 14, color: 'var(--text)', background: 'var(--surface)' },
  error: { background: 'var(--red-bg)', color: 'var(--red)', fontSize: 13, padding: '9px 13px', borderRadius: 'var(--radius-sm)', border: '1px solid #FECACA', fontWeight: 500 },
  btn: { background: 'linear-gradient(135deg, var(--pink) 0%, #DB2777 100%)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', padding: '13px 0', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 4, boxShadow: 'var(--shadow-pink)', transition: 'opacity 0.15s' },
}
