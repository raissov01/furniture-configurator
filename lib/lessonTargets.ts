import type { Lesson, LessonStep } from '@/src/core/lessonCatalog'

// The classic header is hidden, so lessons point at controls that remain exposed.
const CLASSIC_TARGETS: Readonly<Record<string, string>> = {
  size: '[data-testid="classic-tool-properties"]',
  sections: '[data-testid="classic-tool-properties"]',
  materials: '[data-testid="classic-tool-properties"]',
  production: '[data-testid="classic-tool-properties"]',
  drilling: '[data-testid="classic-tool-drill"]',
  nesting: '[data-testid="classic-tool-cut"]',
  quote: '[data-testid="classic-tool-quote"]',
  exports: '[data-testid="classic-menubar"] [data-menu-trigger]',
  wizard: '[data-testid="classic-menubar"] [data-menu-trigger]',
}

const CLASSIC_TEXTS: Readonly<Record<string, string>> = {
  size: 'Откройте «Свойства», чтобы изменить габариты корпуса.',
  sections: 'Откройте «Свойства» → «Конструкция», чтобы изменить секции.',
  materials: 'Откройте «Свойства» → «Материал», чтобы изменить материал корпуса.',
  production: 'Откройте «Свойства» → «Производство» для настроек корпуса.',
  drilling: 'Нажмите «Присадка» на панели инструментов.',
  nesting: 'Нажмите «Раскрой» на панели инструментов.',
  quote: 'Нажмите «Смета и раскрой» на панели инструментов.',
  exports: 'Откройте меню «Файл» → «Экспорт для цеха».',
  wizard: 'Откройте меню «Файл» → «Готовые шаблоны».',
}

const MOBILE_TARGETS: Readonly<Record<string, string>> = {
  size: '[data-tour-mobile="size"]',
  sections: '[data-tour-mobile="sections"]',
}

export function lessonStepFor(lesson: Lesson, classic: boolean, mobile: boolean): LessonStep | null {
  const step = lesson.steps[0]
  if (!step) return null
  const selector = mobile ? MOBILE_TARGETS[lesson.id] : classic ? CLASSIC_TARGETS[lesson.id] : undefined
  return selector ? { selector, title: step.title, text: classic && !mobile ? CLASSIC_TEXTS[lesson.id] ?? step.text : step.text } : step
}

export function lessonAvailability(
  lesson: Lesson, classic: boolean, mobile: boolean, isAvailable: (step: LessonStep) => boolean,
): boolean {
  const step = lessonStepFor(lesson, classic, mobile)
  return Boolean(step && isAvailable(step))
}
