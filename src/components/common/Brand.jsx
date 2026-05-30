import React from 'react'

/**
 * Chama de luz com núcleo dourado — ícone da marca Lumen (proporção 1.16 : 1).
 * Referência ao Salmo 119:105 ("lâmpada para os meus pés é tua palavra").
 *
 * ⚠️ Interino: seguindo as regras de construção do manual (chama + núcleo dourado,
 * núcleo suprimido abaixo de 16px). Substituir pelo SVG oficial quando disponível.
 *
 * @param {number} props.size - Largura (a altura é 1.16 × size)
 * @param {'default'|'light'|'gold'|'reverso'} props.variant - Variação de cor da marca
 * @param {object} props.style - Estilos inline opcionais
 */
export function LumenFlameIcon({ size = 26, variant = 'default', style = {} }) {
  // Paleta Berry — corpo Berry, núcleo Gold
  const colors = {
    default: { fill: 'var(--pink, #8B2655)', core: 'var(--gold, #E8C66A)' },
    light: { fill: 'rgba(255, 255, 255, 0.95)', core: 'var(--gold, #E8C66A)' },
    gold: { fill: 'var(--pink, #8B2655)', core: 'var(--gold, #E8C66A)' },
    reverso: { fill: 'var(--pink-mid, #D9A0B8)', core: 'var(--gold, #E8C66A)' },
  }

  const c = colors[variant] || colors.default
  const showCore = size >= 16 // "ABAIXO DE 16PX, O NÚCLEO DOURADO É SUPRIMIDO"

  return (
    <svg
      width={size}
      height={Math.round(size * 1.16)}
      viewBox="0 0 100 116"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
        transition: 'transform 0.2s ease, filter 0.2s ease',
        ...style
      }}
    >
      {/* Corpo da chama (ponta para cima) */}
      <path
        d="M50 0C72 15 100 38 100 66A50 50 0 0 1 0 66C0 38 28 15 50 0Z"
        fill={c.fill}
      />
      {/* Núcleo dourado (chama interna; suprimido abaixo de 16px) */}
      {showCore && (
        <path
          d="M50 40C61 48 75 60 75 73A25 25 0 0 1 25 73C25 60 39 48 50 40Z"
          fill={c.core}
        />
      )}
    </svg>
  )
}

/**
 * Logotipo / monograma da Lumen com suporte a múltiplos layouts e esquemas de cor.
 * @param {number} props.size - Tamanho de referência
 * @param {'default'|'reverso'|'gold'} props.variant - Tema de cor
 * @param {'horizontal'|'stacked'|'monograma'} props.layout - Formato
 * @param {object} props.style - Estilos inline adicionais
 */
export function LumenLogo({ size = 26, variant = 'default', layout = 'horizontal', style = {} }) {
  // Monograma "lu"
  if (layout === 'monograma') {
    const circleColor = variant === 'reverso' ? 'rgba(255, 255, 255, 0.1)' : 'var(--pink, #8B2655)'
    const textColor = variant === 'reverso' ? 'var(--pink-light, #FAF6F6)' : '#FFFFFF'
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: size * 1.5,
          height: size * 1.5,
          borderRadius: '50%',
          backgroundColor: circleColor,
          fontFamily: "'Bricolage Grotesque', sans-serif",
          fontWeight: 800,
          fontSize: size * 0.72,
          color: textColor,
          userSelect: 'none',
          transition: 'transform 0.2s ease',
          ...style
        }}
      >
        lu
      </div>
    )
  }

  const isDark = variant === 'reverso'
  const isGold = variant === 'gold'

  let textColor = 'var(--text, #180712)'
  let dotColor = 'var(--pink, #8B2655)'
  let flameVariant = 'default'

  if (isDark) {
    textColor = '#FFFFFF'
    dotColor = 'var(--gold, #E8C66A)'
    flameVariant = 'reverso'
  } else if (isGold) {
    textColor = 'var(--pink-dark, #5E1839)'
    dotColor = 'var(--gold, #E8C66A)'
    flameVariant = 'gold'
  }

  const textStyle = {
    fontFamily: "'Bricolage Grotesque', sans-serif",
    fontWeight: 800,
    fontSize: size * 0.95,
    color: textColor,
    letterSpacing: '-0.04em',
    lineHeight: 1,
    display: 'inline-block',
    userSelect: 'none'
  }

  // Layout empilhado (chama em cima, "lumen." embaixo)
  if (layout === 'stacked') {
    return (
      <div
        style={{
          display: 'inline-flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: size * 0.25,
          textAlign: 'center',
          ...style
        }}
      >
        <LumenFlameIcon size={size * 1.3} variant={flameVariant} />
        <span style={textStyle}>
          lumen<span style={{ color: dotColor }}>.</span>
        </span>
      </div>
    )
  }

  // Layout horizontal (chama à esquerda do texto)
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: size * 0.3,
        ...style
      }}
    >
      <LumenFlameIcon size={size} variant={flameVariant} />
      <span style={textStyle}>
        lumen<span style={{ color: dotColor }}>.</span>
      </span>
    </div>
  )
}
