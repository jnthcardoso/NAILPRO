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

  return (
    <span
      role="img"
      aria-label="Lumen"
      style={{ display: 'inline-flex', alignItems: 'center', gap: Math.round(size * 0.28), ...style }}
    >
      <LumenFlameIcon size={altura} variant={variant} />
      <span style={{
        fontFamily: "'Bricolage Grotesque', 'Plus Jakarta Sans', system-ui, sans-serif",
        fontSize: Math.round(altura * 0.82),
        fontWeight: 800,
        color: textColor,
        letterSpacing: '-0.04em',
        lineHeight: 1,
      }}>
        lumen<span style={{ color: dotColor }}>.</span>
      </span>
    </span>
  )
}
