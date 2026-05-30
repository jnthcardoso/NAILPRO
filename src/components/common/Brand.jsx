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
 * @param {number} props.size - Tamanho de referência (altura ≈ size×1.25)
 * @param {'default'|'reverso'|'gold'} props.variant - reverso = fundo escuro
 * @param {'horizontal'|'stacked'|'monograma'} props.layout
 * @param {object} props.style
 */
export function LumenLogo({ size = 26, variant = 'default', layout = 'horizontal', style = {} }) {
  // Monograma → usa só o símbolo
  if (layout === 'monograma') {
    return <LumenFlameIcon size={size * 1.2} variant={variant === 'reverso' ? 'reverso' : variant} style={style} />
  }

  const src = variant === 'reverso'
    ? '/logo/lumen-logo-horizontal-reverse.svg'
    : '/logo/lumen-logo-horizontal.svg'

  // Layout "stacked": símbolo em cima do logo não tem asset próprio — usamos o horizontal.
  const altura = Math.round(size * 1.25)

  return (
    <img
      src={src}
      alt="Lumen — iluminando a gestão, impulsionando o seu talento"
      style={{ display: 'inline-block', verticalAlign: 'middle', height: altura, width: 'auto', ...style }}
    />
  )
}
