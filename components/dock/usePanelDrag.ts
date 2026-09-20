'use client'

/**
 * Қалқымалы панельдің тінтуірмен жылжуы/өлшемі өзгеруі. Есептеу
 * `layout.ts`-тегі таза функцияларға (`clampRect`) сүйенеді, хук тек DOM
 * pointer оқиғаларын байланыстырады — components/RoomPlan.tsx пен
 * TouchJoystick.tsx-тегі `window.addEventListener('pointermove', ...)`
 * үлгісімен бірдей.
 */
import { useCallback, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { clampRect } from './layout'
import { MIN_FLOATING_SIZE } from './types'
import type { Bounds, FloatingRect } from './types'

type DragKind = 'move' | 'resize'

type DragState = {
  kind: DragKind
  startX: number
  startY: number
  startRect: FloatingRect
}

export type UsePanelDragParams = {
  /** Ағымдағы rect — сүйреу басталған сәтте «тірек» ретінде алынады. */
  rect: FloatingRect
  bounds: Bounds
  containerRef: React.RefObject<HTMLElement | null>
  onChange: (rect: FloatingRect) => void
  /** Сүйреу барысында әр қадамда шақырылады (докинг аймағын бояу үшін). `null` — сүйреу аяқталды. */
  onDragging?: (point: { x: number; y: number } | null) => void
  /** Тінтуір жіберілгенде, тек «жылжыту» режимінде шақырылады. */
  onDropAt?: (point: { x: number; y: number }) => void
}

export function usePanelDrag(params: UsePanelDragParams): {
  startMove: (e: ReactPointerEvent) => void
  startResize: (e: ReactPointerEvent) => void
} {
  const dragRef = useRef<DragState | null>(null)
  // Соңғы параметрлерді ref-те ұстаймыз: window-ге тіркелген listener
  // әрқашан ЕҢ ЖАҢА bounds/onChange-ті көруі керек, ескі closure емес.
  const paramsRef = useRef(params)
  paramsRef.current = params

  const toContainerPoint = useCallback((e: PointerEvent): { x: number; y: number } => {
    const el = paramsRef.current.containerRef.current
    const box = el?.getBoundingClientRect()
    return box ? { x: e.clientX - box.left, y: e.clientY - box.top } : { x: e.clientX, y: e.clientY }
  }, [])

  const handleMove = useCallback(
    (e: PointerEvent) => {
      const s = dragRef.current
      if (!s) return
      const p = paramsRef.current
      const dx = e.clientX - s.startX
      const dy = e.clientY - s.startY
      if (s.kind === 'move') {
        p.onChange(clampRect({ ...s.startRect, x: s.startRect.x + dx, y: s.startRect.y + dy }, p.bounds))
        p.onDragging?.(toContainerPoint(e))
      } else {
        const width = Math.max(MIN_FLOATING_SIZE.width, s.startRect.width + dx)
        const height = Math.max(MIN_FLOATING_SIZE.height, s.startRect.height + dy)
        p.onChange(clampRect({ ...s.startRect, width, height }, p.bounds))
      }
    },
    [toContainerPoint],
  )

  const handleUp = useCallback(
    (e: PointerEvent) => {
      const s = dragRef.current
      dragRef.current = null
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      const p = paramsRef.current
      p.onDragging?.(null)
      if (s?.kind === 'move') p.onDropAt?.(toContainerPoint(e))
    },
    [handleMove, toContainerPoint],
  )

  const beginDrag = useCallback(
    (kind: DragKind) => (e: ReactPointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      dragRef.current = { kind, startX: e.clientX, startY: e.clientY, startRect: paramsRef.current.rect }
      window.addEventListener('pointermove', handleMove)
      window.addEventListener('pointerup', handleUp)
    },
    [handleMove, handleUp],
  )

  return {
    startMove: beginDrag('move'),
    startResize: beginDrag('resize'),
  }
}
