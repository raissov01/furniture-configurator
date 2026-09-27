import { describe, expect, it } from 'vitest'
import { cutExportAllowed, safeCutPlan } from '@/lib/safeCutPlan'
import type { NestingResult } from '@/src/core/nesting'

describe('F18 сақталған пропил UI қорғанысы', () => {
  it('шектен тыс мәнді бет құлатпай хабарлайды', () => {
    const nesting = {} as NestingResult
    expect(safeCutPlan(nesting, -1)).toEqual({ plan: null, error: 'Пропил: 0–20 мм рұқсат' })
    expect(safeCutPlan(nesting, 999).error).toMatch(/Пропил.*0.*20/)
    expect(safeCutPlan(nesting, 2.5).error).toMatch(/Пропил.*0.*20/)
  })

  it('өзектің қатесін де экранға қайтаруға мүмкіндік береді', () => {
    expect(safeCutPlan({} as NestingResult, 4).error).toBeTruthy()
    expect(safeCutPlan(null, 4)).toEqual({ plan: null, error: null })
  })

  it('редакцияланып жатқан жарамсыз мәтін экспортты жабады', () => {
    expect(cutExportAllowed(null, true)).toBe(false)
    expect(cutExportAllowed(null, false)).toBe(true)
    expect(cutExportAllowed('Пропил: 0–20 мм рұқсат', false)).toBe(false)
  })
})
