'use client'

/**
 * PRO100 үлгісіндегі терезе рамасы: ақ тақырып жолағы (белгі + атау + ×),
 * сұр іші, астында OK / Отмена / Применить. Модаль, фоны мөлдір — эталондағы
 * Windows диалогы сияқты сахна көрініп тұрады. Esc = жабу, Enter = OK.
 */

import { useEffect, useRef, type ReactNode } from 'react'
import { t as tr } from '@/lib/i18n'
import { useModalLayer } from '@/lib/useModalLayer'
import { cn } from '@/lib/cn'

export function ClassicWindowIcon() {
  return <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16">
    <circle cx="8" cy="8" r="7" fill="var(--p100-icon-blue)" />
    <path d="M5.5 11.5V4.5h3a2 2 0 0 1 0 4h-3" fill="none" stroke="#ffffff" strokeWidth="1.6" />
  </svg>
}

export type ClassicWindowAction = { label: string; onClick: () => void; disabled?: boolean; primary?: boolean; testId?: string }

export function ClassicWindow({ id, title, onClose, onOk, actions, width = 480, children, testId, className }: {
  id: string
  title: string
  onClose: () => void
  /** Enter басылғанда (өріс ішінде де) — әдетте OK. */
  onOk?: (() => void) | undefined
  actions?: ClassicWindowAction[] | undefined
  width?: number
  children: ReactNode
  testId?: string
  className?: string
}) {
  const { zIndex, isTop } = useModalLayer(true, id, onClose)
  const ref = useRef<HTMLElement>(null)
  const okRef = useRef(onOk)
  okRef.current = onOk
  useEffect(() => { ref.current?.querySelector<HTMLElement>('input, select, button:not([data-window-close])')?.focus() }, [])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!isTop || event.key !== 'Enter' || !okRef.current) return
      if (!(event.target instanceof Node) || !ref.current?.contains(event.target)) return
      if (event.target instanceof HTMLButtonElement || event.target instanceof HTMLTextAreaElement) return
      event.preventDefault()
      okRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isTop])
  return <div className="p100-dialog-backdrop" style={{ zIndex }}>
    <section ref={ref} role="dialog" aria-modal="true" aria-label={title} data-testid={testId}
      className={cn('p100-window', className)} style={{ width: `min(${width}px, calc(100vw - 24px))` }}>
      <header className="p100-window-title">
        <ClassicWindowIcon />
        <strong>{title}</strong>
        <button type="button" data-window-close aria-label={tr('Закрыть')} title={tr('Закрыть')} onClick={onClose}>
          <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10"><path d="M1 1l8 8M9 1 1 9" stroke="currentColor" strokeWidth="1.1" /></svg>
        </button>
      </header>
      <div className="p100-window-body">{children}</div>
      {actions && actions.length > 0 ? <footer className="p100-window-actions">
        {actions.map((action) => <button key={action.label} type="button" data-testid={action.testId}
          className={cn('p100-window-button', action.primary && 'p100-window-button-primary')}
          disabled={action.disabled} onClick={action.onClick}>{action.label}</button>)}
      </footer> : null}
    </section>
  </div>
}

/** Windows TabControl: қойындылар мәтіні, белсендісі ақ әрі төменгі жиексіз. */
export function ClassicTabs<T extends string>({ tabs, value, onChange, label }: {
  tabs: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  label: string
}) {
  return <div role="tablist" aria-label={label} className="p100-tabs">
    {tabs.map((tab) => <button key={tab.value} type="button" role="tab" aria-selected={tab.value === value}
      className="p100-tab" onClick={() => onChange(tab.value)}>{tab.label}</button>)}
  </div>
}
