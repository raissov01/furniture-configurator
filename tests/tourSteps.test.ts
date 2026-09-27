/**
 * Тур (P0-2): классикалық режимде 6 қадамның 4-еуі көрінбейтін элементке
 * байланған, экран бұғатталатын. Аялдамалар режимге бейімделеді, ал
 * көрінбейтін мақсат ӨТКІЗІЛЕДІ.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CLASSIC_TOUR_STEPS, OURS_TOUR_STEPS, isRectVisible, tourStepsFor, visibleTourSteps } from '../lib/tourSteps'

const viewport = { width: 1366, height: 768 }
const box = (left: number, top: number, width: number, height: number) => ({ left, top, width, height, right: left + width, bottom: top + height })

describe('tour steps', () => {
  it('uses classic stops in the classic workspace and never the hidden header', () => {
    expect(tourStepsFor(true)).toBe(CLASSIC_TOUR_STEPS)
    expect(tourStepsFor(false)).toBe(OURS_TOUR_STEPS)
    const classic = CLASSIC_TOUR_STEPS.map((step) => step.selector)
    expect(classic).toContain('[data-tour="menubar"]')
    expect(classic).toContain('[data-testid="classic-toolbar"]')
    for (const hidden of ['[data-tour="export"]', '[data-tour="shop"]', '[data-tour="size"]', '[data-tour="sections"]']) {
      expect(classic).not.toContain(hidden)
    }
  })

  it('keeps six ordered stops on a phone, starting at the visible size and sections controls', () => {
    const steps = tourStepsFor(false, true)
    expect(steps).toHaveLength(6)
    expect(steps.map((step) => step.selector).slice(0, 2)).toEqual([
      '[data-tour="mobile-size"]', '[data-tour="mobile-sections"]',
    ])
    expect(steps[2]?.selector).toBe('[data-tour="scene"]')
    expect(steps[3]?.selector).toBe('[data-tour="mobile-cutlist"]')
    const source = readFileSync(new URL('../components/Workspace.tsx', import.meta.url), 'utf8')
    for (const marker of ['mobile-size', 'mobile-sections', 'mobile-cutlist']) {
      expect(source).toContain(`tour="${marker}"`)
    }
  })

  it('classic selectors exist in the Workspace source', () => {
    const source = readFileSync(new URL('../components/Workspace.tsx', import.meta.url), 'utf8')
    for (const step of CLASSIC_TOUR_STEPS) {
      const [, attr, value] = step.selector.match(/^\[([\w-]+)="([^"]+)"\]$/) ?? []
      expect(source, step.selector).toContain(`${attr}="${value}"`)
    }
  })

  it('a rect is visible only when it has area and intersects the viewport', () => {
    expect(isRectVisible(box(10, 10, 100, 20), viewport)).toBe(true)
    expect(isRectVisible(box(0, 0, 0, 0), viewport)).toBe(false)
    expect(isRectVisible(box(10, 10, 0, 20), viewport)).toBe(false)
    expect(isRectVisible(box(10, 800, 100, 20), viewport)).toBe(false)
    expect(isRectVisible(box(-200, 10, 100, 20), viewport)).toBe(false)
    expect(isRectVisible(box(10, -40, 100, 20), viewport)).toBe(false)
    expect(isRectVisible(box(1400, 10, 100, 20), viewport)).toBe(false)
  })

  it('skips steps whose target is missing or hidden, keeping the order', () => {
    const visible = new Set(['[data-tour="scene"]', '[data-tour="menubar"]'])
    const steps = visibleTourSteps(CLASSIC_TOUR_STEPS, (selector) => visible.has(selector))
    expect(steps.map((step) => step.selector)).toEqual(['[data-tour="menubar"]', '[data-tour="scene"]'])
    expect(visibleTourSteps(CLASSIC_TOUR_STEPS, () => false)).toEqual([])
  })

  it('Tour closes on Escape and filters stops by visibility', () => {
    const source = readFileSync(new URL('../components/Tour.tsx', import.meta.url), 'utf8')
    expect(source).toContain('visibleTourSteps')
    expect(source).toMatch(/key === 'Escape'/)
  })
})
