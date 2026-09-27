import { describe, expect, it } from 'vitest'
import { LESSONS, nextAvailableLessonStep, parseCompletedLessons } from '../src/core/lessonCatalog'

describe('interactive lesson catalog', () => {
  it('has twelve distinct lessons with real navigation targets', () => {
    expect(LESSONS).toHaveLength(12)
    expect(new Set(LESSONS.map((lesson) => lesson.id)).size).toBe(12)
    expect(LESSONS.every((lesson) => lesson.steps.length > 0 && lesson.steps.every((step) => step.selector || step.titleTarget))).toBe(true)
  })

  it('skips unavailable targets and persists only known completions', () => {
    const steps = [{ selector: '#missing', title: '', text: '' }, { selector: '#exists', title: '', text: '' }]
    expect(nextAvailableLessonStep(steps, 0, (step) => step.selector === '#exists')).toBe(1)
    expect(nextAvailableLessonStep(steps, 0, () => false)).toBeNull()
    expect(parseCompletedLessons(JSON.stringify(['scene', 'unknown']))).toEqual(['scene'])
  })

  it('recovers from corrupt saved progress so a lesson can be completed again', () => {
    for (const raw of ['0', '{}', 'null', '{broken']) {
      const completed = parseCompletedLessons(raw)
      expect(completed).toEqual([])
      expect(parseCompletedLessons(JSON.stringify([...completed, 'size']))).toEqual(['size'])
    }
  })
})
