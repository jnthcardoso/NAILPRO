import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { LumenLogo } from '../components/common/Brand'
import { validarSenha } from '../lib/formatters'

export default function RedefinirSenha() {
  const { updatePassword } = useAuth()
  const navigate = useNavigate()
  const [senha, setSenha] = useState('')
  const [confirma, setConfirma] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sucesso, setSucesso] = useState(false)

  // Mensagem de aviso caso o link tenha expirado / sessão ausente
  const [semSessao, setSemSessao] = useState(false)
  useEffect(() => {
    // O supabase-js processa o token de recuperação do hash automaticamente.
    // Damos um tempo e checamos se há sessão de recuperação.
    const t = setTimeout(async () => {
      const { data } = await supabase.auth.getSession()
      if (!data?.session) setSemSessao(true)
    }, 1200)
    return () => clearTimeout(t)
  }, [])

  const handle = async (e) => {
    e.preventDefault()
    setError('')
    if (!validarSenha(senha)) { setError('A senha deve ter no mínimo 6 caracteres.'); return }
    if (senha !== confirma) { setError('As senhas não conferem.'); return }
    setLoading(true)
    const { error } = await updatePassword(senha)
    setLoading(false)
    if (error) { setError('Não foi possível redefinir. O link pode ter expirado — peça um novo.'); return }
    setSucesso(true)
    setTimeout(() => navigate('/app', { replace: true }), 1500)
  }

  return (
    <div style={s.root}>
      <div className="fade-in" style={s.card}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
          <LumenLogo size={32} variant="reverso" layout="horizontal" />
        </div>
        <p style={s.sub}>defina sua nova senha</p>

        {sucesso ? (
          <div style={s.okBox}>
            🎉 Senha redefinida! Entrando…
          </div>
        ) : (
          <form onSubmit={handle} style={s.form}>
            <div style={s.field}>
              <label htmlFor="nova-senha" style={s.label}>Nova senha</label>
              <input
                id="nova-senha"
                style={s.input}
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
                value={senha}
                onChange={e => setSenha(e.target.value)}
              />
            </div>
            <div style={s.field}>
              <label htmlFor="confirma-senha" style={s.label}>Confirmar senha</label>
              <input
                id="confirma-senha"
                style={s.input}
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
                value={confirma}
                onChange={e => setConfirma(e.target.value)}
              />
            </div>

            {error && <div role="alert" style={s.error}>{error}</div>}
            {semSessao && !error && (
              <div style={s.warn}>
                Abra esta página pelo link enviado ao seu e-mail. Se já passou muito tempo, volte ao login e peça um novo link.
              </div>
            )}

            <button style={s.btn} type="submit" disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar nova senha'}
            </button>
            <button type="button" style={s.voltar} onClick={() => navigate('/login')}>
              Voltar ao login
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

const s = {
  root: {
    minHeight: '100vh',
    height: '100%',
    overflowY: 'auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'radial-gradient(circle at top, #2C1422 0%, var(--brand-dark-bg, #170D14) 100%)',
    padding: 20,
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
    textAlign: 'center', fontSize: 13, color: 'rgba(255, 255, 255, 0.55)',
    marginTop: 4, marginBottom: 18, fontFamily: "'Instrument Serif', serif", fontStyle: 'italic',
  },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  field: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: { fontSize: 12, fontWeight: 600, color: 'rgba(255, 255, 255, 0.85)' },
  input: {
    padding: '11px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255, 255, 255, 0.1)',
    fontSize: 14, color: '#FFFFFF', background: 'rgba(255, 255, 255, 0.04)', outline: 'none',
  },
  error: {
    background: 'rgba(185, 28, 28, 0.15)', color: '#FF8A8A', fontSize: 13, padding: '10px 14px',
    borderRadius: 'var(--radius-sm)', border: '1px solid rgba(185, 28, 28, 0.3)', fontWeight: 500,
  },
  warn: {
    background: 'rgba(217, 119, 6, 0.15)', color: '#FCD34D', fontSize: 12.5, padding: '10px 14px',
    borderRadius: 'var(--radius-sm)', border: '1px solid rgba(217, 119, 6, 0.3)', lineHeight: 1.5,
  },
  okBox: {
    background: 'rgba(21, 128, 61, 0.18)', color: '#86EFAC', fontSize: 14, padding: '14px',
    borderRadius: 'var(--radius-sm)', border: '1px solid rgba(21,128,61,0.35)', textAlign: 'center', fontWeight: 600,
  },
  btn: {
    background: 'var(--gold, #E6C260)', color: 'var(--brand-dark-bg, #170D14)', border: 'none',
    borderRadius: 'var(--radius-sm)', padding: '13px 0', fontSize: 14, fontWeight: 800, cursor: 'pointer',
    marginTop: 4, boxShadow: 'var(--shadow-gold)', fontFamily: "'Bricolage Grotesque', sans-serif",
  },
  voltar: {
    background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: 13,
    cursor: 'pointer', fontFamily: 'inherit', marginTop: 2,
  },
}
