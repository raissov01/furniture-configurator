'use client'

/**
 * Ең қажетті UI примитивтері (shadcn стилінде, бірақ қолмен жазылған —
 * shadcn CLI интерактивті және желі керек ететіндіктен).
 */

import * as React from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/cn'
import { menuPosition } from '@/lib/menuPosition'
import { t as tr } from '@/lib/i18n'
import { parseNumberDraft, stepAvailable, steppedValue } from '@/lib/numberDraft'

/**
 * ТЫҒЫЗ режим — оң жақтағы қасиеттер панелі үшін (qdesign сияқты: өрістер
 * кішірек, көп нәрсе бір экранға сыяды). Терезелердегі формалар әдепкі
 * өлшемде қалады, сондықтан глобал класс емес, контекст.
 */
const DenseCtx = React.createContext(false)
const FieldLabelCtx = React.createContext('')

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
        {hint ? <span className="min-w-0 text-right text-[10px] text-neutral-500 tabular-nums">{hint}</span> : null}
      </span>
      <FieldLabelCtx.Provider value={label}>{children}</FieldLabelCtx.Provider>
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
  value, onChange, min, max, step = 1, buttonStep = step, invalid, field, label: explicitLabel, onDraftValidityChange,
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  buttonStep?: number
  invalid?: boolean
  field?: string
  label?: string
  onDraftValidityChange?: ((field: string, invalid: boolean) => void) | undefined
}) {
  const dense = React.useContext(DenseCtx)
  const label = explicitLabel ?? (React.useContext(FieldLabelCtx) || tr('Значение'))
  const cls = useControl()
  const [draft, setDraft] = React.useState(String(value))
  const [draftError, setDraftError] = React.useState<ReturnType<typeof parseNumberDraft>['error']>(undefined)
  const wasRejected = React.useRef(Boolean(invalid))
  React.useEffect(() => { setDraft(String(value)); setDraftError(undefined); if (field) onDraftValidityChange?.(field, false) }, [value])
  React.useEffect(() => {
    // A different valid control can resolve a rejected edit while this value stays unchanged.
    if (wasRejected.current && !invalid) setDraft(String(value))
    wasRejected.current = Boolean(invalid)
  }, [invalid, value])
  const errorText = draftError === 'required' ? tr('Поле обязательно')
    : draftError === 'integer' ? tr('Введите целое число, мм')
    : draftError === 'range' ? tr('Значение вне диапазона')
    : draftError === 'number' ? tr('Введите число') : null
  const range = `${min ?? '−∞'}..${max ?? '+∞'} ${tr('мм')}`
  const input = (
    <input
      type="text"
      inputMode="decimal"
      aria-label={explicitLabel}
      aria-invalid={Boolean(invalid || draftError) || undefined}
      className={cn(cls, 'tabular-nums', (invalid || draftError) && 'border-red-500 dark:border-red-500', dense && 'order-2 min-w-0 rounded-none border-x-0 px-0.5 text-center')}
      value={draft}
      onChange={(e) => {
        const raw = e.target.value
        setDraft(raw)
        const result = parseNumberDraft(raw, { min, max, integer: step >= 1 })
        setDraftError(result.error)
        if (field) onDraftValidityChange?.(field, Boolean(result.error))
        if (result.value !== undefined && (result.value !== value || invalid)) onChange(result.value)
      }}
    />
  )
  const error = errorText ? <span role="alert" className="mt-1 block text-[11px] text-red-700 dark:text-red-400">{label}: {errorText} — {tr('допустимо')} {range}</span> : null
  if (!dense) return <span className="block">{input}{error}</span>
  /*
   * ‹ › БАТЫРМАЛАРЫ (qdesign сияқты, тығыз панельде): өлшемді бір басумен
   * қадамға өзгерту. ⚠ DOM-да input БІРІНШІ: <label>-дің «басқаратын
   * элементі» — оның ішіндегі БІРІНШІ labelable элемент; батырма алда тұрса,
   * жазуды басқан адам «−»-ті басып қояр еді. Солға «−» тек CSS `order`-мен.
   */
  const bump = (dir: 1 | -1) => { onChange(steppedValue(value, dir, buttonStep, min, max)) }
  const stepper = 'order-1 w-5 shrink-0 border border-neutral-300 bg-white text-xs text-neutral-500 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:text-neutral-100'
  return (
    <span className="block">
      <span className="flex items-stretch">
        {input}
        <button type="button" tabIndex={-1} aria-label={tr('Уменьшить')} title={tr('Уменьшить')} disabled={Boolean(draftError) || !stepAvailable(value, -1, buttonStep, min, max)} onClick={() => bump(-1)} className={cn(stepper, 'rounded-l-md')}>‹</button>
        <button type="button" tabIndex={-1} aria-label={tr('Увеличить')} title={tr('Увеличить')} disabled={Boolean(draftError) || !stepAvailable(value, 1, buttonStep, min, max)} onClick={() => bump(1)} className={cn(stepper, 'order-3 rounded-r-md')}>›</button>
      </span>
      {error}
    </span>
  )
}

