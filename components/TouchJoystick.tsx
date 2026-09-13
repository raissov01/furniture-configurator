'use client'

/**
 * ТЕЛЕФОНДАҒЫ ПРОГУЛКАНЫҢ ДЖОЙСТИГІ (сол жақ төменгі бұрыш).
 *
 * Телефонда перне де, pointer-lock та жоқ: жүру — осы джойстик, қарау —
 * экранды саусақпен сүйреу (WalkControls). Ауытқу `walkInput`-қа жазылады,
 * ал 3D оны әр кадрда өзі оқиды.
 *
 * Жалпақ дизайн: тұтас жартылай мөлдір түс, 1px жиек, blur жоқ.
 */

import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { t as tr } from '@/lib/i18n'
import { walkInput } from '@/lib/walkInput'

/** Тұтқаның шеңбер ортасынан ең үлкен ауытқуы, px. */
const RADIUS = 44

export function TouchJoystick() {
  const [knob, setKnob] = useState({ x: 0, y: 0 })
  const centre = useRef<{ x: number; y: number; id: number } | null>(null)

  // Джойстик жоғалса (прогулкадан шықса), жүріс тоқтауы керек.
  useEffect(() => () => { walkInput.move = { x: 0, y: 0 } }, [])

  const apply = (e: ReactPointerEvent<HTMLDivElement>) => {
    const c = centre.current
    if (!c || e.pointerId !== c.id) return
    let dx = e.clientX - c.x
    let dy = e.clientY - c.y
    const len = Math.hypot(dx, dy)
    if (len > RADIUS) { dx = (dx / len) * RADIUS; dy = (dy / len) * RADIUS }
    setKnob({ x: dx, y: dy })
    // Экранда төмен — y өседі, ал жүрісте «алға» — жоғары: таңбасы ауысады.
    walkInput.move = { x: dx / RADIUS, y: -dy / RADIUS }
  }
  const release = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (centre.current && e.pointerId !== centre.current.id) return
    centre.current = null
    setKnob({ x: 0, y: 0 })
    walkInput.move = { x: 0, y: 0 }
  }

  return (
    <div
      role="application"
      aria-label={tr('Джойстик: идти')}
      className="pointer-events-auto absolute bottom-20 left-5 z-20 h-28 w-28 touch-none select-none rounded-full border border-white/70 bg-black/30"
      onPointerDown={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        centre.current = { x: r.left + r.width / 2, y: r.top + r.height / 2, id: e.pointerId }
        e.currentTarget.setPointerCapture(e.pointerId)
        apply(e)
      }}
      onPointerMove={apply}
      onPointerUp={release}
      onPointerCancel={release}
    >
      <span
        className="absolute left-1/2 top-1/2 h-12 w-12 rounded-full border border-neutral-300 bg-white"
        style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
      />
    </div>
  )
}
