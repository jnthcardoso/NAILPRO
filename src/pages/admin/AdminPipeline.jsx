import { differenceInDays, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const ESTAGIOS = [
  { id: 'novo',       label: 'Novo',       color: '#1E40AF', bg: '#DBEAFE', desc: 'Cadastrou recentemente' },
  { id: 'explorando', label: 'Explorando', color: '#92400E', bg: '#FEF3C7', desc: 'Trial com alguns clientes' },
  { id: 'engajada',   label: 'Engajada',   color: '#065F46', bg: '#D1FAE5', desc: '5+ clientes — forte candidata' },
  { id: 'converteu',  label: 'Converteu',  color: '#7C3AED', bg: '#EDE9FE', desc: 'Pagante ou cortesia' },
  { id: 'perdida',    label: 'Perdida',    color: '#6B7280', bg: '#F3F4F6', desc: 'Cancelou ou nunca usou' },
]

function classificar(u) {
  const dias = differenceInDays(new Date(), new Date(u.user_created_at))
  if (u.assinatura_status === 'active' || u.cortesia) return 'converteu'
  if (['canceled', 'expired'].includes(u.assinatura_status)) return 'perdida'
  // trialing ou pending
  if (u.total_clientes === 0 && dias <= 3) return 'novo'
  if (u.total_clientes === 0) return 'perdida'
  if (u.total_clientes >= 5) return 'engajada'
  return 'explorando'
}

function quando(ts) {
  if (!ts) return 'nunca'
  try { return formatDistanceToNow(new Date(ts), { addSuffix: true, locale: ptBR }) } catch { return '—' }
}

export default function AdminPipeline({ usuarios }) {
  const porEstagio = Object.fromEntries(ESTAGIOS.map(e => [e.id, []]))
  usuarios.filter(u => !u.cortesia || u.assinatura_status === 'active')
    .forEach(u => {
      const id = classificar(u)
      if (porEstagio[id]) porEstagio[id].push(u)
    })
  // cortesia vai em converteu
  usuarios.filter(u => u.cortesia).forEach(u => {
    if (!porEstagio['converteu'].find(x => x.user_id === u.user_id)) {
      porEstagio['converteu'].push(u)
    }
  })

  return (
    <div style={s.wrap}>
      <p style={s.info}>
        Onde cada conta está no caminho até virar cliente pagante. Critério: clientes cadastrados + status da assinatura.
      </p>
      <div style={s.board}>
        {ESTAGIOS.map(est => {
          const lista = porEstagio[est.id] || []
          return (
            <div key={est.id} style={s.col}>
              <div style={s.colHead}>
                <span style={{ ...s.colBadge, background: est.bg, color: est.color }}>
                  {est.label}
                </span>
                <span style={s.colCount}>{lista.length}</span>
              </div>
              <div style={s.colDesc}>{est.desc}</div>
              <div style={s.cards}>
                {lista.length === 0 && (
                  <div style={s.vazio}>Nenhuma</div>
                )}
                {lista.map(u => {
                  const nome = u.nome || u.email?.split('@')[0] || '?'
                  const dias = differenceInDays(new Date(), new Date(u.user_created_at))
                  return (
                    <div key={u.user_id} style={s.card}>
                      <div style={s.cardNome} title={u.email}>{nome}</div>
                      {u.nome_salao && <div style={s.cardSalao}>{u.nome_salao}</div>}
                      <div style={s.cardMeta}>
                        {u.total_clientes || 0} cli · {dias}d ·{' '}
                        {u.assinatura_plano?.toUpperCase() || '—'}
                      </div>
                      <div style={s.cardAcesso}>
                        ativo {quando(u.ultima_atividade)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const s = {
  wrap:      { display: 'flex', flexDirection: 'column', gap: 12 },
  info:      { fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 },
  board:     { display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 8, alignItems: 'flex-start' },
  col:       { minWidth: 180, flex: '0 0 180px', display: 'flex', flexDirection: 'column', gap: 6 },
  colHead:   { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  colBadge:  { fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999 },
  colCount:  { fontSize: 14, fontWeight: 800, color: 'var(--text)', fontFamily: "'JetBrains Mono', monospace" },
  colDesc:   { fontSize: 10, color: 'var(--text3)', lineHeight: 1.4 },
  cards:     { display: 'flex', flexDirection: 'column', gap: 6 },
  card:      { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', boxShadow: 'var(--shadow-xs)' },
  cardNome:  { fontSize: 12.5, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  cardSalao: { fontSize: 10.5, color: 'var(--text3)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  cardMeta:  { fontSize: 10, color: 'var(--text2)', marginTop: 5, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" },
  cardAcesso:{ fontSize: 10, color: 'var(--text3)', marginTop: 2 },
  vazio:     { fontSize: 11, color: 'var(--text3)', textAlign: 'center', padding: '12px 0', fontStyle: 'italic' },
}