export function Select<T extends string>({
  value, onChange, options, disabled, invalid,
}: { value: T; onChange: (v: T) => void; options: { value: T; label: string; disabled?: boolean }[]; disabled?: boolean; invalid?: boolean }) {
  const cls = useControl()
  return (
    <select className={cn(cls, invalid && 'border-red-500 dark:border-red-500')} aria-invalid={invalid || undefined}
      value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => (
        <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>
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
  label, title, active, children, align = 'left', size,
}: {
  label: React.ReactNode
  title?: string
  active?: boolean
  children: React.ReactNode
  align?: 'left' | 'right'
  /** Тек батырманың сыртқы түрі (`Button`-дегі `size`); мәзірдің өзі емес. */
  size?: 'sm' | 'md'
}) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const menuRef = React.useRef<HTMLDivElement>(null)
  const [position, setPosition] = React.useState<ReturnType<typeof menuPosition> | null>(null)

  const items = () => [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])]
    .filter((item) => !item.disabled)
  const place = React.useCallback(() => {
    const anchor = triggerRef.current?.getBoundingClientRect()
    if (!anchor) return
    setPosition(menuPosition(anchor, window.innerWidth, window.innerHeight,
      menuRef.current?.offsetWidth ?? 240, align))
  }, [align])
  const openMenu = () => {
    document.dispatchEvent(new CustomEvent('ui-menu-open', { detail: ref.current }))
    place()
    setOpen(true)
  }
  React.useLayoutEffect(() => {
    if (!open) return
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [open, place])

  React.useEffect(() => {
    const onOtherMenu = (event: Event) => {
      if ((event as CustomEvent<Element | null>).detail !== ref.current) setOpen(false)
    }
    document.addEventListener('ui-menu-open', onOtherMenu)
    return () => document.removeEventListener('ui-menu-open', onOtherMenu)
  }, [])
  React.useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node) && !menuRef.current?.contains(e.target as Node)) setOpen(false)

    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && open) {
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
      triggerRef.current?.focus()
      return
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      const bar = ref.current?.closest('[role="menubar"]')
      const triggers = [...(bar?.querySelectorAll<HTMLButtonElement>('[data-menu-trigger]') ?? [])]
      const index = triggers.indexOf(triggerRef.current!)
      if (index < 0 || triggers.length < 2) return
      event.preventDefault()
      const delta = event.key === 'ArrowRight' ? 1 : -1
      const next = triggers[(index + delta + triggers.length) % triggers.length]!
      setOpen(false)
      next.focus()
      next.click()
      return
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const enabled = items()
    if (!open || enabled.length === 0) {
      openMenu()
      window.setTimeout(() => {
        const available = items()
        ;(event.key === 'ArrowUp' ? available.at(-1) : available[0])?.focus()
      }, 0)
      return
    }
    const index = enabled.indexOf(document.activeElement as HTMLButtonElement)
    const delta = event.key === 'ArrowDown' ? 1 : -1
    enabled[(index + delta + enabled.length) % enabled.length]?.focus()
  }
  return (
    <div ref={ref} className="relative" onKeyDown={onKeyDown} onMouseEnter={() => {
      const bar = ref.current?.closest('[role="menubar"]')
      if (bar?.querySelector('[data-menu-trigger][aria-expanded="true"]') && !open) openMenu()
    }}>
      <button
        ref={triggerRef}
        type="button"
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={open}
        data-menu-trigger
        title={title ?? (typeof label === 'string' ? label : undefined)}
        onClick={() => open ? setOpen(false) : openMenu()}
        className={cn(
          'rounded-md border font-medium transition',
          size === 'sm' ? 'px-1.5 py-0.5 text-[11px] leading-4' : 'px-2.5 py-1.5 text-xs',
          active || open
            ? 'border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900'
            : 'border-neutral-300 bg-white text-neutral-700 hover:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-neutral-500',
        )}
      >
        {label} <span data-menu-chevron className="text-[9px] opacity-60">▾</span>
      </button>
      {open && position ? createPortal(

        <div
          ref={menuRef}
          role="menu"
          aria-label={typeof label === 'string' ? label : undefined}
          style={{ left: position.left, top: position.top, maxHeight: position.maxHeight }}
          className="ui-menu-portal fixed z-[1000] min-w-44 max-w-[calc(100vw-24px)] overflow-y-auto border border-neutral-300 bg-white p-1 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"

        >
          <MenuCtx.Provider value={() => setOpen(false)}>{children}</MenuCtx.Provider>
        </div>, document.body) : null}
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
      role="menuitem"
      aria-current={active ? 'true' : undefined}
      tabIndex={-1}
      disabled={disabled}
      title={title}
      onClick={() => { onClick?.(); close() }}
      className={cn(
        'flex w-full items-center gap-2 border border-transparent px-2.5 py-1.5 text-left text-xs transition disabled:opacity-40 max-lg:min-h-11 max-lg:text-sm',
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
  children, onClick, disabled, active, ariaPressed, title, tour, size = 'md', testId,
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  active?: boolean
  ariaPressed?: boolean
  title?: string
  /** Оқыту көмекшісінің белгісі (`components/Tour.tsx`). */
  tour?: string
  /**
   * `sm` — PRO100-дың тығыз белгіше қатарлары үшін (`docs/pro100/ui-design.md`):
   * жоғарғы екі қатар, сол жақтағы тар құралдар жолағы. Әдепкі `md` —
   * бұрынғы батырмалардың бәрі (сыртқы түрі өзгермейді).
   */
  size?: 'sm' | 'md'
  testId?: string
}) {
  return (
    <button
      type="button"
      title={title}
      data-tour={tour}
      data-testid={testId}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={ariaPressed ?? (active ? true : undefined)}
      className={cn(
        'rounded-md border font-medium transition',
        size === 'sm' ? 'px-1.5 py-0.5 text-[11px] leading-4' : 'px-2.5 py-1.5 text-xs',
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
  checked, onChange, label, disabled = false,
}: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <label className={cn('flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300', disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer')}>
      <input
        type="checkbox"
        disabled={disabled}
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
    <h2 className="mt-1 text-[11px] font-semibold text-neutral-700 dark:text-neutral-200">
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
