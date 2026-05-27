/**
 * Skeleton loader genérico com animação pulse.
 * Substitui o "Carregando..." textual por placeholder visual.
 */
export default function Skeleton({ width, height = 16, borderRadius = 6, style = {} }) {
  return (
    <div
      style={{
        width: width || '100%',
        height,
        borderRadius,
        background: 'linear-gradient(90deg, var(--surface2) 25%, var(--border) 50%, var(--surface2) 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.4s ease-in-out infinite',
        ...style,
      }}
    />
  )
}

/**
 * Skeleton de página inteira (tela cheia centralizada).
 */
export function PageSkeleton({ message = 'Carregando' }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      gap: 12,
      background: 'var(--bg, #FBF6F8)',
    }}>
      <div style={{
        width: 48,
        height: 48,
        borderRadius: '50%',
        border: '3px solid var(--border)',
        borderTopColor: 'var(--pink)',
        animation: 'spin 0.8s linear infinite',
      }} />
      <div style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 500 }}>{message}</div>
    </div>
  )
}

/**
 * Skeleton tipo card (usado em listas: clientes, agendamentos).
 */
export function CardSkeleton({ count = 3 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: 14,
            marginBottom: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            boxShadow: 'var(--shadow-xs)',
          }}
        >
          <Skeleton width={42} height={42} borderRadius="50%" />
          <div style={{ flex: 1 }}>
            <Skeleton width="60%" height={14} />
            <div style={{ height: 6 }} />
            <Skeleton width="40%" height={11} />
          </div>
          <Skeleton width={50} height={20} borderRadius={10} />
        </div>
      ))}
    </>
  )
}
