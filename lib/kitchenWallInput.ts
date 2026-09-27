// UI capacity guard: prevents a pasted multi-kilometre value from generating
// thousands of scene nodes. This is an editor limit, not a manufacturing rule.
export const KITCHEN_WALL_UI_MAX = 20_000

export function parseKitchenWalls(rawA: string, rawB: string, corner: boolean) {
  const parse = (raw: string, label: string) => {
    const error = label === 'Стена A'
      ? 'Стена A: целые мм, 600–20 000 мм'
      : 'Стена B: целые мм, 600–20 000 мм'
    if (!/^\d+$/.test(raw.trim())) return { value: undefined, error }
    const value = Number(raw.trim())
    if (!Number.isSafeInteger(value) || value < 600 || value > KITCHEN_WALL_UI_MAX) {
      return { value: undefined, error }
    }
    return { value, error: null }
  }
  const a = parse(rawA, 'Стена A')
  const b = corner ? parse(rawB, 'Стена B') : { value: undefined, error: null }
  return { lengthA: a.value, lengthB: b.value, errorA: a.error, errorB: b.error,
    valid: a.error === null && b.error === null }
}
