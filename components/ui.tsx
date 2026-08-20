'use client'

/**
 * Ең қажетті UI примитивтері (shadcn стилінде, бірақ қолмен жазылған —
 * shadcn CLI интерактивті және желі керек ететіндіктен).
 */

import { cn } from '@/lib/cn'

export function Field({
  label, hint, children,
}: { label: string; hint?: string | undefined; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">{label}</span>
        {hint ? <span className="text-[10px] text-neutral-400 tabular-nums">{hint}</span> : null}
      </span>
      {children}
    </label>
  )
}

const control =
  'w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900 ' +
  'outline-none transition focus:border-neutral-900 disabled:opacity-40 ' +
  'dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-300'

export function NumberInput({
  value, onChange, min, max, step = 1, invalid,
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  invalid?: boolean
}) {
  return (
    <input
      type="number"
      className={cn(control, 'tabular-nums', invalid && 'border-red-500 dark:border-red-500')}
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => {
        const next = Number(e.target.value)
        if (Number.isFinite(next)) onChange(Math.round(next))
      }}
    />
  )
}

export function Select<T extends string>({
  value, onChange, options,
}: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <select className={control} value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

export function Slider({
  value, onChange, min = 0, max = 1, step = 0.01,
}: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }) {
  return (
    <input
      type="range"
      className="w-full accent-neutral-900 dark:accent-neutral-100"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  )
}

export function Button({
  children, onClick, disabled, active, title,
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  active?: boolean
  title?: string
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'rounded-md border px-2.5 py-1.5 text-xs font-medium transition',
        'disabled:cursor-not-allowed disabled:opacity-35',
        active
          ? 'border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900'
          : 'border-neutral-300 bg-white text-neutral-700 hover:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-neutral-500',
      )}
    >
      {children}
    </button>
  )
}

export function Toggle({
  checked, onChange, label,
}: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300">
      <input
        type="checkbox"
        className="accent-neutral-900 dark:accent-neutral-100"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  )
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
      {children}
    </h2>
  )
}
