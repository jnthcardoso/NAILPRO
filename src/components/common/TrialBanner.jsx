import { useNavigate } from 'react-router-dom'
import { Sparkles, AlertCircle, ChevronRight, Zap } from 'lucide-react'
import { useAssinatura } from '../../contexts/AssinaturaContext'

export default function TrialBanner() {
  const navigate = useNavigate()
  const { isTrialing, isActive, isExpired, trialAcabou, diasRestantesTrial, plano } = useAssinatura()

  // Não mostra se já assinou ativamente
  if (isActive) return null

  // Trial acabou: bloqueio crítico
  if (trialAcabou || isExpired) {
    return (
      <div style={{ ...s.banner, ...s.bannerCritico }} onClick={() => navigate('/planos')}>
        <div style={s.icon}><AlertCircle size={18} color="white" /></div>
        <div style={{ flex: 1 }}>
          <div style={s.title}>Seu período de teste acabou</div>
          <div style={s.sub}>Assine pra continuar acessando todas as funcionalidades</div>
        </div>
        <button style={s.cta}>
          Assinar <ChevronRight size={14} />
        </button>
      </div>
    )
  }

  // Trial ativo: amarelo se < 3 dias, info se > 3 dias
  if (isTrialing && diasRestantesTrial != null) {
    const critico = diasRestantesTrial <= 3

    return (
      <div
        style={{ ...s.banner, ...(critico ? s.bannerAlerta : s.bannerTrial) }}
        onClick={() => navigate('/planos')}
      >
        <div style={s.icon}>
          {critico ? <Zap size={18} color="white" /> : <Sparkles size={18} color="white" />}
        </div>
        <div style={{ flex: 1 }}>
          <div style={s.title}>
            {diasRestantesTrial === 0
              ? 'Último dia do seu teste grátis!'
              : `${diasRestantesTrial} ${diasRestantesTrial === 1 ? 'dia restante' : 'dias restantes'} no teste`}
          </div>
          <div style={s.sub}>
            {critico
              ? 'Garanta agora seu acesso e não perca seus dados'
              : `Teste tudo até ${diasRestantesTrial} dias. Assine quando quiser.`}
          </div>
        </div>
        <button style={s.cta}>
          Ver planos <ChevronRight size={14} />
        </button>
      </div>
    )
  }

  return null
}

const s = {
  banner: { display: 'flex', alignItems: 'center', gap: 12, borderRadius: 'var(--radius-sm)', padding: '12px 14px', marginBottom: 16, cursor: 'pointer', boxShadow: 'var(--shadow-sm)' },
  bannerTrial: { background: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)', border: '1px solid #93C5FD', color: '#1E3A8A' },
  bannerAlerta: { background: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)', border: '1px solid #FCD34D', color: '#78350F' },
  bannerCritico: { background: 'linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%)', border: '1px solid #FCA5A5', color: '#7F1D1D' },
  icon: { width: 34, height: 34, borderRadius: '50%', background: 'rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  title: { fontSize: 13, fontWeight: 700 },
  sub: { fontSize: 11, marginTop: 2, opacity: 0.85 },
  cta: { display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(0,0,0,0.85)', color: 'white', border: 'none', borderRadius: 'var(--radius-pill)', padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' },
}
