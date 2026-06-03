import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

const INATIVIDADE_MS = 30 * 60 * 1000 // 30 minutos

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // ── Auto-logout por inatividade ───────────────────
  useEffect(() => {
    if (!user) return
    let timer = setTimeout(() => supabase.auth.signOut(), INATIVIDADE_MS)
    const reset = () => {
      clearTimeout(timer)
      timer = setTimeout(() => supabase.auth.signOut(), INATIVIDADE_MS)
    }
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click', 'mousemove']
    events.forEach(ev => document.addEventListener(ev, reset, { passive: true }))
    return () => {
      clearTimeout(timer)
      events.forEach(ev => document.removeEventListener(ev, reset))
    }
  }, [user])

  const signIn = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  const signUp = async (email, password, name, indicadoPor) => {
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: name, indicado_por: (indicadoPor || '').trim() || null } },
    })
    return { data, error }
  }

  const signOut = async () => { await supabase.auth.signOut() }

  // Envia e-mail com link para redefinir a senha
  const resetPassword = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    })
    return { error }
  }

  // Define a nova senha (usado na tela /redefinir-senha, com sessão de recuperação)
  const updatePassword = async (password) => {
    const { error } = await supabase.auth.updateUser({ password })
    return { error }
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, resetPassword, updatePassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)