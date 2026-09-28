'use client'

import type { ChangeEvent, InputHTMLAttributes } from 'react'
import { t as tr } from '@/lib/i18n'

/** Ата-анасы label болуы тиіс. Нативті ағылшын «Choose File» мәтінін көрсетпейді. */
export function LocalizedFileChooser({ accept, capture, disabled, onChange, ariaLabel, selectedName, caption = 'Выбрать файл' }: {
  accept: string
  capture?: InputHTMLAttributes<HTMLInputElement>['capture']
  disabled?: boolean
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
  ariaLabel?: string
  selectedName?: string | null
  caption?: string
}) {
  return <span className="block min-w-0">
    <input type="file" accept={accept} capture={capture} disabled={disabled} onChange={onChange}
      aria-label={ariaLabel ?? tr(caption)} className="peer sr-only" />
    <span aria-hidden="true" className="inline-flex min-h-11 max-w-full items-center border border-neutral-400 bg-white px-3 py-2 text-sm text-neutral-900 peer-disabled:opacity-50 peer-focus-visible:outline peer-focus-visible:outline-1 peer-focus-visible:outline-neutral-900">
      {tr(caption)}
    </span>
    {selectedName ? <span className="ml-2 break-all text-sm text-neutral-700">{selectedName}</span> : null}
  </span>
}
