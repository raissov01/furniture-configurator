import { describe, expect, it } from 'vitest'
import { LESSONS } from '../src/core/lessonCatalog'
import { lessonStepFor, lessonAvailability } from '../lib/lessonTargets'

describe('lesson targets', () => {
  it('routes every classic lesson to an exposed control', () => {
    const hidden = ['[data-tour="size"]', '[data-tour="sections"]', '[data-tour="tabs"] button:nth-child(2)', '[data-tour="tabs"] button:nth-child(4)', '[data-tour="export"]']
    for (const lesson of LESSONS) {
      const step = lessonStepFor(lesson, true, false)
      expect(step?.selector, lesson.id).toBeTruthy()
      expect(hidden, lesson.id).not.toContain(step?.selector)
      expect(step?.titleTarget, lesson.id).toBeUndefined()
    }
    expect(lessonStepFor(LESSONS.find((item) => item.id === 'exports')!, true, false)?.selector).toBe('[data-testid="classic-menubar"] [data-menu-trigger]')
  })

  it('uses two distinct visible mobile controls for dimensions and sections', () => {
    expect(lessonStepFor(LESSONS[0]!, false, true)?.selector).toBe('[data-tour="mobile-size"]')
    expect(lessonStepFor(LESSONS[1]!, false, true)?.selector).toBe('[data-tour="mobile-sections"]')
  })

  it('makes unavailable lessons explicit', () => {
    const lesson = LESSONS[0]!
    expect(lessonAvailability(lesson, true, false, () => false)).toBe(false)
    expect(lessonAvailability(lesson, true, false, (step) => step.selector === '[data-testid="classic-tool-properties"]')).toBe(true)
  })

  it('routes the quote lesson to the dedicated toolbar control', () => {
    const quote = LESSONS.find((lesson) => lesson.id === 'quote')!
    expect(lessonStepFor(quote, true, false)?.selector).toBe('[data-testid="classic-tool-quote"]')
  })
})
