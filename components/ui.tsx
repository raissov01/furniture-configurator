'use client'

/**
 * Ең қажетті UI примитивтері (shadcn стилінде, бірақ қолмен жазылған —
 * shadcn CLI интерактивті және желі керек ететіндіктен).
 */

import * as React from 'react'
import { cn } from '@/lib/cn'
import { t as tr } from '@/lib/i18n'

/**
 * ТЫҒЫЗ режим — оң жақтағы қасиеттер панелі үшін (qdesign сияқты: өрістер
 * кішірек, көп нәрсе бір экранға сыяды). Терезелердегі формалар әдепкі
 * өлшемде қалады, сондықтан глобал класс емес, контекст.
 */
const DenseCtx = React.createContext(false)

export function Dense({ children }: { children: React.ReactNode }) {
  return <DenseCtx.Provider value>{children}</DenseCtx.Provider>
}

export function Field({
  label, hint, children,
}: { label: string; hint?: string | undefined; children: React.ReactNode }) {
  const dense = React.useContext(DenseCtx)
  return (
    <label className="block">
      <span className={cn('flex items-baseline justify-between gap-2', dense ? 'mb-0.5' : 'mb-1')}>
        <span className={cn('font-medium text-neutral-700 dark:text-neutral-300', dense ? 'text-[11px]' : 'text-xs')}>{label}</span>
        {hint ? <span className="text-[10px] text-neutral-400 tabular-nums">{hint}</span> : null}
      </span>
      {children}
    </label>
  )
}

const controlBase =
  'w-full rounded-md border border-neutral-300 bg-white text-neutral-900 ' +
  'outline-none transition focus:border-neutral-900 disabled:opacity-40 ' +
  'dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-300'
const control = `${controlBase} px-2 py-1.5 text-sm`
const controlDense = `${controlBase} px-1.5 py-1 text-xs`
const useControl = () => (React.useContext(DenseCtx) ? controlDense : control)

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
  const dense = React.useContext(DenseCtx)
  const cls = useControl()
  const input = (
    <input
      type="number"
      className={cn(cls, 'tabular-nums', invalid && 'border-red-500 dark:border-red-500', dense && 'order-2 min-w-0 rounded-none border-x-0 px-0.5 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none')}
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
  if (!dense) return input
  /*
   * ‹ › БАТЫРМАЛАРЫ (qdesign сияқты, тығыз панельде): өлшемді бір басумен
   * қадамға өзгерту. ⚠ DOM-да input БІРІНШІ: <label>-дің «басқаратын
   * элементі» — оның ішіндегі БІРІНШІ labelable элемент; батырма алда тұрса,
   * жазуды басқан адам «−»-ті басып қояр еді. Солға «−» тек CSS `order`-мен.
   */
  const bump = (dir: 1 | -1) => {
    let next = value + dir * step
    if (min !== undefined) next = Math.max(min, next)
    if (max !== undefined) next = Math.min(max, next)
    onChange(Math.round(next))
  }
  const stepper = 'order-1 w-5 shrink-0 border border-neutral-300 bg-white text-xs text-neutral-500 hover:text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:text-neutral-100'
  return (
    <span className="flex items-stretch">
      {input}
      <button type="button" tabIndex={-1} aria-label={tr('Уменьшить')} onClick={() => bump(-1)} className={cn(stepper, 'rounded-l-md')}>‹</button>
      <button type="button" tabIndex={-1} aria-label={tr('Увеличить')} onClick={() => bump(1)} className={cn(stepper, 'order-3 rounded-r-md')}>›</button>
    </span>
  )
}

