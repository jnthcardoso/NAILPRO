/**
 * Tokens de estilo compartilhados entre as páginas.
 *
 * São os objetos de estilo inline que apareciam identicos em varias paginas
 * (input, label, botoes). Centralizar aqui evita divergencia acidental.
 * Paginas com variacao pontual podem compor: `{ ...inputBase, padding: '9px 12px' }`.
 */

// Campo de texto padrão.
export const inputBase = {
  padding: '10px 13px',
  border: '1px solid var(--border2)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 14,
  background: 'var(--surface)',
  color: 'var(--text)',
  fontFamily: 'inherit',
  width: '100%',
  boxSizing: 'border-box',
  minWidth: 0,
}

// Rótulo de campo.
export const labelBase = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text2)',
}

// Botão de ação primária (rosa).
export const btnPrimaryBase = {
  background: 'var(--pink)',
  color: 'white',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  padding: '13px',
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
  marginTop: 4,
  boxShadow: 'var(--shadow-pink)',
  transition: 'background 0.15s',
}

// Botão secundário (cancelar / neutro).
export const btnSecondaryBase = {
  background: 'var(--surface2)',
  color: 'var(--text2)',
  border: '1px solid var(--border2)',
  borderRadius: 'var(--radius-sm)',
  padding: '12px',
  fontSize: 14,
  fontWeight: 500,
  cursor: 'pointer',
}
