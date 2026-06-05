import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import AppLayout from './components/layout/AppLayout'
// Páginas carregadas sob demanda (code-splitting): cada rota baixa só o seu
// código. Assim a landing/login/agenda pública não carregam as telas internas
// pesadas (Agenda, Financeiro, etc.) e abrem muito mais rápido no celular.
const Login = lazy(() => import('./pages/Login'))
const Home = lazy(() => import('./pages/Home'))
const Agenda = lazy(() => import('./pages/Agenda'))
const Clientes = lazy(() => import('./pages/Clientes'))
const ClienteDetalhe = lazy(() => import('./pages/ClienteDetalhe'))
const Financeiro = lazy(() => import('./pages/Financeiro'))
const Configuracoes = lazy(() => import('./pages/Configuracoes'))
const AgendaPublica = lazy(() => import('./pages/AgendaPublica'))
const Metas = lazy(() => import('./pages/Metas'))
const BemVindo = lazy(() => import('./pages/BemVindo'))
const Lembretes = lazy(() => import('./pages/Lembretes'))
const Planos = lazy(() => import('./pages/Planos'))
const Admin = lazy(() => import('./pages/Admin'))
const Equipe = lazy(() => import('./pages/Equipe'))
const Avisos = lazy(() => import('./pages/Avisos'))
const Termos = lazy(() => import('./pages/Termos'))
const Privacidade = lazy(() => import('./pages/Privacidade'))
const Landing = lazy(() => import('./pages/Landing'))
const RedefinirSenha = lazy(() => import('./pages/RedefinirSenha'))
const Indicacao = lazy(() => import('./pages/Indicacao'))
import { AssinaturaProvider, useAssinatura } from './contexts/AssinaturaContext'
import { SalaoProvider, useSalao } from './contexts/SalaoContext'
import { ToastProvider } from './contexts/ToastContext'
import { PageSkeleton } from './components/common/Skeleton'
import ErrorBoundary from './components/common/ErrorBoundary'
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
  const { papel, loading: salaoLoading } = useSalao()
  const location = useLocation()
  // status: 'checking' | 'needs' | 'done'
  const justCompleted = location.state?.onboardingJustCompleted === true
  const [status, setStatus] = useState(justCompleted ? 'done' : 'checking')

  useEffect(() => {
    // Se acabou de completar, pula o check do DB (evita race condition)
    if (justCompleted) { setStatus('done'); return }
    if (!user?.id || salaoLoading) return

    // Profissionais e recepcionistas não fazem onboarding — só a dona configura
    // o salão. Sem isso, membros convidados ficavam presos em loop no /bem-vindo
    // porque não têm permissão de INSERT em configuracoes.
    if (papel && papel !== 'dona') { setStatus('done'); return }

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
  }, [user?.id, salaoLoading, papel, justCompleted])

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
  return gerenciaTudo ? children : <Navigate to="/app/agenda" replace />
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
          <ErrorBoundary>
          <Suspense fallback={<PageSkeleton />}>
          <Routes>
            {/* Rotas públicas */}
            <Route path="/" element={<PublicRoute><Landing /></PublicRoute>} />
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/agendar/:slug" element={<AgendaPublica />} />
            <Route path="/redefinir-senha" element={<RedefinirSenha />} />
            <Route path="/indicacao" element={<Indicacao />} />
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
              <Route path="avisos" element={<Avisos />} />
            </Route>
          </Routes>
          </Suspense>
          </ErrorBoundary>
        </BrowserRouter>
        </ToastProvider>
      </AssinaturaProvider>
      </SalaoProvider>
    </AuthProvider>
  )
}
