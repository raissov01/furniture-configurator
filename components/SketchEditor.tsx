'use client'

/**
 * «Нарисовать» — корпустың фас көрінісін тікелей сызу.
 *
 * Бұл ЖАҢА модель емес: сурет те, басу да сол `sections × полосы` құрылымына
 * түседі. Перегородканы қойған жерің — секцияның шекарасы, көлденең сызық —
 * жолақтың шекарасы. Сондықтан сызып болғаннан кейін деталировка да, раскрой
 * да бірден дайын: аудару қажет емес.
 */

import { useMemo, useState } from 'react'
import { layoutBands, layoutSections } from '@/src/core/index'
import type { CabinetConfig, Section, SectionContent } from '@/src/core/index'
import { activeCabinet, useConfigurator } from '@/store/configurator'
import { Button } from '@/components/ui'
import { cn } from '@/lib/cn'

type Tool = 'divider' | 'band' | 'shelf' | 'drawer' | 'rod' | 'front' | 'erase'

const TOOLS: { value: Tool; label: string; hint: string }[] = [
  { value: 'divider', label: 'Перегородка', hint: 'кликните там, где нужна вертикальная стойка' },
  { value: 'band', label: 'Полка-разделитель', hint: 'кликните на высоте, где делим секцию' },
  { value: 'shelf', label: 'Полки', hint: 'клик по отсеку добавляет полку' },
  { value: 'drawer', label: 'Ящики', hint: 'клик по отсеку добавляет ящик' },
  { value: 'rod', label: 'Штанга', hint: 'клик по отсеку ставит штангу' },
  { value: 'front', label: 'Фасад', hint: 'клик по секции включает или снимает фасад' },
  { value: 'erase', label: 'Стереть', hint: 'клик по перегородке или разделителю убирает его' },
]

/** Сурет экранда осынша биік болады. */
const CANVAS_PX = 460
/** Басқанда «дәл тидің» деп саналатын аралық, мм. */
const HIT_MM = 40

