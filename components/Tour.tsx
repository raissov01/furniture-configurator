'use client'

/**
 * ОҚЫТУ КӨМЕКШІСІ — бірінші рет кіргенде.
 *
 * НЕГЕ КЕРЕК. Конфигуратордың панелінде оннан астам бөлім, жоғарыда жиырма
 * шақты батырма бар. Цехтың адамы оны бір күнде игереді, ал БІРІНШІ он минут
 * шешуші: сол уақытта «мұнда бәрі күрделі екен» деген ой пайда болса, ол
 * қайтып ашпайды.
 *
 * ҚАДАМДАР НАҚТЫ ЭЛЕМЕНТКЕ БАЙЛАНАДЫ (`selector`), сондықтан көмекші
 * «жалпы сөз» айтпайды: экранда дәл сол батырма жарқырап тұрады. Элемент
 * табылмаса, қадам ӨТКІЗІЛЕДІ — интерфейс өзгергенде көмекші сынбауы керек
 * (ал ол өзгереді).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { t as tr } from '@/lib/i18n'
import { Button } from '@/components/ui'
import { LESSONS, nextAvailableLessonStep, parseCompletedLessons } from '@/src/core/lessonCatalog'
import type { LessonStep } from '@/src/core/lessonCatalog'

const DONE_KEY = 'furniture-configurator:tour-done'
export const LESSON_DONE_KEY = 'furniture-configurator:lessons-done'

type Step = {
  /** Қай элементті көрсету. Табылмаса — қадам өткізіледі. */
  selector: string
  title: string
  text: string
}

function targetOf(step: LessonStep): Element | null {
  if (step.selector) return document.querySelector(step.selector)
  return [...document.querySelectorAll('[title]')].find((element) =>
    element.getAttribute('title') === tr(step.titleTarget ?? '')) ?? null
}

/**
 * Қадамдар — жұмыстың НАҚТЫ РЕТІМЕН: габарит → бөлімдер → 3D → деталировка
 * → экспорт. Бұл — цехтың бір тапсырысты өткізу жолы, әрі көмекші сол жолды
 * қайталайды.
 */
const STEPS: Step[] = [
  {
    selector: '[data-tour="size"]',
    title: 'Начните с габарита',
    text: 'Высота, ширина и глубина — всё остальное считается от них. Порядок в программе всегда H × W × D.',
  },
  {
    selector: '[data-tour="sections"]',
    title: 'Наполнение — в разделах слева',
    text: 'Полки, ящики, фасады, планки. Закрытый раздел показывает своё состояние справа, так что ничего не потеряется.',
  },
  {
    selector: '[data-tour="scene"]',
    title: 'Это не картинка, а те же детали',
    text: '3D и деталировка считаются из одной модели: если тут что-то не так, значит и в раскрое будет не так.',
  },
  {
    selector: '[data-tour="cutlist"]',
    title: 'Деталировка: готовый и рез',
    text: 'Клиенту показывают готовый размер, цеху — рез. Разница — толщина кромки, и она уже вычтена.',
  },
  {
    selector: '[data-tour="export"]',
    title: 'Экспорт для цеха',
    text: 'XLSX и CSV — на распил, DXF — на станок, PDF — на сборку. Присадка и карта раскроя лежат на странице «Раскрой».',
  },
  {
    selector: '[data-tour="shop"]',
    title: 'Профиль цеха — ваши правила',
    text: 'Материалы, кромки, цены, зазоры и присадка берутся отсюда. Пока цены пустые, коммерческое предложение не выпускается.',
  },
]

