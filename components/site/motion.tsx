'use client'

/**
 * Лендингтің қозғалыс көмекшілері. Тәуелділік ЖОҚ: IntersectionObserver +
 * Web Animations API жеткілікті (Motion пакеті бұл үш сәт үшін артық салмақ).
 *
 * Ереже: әдепкі күй — СОҢҒЫ күй. JS істемесе, `prefers-reduced-motion`
 * қосулы болса немесе элемент бет ашылғанда-ақ көрініп тұрса, ештеңе
 * жасырылмайды — адам бірден дайын бетті көреді.
 */

import { useEffect, useRef, type ReactNode, type Ref } from 'react'

/** Қозғалысқа рұқсат бар ма (SSR-де — жоқ). */
export function motionAllowed(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  if (typeof IntersectionObserver === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: no-preference)').matches
}

/** Элемент экранның төменгі шетінен төмен тұр ма — яғни адам оны әлі көрмеген. */
export function belowFold(el: Element): boolean {
  return el.getBoundingClientRect().top > window.innerHeight * 0.92
}

/**
 * Элемент экранға бір рет кіргенде `onEnter` шақырылады.
 * Қайтарылатын функция бақылауды тоқтатады.
 */
export function observeOnce(el: Element, onEnter: () => void, threshold = 0.3): () => void {
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      io.disconnect()
      onEnter()
    }
  }, { threshold })
  io.observe(el)
  return () => io.disconnect()
}

/**
 * Тізім ретінде көрінетін блоктарды (мыс. 4 қадам) кезекпен шығарады.
 * Бала элементтер тек экраннан ТЫС тұрғанда ғана жасырылады.
 */
export function RevealList({ children, className, step = 90, as = 'div' }: {
  children: ReactNode
  className?: string
  /** Семантика: реттелген қадамдар үшін `ol`. */
  as?: 'div' | 'ol' | 'ul'
  /** Көршілер арасындағы кідіріс, мс. Жалпы кідіріс 4 × step-тен аспайды. */
  step?: number
}) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || !motionAllowed() || !belowFold(el)) return
    const items = Array.from(el.children) as HTMLElement[]
    items.forEach((item, i) => { item.style.animationDelay = `${Math.min(i, 5) * step}ms` })
    el.dataset.reveal = 'pending'
    return observeOnce(el, () => { el.dataset.reveal = 'in' }, 0.2)
  }, [step])
  const Tag = as
  return <Tag ref={ref as Ref<never>} className={className}>{children}</Tag>
}