export function SketchEditor() {
  const open = useConfigurator((s) => s.sketchOpen)
  const setOpen = useConfigurator((s) => s.setSketchOpen)
  const cabinet = useConfigurator(activeCabinet)
  const materials = useConfigurator((s) => s.shop.materials)
  const edit = useConfigurator((s) => s.edit)
  const [tool, setTool] = useState<Tool>('divider')

  const t = materials.find((m) => m.id === cabinet.carcassMaterialId)?.thickness ?? 16

  const layout = useMemo(() => {
    try {
      const { layouts, dividerPositions } = layoutSections(cabinet.sections, cabinet.width - 2 * t, t, t)
      const innerHeight = cabinet.height - 2 * t
      return {
        layouts: layouts.map((l, i) => ({
          ...l,
          index: i,
          bands: layoutBands(l.section.contents, innerHeight, t, i),
        })),
        dividerPositions,
        innerHeight,
      }
    } catch {
      // Конфиг уақытша жарамсыз болса, сурет жоғалып кетпеуі керек.
      return null
    }
  }, [cabinet, t])

  if (!open) return null

  const setSections = (sections: Section[]) => edit('sketch', { sections })

  /** Басылған нүктедегі секция мен жолақ. */
  const locate = (xMm: number, yMm: number) => {
    if (!layout) return null
    const section = layout.layouts.find((l) => xMm >= l.x && xMm <= l.x + l.width)
    if (!section) return null
    const band = section.bands.find((b) => yMm >= b.y && yMm <= b.y + b.height)
    return { section, band, bandIndex: section.bands.findIndex((b) => b === band) }
  }

  const apply = (xMm: number, yMm: number) => {
    if (!layout) return
    const hit = locate(xMm, yMm)

    if (tool === 'divider') {
      if (!hit) return
      // Секцияны басылған жерден екіге бөлеміз: екеуі де тіркелген енге ие
      // болады, сонда сурет пен нәтиже дәл келеді.
      const left = Math.round(xMm - hit.section.x)
      const right = Math.round(hit.section.width - left - t)
      if (left < 100 || right < 100) return
      const next = [...cabinet.sections]
      const original = next[hit.section.index]!
      next.splice(hit.section.index, 1,
        { ...original, id: `${original.id}a`, widthMode: 'fixed', width: left },
        { id: `${original.id}b`, widthMode: 'fixed', width: right, contents: [{ kind: 'empty' }], fronts: null },
      )
      setSections(next)
      return
    }

    if (tool === 'band') {
      if (!hit || !hit.band) return
      const lower = Math.round(yMm - hit.band.y)
      if (lower < 100 || hit.band.height - lower - t < 100) return
      const contents = [...hit.section.section.contents]
      const existing = contents[hit.bandIndex] ?? { kind: 'empty' as const }
      contents.splice(hit.bandIndex, 1,
        { ...existing, height: lower },
        { kind: 'empty' },
      )
      setSections(cabinet.sections.map((s, i) => (i === hit.section.index ? { ...s, contents } : s)))
      return
    }

    if (tool === 'shelf' || tool === 'drawer' || tool === 'rod') {
      if (!hit || hit.bandIndex < 0) return
      const contents = [...hit.section.section.contents]
      const current = contents[hit.bandIndex]
      const height = current?.height
      const keep = height === undefined ? {} : { height }
      let next: SectionContent
      if (tool === 'shelf') {
        next = current?.kind === 'shelves'
          ? { ...current, count: Math.min(20, current.count + 1) }
          : { kind: 'shelves', count: 1, shelfKind: 'adjustable', ...keep }
      } else if (tool === 'drawer') {
        next = current?.kind === 'drawers'
          ? { ...current, count: Math.min(8, current.count + 1) }
          : { kind: 'drawers', count: 1, ...keep }
      } else {
        next = { kind: 'rod', ...keep }
      }
      contents.splice(hit.bandIndex, 1, next)
      setSections(cabinet.sections.map((s, i) => (i === hit.section.index ? { ...s, contents } : s)))
      return
    }

    if (tool === 'front') {
      if (!hit) return
      const section = hit.section.section
      setSections(cabinet.sections.map((s, i) => (i === hit.section.index
        ? { ...s, fronts: section.fronts ? null : { count: 1, mount: 'overlay' as const } }
        : s)))
      return
    }

    // Стереть: алдымен перегородка, сосын жолақ шекарасы.
    const nearDivider = layout.dividerPositions.findIndex((x) => Math.abs(xMm - (x + t / 2)) < HIT_MM)
    if (nearDivider >= 0 && cabinet.sections.length > 1) {
      const next = [...cabinet.sections]
      const merged = next[nearDivider]!
      next.splice(nearDivider, 2, { ...merged, widthMode: 'flex', width: undefined })
      setSections(next)
      return
    }
    if (hit && hit.section.bands.length > 1) {
      const boundary = hit.section.bands.findIndex((b, i) =>
        i < hit.section.bands.length - 1 && Math.abs(yMm - (b.y + b.height + t / 2)) < HIT_MM)
      if (boundary >= 0) {
        const contents = [...hit.section.section.contents]
        const kept = contents[boundary]!
        contents.splice(boundary, 2, { ...kept, height: undefined })
        setSections(cabinet.sections.map((s, i) => (i === hit.section.index ? { ...s, contents } : s)))
      }
    }
  }

  const scale = CANVAS_PX / cabinet.height
  const activeTool = TOOLS.find((x) => x.value === tool)!

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/40 p-4 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-4xl rounded-xl border border-neutral-200 bg-white p-4 shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="mr-2 text-sm font-semibold">Нарисовать корпус</h2>
          {TOOLS.map((x) => (
            <Button key={x.value} active={tool === x.value} onClick={() => setTool(x.value)}>
              {x.label}
            </Button>
          ))}
          <div className="ml-auto">
            <Button onClick={() => setOpen(false)}>Закрыть</Button>
          </div>
        </div>

        <p className="mb-2 text-[11px] text-neutral-500">{activeTool.hint}</p>

        {layout ? (
          <div className="flex justify-center rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-950">
            <svg
              viewBox={`0 0 ${cabinet.width} ${cabinet.height}`}
              width={cabinet.width * scale}
              height={CANVAS_PX}
              className="cursor-crosshair"
              role="img"
              aria-label="Эскиз корпуса"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                const xMm = ((e.clientX - rect.left) / rect.width) * cabinet.width
                // SVG-де y жоғарыдан төмен, ал корпуста төменнен жоғары.
                const yMm = cabinet.height - ((e.clientY - rect.top) / rect.height) * cabinet.height
                apply(xMm, yMm)
              }}
            >
              <rect x={0} y={0} width={cabinet.width} height={cabinet.height}
                fill="#f4efe1" stroke="#7c5f14" strokeWidth={t} />

              {layout.layouts.map((l) =>
                l.bands.map((band, bi) => (
                  <BandShape
                    key={`${l.section.id}-${bi}`}
                    x={l.x} width={l.width}
                    y={cabinet.height - band.y - band.height} height={band.height}
                    content={band.content}
                    thickness={t}
                  />
                )),
              )}

              {layout.dividerPositions.map((x) => (
                <rect key={x} x={x} y={t} width={t} height={cabinet.height - 2 * t} fill="#bd9520" />
              ))}

              {layout.layouts.map((l) =>
                l.section.fronts ? (
                  <rect
                    key={`f-${l.section.id}`}
                    x={l.x} y={t} width={l.width} height={cabinet.height - 2 * t}
                    fill="#b8862a" fillOpacity={0.35} stroke="#7c5f14" strokeWidth={4}
                  />
                ) : null,
              )}
            </svg>
          </div>
        ) : (
          <p className="text-xs text-neutral-500">Проверьте размеры — корпус сейчас не собирается.</p>
        )}

        <p className="mt-3 text-[11px] text-neutral-400">
          Каждый клик сразу пересчитывает модель, деталировку и раскрой. Ctrl+Z отменяет.
        </p>
      </div>
    </div>
  )
}

/** Бір жолақтың ішкі көрінісі: сөре сызықтары, ящик фасады, штанга. */
function BandShape({
  x, width, y, height, content, thickness,
}: {
  x: number
  width: number
  y: number
  height: number
  content: SectionContent
  thickness: number
}) {
  if (content.kind === 'shelves' && content.count > 0) {
    const step = height / (content.count + 1)
    return (
      <g>
        {Array.from({ length: content.count }, (_, i) => (
          <rect key={i} x={x} y={y + step * (i + 1)} width={width} height={thickness} fill="#c9a227" />
        ))}
      </g>
    )
  }
  if (content.kind === 'drawers') {
    const step = height / content.count
    return (
      <g>
        {Array.from({ length: content.count }, (_, i) => (
          <rect key={i} x={x + 6} y={y + step * i + 6} width={width - 12} height={step - 12}
            fill="#d9b642" stroke="#7c5f14" strokeWidth={4} />
        ))}
      </g>
    )
  }
  if (content.kind === 'rod') {
    return <rect x={x} y={y + 60} width={width} height={25} rx={12} fill="#9aa3ad" />
  }
  return null
}
