import type { ConstructionSettings } from '@/src/core/types'

/** The band threshold must not subtract fractional edge bands from whole-mm cuts. */
export function ruleInputPolicy(key: keyof ConstructionSettings): { min: number; label: string } {
  return { min: key === 'minBandSubtract' ? 1 : 0, label: key }
}
