export type FillingGlyph = 'hanger' | 'trousers' | 'pantograph' | 'rotary' | 'rail' | 'unknown'

/** Stable shop hardware IDs choose only a visual symbol; no cut or drill sizes are changed. */
export function fillingGlyph(hardwareId: string): FillingGlyph {
  switch (hardwareId) {
    case 'filling-pullout-hanger': return 'hanger'
    case 'filling-trousers': return 'trousers'
    case 'filling-pantograph': return 'pantograph'
    case 'filling-rotary-shelf': return 'rotary'
    case 'filling-rail-profile': return 'rail'
    default: return 'unknown'
  }
}
