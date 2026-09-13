'use client'

/**
 * МОДУЛЬДЕР ТІЗІМІ — 3D-нің сол жақ жоғарғы бұрышында.
 *
 * Бірнеше корпусты жобада (генерацияланған ас үй — 13 модуль) «қазір қай
 * корпусты өңдеп отырмын» деген сұрақтың жауабы бір жерде тұруы керек.
 * Бұрын оны тек 3D-де басып таңдауға болатын, ал басқан сайын камера сол
 * корпусқа секіретін. Енді тізімнен таңдалады, камера орнында қалады.
 *
 * Бір корпус болса тізім көрсетілмейді — таңдайтын ештеңе жоқ.
 */

import { useEffect, useState } from 'react'
import { t as tr } from '@/lib/i18n'
import { cn } from '@/lib/cn'
import { useConfigurator } from '@/store/configurator'

export function ModuleList() {
  const cabinets = useConfigurator((s) => s.cabinets)
  const placements = useConfigurator((s) => s.placements)
  const activeId = useConfigurator((s) => s.activeId)
  const setActive = useConfigurator((s) => s.setActive)
  const [open, setOpen] = useState(true)
  // Тар экранда (телефон) тізім ӘДЕПКІДЕ жиылған: ашық 15 жол шағын 3D-ні
  // толық жауып, астындағы панельге дейін төгілетін (09-13).
  useEffect(() => {
    if (!window.matchMedia('(min-width: 1024px)').matches) setOpen(false)
  }, [])

  if (cabinets.length < 2) return null

  return (
    <div className="pointer-events-auto absolute left-3 top-3 z-10 flex max-h-[calc(100%-1.5rem)] w-52 flex-col rounded-lg border border-neutral-200 bg-white text-xs lg:w-60 dark:border-neutral-700 dark:bg-neutral-900">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full shrink-0 items-center justify-between border-b border-neutral-200 px-3 py-2 font-semibold dark:border-neutral-700"
        aria-expanded={open}
      >
        <span>{tr('Модули')} · {cabinets.length}</span>
        <span className="text-[10px] text-neutral-400">{open ? '▲' : '▼'}</span>
      </button>
      {open ? (
        // Биіктігі 3D-нің өз шегімен (max-h ата-анадан), ұзын тізім ішінде айналады.
        <ol className="min-h-0 flex-1 overflow-auto p-1">
          {cabinets.map((cabinet, i) => {
            const hanging = (placements.find((p) => p.cabinetId === cabinet.id)?.elevation ?? 0) > 0
            const active = cabinet.id === activeId
            return (
              <li key={cabinet.id}>
                <button
                  type="button"
                  data-module={cabinet.id}
                  onClick={() => setActive(cabinet.id)}
                  className={cn(
                    'flex w-full items-baseline gap-2 rounded-md px-2 py-1.5 text-left transition',
                    active
                      ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                      : 'hover:bg-neutral-100 dark:hover:bg-neutral-800',
                  )}
                >
                  <span className="w-5 shrink-0 tabular-nums opacity-60">{String(i + 1).padStart(2, '0')}</span>
                  <span className="min-w-0 flex-1 truncate">{cabinet.name}</span>
                  <span className="shrink-0 tabular-nums opacity-60">
                    {cabinet.width}{hanging ? ` · ${tr('навес')}` : ''}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      ) : null}
    </div>
  )
}
