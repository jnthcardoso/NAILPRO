/**
 * Gráfico de barras simples em SVG.
 * @param {Array<{label: string, valor: number}>} data
 * @param {string} cor - cor das barras (default: var(--pink))
 * @param {string} prefixo - prefixo dos valores (ex: "R$")
 * @param {number} height
 */
export default function BarChart({ data = [], cor = 'var(--pink)', prefixo = '', height = 160 }) {
  if (!data.length) {
    return <div style={s.empty}>Sem dados ainda</div>
  }

  const max = Math.max(...data.map(d => d.valor), 1)
  const barWidth = 100 / data.length

  function fmt(v) {
    if (v >= 1000) return `${prefixo}${(v / 1000).toFixed(1)}k`
    return `${prefixo}${v.toFixed(0)}`
  }

  return (
    <div style={s.wrap}>
      <div style={{ ...s.chart, height }}>
        {data.map((d, i) => {
          const h = (d.valor / max) * 100
          return (
            <div key={i} style={{ ...s.barCol, width: `${barWidth}%` }}>
              <div style={s.barValueTop}>{d.valor > 0 ? fmt(d.valor) : ''}</div>
              <div
                style={{
                  ...s.bar,
                  height: `${h}%`,
                  background: `linear-gradient(180deg, ${cor} 0%, ${cor}cc 100%)`,
                }}
                title={`${d.label}: ${prefixo}${d.valor.toFixed(2)}`}
              />
              <div style={s.barLabel}>{d.label}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Gráfico de barras horizontais — bom pra top serviços, top clientes, etc.
 */
export function HBarChart({ data = [], cor = 'var(--pink)', prefixo = '', formatValor }) {
  if (!data.length) {
    return <div style={s.empty}>Sem dados ainda</div>
  }
  const max = Math.max(...data.map(d => d.valor), 1)

  return (
    <div style={s.hwrap}>
      {data.map((d, i) => {
        const w = (d.valor / max) * 100
        return (
          <div key={i} style={s.hrow}>
            <div style={s.hlabel}>{d.label}</div>
            <div style={s.htrack}>
              <div
                style={{
                  ...s.hbar,
                  width: `${w}%`,
                  background: `linear-gradient(90deg, ${cor} 0%, ${cor}cc 100%)`,
                }}
              />
              <span style={s.hvalor}>
                {formatValor ? formatValor(d.valor) : `${prefixo}${d.valor.toFixed(0)}`}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

const s = {
  wrap: { padding: 4 },
  chart: { display: 'flex', alignItems: 'flex-end', gap: 6, padding: '8px 0 0', borderBottom: '1px solid var(--border)' },
  barCol: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', position: 'relative' },
  barValueTop: { fontSize: 9, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text2)', fontWeight: 600, marginBottom: 2, whiteSpace: 'nowrap' },
  bar: { width: '70%', borderRadius: '4px 4px 0 0', minHeight: 2, transition: 'height 0.4s ease', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  barLabel: { fontSize: 10, color: 'var(--text3)', fontWeight: 600, marginTop: 6, textAlign: 'center', textTransform: 'capitalize' },
  empty: { textAlign: 'center', color: 'var(--text3)', fontSize: 13, padding: '24px 12px' },
  /* HBar */
  hwrap: { display: 'flex', flexDirection: 'column', gap: 10, padding: 4 },
  hrow: { display: 'flex', flexDirection: 'column', gap: 4 },
  hlabel: { fontSize: 12, fontWeight: 600, color: 'var(--text2)' },
  htrack: { position: 'relative', height: 22, background: 'var(--surface2)', borderRadius: 6, overflow: 'hidden', display: 'flex', alignItems: 'center' },
  hbar: { height: '100%', borderRadius: 6, transition: 'width 0.5s ease' },
  hvalor: { position: 'absolute', right: 8, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: 'var(--text)', textShadow: '0 1px 2px rgba(255,255,255,0.8)' },
}
