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
import { isRectVisible, tourStepsFor, visibleTourSteps, type TourStep } from '@/lib/tourSteps'

const DONE_KEY = 'furniture-configurator:tour-done'

/** Элемент қазір экранда көріне ме (жасырын header ішіндегісі — 0×0). */
function targetVisible(selector: string): boolean {
  const el = document.querySelector(selector)
  return el !== null && isRectVisible(el.getBoundingClientRect(), { width: window.innerWidth, height: window.innerHeight })
}

export function Tour({ paused = false, classic = false }: { paused?: boolean; classic?: boolean }) {
  const [step, setStep] = useState<number | null>(null)
  /*
   * Аялдамалар тур БАСТАЛҒАНДА режимге қарай таңдалып, көрінбейтіндері
   * алынып тасталады (09-26, P0-2): классикада жасырын header-дегі «Экспорт»
   * пен «Цех» 0×0 тесікпен бүкіл экранды қараңғылап тұратын.
   */
  const [steps, setSteps] = useState<TourStep[]>([])
  const [rect, setRect] = useState<DOMRect | null>(null)

  const close = useCallback((remember: boolean) => {
    setStep(null)
    if (!remember) return
    try {
      window.localStorage.setItem(DONE_KEY, '1')
    } catch { /* жады жоқ болса, келесі жолы қайта көрсетіледі — қате емес */ }
  }, [])

  /*
   * Бірінші кіргенде ғана. Тексеру эффектіде: серверде localStorage жоқ.
   *
   * ⚠ `paused` — ашық терезе жабылғанша күтеміз: бірінші кіргенде шаблон
   * галереясы өзі ашылады, ал көмекші онымен қатар шығып, бір экранда екі
   * «бастаушы» тұратын (09-13). Бір жүктелуде өзі бір-ақ рет басталады.
   */
  const autoStarted = useRef(false)
  const start = useCallback(() => {
    const available = visibleTourSteps(tourStepsFor(classic), targetVisible)
    setSteps(available)
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
    window.addEventListener('tour:start', start)
    return () => window.removeEventListener('tour:start', start)
  }, [start])

  // Esc — турдан кез келген сәтте шығу (экран ешқашан тұйықталмайды).
  useEffect(() => {
    if (step === null) return undefined
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close(true) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step, close])

  // Ағымдағы қадамның элементін тауып, оның орнын өлшейміз. Тур кезінде
  // элемент жоғалса/жасырылса — келесі көрінетін қадамға өтеміз.
  useEffect(() => {
    if (step === null) return undefined
    let index = step
    let el: Element | null = null
    while (index < steps.length && !el) {
      const selector = steps[index]!.selector
      el = targetVisible(selector) ? document.querySelector(selector) : null
      if (!el) index += 1
    }
    if (!el) {
      close(true)
      return undefined
    }
    if (index !== step) setStep(index)
    el.scrollIntoView({ block: 'nearest' })
    const measure = () => setRect(el!.getBoundingClientRect())
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [step, steps, close])

  if (step === null || !rect || !steps[step]) return null
  const current = steps[step]!
  const last = step === steps.length - 1

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
          {tr('Шаг')} {step + 1} / {steps.length}
        </p>
        <h3 className="mt-0.5 text-sm font-semibold">{tr(current.title)}</h3>
        <p className="mt-1 text-xs leading-snug text-neutral-600 dark:text-neutral-300">
          {tr(current.text)}
        </p>
        <div className="mt-3 flex items-center gap-2">
          <Button onClick={() => close(true)}>{tr('Пропустить')}</Button>
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
