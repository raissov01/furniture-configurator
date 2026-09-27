import type { MaterialPbr } from '@/src/core/types'

export type PbrDraft = { roughness: string; metalness: string; reflection: string; opacity: string;
  normalUrl: string; normalX: string; normalY: string; normalStrength: string }
export type PbrField = keyof PbrDraft
export type PbrErrors = Partial<Record<PbrField, string>>

export function visualNumber(raw: string, label: string, min: number, max: number, required = true, integer = false): { value?: number; error?: string } {
  if (!raw.trim() && !required) return {}
  const value = Number(raw)
  if (!raw.trim() || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    return { error: `${label}: ${min === 1 ? '> 0' : `${min}..${max}`}${integer ? ' мм, целое число' : ''}` }
  }
  return { value }
}

export function parsePbrDraft(draft: PbrDraft): { pbr: MaterialPbr | undefined; errors: PbrErrors } {
  const errors: PbrErrors = {}
  const bounded = (key: 'roughness' | 'metalness' | 'reflection' | 'opacity' | 'normalStrength', max: number, required = false) => {
    const result = visualNumber(draft[key], key, 0, max, required)
    if (result.error) errors[key] = result.error
    return result.value
  }
  const roughness = bounded('roughness', 1)
  const metalness = bounded('metalness', 1)
  const reflection = bounded('reflection', 2)
  const opacity = bounded('opacity', 1)
  let normal: MaterialPbr['normal']
  if (draft.normalUrl.trim()) {
    try {
      const url = new URL(draft.normalUrl.trim())
      if (!['http:', 'https:'].includes(url.protocol)) errors.normalUrl = 'URL: http(s)'
    } catch { errors.normalUrl = 'URL: http(s)' }
    const x = visualNumber(draft.normalX, 'normalX', 1, Number.MAX_SAFE_INTEGER, true, true)
    const y = visualNumber(draft.normalY, 'normalY', 1, Number.MAX_SAFE_INTEGER, true, true)
    if (x.error) errors.normalX = 'normalX: > 0 мм, целое число'
    if (y.error) errors.normalY = 'normalY: > 0 мм, целое число'
    const strength = draft.normalStrength.trim() ? bounded('normalStrength', 2) : 1
    if (!errors.normalUrl && x.value !== undefined && y.value !== undefined && strength !== undefined) {
      normal = { url: draft.normalUrl.trim(), sizeMm: { x: x.value, y: y.value }, strength }
    }
  }
  if (Object.keys(errors).length) return { pbr: undefined, errors }
  const pbr: MaterialPbr = { roughness, metalness, reflection, opacity, normal }
  return { pbr: Object.values(pbr).every((value) => value === undefined) ? undefined : pbr, errors }
}