export function Select<T extends string>({
  value, onChange, options,
}: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  const cls = useControl()
  return (
    <select className={cls} value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

// ── Ашылмалы мәзір (тақтаны топтап, «каша»-ны азайту үшін) ─────────────────

const MenuCtx = React.createContext<() => void>(() => {})

/**
 * Түйме басылғанда астынан тізім ашылатын мәзір. Сыртқа басқанда/Esc-те
 * жабылады, элемент таңдалғанда да жабылады.
 */
export function Menu({
  label, title, active, children, align = 'left',
}: {
  label: React.ReactNode
  title?: string
  active?: boolean
  children: React.ReactNode
  align?: 'left' | 'right'
}) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [open])
  return (
    <div ref={ref} className="relative">
      <Button active={active || open} {...(title ? { title } : {})} onClick={() => setOpen((v) => !v)}>
        {label} <span className="text-[9px] opacity-60">▾</span>
      </Button>
      {open ? (
        <div
          className={cn(
            'absolute z-40 mt-1 min-w-44 rounded-lg border border-neutral-200 bg-white p-1 shadow-xl dark:border-neutral-700 dark:bg-neutral-900',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          <MenuCtx.Provider value={() => setOpen(false)}>{children}</MenuCtx.Provider>
        </div>
      ) : null}
    </div>
  )
}

/** Мәзір элементі — таңдалғанда мәзірді жабады. */
export function MenuItem({
  onClick, children, active, title, disabled,
}: {
  onClick?: () => void
  children: React.ReactNode
  active?: boolean
  title?: string
  disabled?: boolean
}) {
  const close = React.useContext(MenuCtx)
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={() => { onClick?.(); close() }}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition disabled:opacity-40',
        active
          ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
          : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800',
      )}
    >
      {children}
    </button>
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
  children, onClick, disabled, active, title, tour,
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  active?: boolean
  title?: string
  /** Оқыту көмекшісінің белгісі (`components/Tour.tsx`). */
  tour?: string
}) {
  return (
    <button
      type="button"
      title={title}
      data-tour={tour}
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

/**
 * ЖИЫЛАТЫН бөлім.
 *
 * НЕГЕ КЕРЕК: панельде оннан астам бөлім бар, ал бір тапсырыста олардың
 * үш-төртеуі ғана керек. Бәрі ашық тұрғанда керегін табу үшін ұзақ
 * айналдыруға тура келеді.
 *
 * Ашық/жабық күйі БРАУЗЕРДЕ сақталады (жобада емес): бұл — адамның өз
 * ыңғайы, ал жоба басқа адамға ашылғанда оның әдеті таңылмауы керек.
 * Оқу мен жазу try/catch ішінде: жеке терезеде localStorage лақтыруы мүмкін.
 */
const COLLAPSE_KEY = 'furniture-configurator:collapsed'

function readCollapsed(): Record<string, boolean> {
  try {
    const raw = window.localStorage.getItem(COLLAPSE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
  } catch {
    return {}
  }
}

export function Collapsible({
  title, id, defaultOpen = false, badge, children, tour,
}: {
  title: React.ReactNode
  /** localStorage кілті. Атауы өзгерсе де күй сақталуы үшін бөлек. */
  id: string
  defaultOpen?: boolean
  /** Тақырыптың жанындағы қысқа белгі: «бар», «2 шт» — жабық күйде де көрінеді. */
  badge?: React.ReactNode
  children: React.ReactNode
  /** Оқыту көмекшісінің белгісі (`components/Tour.tsx`). */
  tour?: string
}) {
  const [open, setOpen] = React.useState(defaultOpen)

  // Гидратациядан КЕЙІН оқимыз: сервер мен клиент бірінші кадрда бірдей
  // болуы керек, әйтпесе React ескертеді.
  React.useEffect(() => {
    const saved = readCollapsed()[id]
    if (saved !== undefined) setOpen(saved)
  }, [id])

  const toggle = () => {
    const next = !open
    setOpen(next)
    try {
      window.localStorage.setItem(COLLAPSE_KEY, JSON.stringify({ ...readCollapsed(), [id]: next }))
    } catch {
      // Жады жоқ болса, күй тек осы сессияда тұрады — бұл қате емес.
    }
  }

  return (
    <div className="border-t border-neutral-200 pt-2 dark:border-neutral-800" data-tour={tour}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 text-left"
      >
        <span className={cn('text-[10px] text-neutral-400 transition-transform', open && 'rotate-90')}>
          ▶
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
          {title}
        </span>
        {badge && !open ? (
          <span className="ml-auto text-[10px] normal-case text-neutral-500">{badge}</span>
        ) : null}
      </button>
      {/*
        ⚠ Жабық бөлім DOM-да ҚАЛАДЫ, тек көрінбейді.
        Бұрын ол `{open ? ... : null}` еді, яғни балалары ағаштан МҮЛДЕ
        алынып тасталатын. Одан екі зиян шықты:
          1. Беттен іздеу (Ctrl+F) «фартук» дегенді таппайды — қолданушы
             өрістің бар екенін білмей қалады;
          2. e2e жабық бөлімнің ішіндегі басқаруды көрмейді де, «Угловой»
             мен «Планки» тесттері жалған құлайды.
        Мазмұны — қарапайым өрістер, оларды рендерлеу қымбат емес.

        Жасыру КЛАСС арқылы, `hidden` атрибутымен емес: Tailwind-тың
        `[hidden]` ережесі `:where()` ішінде тұр (салмағы 0), ал `flex`
        утилитасы одан ауыр — атрибут қойсақ та, бөлім ашық күйінде қалар еді.
      */}
      <div className={cn('mt-2 flex-col gap-2', open ? 'flex' : 'hidden')}>{children}</div>
    </div>
  )
}
