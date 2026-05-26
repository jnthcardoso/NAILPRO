import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import AppLayout from './components/layout/AppLayout'
import Login from './pages/Login'
import Home from './pages/Home'
import Agenda from './pages/Agenda'
import Clientes from './pages/Clientes'
import ClienteDetalhe from './pages/ClienteDetalhe'
import Financeiro from './pages/Financeiro'
import Configuracoes from './pages/Configuracoes'
import AgendaPublica from './pages/AgendaPublica'
import Metas from './pages/Metas'
import BemVindo from './pages/BemVindo'
import Lembretes from './pages/Lembretes'
import Planos from './pages/Planos'
import Admin from './pages/Admin'
import { AssinaturaProvider } from './contexts/AssinaturaContext'
import { supabase } from './lib/supabase'
import './index.css'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', color:'var(--pink)' }}>Carregando...</div>
  return user ? children : <Navigate to="/login" replace />
}

function OnboardingGuard({ children }) {
  const { user } = useAuth()
  const location = useLocation()
  // status: 'checking' | 'needs' | 'done'
  const justCompleted = location.state?.onboardingJustCompleted === true
  const [status, setStatus] = useState(justCompleted ? 'done' : 'checking')

  useEffect(() => {
    // Se acabou de completar, pula o check do DB (evita race condition)
    if (justCompleted) {
      setStatus('done')
      return
    }
    if (!user?.id) return
    let cancelled = false

    supabase.from('configuracoes')
      .select('onboarding_completo')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.warn('OnboardingGuard:', error.message)
          setStatus('needs') // pessimista: em caso de erro, mostra onboarding
          return
        }
        // Só pula onboarding se EXPLICITAMENTE marcado como true
        setStatus(data?.onboarding_completo === true ? 'done' : 'needs')
      })

    return () => { cancelled = true }
  }, [user?.id, justCompleted])

  if (status === 'checking') {
    return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', color:'var(--pink)' }}>Carregando...</div>
  }

  if (status === 'needs' && location.pathname !== '/bem-vindo') {
    return <Navigate to="/bem-vindo" replace />
  }
  if (status === 'done' && location.pathname === '/bem-vindo') {
    return <Navigate to="/" replace />
  }

  return children
}

export default function App() {
  return (
    <AuthProvider>
      <AssinaturaProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/agendar/:slug" element={<AgendaPublica />} />
            <Route path="/bem-vindo" element={<PrivateRoute><OnboardingGuard><BemVindo /></OnboardingGuard></PrivateRoute>} />
            <Route path="/planos" element={<PrivateRoute><OnboardingGuard><Planos /></OnboardingGuard></PrivateRoute>} />
            <Route path="/" element={<PrivateRoute><OnboardingGuard><AppLayout /></OnboardingGuard></PrivateRoute>}>
              <Route index element={<Home />} />
              <Route path="metas" element={<Metas />} />
              <Route path="lembretes" element={<Lembretes />} />
              <Route path="agenda" element={<Agenda />} />
              <Route path="clientes" element={<Clientes />} />
              <Route path="clientes/:id" element={<ClienteDetalhe />} />
              <Route path="financeiro" element={<Financeiro />} />
              <Route path="configuracoes" element={<Configuracoes />} />
              <Route path="admin" element={<Admin />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AssinaturaProvider>
    </AuthProvider>
  )
}
