'use client'

/**
 * «Нарисовать» — корпустың фас көрінісін тікелей сызу.
 *
 * Бұл ЖАҢА модель емес: сурет те, басу да сол `sections × полосы` құрылымына
 * түседі. Перегородканы қойған жерің — секцияның шекарасы, көлденең сызық —
 * жолақтың шекарасы. Сондықтан сызып болғаннан кейін деталировка да, раскрой
 * да бірден дайын: аудару қажет емес.
 */

import { t as tr } from '@/lib/i18n'
import { useModalLayer } from '@/lib/useModalLayer'
import { useMemo, useState } from 'react'
import { layoutBands, layoutSections } from '@/src/core/index'
import type { CabinetConfig, Section, SectionContent } from '@/src/core/index'
import { activeCabinet, useConfigurator } from '@/store/configurator'
import { Button } from '@/components/ui'
import { cn } from '@/lib/cn'
import { eraseBandDecision, eraseDividerDecision, mergeBandsForErase, mergeSectionsForErase, splitDecision, sketchContentDecision } from '@/lib/f32Sketch'

type Tool = 'divider' | 'band' | 'shelf' | 'drawer' | 'rod' | 'front' | 'erase'

const TOOLS: { value: Tool; label: string; hint: string }[] = [
  { value: 'divider', label: tr('Перегородка'), hint: tr('кликните там, где нужна вертикальная стойка') },
  { value: 'band', label: tr('Полка-разделитель'), hint: tr('кликните на высоте, где делим секцию') },
  { value: 'shelf', label: tr('Полки'), hint: tr('клик по отсеку добавляет полку') },
  { value: 'drawer', label: tr('Ящики'), hint: tr('клик по отсеку добавляет ящик') },
  { value: 'rod', label: tr('Штанга'), hint: tr('клик по отсеку ставит штангу') },
  { value: 'front', label: tr('Фасад'), hint: tr('клик по секции включает или снимает фасад') },
  { value: 'erase', label: tr('Стереть'), hint: tr('клик по перегородке или разделителю убирает его') },
]

/** Сурет экранда осынша биік болады. */
const CANVAS_PX = 460
/** Басқанда «дәл тидің» деп саналатын аралық, мм. */
const HIT_MM = 40

