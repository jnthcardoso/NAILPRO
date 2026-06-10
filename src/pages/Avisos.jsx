import { Bell, RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAvisos } from '../hooks/useAvisos'

export default function Avisos() {
  const navigate = useNavigate()
  const { alertas, loading, reload } = useAvisos()

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <div style={s.iconBox}><Bell size={20} color="white" /></div>
          <div>
            <h1 style={s.title}>Avisos</h1>
            <p style={s.sub}>Ações e alertas do seu salão</p>
          </div>
        </div>
        <button style={s.refreshBtn} onClick={reload} title="Atualizar">
          <RefreshCw size={15} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
        </button>
      </div>

      {loading ? (
        <div style={s.empty}>Carregando avisos...</div>
      ) : alertas.length === 0 ? (
        <div style={s.emptyBox}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✨</div>
          <div style={s.emptyTitulo}>Tudo em dia!</div>
          <div style={s.emptySub}>Nenhum aviso no momento. Seu salão está organizado.</div>
        </div>
      ) : (
        <div style={s.lista}>
          {alertas.map(a => {
            const Ico = a.icon
            return (
              <button key={a.id} style={{ ...s.card, ...(a.urgente ? s.cardUrgente : {}) }} onClick={() => navigate(a.to)}>
                <div style={{ ...s.cardIcon, background: a.bg, color: a.cor }}>
                  <Ico size={22} />
                </div>
                <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                  <div style={s.cardTitulo}>{a.titulo}</div>
                  <div style={s.cardSub}>{a.sub}</div>
                  {a.detalhe && <div style={s.cardDetalhe}>{a.detalhe}</div>}
                </div>
                <div style={{ ...s.cardSeta, color: a.cor }}>→</div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

const s = {
  page: { padding: '20px 20px 80px' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  iconBox: { width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, #8B2655 0%, var(--pink-bright) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px rgba(var(--pink-rgb),0.3)' },
  title: { fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 20, fontWeight: 800, color: 'var(--text)', margin: 0 },
  sub: { fontSize: 12, color: 'var(--text3)', margin: '2px 0 0' },
  refreshBtn: { width: 36, height: 36, borderRadius: '50%', background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text2)' },
  lista: { display: 'flex', flexDirection: 'column', gap: 10 },
  card: { display: 'flex', alignItems: 'center', gap: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px 18px', cursor: 'pointer', fontFamily: 'inherit', width: '100%', boxShadow: 'var(--shadow-xs)', transition: 'box-shadow 0.15s' },
  cardUrgente: { border: '1.5px solid #FCA5A5', background: '#FFF9F9' },
  cardIcon: { width: 52, height: 52, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardTitulo: { fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 3 },
  cardSub: { fontSize: 12, color: 'var(--text2)', lineHeight: 1.4 },
  cardDetalhe: { fontSize: 11, color: 'var(--text3)', marginTop: 4, fontStyle: 'italic' },
  cardSeta: { fontSize: 18, fontWeight: 700, flexShrink: 0, opacity: 0.7 },
  empty: { textAlign: 'center', color: 'var(--text3)', padding: 40, fontSize: 13 },
  emptyBox: { textAlign: 'center', padding: '60px 20px' },
  emptyTitulo: { fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 20, fontWeight: 800, color: 'var(--text)', marginBottom: 6 },
  emptySub: { fontSize: 14, color: 'var(--text3)', lineHeight: 1.5 },
}
