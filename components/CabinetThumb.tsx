'use client'

/**
 * Корпустың фас көрінісі (SVG). Сурет ҚОЛМЕН салынбайды — ол нақты
 * `generateCabinet()` нәтижесінен шығады, сондықтан карточкадағы сурет пен
 * жүктелгеннен кейінгі 3D ешқашан алшақтамайды (CLAUDE.md §3).
 *
 * Шаблон галереясы да, чат-боттың варианттары да осыны қолданады.
 */

import { t as tr } from '@/lib/i18n'
import { useMemo } from 'react'
import { generateCabinet, panelExtents } from '@/src/core/index'
import type { CabinetConfig, Catalog, Panel } from '@/src/core/index'

/** Рөл бойынша түс — 3D сахнадағы палитраның жеңіл нұсқасы. */
const FILL: Record<string, string> = {
  side: 'var(--brand-amber)',
  top: 'var(--brand-amber)',
  bottom: 'var(--brand-amber)',
  shelf: 'var(--brand-amber)',
  divider: 'var(--brand-amber)',
  back: 'var(--neutral-200)',
  drawerSide: 'var(--brand-amber)',
  drawerBack: 'var(--brand-amber)',
  drawerBottom: 'var(--neutral-200)',
  front: 'var(--brand-amber)',
}

type Rect = { x: number; y: number; w: number; h: number; role: string }

export function CabinetThumb({
  cabinet, catalog, pxPerMm,
}: {
  cabinet: CabinetConfig
  catalog: Catalog
  /**
   * Барлық карточкаға ОРТАҚ масштаб: 400 мм антресоль мен 2200 мм шкаф
   * галереяда бірдей болып көрінбеуі керек, әйтпесе өлшем сезімі жоғалады.
   */
  pxPerMm: number
}) {
  const view = useMemo(() => {
    let panels: Panel[]
    try {
      panels = generateCabinet(cabinet, catalog)
    } catch {
      // Карточка ешқашан бүкіл галереяны құлатпауы керек.
      return null
    }
    const thickness = new Map(catalog.materials.map((m) => [m.id, m.thickness]))

    const rects: Rect[] = []
    for (const p of panels) {
      const e = panelExtents(p, thickness.get(p.materialId) ?? 16)
      rects.push({
        x: p.position.x,
        // SVG-де y төмен қарай өседі, ал корпуста жоғары — сондықтан аударамыз.
        y: cabinet.height - (p.position.y + e.y),
        w: e.x,
        h: e.y,
        role: p.role,
      })
    }
    // Артқы қабырға → корпус → фасад ретімен салынады: соңғысы үстінде тұрады.
    const order = ['back', 'side', 'top', 'bottom', 'divider', 'shelf', 'drawerBottom', 'drawerSide', 'drawerBack', 'front']
    const depth = (role: string) => {
      const i = order.indexOf(role)
      return i === -1 ? order.length : i
    }
    rects.sort((a, b) => depth(a.role) - depth(b.role))
    return { rects, w: cabinet.width, h: cabinet.height }
  }, [cabinet, catalog])

  if (!view) {
    return <div className="grid h-full place-items-center text-[10px] text-neutral-400">{tr('нет превью')}</div>
  }

  const width = view.w * pxPerMm
  const height = view.h * pxPerMm

  return (
    <svg
      viewBox={`0 0 ${view.w} ${view.h}`}
      width={width}
      height={height}
      className="shrink-0"
      role="img"
      aria-label={`${cabinet.name} фас`}
    >
      {view.rects.map((r, i) => (
        <rect
          key={i}
          x={r.x}
          y={r.y}
          width={Math.max(r.w, 1)}
          height={Math.max(r.h, 1)}
          fill={FILL[r.role] ?? '#cbd5e1'}
          // Фасад корпустың алдында тұр: жартылай мөлдір болса, ішкі
          // толтырылым да көрініп тұрады.
          fillOpacity={r.role === 'front' ? 0.55 : r.role === 'back' ? 0.35 : 1}
          stroke="var(--brand-graphite)"
          strokeOpacity={0.35}
          strokeWidth={2}
        />
      ))}
    </svg>
  )
}
