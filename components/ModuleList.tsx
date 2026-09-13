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

import { useState } from 'react'
import { t as tr } from '@/lib/i18n'
import { cn } from '@/lib/cn'
import { useConfigurator } from '@/store/configurator'

export function ModuleList() {
  const cabinets = useConfigurator((s) => s.cabinets)
  const placements = useConfigurator((s) => s.placements)
  const activeId = useConfigurator((s) => s.activeId)
  const setActive = useConfigurator((s) => s.setActive)
  const [open, setOpen] = useState(true)

  if (cabinets.length < 2) return null

  return (
    <div className="pointer-events-auto absolute left-3 top-3 z-10 w-60 rounded-lg border border-neutral-200 bg-white text-xs dark:border-neutral-700 dark:bg-neutral-900">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between border-b border-neutral-200 px-3 py-2 font-semibold dark:border-neutral-700"
        aria-expanded={open}
      >
        <span>{tr('Модули')} · {cabinets.length}</span>
        <span className="text-[10px] text-neutral-400">{open ? '▲' : '▼'}</span>
      </button>
      {open ? (
        <ol className="max-h-[50vh] overflow-auto p-1">
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
