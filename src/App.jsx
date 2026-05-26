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
  const [checking, setChecking] = useState(true)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)

  useEffect(() => {
    if (!user) { setChecking(false); return }
    supabase.from('configuracoes')
      .select('onboarding_completo')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setNeedsOnboarding(!data?.onboarding_completo)
        setChecking(false)
      })
  }, [user])

  if (checking) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', color:'var(--pink)' }}>Carregando...</div>

  if (needsOnboarding && location.pathname !== '/bem-vindo') {
    return <Navigate to="/bem-vindo" replace />
  }
  if (!needsOnboarding && location.pathname === '/bem-vindo') {
    return <Navigate to="/" replace />
  }

  return children
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/agendar/:slug" element={<AgendaPublica />} />
          <Route path="/bem-vindo" element={<PrivateRoute><OnboardingGuard><BemVindo /></OnboardingGuard></PrivateRoute>} />
          <Route path="/" element={<PrivateRoute><OnboardingGuard><AppLayout /></OnboardingGuard></PrivateRoute>}>
            <Route index element={<Home />} />
            <Route path="metas" element={<Metas />} />
            <Route path="agenda" element={<Agenda />} />
            <Route path="clientes" element={<Clientes />} />
            <Route path="clientes/:id" element={<ClienteDetalhe />} />
            <Route path="financeiro" element={<Financeiro />} />
            <Route path="configuracoes" element={<Configuracoes />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
