/** A direction choice has no manufacturing effect for material without grain. */
export function grainDirectionUi(hasGrain: boolean): { disabled: boolean; reason: string | null } {
  return hasGrain
    ? { disabled: false, reason: null }
    : { disabled: true, reason: 'У материала нет направления текстуры' }
}
