'use client'

import { useEffect, useRef, useState } from 'react'
import { formatMoneyDraft, parseMoneyDraft } from '@/lib/moneyDraft'
import { t as tr } from '@/lib/i18n'

export function MoneyInput({ value, label, onChange, onValidityChange }: {
  value: number | undefined
  label: string
  onChange: (tiyn: number) => void
  onValidityChange?: (valid: boolean) => void
}) {
  const [draft, setDraft] = useState(() => value === undefined ? '' : formatMoneyDraft(value))
  const [error, setError] = useState<string | undefined>()
  const emitted = useRef<number | null>(null)
  useEffect(() => {
    if (emitted.current === value) { emitted.current = null; return }
    setDraft(value === undefined ? '' : formatMoneyDraft(value))
    setError(undefined)
    onValidityChange?.(true)
  }, [value])
  return <span className="block min-w-0">
    <input type="text" inputMode="decimal" aria-label={label} aria-invalid={Boolean(error) || undefined}
      value={draft} onChange={(event) => {
        const raw = event.target.value
        setDraft(raw)
        const parsed = parseMoneyDraft(raw, label, {
          allowed: tr('допустимо'), decimals: tr('до 2 знаков после запятой'),
        })
        setError(parsed.error)
        onValidityChange?.(!parsed.error)
        if (parsed.value !== undefined && parsed.value !== value) {
          emitted.current = parsed.value
          onChange(parsed.value)
        }
      }}
      className={`w-full min-w-20 rounded-md border bg-white px-2 py-1.5 text-sm tabular-nums outline-none dark:bg-neutral-900 ${error ? 'border-red-500' : 'border-neutral-300 dark:border-neutral-700'}`} />
    {error && <span role="alert" className="mt-1 block text-[11px] text-red-700 dark:text-red-400">{error}</span>}
  </span>
}