export function SketchEditor() {
  const open = useConfigurator((s) => s.sketchOpen)
  const setOpen = useConfigurator((s) => s.setSketchOpen)
  const { zIndex } = useModalLayer(open, 'sketch')
  const cabinet = useConfigurator(activeCabinet)
  const materials = useConfigurator((s) => s.shop.materials)
  const edit = useConfigurator((s) => s.edit)
  const [tool, setTool] = useState<Tool>('divider')
  const [pendingErase, setPendingErase] = useState<
    | { kind: 'divider'; index: number }
    | { kind: 'band'; sectionIndex: number; index: number }
    | null
  >(null)
  const [pendingReplace, setPendingReplace] = useState<{ sectionIndex: number; bandIndex: number; next: SectionContent } | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

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

  const setSections = (sections: Section[]) => { edit('sketch', { sections }); setFeedback(null) }

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
      const split = splitDecision(xMm - hit.section.x, hit.section.width, t, 'divider')
      if (!split.allowed) { setFeedback(split.error); return }
      const next = [...cabinet.sections]
      const original = next[hit.section.index]!
      next.splice(hit.section.index, 1,
        { ...original, id: `${original.id}a`, widthMode: 'fixed', width: split.first },
        { id: `${original.id}b`, widthMode: 'fixed', width: split.second, contents: [{ kind: 'empty' }], fronts: null },
      )
      setSections(next)
      return
    }

    if (tool === 'band') {
      if (!hit || !hit.band) return
      const split = splitDecision(yMm - hit.band.y, hit.band.height, t, 'band')
      if (!split.allowed) { setFeedback(split.error); return }
      const contents = [...hit.section.section.contents]
      const existing = contents[hit.bandIndex] ?? { kind: 'empty' as const }
      contents.splice(hit.bandIndex, 1,
        { ...existing, height: split.first },
        { kind: 'empty' },
      )
      setSections(cabinet.sections.map((s, i) => (i === hit.section.index ? { ...s, contents } : s)))
      return
    }

    if (tool === 'shelf' || tool === 'drawer' || tool === 'rod') {
      if (!hit || hit.bandIndex < 0) return
      const contents = [...hit.section.section.contents]
      const current = contents[hit.bandIndex]
      const decision = sketchContentDecision(current, tool)
      if (decision.error || !decision.next) { setFeedback(decision.error ?? 'contents: жарамсыз'); return }
      if (decision.requiresConfirmation) {
        setPendingReplace({ sectionIndex: hit.section.index, bandIndex: hit.bandIndex, next: decision.next })
        return
      }
      contents.splice(hit.bandIndex, 1, decision.next)
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
      const decision = eraseDividerDecision(cabinet.sections[nearDivider]!, cabinet.sections[nearDivider + 1]!)
      if (decision.requiresConfirmation) { setPendingReplace(null); setPendingErase({ kind: 'divider', index: nearDivider }) }
      else setSections(mergeSectionsForErase(cabinet.sections, nearDivider, decision.keep))
      return
    }
    if (hit && hit.section.bands.length > 1) {
      const boundary = hit.section.bands.findIndex((b, i) =>
        i < hit.section.bands.length - 1 && Math.abs(yMm - (b.y + b.height + t / 2)) < HIT_MM)
      if (boundary >= 0) {
        const section = hit.section.section
        const decision = eraseBandDecision(section.contents[boundary]!, section.contents[boundary + 1]!)
        if (decision.requiresConfirmation) { setPendingReplace(null); setPendingErase({ kind: 'band', sectionIndex: hit.section.index, index: boundary }) }
        else setSections(cabinet.sections.map((s, i) => i === hit.section.index
          ? mergeBandsForErase(s, boundary, decision.keep) : s))
      }
    }
  }

  const scale = CANVAS_PX / cabinet.height
  const activeTool = TOOLS.find((x) => x.value === tool)!
  const applyPendingErase = (keep: 'left' | 'right' | 'lower' | 'upper') => {
    if (!pendingErase) return
    if (pendingErase.kind === 'divider' && (keep === 'left' || keep === 'right')) {
      setSections(mergeSectionsForErase(cabinet.sections, pendingErase.index, keep))
    } else if (pendingErase.kind === 'band' && (keep === 'lower' || keep === 'upper')) {
      setSections(cabinet.sections.map((section, i) => i === pendingErase.sectionIndex
        ? mergeBandsForErase(section, pendingErase.index, keep) : section))
    }
    setPendingErase(null)
  }
  const contentNames = (section: Section) => [
    ...section.contents.filter((content) => content.kind !== 'empty').map((content) =>
      tr(content.kind === 'shelves' ? 'Полки' : content.kind === 'drawers' ? 'Ящики' : 'Штанга')),
    ...(section.fronts ? [tr('Фасад')] : []),
  ].join(', ')
  const contentLabel = (kind: SectionContent['kind'] | undefined) => tr(kind === 'shelves'
    ? 'Полки' : kind === 'drawers' ? 'Ящики' : kind === 'rod' ? 'Штанга' : 'Пусто')

  return (
    <div
      className="fixed inset-0 flex items-start justify-center overflow-auto bg-black/40 p-4"
      style={{ zIndex }}
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-4xl rounded-xl border border-neutral-200 bg-white p-4 shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="mr-2 text-sm font-semibold">{tr('Нарисовать корпус')}</h2>
          {TOOLS.map((x) => (
            <Button key={x.value} active={tool === x.value} onClick={() => { setTool(x.value); setFeedback(null) }}>
              {x.label}
            </Button>
          ))}
          <div className="ml-auto">
            <Button onClick={() => setOpen(false)}>{tr('Закрыть')}</Button>
          </div>
        </div>

        <p className="mb-2 text-[11px] text-neutral-500">{activeTool.hint}</p>
        {feedback && <p role="alert" className="mb-2 border border-red-600 p-2 text-xs text-red-700 dark:text-red-400">{feedback}</p>}

        {pendingErase && <div role="alertdialog" aria-label={tr('Выберите, что сохранить')}
          className="mb-3 border border-amber-600 bg-white p-3 text-xs dark:bg-neutral-900">
          <p className="mb-2 font-medium">{tr('При объединении содержимое другой части будет удалено. Выберите, что сохранить.')}</p>
          {pendingErase.kind === 'divider' ? <>
            <p>{tr('Слева')}: {contentNames(cabinet.sections[pendingErase.index]!) || '—'}</p>
            <p>{tr('Справа')}: {contentNames(cabinet.sections[pendingErase.index + 1]!) || '—'}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button onClick={() => applyPendingErase('left')}>{tr('Сохранить левую часть')}</Button>
              <Button onClick={() => applyPendingErase('right')}>{tr('Сохранить правую часть')}</Button>
              <Button onClick={() => setPendingErase(null)}>{tr('Отмена')}</Button>
            </div>
          </> : <>
            <p>{tr('Снизу')}: {contentLabel(cabinet.sections[pendingErase.sectionIndex]?.contents[pendingErase.index]?.kind)}</p>
            <p>{tr('Сверху')}: {contentLabel(cabinet.sections[pendingErase.sectionIndex]?.contents[pendingErase.index + 1]?.kind)}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button onClick={() => applyPendingErase('lower')}>{tr('Сохранить нижнюю часть')}</Button>
              <Button onClick={() => applyPendingErase('upper')}>{tr('Сохранить верхнюю часть')}</Button>
              <Button onClick={() => setPendingErase(null)}>{tr('Отмена')}</Button>
            </div>
          </>}
        </div>}

        {pendingReplace && <div role="alertdialog" aria-label={tr('Подтвердите замену содержимого')}
          className="mb-3 border border-amber-600 bg-white p-3 text-xs dark:bg-neutral-900">
          <p className="mb-2">{tr('Текущее содержимое будет удалено')}:{' '}
            {contentLabel(cabinet.sections[pendingReplace.sectionIndex]?.contents[pendingReplace.bandIndex]?.kind)}.</p>
          <div className="flex gap-2">
            <Button onClick={() => {
              const sections = cabinet.sections.map((section, i) => i === pendingReplace.sectionIndex
                ? { ...section, contents: section.contents.map((content, j) => j === pendingReplace.bandIndex ? pendingReplace.next : content) }
                : section)
              setSections(sections)
              setPendingReplace(null)
            }}>{tr('Заменить содержимое')}</Button>
            <Button onClick={() => setPendingReplace(null)}>{tr('Отмена')}</Button>
          </div>
        </div>}

        {layout ? (
          <div className={cn('flex justify-center rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-950',
            (pendingErase || pendingReplace) && 'pointer-events-none')}>
            <svg
              viewBox={`0 0 ${cabinet.width} ${cabinet.height}`}
              width={cabinet.width * scale}
              height={CANVAS_PX}
              className="cursor-crosshair"
              role="img"
              aria-label={tr('Эскиз корпуса')}
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
          <p className="text-xs text-neutral-500">{tr('Проверьте размеры — корпус сейчас не собирается.')}</p>
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
