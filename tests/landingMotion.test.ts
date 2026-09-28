import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { demoRows, demoSheet } from '../lib/demo'
import { sheetCutPlan } from '../src/core/index'
import { freedAfter } from '../components/site/SheetFigure'
import LandingPage from '../components/site/LandingPage'

describe('лендинг қозғалысы', () => {
  it('әр деталь нақты рез тізбегінің бір резінен кейін босайды', () => {
    const { cuts } = sheetCutPlan(demoSheet.sheet)
    for (const part of demoSheet.sheet.parts) {
      const at = freedAfter(part, cuts)
      expect(at, part.label).toBeGreaterThan(0)
      expect(at).toBeLessThanOrEqual(cuts.length)
    }
    // Детальдар бір мезетте емес, тізбек бойымен босайды.
    expect(new Set(demoSheet.sheet.parts.map((p) => freedAfter(p, cuts))).size).toBeGreaterThan(2)
  })

  it('серверде соңғы күй шығады: рез өлшемдері, барлық рез саны, жасырын элемент жоқ', () => {
    const html = renderToStaticMarkup(createElement(LandingPage, { initialLang: 'ru', explicit: true }))
    const facade = demoRows.find((r) => r.cutLength !== r.finishedLength)!
    expect(html).toContain(`>${facade.cutLength}<`)
    expect(html).not.toContain('data-reveal')
    expect(html).not.toContain('cut-pending')
    expect(html).toMatch(new RegExp(`tabular-nums[^>]*>${sheetCutPlan(demoSheet.sheet).cuts.length}</span>`))
  })

  it('қозғалыс тек prefers-reduced-motion: no-preference ішінде', () => {
    const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')
    const block = css.slice(css.indexOf('@media (prefers-reduced-motion: no-preference) {\n  [data-reveal'))
    expect(block).toContain('[data-reveal="pending"] > * { opacity: 0; }')
    expect(css.indexOf('[data-reveal="pending"]')).toBeGreaterThan(css.indexOf('@media (prefers-reduced-motion: no-preference) {\n  [data-reveal'))
    const motion = readFileSync(new URL('../components/site/motion.tsx', import.meta.url), 'utf8')
    expect(motion).toContain("'(prefers-reduced-motion: no-preference)'")
  })
})
