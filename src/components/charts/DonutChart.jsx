/**
 * Gráfico de rosca (donut) em SVG puro.
 * @param {Array<{label: string, valor: number, cor: string}>} data
 * @param {number} size
 * @param {string} centerLabel - label central (ex: "R$ 1.250")
 * @param {string} centerSub - sub-label central
 * @param {function} formatValor - formata o valor na legenda (padrão: R$ x.xxx,xx)
 */
function defaultFormat(v) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function DonutChart({ data = [], size = 160, centerLabel = '', centerSub = '', formatValor = defaultFormat }) {
  const total = data.reduce((s, d) => s + d.valor, 0)
  if (total === 0) {
    return <div style={s.empty}>Sem dados ainda</div>
  }

  const stroke = 14
  const r = size / 2 - stroke
  const cx = size / 2
  const cy = size / 2
  const circ = 2 * Math.PI * r

  // Espaço livre DENTRO do anel (diâmetro do buraco) — o texto central tem que
  // caber aqui com folga pra nunca encostar no círculo. Reduz a fonte conforme
  // o valor cresce (ex.: "R$ 10.450,00"), respeitando esse limite.
  const buracoD = 2 * (r - stroke / 2)
  const maxTextW = buracoD - 14
  const len = String(centerLabel).length || 1
  let labelFont = 16
  while (labelFont > 10 && len * labelFont * 0.6 > maxTextW) labelFont -= 1

  let acumulado = 0

  return (
    <div style={s.wrap}>
      {/* Donut centralizado */}
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
          {data.map((d, i) => {
            const frac = d.valor / total
            const dasharray = `${frac * circ} ${circ - frac * circ}`
            const offset = -((acumulado / total) * circ)
            acumulado += d.valor
            return (
              <circle
                key={i}
                cx={cx} cy={cy} r={r}
                fill="none"
                stroke={d.cor}
                strokeWidth={stroke}
                strokeDasharray={dasharray}
                strokeDashoffset={offset}
                strokeLinecap="butt"
                transform={`rotate(-90 ${cx} ${cy})`}
                style={{ transition: 'stroke-dasharray 0.6s ease' }}
              />
            )
          })}
        </svg>
        <div style={s.center}>
          <div style={{ ...s.centerLabel, fontSize: labelFont, maxWidth: maxTextW }}>{centerLabel}</div>
          {centerSub && <div style={s.centerSub}>{centerSub}</div>}
        </div>
      </div>

      {/* Legenda abaixo — largura total, sem truncar */}
      <div style={s.legend}>
        {data.map((d, i) => {
          const pct = total ? Math.round((d.valor / total) * 100) : 0
          return (
            <div key={i} style={s.legendItem}>
              <span style={{ ...s.legendDot, background: d.cor }} />
              <span style={s.legendLabel}>{d.label}</span>
              <span style={s.legendValor}>{formatValor(d.valor)}</span>
              <span style={s.legendPct}>{pct}%</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const s = {
  wrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '4px 0' },
  center: { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  centerLabel: { fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: 'var(--text)', lineHeight: 1, whiteSpace: 'nowrap', textAlign: 'center' },
  centerSub: { fontSize: 10, color: 'var(--text3)', marginTop: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' },
  legend: { width: '100%', display: 'flex', flexDirection: 'column', gap: 6 },
  legendItem: { display: 'flex', alignItems: 'center', gap: 8 },
  legendDot: { width: 9, height: 9, borderRadius: 2, flexShrink: 0 },
  legendLabel: { flex: 1, fontSize: 12, color: 'var(--text2)', fontWeight: 500 },
  legendValor: { fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap' },
  legendPct: { fontSize: 11, color: 'var(--text3)', fontWeight: 600, minWidth: 30, textAlign: 'right' },
  empty: { textAlign: 'center', color: 'var(--text3)', fontSize: 13, padding: '24px 12px' },
}
