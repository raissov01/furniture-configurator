'use client'

/**
 * Хоткейлер анықтамасы.
 *
 * Тізім ҚОЛМЕН жазылмайды — ол `lib/hotkeys.ts`-тегі нақты байланыстардан
 * шығады. Әйтпесе анықтама мен шындық бір күні ажырап кетеді де,
 * пайдаланушы жоқ пернені басып отырады.
 */

import { t as tr } from '@/lib/i18n'
import { Button } from '@/components/ui'
import { HOTKEYS } from '@/lib/hotkeys'
import { LESSON_DONE_KEY, startLesson, startTour } from '@/components/Tour'
import { useConfigurator } from '@/store/configurator'
import { LESSONS, parseCompletedLessons } from '@/src/core/lessonCatalog'
import { lessonAvailability } from '@/lib/lessonTargets'
import { findTourTarget } from '@/lib/tourTarget'
import { useEffect, useRef, useState } from 'react'
import { useModalLayer } from '@/lib/useModalLayer'

export function HelpPanel({ classic = false }: { classic?: boolean }) {
  const open = useConfigurator((s) => s.helpOpen)
  const setOpen = useConfigurator((s) => s.setHelpOpen)
  const { zIndex, isTop } = useModalLayer(open, 'help', () => setOpen(false))

  const [completed, setCompleted] = useState<string[]>([])
  const dialogRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialogRef.current?.focus()
    try { setCompleted(parseCompletedLessons(window.localStorage.getItem(LESSON_DONE_KEY))) }
    catch (cause) { console.error('Lesson progress could not be read', cause); setCompleted([]) }
    return () => { returnFocus?.focus() }
  }, [open, setOpen])

  if (!open) return null
  const mobile = typeof window !== 'undefined' && window.innerWidth < 1024

  return (
    <div
      style={{ zIndex }}
      className="fixed inset-0 flex items-start justify-center overflow-auto bg-black/40 p-4"
      onClick={() => { if (isTop) setOpen(false) }}

    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-dialog-title"
        tabIndex={-1}
        className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-2">
          <h2 id="help-dialog-title" className="text-sm font-semibold">{tr('Горячие клавиши')}</h2>
          <div className="ml-auto flex gap-2">
            {/* Оқытуды қайта қосу: адам оны бірінші рет өткізіп жіберуі мүмкін. */}
            <Button onClick={() => { setOpen(false); startTour() }}>{tr('Обучение')}</Button>
            <Button onClick={() => setOpen(false)}>{tr('Закрыть')}</Button>
          </div>
        </div>

        <section className="mb-4 border-b border-neutral-200 pb-3 dark:border-neutral-700">
          <h3 className="mb-2 text-xs font-semibold">{tr('Тематические уроки')}</h3>
          <div className="grid grid-cols-2 gap-2">
            {LESSONS.map((lesson) => {
              const available = lessonAvailability(lesson, classic, mobile, (step) => findTourTarget(step, tr) !== null)
              return (
              <button key={lesson.id} type="button" className="rounded border border-neutral-300 px-2 py-1.5 text-left text-xs hover:border-neutral-700 dark:border-neutral-700"
                disabled={!available}
                title={!available ? tr('Выберите корпус или откройте нужный раздел, чтобы начать урок.') : undefined}
                onClick={() => { setOpen(false); startLesson(lesson.id) }}>
                <span className="block font-medium">{tr(lesson.name)}</span>
                <span className="text-[11px] text-neutral-500">{!available ? tr('Выберите корпус или откройте нужный раздел, чтобы начать урок.') : completed.includes(lesson.id) ? tr('Пройдено · повторить') : tr('Начать урок')}</span>
              </button>
            )})}
          </div>
        </section>
        <dl className="space-y-1">
          {HOTKEYS.map((h) => (
            <div key={h.keys} className="flex items-center gap-3 text-xs">
              <dt className="w-28 shrink-0">
                <kbd className="rounded border border-neutral-300 bg-neutral-100 px-1.5 py-0.5 font-mono text-[11px] dark:border-neutral-700 dark:bg-neutral-800">
                  {h.keys}
                </kbd>
              </dt>
              <dd className="text-neutral-600 dark:text-neutral-400">{tr(h.description)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
