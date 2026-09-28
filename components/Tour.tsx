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
import { tourStepsFor, visibleTourSteps } from '@/lib/tourSteps'
import { lessonStepFor } from '@/lib/lessonTargets'
import { findTourTarget } from '@/lib/tourTarget'
import { tourCardPosition } from '@/lib/f32TourPosition'
import { tourZIndex } from '@/lib/modalStack'
import { useModalStack } from '@/lib/useModalLayer'

const DONE_KEY = 'furniture-configurator:tour-done'
export const LESSON_DONE_KEY = 'furniture-configurator:lessons-done'

export function Tour({ paused = false, classic = false }: { paused?: boolean; classic?: boolean }) {
  const modalStack = useModalStack()
  const blockedByModal = modalStack.some((id) => id !== 'properties')

  const [step, setStep] = useState<number | null>(null)
  const [lessonId, setLessonId] = useState<string | null>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [cardHeight, setCardHeight] = useState(220)
  const cardRef = useRef<HTMLDivElement>(null)
  const [tourSteps, setTourSteps] = useState<readonly LessonStep[]>([])
  const [lessonSteps, setLessonSteps] = useState<readonly LessonStep[]>([])
  const lesson = LESSONS.find((item) => item.id === lessonId)
  const activeSteps: readonly LessonStep[] = lesson ? lessonSteps : tourSteps

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
  const start = useCallback(() => {
    setLessonId(null)
    setRect(null)
    const available = visibleTourSteps(tourStepsFor(classic, window.innerWidth < 1024), (selector) =>
      findTourTarget({ selector, title: '', text: '' }, tr) !== null)
    setTourSteps(available)
    if (available.length === 0) close(true)
    else setStep(0)
  }, [classic, close])
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
      start()
    }, 1200)
    return () => clearTimeout(timer)
  }, [paused, start])

  // Басқа жерден қайта қосу: «?» терезесіндегі батырма осы оқиғаны жібереді.
  useEffect(() => {
    const onStart = () => start()
    const onLesson = (event: Event) => {
      const id = (event as CustomEvent<{ lessonId: string }>).detail?.lessonId
      const selectedLesson = LESSONS.find((item) => item.id === id)
      if (!selectedLesson) return
      const selectedStep = lessonStepFor(selectedLesson, classic, window.innerWidth < 1024)
      if (!selectedStep) return
      setLessonId(id)
      setLessonSteps([selectedStep])
      setRect(null)
      setStep(0)
    }
    window.addEventListener('tour:start', onStart)
    window.addEventListener('tour:lesson', onLesson)
    return () => { window.removeEventListener('tour:start', onStart); window.removeEventListener('tour:lesson', onLesson) }
  }, [start, classic])

  // Esc кез келген турды жабады, фон басқаруды ешқашан тұйықтамайды.
  useEffect(() => {
    if (step === null) return undefined
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step, close])

  // Ағымдағы қадамның элементін тауып, оның орнын өлшейміз.
  useEffect(() => {
    if (step === null) return undefined
    const index = nextAvailableLessonStep(activeSteps, step, (item) => findTourTarget(item, tr) !== null)
    if (index === null) {
      close(!lesson)
      return undefined
    }
    const el = findTourTarget(activeSteps[index]!, tr)!
    if (index !== step) setStep(index)
    el.scrollIntoView({ block: 'nearest' })
    const measure = () => setRect(el!.getBoundingClientRect())
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [step, close, lessonId, activeSteps, lesson])

  useEffect(() => {
    if (step === null || !cardRef.current) return undefined
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setCardHeight(entry.target.getBoundingClientRect().height)
    })
    observer.observe(cardRef.current)
    return () => observer.disconnect()
  }, [step])

  if (paused || blockedByModal || step === null || !rect || !activeSteps[step]) return null
  const current = activeSteps[step]!
  const last = step === activeSteps.length - 1

  // Карточка элементтің АСТЫНА қойылады, ал орын жетпесе — үстіне.
  const { top, left } = tourCardPosition(rect, window.innerWidth, window.innerHeight,
    cardHeight, Math.min(320, window.innerWidth - 24))

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
    <div className="pointer-events-none fixed inset-0" style={{ zIndex: tourZIndex(modalStack) }}>

      {/* Қараңғы қабат ТЕСІКПЕН: көрсетіліп тұрған элемент жарық қалады. */}
      <div
        className="pointer-events-none absolute rounded-lg ring-1 ring-amber-400 transition-all"
        style={{
          top: rect.top - 4,
          left: rect.left - 4,
          width: rect.width + 8,
          height: rect.height + 8,
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
        }}
      />
      <div
        ref={cardRef}
        className="pointer-events-auto absolute w-80 max-w-[calc(100vw-24px)] max-h-[calc(100dvh-24px)] overflow-y-auto rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900"
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
