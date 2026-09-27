import { cutPlan } from '@/src/core/cutPlan'
import type { CutPlan } from '@/src/core/cutPlan'
import type { NestingResult } from '@/src/core/nesting'

/** Сақталған ескі цех профилі жарамсыз болса, /cut беті қате экранына кетпейді. */
export function safeCutPlan(nesting: NestingResult | null, kerf: number): { plan: CutPlan | null; error: string | null } {
  if (!nesting) return { plan: null, error: null }
  if (!Number.isInteger(kerf) || kerf < 0 || kerf > 20) {
    return { plan: null, error: 'Пропил: 0–20 мм рұқсат' }
  }
  try {
    return { plan: cutPlan(nesting, { kerf }), error: null }
  } catch (cause) {
    return { plan: null, error: `Пропил / раскрой: ${cause instanceof Error ? cause.message : String(cause)}` }
  }
}
