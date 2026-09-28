import Link from 'next/link'
import { forwardRef } from 'react'
import type { ReactNode } from 'react'

/** A physical dimension, with the same drafting line across public surfaces. */
export function Dimension({ value, label, className = '' }: { value: string; label?: string; className?: string }) {
  return <div className={`dimline py-6 text-xs tracking-[0.06em] ${className}`} style={{ fontFamily: 'var(--font-mono)' }}>
    <span>{label ?? ''}</span><span className="dimline-track" /><span>{value}</span>
  </div>
}

/** Client-facing paper. The classic cut page can retain its own chrome. */
export const Sheet = forwardRef<HTMLElement, {
  children: ReactNode; caption?: string; className?: string; classic?: boolean
}>(function Sheet({ children, caption, className = '', classic = false }, ref) {
  return <figure ref={ref} className={`${classic ? 'border border-neutral-300 bg-white' : 'sheet'} ${className}`}>
    {caption ? <figcaption className="mb-3 text-xs text-[var(--ink-soft)]">{caption}</figcaption> : null}
    {children}
  </figure>
})

export function Cta({ href, children, tone = 'solid' }: {
  href: string; children: ReactNode; tone?: 'solid' | 'ghost'
}) {
  return <Link href={href} className={`${tone === 'solid' ? 'site-cta' : 'site-ghost'} inline-flex min-h-11 items-center gap-2 border px-5 py-3 text-sm`}>
    {children}
  </Link>
}
