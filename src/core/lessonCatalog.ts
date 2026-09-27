export type LessonStep = { selector?: string; titleTarget?: string; title: string; text: string }
export type Lesson = { id: string; name: string; steps: LessonStep[] }

/** Targets are controls that exist in Workspace or the cabinet properties panel. */
export const LESSONS: readonly Lesson[] = [
  { id: 'size', name: 'Габариты', steps: [{ selector: '[data-tour="size"]', title: 'Задайте размеры', text: 'Введите высоту, ширину и глубину в миллиметрах.' }] },
  { id: 'sections', name: 'Секции модуля', steps: [{ selector: '[data-tour="sections"]', title: 'Настройте секции', text: 'Откройте конструкцию и измените секции корпуса.' }] },
  { id: 'scene', name: '3D-сцена', steps: [{ selector: '[data-tour="scene"]', title: 'Осмотрите модель', text: 'Поверните модель и выберите деталь в сцене.' }] },
  { id: 'views', name: 'Виды 3D', steps: [{ selector: '[data-tour="viewtabs"]', title: 'Смените вид', text: 'Выберите перспективу, план или вид со стороны стены.' }] },
  { id: 'parts', name: 'Деталировка', steps: [{ selector: '[data-tour="cutlist"]', title: 'Проверьте детали', text: 'Откройте список деталей и сравните готовый размер с резом.' }] },
  { id: 'materials', name: 'Материалы модуля', steps: [{ selector: '[data-tour="tabs"] button:nth-child(2)', title: 'Выберите материал', text: 'На вкладке «Материал» измените материал корпуса.' }] },
  { id: 'production', name: 'Настройки производства', steps: [{ selector: '[data-tour="tabs"] button:nth-child(4)', title: 'Откройте производство', text: 'Здесь находятся производственные настройки выбранного модуля.' }] },
  { id: 'drilling', name: 'Присадка', steps: [{ titleTarget: 'Материалы, раскрой, присадка, смета', title: 'Откройте присадку', text: 'В меню «Проект» выберите «Присадка» для выбранного модуля или детали.' }] },
  { id: 'nesting', name: 'Раскрой', steps: [{ selector: 'a[href="/cut"]', title: 'Откройте раскрой', text: 'На отдельной странице проверьте листы, порядок резов и экспорт.' }] },
  { id: 'quote', name: 'Коммерческое предложение', steps: [{ titleTarget: 'Материалы, раскрой, присадка, смета', title: 'Откройте смету', text: 'В меню «Проект» выберите «Смета и раскрой».' }] },
  { id: 'exports', name: 'Экспорт', steps: [{ selector: '[data-tour="export"]', title: 'Скачайте файлы', text: 'Здесь доступны файлы для цеха и клиента.' }] },
  { id: 'wizard', name: 'Мастер мебели', steps: [{ titleTarget: 'С чего начать корпус', title: 'Откройте мастер', text: 'В меню «Создать» откройте готовые шаблоны и выберите мастер.' }] },
]

export function nextAvailableLessonStep(
  steps: readonly LessonStep[], from: number, available: (step: LessonStep) => boolean,
): number | null {
  for (let i = from; i < steps.length; i += 1) if (available(steps[i]!)) return i
  return null
}

export function parseCompletedLessons(raw: string | null): string[] {
  if (raw === null) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (cause) {
    // Malformed local progress is recoverable; the next completed lesson rewrites it.
    if (cause instanceof SyntaxError) return []
    throw cause
  }
  if (!Array.isArray(parsed)) return []
  const known = new Set(LESSONS.map((lesson) => lesson.id))
  return [...new Set(parsed.filter((id): id is string => typeof id === 'string' && known.has(id)))]
}
