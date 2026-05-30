import React from 'react'

/**
 * Símbolo oficial da Lumen (a chama). Usa os SVGs oficiais em /logo.
 * @param {number} props.size - Largura em px (altura proporcional ~1.167×)
 * @param {'default'|'light'|'gold'|'reverso'} props.variant
 * @param {object} props.style
 */
export function LumenFlameIcon({ size = 26, variant = 'default', style = {} }) {
  const src = {
    default: '/logo/lumen-symbol.svg',
    reverso: '/logo/lumen-symbol.svg', // a chama colorida (núcleo dourado) se destaca no escuro
    gold: '/logo/lumen-symbol-gold.svg',
    light: '/logo/lumen-symbol-white.svg',
    white: '/logo/lumen-symbol-white.svg',
  }[variant] || '/logo/lumen-symbol.svg'

  return (
    <img
      src={src}
      alt="Lumen"
      width={size}
      style={{ display: 'inline-block', verticalAlign: 'middle', height: 'auto', ...style }}
    />
  )
}

/**
 * Logotipo oficial da Lumen (chama + "lumen.").
 * Renderizado como SVG inline para que as fontes web do documento sejam aplicadas.
 * @param {number} props.size - Tamanho de referência (altura ≈ size×1.25)
 * @param {'default'|'reverso'|'gold'} props.variant - reverso = fundo escuro
 * @param {'horizontal'|'stacked'|'monograma'} props.layout
 * @param {object} props.style
 */
export function LumenLogo({ size = 26, variant = 'default', layout = 'horizontal', style = {} }) {
  if (layout === 'monograma') {
    return <LumenFlameIcon size={size * 1.2} variant={variant === 'reverso' ? 'reverso' : variant} style={style} />
  }

  const altura = Math.round(size * 1.25)
  const textColor = variant === 'reverso' ? '#fbf6f8' : '#180712'
  const dotColor  = variant === 'reverso' ? '#e8c66a' : '#8b2655'
  // IDs únicos por variante para evitar conflito de gradiente quando há múltiplos logos na página
  const berryId = `lumen-berry-${variant}`
  const glowId  = `lumen-glow-${variant}`

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 540 160"
      role="img"
      aria-label="Lumen — iluminando a gestão, impulsionando o seu talento"
      style={{ display: 'inline-block', verticalAlign: 'middle', height: altura, width: 'auto', ...style }}
    >
      <defs>
        <linearGradient id={berryId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b34678" />
          <stop offset="1" stopColor="#8b2655" />
        </linearGradient>
        <radialGradient id={glowId} cx="0.5" cy="0.72" r="0.55">
          <stop offset="0" stopColor="#f5dd9b" />
          <stop offset="1" stopColor="#e8c66a" />
        </radialGradient>
      </defs>
      <g transform="translate(12,12)">
        <path d="M60 8 C 96 50, 108 84, 108 102 A 48 48 0 1 1 12 102 C 12 84, 24 50, 60 8 Z" fill={`url(#${berryId})`} />
        <path d="M60 60 C 82 86, 90 100, 90 112 A 30 30 0 1 1 30 112 C 30 100, 38 86, 60 60 Z" fill={`url(#${glowId})`} />
        <ellipse cx="60" cy="114" rx="9" ry="15" fill="#fffdf5" opacity="0.65" />
      </g>
      <text
        x="148"
        y="118"
        fill={textColor}
        fontFamily="'Bricolage Grotesque', 'Plus Jakarta Sans', system-ui, sans-serif"
        fontSize="90"
        fontWeight="800"
        letterSpacing="-4"
      >
        lumen<tspan fill={dotColor}>.</tspan>
      </text>
    </svg>
  )
}
