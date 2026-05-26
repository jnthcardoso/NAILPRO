import React from 'react'

/**
 * Gotinha de esmalte estilizada com brilhinho interno (proporção 1.16 : 1).
 * @param {object} props
 * @param {number} props.size - Largura da gotinha (a altura é calculada automaticamente como 1.16 * size)
 * @param {'default'|'light'|'gold'|'reverso'} props.variant - Variação de cor correspondente à marca
 * @param {object} props.style - Estilos inline opcionais
 */
export function NailDropIcon({ size = 26, variant = 'default', style = {} }) {
  // Cores exatas da identidade visual do NailPro
  const colors = {
    default: { fill: 'var(--pink, #8B2655)', hl: 'rgba(255, 255, 255, 0.45)' },
    light: { fill: 'rgba(255, 255, 255, 0.95)', hl: 'rgba(255, 255, 255, 0.35)' },
    gold: { fill: 'var(--pink, #8B2655)', hl: 'rgba(255, 255, 255, 0.45)' },
    reverso: { fill: 'var(--pink-mid, #D9A0B8)', hl: 'rgba(255, 255, 255, 0.5)' },
  }

  const activeColor = colors[variant] || colors.default
  const showShine = size >= 16 // "ABAIXO DE 16PX, O BRILHO INTERNO É SUPRIMIDO"

  // Geometria da gotinha calculada de forma harmônica na proporção 1.16 : 1 (Largura = 100, Altura = 116)
  // M 50,0 C 72,15 100,38 100,66 A 50,50 0 0,1 0,66 C 0,38 28,15 50,0 Z
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
      {/* Corpo da Gotinha */}
      <path
        d="M50 0C72 15 100 38 100 66A50 50 0 0 1 0 66C0 38 28 15 50 0Z"
        fill={activeColor.fill}
      />
      {/* Brilho interno (Elipse inclinada a -10°, no lado esquerdo. Suprimido em tamanho reduzido < 16px) */}
      {showShine && (
        <ellipse
          cx="38"
          cy="68"
          rx="9"
          ry="17"
          transform="rotate(-10 38 68)"
          fill={activeColor.hl}
        />
      )}
    </svg>
  )
}

/**
 * Logotipo completo ou monograma do NailPro com suporte a múltiplos layouts e esquemas de cores.
 * @param {object} props
 * @param {number} props.size - Tamanho de referência (ajusta o texto e o ícone proporcionalmente)
 * @param {'default'|'reverso'|'gold'} props.variant - Tema de cor (default = claro, reverso = escuro/dark, gold = gold edition)
 * @param {'horizontal'|'stacked'|'monograma'} props.layout - Formato de exibição do logo
 * @param {object} props.style - Estilos inline adicionais
 */
export function NailProLogo({ size = 26, variant = 'default', layout = 'horizontal', style = {} }) {
  // Caso de Monograma "np"
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
        np
      </div>
    )
  }

  const isDark = variant === 'reverso'
  const isGold = variant === 'gold'

  // Determinar cores do texto e ponto de encerramento da marca
  let textColor = 'var(--text, #180712)'
  let dotColor = 'var(--pink, #8B2655)'
  let dropVariant = 'default'

  if (isDark) {
    textColor = '#FFFFFF'
    dotColor = 'var(--gold, #E6C260)'
    dropVariant = 'reverso'
  } else if (isGold) {
    textColor = 'var(--pink-dark, #5E1839)'
    dotColor = 'var(--pink, #8B2655)'
    dropVariant = 'gold'
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

  // Layout vertical / empilhado (Gotinha em cima, "nailpro." embaixo)
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
        <NailDropIcon size={size * 1.3} variant={dropVariant} />
        <span style={textStyle}>
          nailpro<span style={{ color: dotColor }}>.</span>
        </span>
      </div>
    )
  }

  // Layout horizontal clássico (Gotinha do lado esquerdo do texto)
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: size * 0.3,
        ...style
      }}
    >
      <NailDropIcon size={size} variant={dropVariant} />
      <span style={textStyle}>
        nailpro<span style={{ color: dotColor }}>.</span>
      </span>
    </div>
  )
}
