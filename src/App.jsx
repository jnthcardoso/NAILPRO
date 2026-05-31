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
import Equipe from './pages/Equipe'
import Termos from './pages/Termos'
import Privacidade from './pages/Privacidade'
import Landing from './pages/Landing'
import { AssinaturaProvider, useAssinatura } from './contexts/AssinaturaContext'
import { SalaoProvider, useSalao } from './contexts/SalaoContext'
import { ToastProvider } from './contexts/ToastContext'
import { PageSkeleton } from './components/common/Skeleton'
import { supabase } from './lib/supabase'
import './index.css'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <PageSkeleton />
  return user ? children : <Navigate to="/login" replace />
}

// Rota pública: se já logado, manda direto pro app
function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <PageSkeleton />
  return user ? <Navigate to="/app" replace /> : children
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
    return <PageSkeleton />
  }

  if (status === 'needs' && location.pathname !== '/bem-vindo') {
    return <Navigate to="/bem-vindo" replace />
  }
  if (status === 'done' && location.pathname === '/bem-vindo') {
    return <Navigate to="/app" replace />
  }

  return children
}

// Bloqueia profissionais de páginas de gestão (clientes, financeiro do salão,
// metas, lembretes, configurações). Dona e recepcionista passam.
function RequireGerencia({ children }) {
  const { loading, gerenciaTudo } = useSalao()
  if (loading) return <PageSkeleton />
  return gerenciaTudo ? children : <Navigate to="/agenda" replace />
}

// Paywall: trial encerrado ou assinatura expirada → manda para /planos.
function PlanoGuard({ children }) {
  const { loading, precisaUpgrade } = useAssinatura()
  if (loading) return <PageSkeleton />
  if (precisaUpgrade) return <Navigate to="/planos" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <SalaoProvider>
      <AssinaturaProvider>
        <ToastProvider>
        <BrowserRouter>
          <Routes>
            {/* Rotas públicas */}
            <Route path="/" element={<PublicRoute><Landing /></PublicRoute>} />
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/agendar/:slug" element={<AgendaPublica />} />
            <Route path="/termos" element={<Termos />} />
            <Route path="/privacidade" element={<Privacidade />} />

            {/* Rotas do app (pós-login) */}
            <Route path="/bem-vindo" element={<PrivateRoute><OnboardingGuard><BemVindo /></OnboardingGuard></PrivateRoute>} />
            <Route path="/planos" element={<PrivateRoute><OnboardingGuard><Planos /></OnboardingGuard></PrivateRoute>} />
            <Route path="/app" element={<PrivateRoute><OnboardingGuard><PlanoGuard><AppLayout /></PlanoGuard></OnboardingGuard></PrivateRoute>}>
              <Route index element={<Home />} />
              <Route path="metas" element={<RequireGerencia><Metas /></RequireGerencia>} />
              <Route path="lembretes" element={<RequireGerencia><Lembretes /></RequireGerencia>} />
              <Route path="agenda" element={<Agenda />} />
              <Route path="clientes" element={<RequireGerencia><Clientes /></RequireGerencia>} />
              <Route path="clientes/:id" element={<RequireGerencia><ClienteDetalhe /></RequireGerencia>} />
              <Route path="financeiro" element={<Financeiro />} />
              <Route path="configuracoes" element={<RequireGerencia><Configuracoes /></RequireGerencia>} />
              <Route path="equipe" element={<Equipe />} />
              <Route path="admin" element={<Admin />} />
            </Route>
          </Routes>
        </BrowserRouter>
        </ToastProvider>
      </AssinaturaProvider>
      </SalaoProvider>
    </AuthProvider>
  )
}