export function Tour({ paused = false }: { paused?: boolean }) {
  const [step, setStep] = useState<number | null>(null)
  const [lessonId, setLessonId] = useState<string | null>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const lesson = LESSONS.find((item) => item.id === lessonId)
  const activeSteps: readonly LessonStep[] = lesson?.steps ?? STEPS

  const close = useCallback((completed: boolean) => {
    setStep(null)
    try {
      if (lessonId) {
        if (completed) {
          const done = parseCompletedLessons(window.localStorage.getItem(LESSON_DONE_KEY))
          window.localStorage.setItem(LESSON_DONE_KEY, JSON.stringify([...new Set([...done, lessonId])]))
        }
      } else window.localStorage.setItem(DONE_KEY, '1')
    } catch (cause) { console.error('Lesson progress could not be saved', cause) }
  }, [lessonId])

  /*
   * Бірінші кіргенде ғана. Тексеру эффектіде: серверде localStorage жоқ.
   *
   * ⚠ `paused` — ашық терезе жабылғанша күтеміз: бірінші кіргенде шаблон
   * галереясы өзі ашылады, ал көмекші онымен қатар шығып, бір экранда екі
   * «бастаушы» тұратын (09-13). Бір жүктелуде өзі бір-ақ рет басталады.
   */
  const autoStarted = useRef(false)
  useEffect(() => {
    if (paused || autoStarted.current) return undefined
    let done = true
    try {
      done = window.localStorage.getItem(DONE_KEY) === '1'
    } catch { /* оқылмаса, көмекшіні МАЗАЛАМАУ үшін көрсетпейміз */ }
    if (done) return undefined
    // Кідіріс: бет пен 3D орнығып болсын, әйтпесе шеңбер қате жерде тұрады.
    const timer = setTimeout(() => {
      autoStarted.current = true
      setStep(0)
    }, 1200)
    return () => clearTimeout(timer)
  }, [paused])

  // Басқа жерден қайта қосу: «?» терезесіндегі батырма осы оқиғаны жібереді.
  useEffect(() => {
    const onStart = () => { setLessonId(null); setRect(null); setStep(0) }
    const onLesson = (event: Event) => {
      const id = (event as CustomEvent<{ lessonId: string }>).detail?.lessonId
      if (!LESSONS.some((item) => item.id === id)) return
      setLessonId(id)
      setRect(null)
      setStep(0)
    }
    window.addEventListener('tour:start', onStart)
    window.addEventListener('tour:lesson', onLesson)
    return () => { window.removeEventListener('tour:start', onStart); window.removeEventListener('tour:lesson', onLesson) }
  }, [])

  // Ағымдағы қадамның элементін тауып, оның орнын өлшейміз.
  useEffect(() => {
    if (step === null) return undefined
    const index = nextAvailableLessonStep(activeSteps, step, (item) => targetOf(item) !== null)
    if (index === null) {
      close(false)
      return undefined
    }
    const el = targetOf(activeSteps[index]!)!
    if (index !== step) setStep(index)
    el.scrollIntoView({ block: 'nearest' })
    const measure = () => setRect(el!.getBoundingClientRect())
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [step, close, lessonId])

  if (step === null || !rect) return null
  const current = activeSteps[step]!
  const last = step === activeSteps.length - 1

  // Карточка элементтің АСТЫНА қойылады, ал орын жетпесе — үстіне.
  const below = rect.bottom + 180 < window.innerHeight
  const top = below ? rect.bottom + 12 : Math.max(12, rect.top - 172)
  const left = Math.min(Math.max(12, rect.left), window.innerWidth - 340)

  return (
    /*
     * ⚠ ҚАБАТ БАСҚАРУДЫ БӨГЕМЕЙДІ (`pointer-events-none`).
     *
     * Бірінші нұсқада ол бүкіл бетті жауып тұрған да, жаңа қолданушының
     * КЛИКТЕРІ бағдарламаға жетпей қалған: адам «көмекші тұрып қалды» деп
     * ойлайды. Жанды сайттағы e2e дәл соны ұстады (09-04). Енді тек
     * карточканың өзі басылады, ал қалған бәрі бұрынғыдай жұмыс істейді —
     * көмекшіні оқи отырып, бірден істеп көруге болады.
     */
    <div className="pointer-events-none fixed inset-0 z-[60]">
      {/* Қараңғы қабат ТЕСІКПЕН: көрсетіліп тұрған элемент жарық қалады. */}
      <div
        className="pointer-events-none absolute rounded-lg ring-2 ring-amber-400 transition-all"
        style={{
          top: rect.top - 4,
          left: rect.left - 4,
          width: rect.width + 8,
          height: rect.height + 8,
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
        }}
      />
      <div
        className="pointer-events-auto absolute w-80 rounded-xl border border-neutral-200 bg-white p-3 shadow-2xl dark:border-neutral-700 dark:bg-neutral-900"
        style={{ top, left }}
      >
        <p className="text-[10px] uppercase tracking-wider text-neutral-400">
          {lesson ? `${tr(lesson.name)} · ` : null}{tr('Шаг')} {step + 1} / {activeSteps.length}
        </p>
        <h3 className="mt-0.5 text-sm font-semibold">{tr(current.title)}</h3>
        <p className="mt-1 text-xs leading-snug text-neutral-600 dark:text-neutral-300">
          {tr(current.text)}
        </p>
        <div className="mt-3 flex items-center gap-2">
          <Button onClick={() => close(false)}>{tr('Пропустить')}</Button>
          <div className="ml-auto flex gap-2">
            {step > 0 ? <Button onClick={() => setStep(step - 1)}>{tr('Назад')}</Button> : null}
            <Button active onClick={() => (last ? close(true) : setStep(step + 1))}>
              {last ? tr('Готово') : tr('Дальше')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** «?» терезесінен қайта қосу. */
export function startTour(): void {
  window.dispatchEvent(new Event('tour:start'))
}

export function startLesson(lessonId: string): void {
  window.dispatchEvent(new CustomEvent('tour:lesson', { detail: { lessonId } }))
}
