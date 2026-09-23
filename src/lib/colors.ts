// Original, brand-neutral color palette (no Google trademark hex codes).
// Each entry is a named swatch used for calendars and per-event overrides.

export interface Swatch {
  name: string
  value: string
}

export const EVENT_COLORS: Swatch[] = [
  { name: 'Indigo', value: '#5b5bd6' },
  { name: 'Grape', value: '#8b5cf6' },
  { name: 'Rose', value: '#e5484d' },
  { name: 'Flamingo', value: '#e93d82' },
  { name: 'Tangerine', value: '#e8590c' },
  { name: 'Amber', value: '#d9a300' },
  { name: 'Basil', value: '#2f9e44' },
  { name: 'Sage', value: '#5c9e6b' },
  { name: 'Teal', value: '#0d9488' },
  { name: 'Peacock', value: '#0ea5b7' },
  { name: 'Sky', value: '#2f80ed' },
  { name: 'Graphite', value: '#5a6270' },
]

/**
 * Compute a readable text color (black/white) for a given background hex,
 * using relative luminance.
 */
export function contrastText(hex: string): string {
  const c = hex.replace('#', '')
  const r = parseInt(c.substring(0, 2), 16) / 255
  const g = parseInt(c.substring(2, 4), 16) / 255
  const b = parseInt(c.substring(4, 6), 16) / 255
  const lin = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
  return L > 0.55 ? '#1f1f29' : '#ffffff'
}

/** Translucent version of a hex color (for soft event backgrounds). */
export function withAlpha(hex: string, alpha: number): string {
  const c = hex.replace('#', '')
  const r = parseInt(c.substring(0, 2), 16)
  const g = parseInt(c.substring(2, 4), 16)
  const b = parseInt(c.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
