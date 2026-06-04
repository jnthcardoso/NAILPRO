// Estado de vazio padronizado: título, subtítulo e (opcional) um CTA.
// Usado quando uma tela não tem dados ainda, para guiar o próximo passo.
export default function EmptyState({ icon, titulo, sub, cta, onCta }) {
  return (
    <div style={s.wrap}>
      {icon && <div style={s.icon}>{icon}</div>}
      <div style={s.titulo}>{titulo}</div>
      {sub && <div style={s.sub}>{sub}</div>}
      {cta && onCta && (
        <button style={s.btn} onClick={onCta}>{cta}</button>
      )}
    </div>
  )
}

const s = {
  wrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '44px 20px' },
  icon: { width: 52, height: 52, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--pink-light)', color: 'var(--pink)', marginBottom: 14 },
  titulo: { fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4 },
  sub: { fontSize: 13, color: 'var(--text3)', marginBottom: 18, maxWidth: 320, lineHeight: 1.5 },
  btn: { display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--pink)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', padding: '11px 22px', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: 'var(--shadow-pink)', fontFamily: 'inherit' },
}
