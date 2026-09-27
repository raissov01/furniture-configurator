import type { LessonStep } from '@/src/core/lessonCatalog'
import { isRectVisible } from '@/lib/tourSteps'

export function findTourTarget(step: LessonStep, translate: (text: string) => string): Element | null {
  const element = step.selector ? document.querySelector(step.selector) :
    [...document.querySelectorAll('[title]')].find((candidate) =>
      candidate.getAttribute('title') === translate(step.titleTarget ?? '')) ?? null
  if (!element) return null
  if (element instanceof HTMLButtonElement && element.disabled) return null
  return isRectVisible(element.getBoundingClientRect(), { width: window.innerWidth, height: window.innerHeight }) ? element : null
}
