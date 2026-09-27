'use client'

/**
 * Присадканың ҚОЛМЕН редакторы: панельдің 2D жаймасы.
 *
 * Экранда — кесілген детальдің өзі, айналасында ТӨРТ ТОРЦЫ жайылып салынған
 * (L1 астында, L2 үстінде, W1 солда, W2 оңда). Тесік қай бетте тұрғанын
 * сөзбен түсіндірудің қажеті жоқ: ол дәл сол бетте көрініп тұрады. Бұл —
 * цехтағы адамның детальді қолына алып қарағанындай көрініс.
 *
 * ҚАЙДА САҚТАЛАДЫ. Тесік панельге жазылмайды — панель әрқашан конфигтен
 * қайта есептеледі (§7). Шкаф тесігі `cabinet.drillEdits`, еркін тақта
 * тесігі `BoardSpec.drilling` ішінде сақталады. Сондықтан
 * қолмен қойылған тесік 3D-де де, DXF-те де, сметада да бірдей көрінеді.
 */

import { t as tr } from '@/lib/i18n'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Field, NumberInput, Select } from '@/components/ui'
import { cn } from '@/lib/cn'
import { drillClickResult, drillDeleteDecision, drillPresetOptions } from '@/lib/f17DrillUi'
import { childExportAllowed } from '@/lib/propertiesDialogState'
import { useModalLayer } from '@/lib/useModalLayer'
import { panelCncAvailable, panelCncCsv } from '@/lib/panelCncExport'
import {
  CUTOUT_PRESETS,
  DRILL_PRESETS,
  addDrill,
  cutoutBounds,
  cutoutWarnings,
  findCutoutPreset,
  drillEditCounts,
  drillKey,
  isManualDrill,
  removeDrill,
  resetPanelDrills,
  snapToPitch,
} from '@/src/core/index'
import type { Catalog, Cutout, Drill, DrillEdits, Panel, PanelCutouts } from '@/src/core/index'
import { useConfigurator } from '@/store/configurator'
import { findNode } from '@/src/core/index'

type Filter = 'all' | 'auto' | 'manual'

/** Жайманың экрандағы ені, пиксель. */
const VIEW_PX = 760
/** Тордың қадамы 32 мм (§4.9); торға түсіру ӨШІРУЛІ де болады. */
const SNAP_LABEL = '32 мм'

const PURPOSE_COLOR: Record<Drill['purpose'], string> = {
  confirmat: '#dc2626',
  dowel: '#a16207',
  minifix: '#7c3aed',
  shelfPin: '#2563eb',
  hinge: '#059669',
  runner: '#ea580c',
  handle: '#0891b2',
  leg: '#64748b',
  facadeScrew: '#be185d',
}

const PURPOSE_NAME: Record<Drill['purpose'], string> = {
  confirmat: 'Конфирмат',
  dowel: 'Шкант',
  minifix: 'Минификс',
  shelfPin: 'Полкодержатель',
  hinge: 'Петля',
  runner: 'Направляющая',
  handle: 'Ручка',
  leg: 'Ножка',
  facadeScrew: 'Фасад евровинты',
}

const EDGE_FACES = ['edgeL1', 'edgeL2', 'edgeW1', 'edgeW2'] as const
type EdgeFace = (typeof EDGE_FACES)[number]

const isEdgeFace = (face: Drill['face']): face is EdgeFace =>
  (EDGE_FACES as readonly string[]).includes(face)

/**
 * Тесіктің жаймадағы орны.
 *
 * Торц беттердің өз координатасында x — жиектің бойымен, y — ҚАЛЫҢДЫҚ
 * бойымен. Жаймада қалыңдық детальден СЫРТҚА қарай өседі, сондықтан
 * L1 жолағында y теріс бағытта салынады. Бұл — жайманың келісімі, ол
 * тесіктің өз координатасын өзгертпейді.
 */
function place(drill: Drill, length: number, width: number): { x: number; y: number } {
  switch (drill.face) {
    case 'inner':
    case 'outer':
      return { x: drill.x, y: drill.y }
    case 'edgeL1':
      return { x: drill.x, y: -drill.y }
    case 'edgeL2':
      return { x: drill.x, y: width + drill.y }
    case 'edgeW1':
      return { x: -drill.y, y: drill.x }
    case 'edgeW2':
      return { x: length + drill.y, y: drill.x }
  }
}

export function DrillEditor({ panels, catalog, propertiesOpen = false }: { panels: Panel[]; catalog: Catalog; propertiesOpen?: boolean }) {
  const open = useConfigurator((s) => s.drillOpen)
  const { zIndex, isTop } = useModalLayer(open, 'drill')
  const setOpen = useConfigurator((s) => s.setDrillOpen)
  const cabinet = useConfigurator((s) => s.cabinets.find((item) => item.id === s.activeId))
  const boardNode = useConfigurator((s) => {
    const node = findNode(s.root, s.activeId)
    return node?.kind === 'board' ? node : null
  })
  const edit = useConfigurator((s) => s.edit)
  const editBoard = useConfigurator((s) => s.editBoard)
  const projectSettings = useConfigurator((s) => s.projectSettings ?? s.shop.settings)

  const [panelId, setPanelId] = useState<string | null>(null)
  const [presetId, setPresetId] = useState(DRILL_PRESETS[0]!.id)
  const [filter, setFilter] = useState<Filter>('all')
  const [side, setSide] = useState<'inner' | 'outer'>('inner')
  const [snap, setSnap] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const edits: DrillEdits = boardNode ? { [boardNode.id]: { added: boardNode.board.drilling ?? [], removed: [] } }
    : cabinet?.drillEdits ?? {}
  const allCutouts: PanelCutouts = boardNode ? { [boardNode.id]: boardNode.board.cutouts ?? [] }
    : cabinet?.panelCutouts ?? {}
  const panel = panels.find((p) => p.id === panelId) ?? panels[0]
  const settings = { ...projectSettings, ...cabinet?.settings }
  const presetOptions = drillPresetOptions(settings)
  const preset = presetOptions.find((option) => option.id === presetId) ?? presetOptions[0]!

  const setEdits = (next: DrillEdits, key: string) => {
    if (boardNode) editBoard(boardNode.id, { drilling: next[boardNode.id]?.added ?? [] })
    else edit(`drill:${key}`, { drillEdits: next })
  }

  /**
   * Ойманы қосу/өшіру. Присадкамен бір терезеде тұрғаны әдейі: цехтағы адам
   * бір детальді ашып, тесігін де, ойымын да сонда көреді.
   */
  const setCutouts = (panelId: string, list: Cutout[], key: string) => {
    const next: PanelCutouts = { ...allCutouts }
    if (list.length === 0) delete next[panelId]
    else next[panelId] = list
    if (boardNode) editBoard(boardNode.id, { cutouts: list })
    else edit(`cutout:${key}`, { panelCutouts: next })
  }

  // Панель жоғалса (габарит өзгерді, секция өшті) — таңдау бірінші панельге көшеді.
  useEffect(() => {
    if (panelId !== null && !panels.some((p) => p.id === panelId)) setPanelId(null)
  }, [panels, panelId])

  const material = useMemo(
    () => (panel ? catalog.materials.find((m) => m.id === panel.materialId) : undefined),
    [panel, catalog],
  )

  const drills = useMemo(() => {
    if (!panel) return []
    const edit = edits[panel.id]
    return panel.drilling
      .map((d) => ({ drill: d, key: drillKey(d), manual: isManualDrill(d, edit) }))
      .filter((d) => (filter === 'all' ? true : filter === 'manual' ? d.manual : !d.manual))
  }, [panel, edits, filter])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!open || !isTop) return
      if (e.key === 'Escape') setOpen(false)
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected !== null && panel) {
        const found = panel.drilling.find((d) => drillKey(d) === selected)
        if (!found) return
        e.preventDefault()
        if (drillDeleteDecision(boardNode !== null, isManualDrill(found, edits[panel.id])) === 'auto-board') {
          setFeedback(tr('Автоотверстие задаётся соединением. Измените соединение; удалить можно только ручное отверстие.'))
          return
        }
        setEdits(
          removeDrill(edits, panel.id, found, { manual: isManualDrill(found, edits[panel.id]) }),
          `remove:${selected}`,
        )
        setSelected(null)
        setFeedback(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!open) return null
  if (!panel || !material) {
    return (
      <Shell onClose={() => setOpen(false)} zIndex={zIndex}>
        <p className="text-xs text-neutral-500">{tr('Нет деталей для присадки.')}</p>
      </Shell>
    )
  }

  const t = material.thickness
  const L = panel.cutLength
  const W = panel.cutWidth
  // Жайманың өрісі: екі жағында торц жолағы + тыныс алатын шет.
  const pad = Math.max(40, t * 2)
  const viewW = L + t * 2 + pad * 2
  const viewH = W + t * 2 + pad * 2
  const scale = VIEW_PX / viewW
  const counts = drillEditCounts(edits)
  const panelEdit = edits[panel.id]
  const panelCutouts = allCutouts[panel.id] ?? []
  const warnings = cutoutWarnings(panel)

  /** Экрандағы нүкте → детальдің миллиметрі. */
  const toMm = (e: React.MouseEvent<SVGSVGElement>): { x: number; y: number } => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * viewW - pad - t
    // SVG-де y төмен қарай өседі, ал детальдің y-і ЖОҒАРЫ қарай.
    const y = W + t + pad - ((e.clientY - rect.top) / rect.height) * viewH
    return { x, y }
  }

  /** Басылған нүкте қай бетке түседі: кең бет пе, әлде торц па. */
  const faceAt = (x: number, y: number): { face: Drill['face']; x: number; y: number } | null => {
    if (x >= 0 && x <= L && y >= 0 && y <= W) return { face: side, x, y }
    if (x >= 0 && x <= L && y < 0 && y >= -t) return { face: 'edgeL1', x, y: -y }
    if (x >= 0 && x <= L && y > W && y <= W + t) return { face: 'edgeL2', x, y: y - W }
    if (y >= 0 && y <= W && x < 0 && x >= -t) return { face: 'edgeW1', x: y, y: -x }
    if (y >= 0 && y <= W && x > L && x <= L + t) return { face: 'edgeW2', x: y, y: x - L }
    return null
  }

  const onClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const mm = toMm(e)
    const spot = faceAt(mm.x, mm.y)
    if (!spot) return

    const onEdge = isEdgeFace(spot.face)
    // Торцта тесік ӘРҚАШАН қалыңдықтың ортасында: станок басқаша бұрғыламайды.
    const x = snap && !onEdge ? snapToPitch(spot.x) : spot.x
    const y = onEdge ? t / 2 : snap ? snapToPitch(spot.y) : spot.y
    const result = drillClickResult(panel, t, preset.id, settings, { ...spot, x, y })
    if (!result.drill) { setFeedback(result.error); return }
    const drill = result.drill
    setEdits(addDrill(edits, panel.id, drill), `add:${drillKey(drill)}`)
    setSelected(drillKey(drill))
    setFeedback(null)
  }

  return (
    <Shell onClose={() => setOpen(false)} zIndex={zIndex}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="mr-1 text-sm font-semibold">{tr('Присадка вручную')}</h2>
        <span className="text-[11px] text-neutral-500">
          {tr('добавлено')}: <b className="tabular-nums">{counts.added}</b> · {tr('удалено')}:{' '}
          <b className="tabular-nums">{counts.removed}</b>
        </span>
        <div className="ml-auto flex items-center gap-1">
          {propertiesOpen && <span role="status" className="text-xs">{tr('Закройте свойства через OK перед экспортом')}</span>}
          {/* Панель бойынша CNC: станоктың бағдарламасы дәл осындай кестені
              оқиды, ал бүкіл жобаның архивін ашудың қажеті жоқ. */}
          <Button
            disabled={!childExportAllowed(propertiesOpen) || !panelCncAvailable(panel)}
            title={panelCncAvailable(panel) ? tr('CSV с отверстиями этой детали — для станка') : tr('Нет отверстий')}
            onClick={() => {
              const { name, csv } = panelCncCsv(panel, (drill) => isManualDrill(drill, panelEdit))
              // BOM: Excel онсыз кириллицаны бұзып ашады.
              const blob = new Blob([new TextEncoder().encode(`\ufeff${csv}`)], { type: 'text/csv;charset=utf-8' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = name
              a.click()
              URL.revokeObjectURL(url)
            }}
          >
            {tr('CNC CSV')}
          </Button>
          <Button
            disabled={!panelEdit || (boardNode !== null && panelEdit.added.length === 0)}
            title={boardNode ? tr('Удалить только ручные отверстия; автоматические задаются соединением') : tr('Вернуть автоматическую присадку этой детали')}
            onClick={() => {
              setEdits(resetPanelDrills(edits, panel.id), `reset:${panel.id}`)
              setSelected(null)
              setFeedback(null)
            }}
          >
            {boardNode ? tr('Удалить ручные отверстия') : tr('Вернуть авто')}
          </Button>
          <Button onClick={() => setOpen(false)}>{tr('Закрыть')}</Button>
        </div>
      </div>
      {feedback ? <p role="status" className="mb-2 border border-red-500 px-2 py-1 text-xs text-red-700 dark:text-red-300">{feedback}</p> : null}

      <div className="grid gap-3 lg:grid-cols-[230px_1fr]">
        <aside className="space-y-3">
          <Field label={tr('Деталь')} hint={`${panel.cutLength} × ${panel.cutWidth}`}>
            <Select
              value={panel.id}
              onChange={(id) => { setPanelId(id); setSelected(null) }}
              options={panels.map((p) => ({
                value: p.id,
                label: `${p.label} ${p.cutLength}×${p.cutWidth}`,
              }))}
            />
          </Field>

          <Field label={tr('Что сверлим')} hint={preset.where === 'edge' ? tr('в торец') : tr('в пласть')}>
            <Select
              value={presetId}
              onChange={(id) => { setPresetId(id); setFeedback(null) }}
              options={presetOptions.map((p) => ({ value: p.id, label: p.name }))}
            />
          </Field>

          <Field label={tr('Сторона')} hint={tr('для пласти')}>
            <Select
              value={side}
              onChange={setSide}
              options={[
                { value: 'inner' as const, label: tr('Внутренняя') },
                { value: 'outer' as const, label: tr('Внешняя') },
              ]}
            />
          </Field>

          <div className="flex flex-wrap gap-1">
            <Button active={filter === 'all'} onClick={() => setFilter('all')}>{tr('Все')}</Button>
            <Button active={filter === 'auto'} onClick={() => setFilter('auto')}>{tr('Авто')}</Button>
            <Button active={filter === 'manual'} onClick={() => setFilter('manual')}>{tr('Вручную')}</Button>
          </div>

          <Button active={snap} onClick={() => setSnap(!snap)} title={tr('Привязка к системе 32 мм')}>
            {tr('Сетка')} {SNAP_LABEL}
          </Button>

          <p className="text-[10px] leading-relaxed text-neutral-500">
            {tr('Клик по детали — добавить отверстие, клик по отверстию — выбрать, Delete — удалить. Отверстие в торец ставится по центру толщины.')}
          </p>

          {selected !== null ? <SelectedInfo panel={panel} keyOf={selected} /> : null}

          {/* ── Оймалар ─────────────────────────────────────────────────────
              Раковина, розетка, құбыр: параметрлі модельден шықпайтын, бірақ
              әр екінші тапсырыста кездесетін нәрсе. */}
          <div className="space-y-2 border-t border-neutral-200 pt-2 dark:border-neutral-800">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider text-neutral-500">{tr('Вырезы')}</span>
              <span className="text-[11px] text-neutral-400 tabular-nums">{panelCutouts.length}</span>
            </div>

            <Select
              value=""
              onChange={(id) => {
                const preset = findCutoutPreset(id)
                if (!preset) return
                const n = panelCutouts.length + 1
                const common = {
                  id: `cut-${n}-${Date.now().toString(36)}`,
                  label: preset.name,
                  corner: 'bottomLeft' as const,
                  // Әдепкі орны — сол-төменгі бұрыштан 100 мм: деталь ішінде
                  // жататыны кепілді, ал цех оны бірден жылжытады.
                  x: 100,
                  y: 100,
                }
                const cutout: Cutout = preset.shape === 'circle'
                  ? { ...common, shape: 'circle', diameter: preset.diameter ?? 68 }
                  : {
                    ...common, shape: 'rect',
                    width: preset.width ?? 100, height: preset.height ?? 60,
                    ...(preset.radius === undefined ? {} : { radius: preset.radius }),
                  }
                setCutouts(panel.id, [...panelCutouts, cutout], `add:${cutout.id}`)
              }}
              options={[
                { value: '', label: tr('+ Добавить вырез') },
                ...CUTOUT_PRESETS.map((p) => ({ value: p.id, label: p.name })),
              ]}
            />

            {panelCutouts.map((cutout, i) => (
              <div key={cutout.id} className="rounded-md border border-neutral-200 p-1.5 dark:border-neutral-700">
                <div className="flex items-center gap-1">
                  <span className="flex-1 truncate text-[11px]">{cutout.label ?? cutout.id}</span>
                  <Button onClick={() => setCutouts(
                    panel.id,
                    panelCutouts.filter((c) => c.id !== cutout.id),
                    `remove:${cutout.id}`,
                  )}>
                    ✕
                  </Button>
                </div>
                <div className="mt-1 grid grid-cols-2 gap-1">
                  <Field label="X" hint={tr('от угла')}>
                    <NumberInput
                      value={cutout.x} min={0} max={5000}
                      onChange={(x) => setCutouts(
                        panel.id,
                        panelCutouts.map((c, k) => (k === i ? { ...c, x } : c)),
                        `x:${cutout.id}`,
                      )}
                    />
                  </Field>
                  <Field label="Y" hint={tr('от угла')}>
                    <NumberInput
                      value={cutout.y} min={0} max={5000}
                      onChange={(y) => setCutouts(
                        panel.id,
                        panelCutouts.map((c, k) => (k === i ? { ...c, y } : c)),
                        `y:${cutout.id}`,
                      )}
                    />
                  </Field>
                  <Field label={tr('Угол')}>
                    <Select
                      value={cutout.corner}
                      onChange={(corner) => setCutouts(
                        panel.id,
                        panelCutouts.map((c, k) => (k === i ? { ...c, corner } : c)),
                        `corner:${cutout.id}`,
                      )}
                      options={[
                        { value: 'bottomLeft' as const, label: tr('Слева снизу') },
                        { value: 'bottomRight' as const, label: tr('Справа снизу') },
                        { value: 'topLeft' as const, label: tr('Слева сверху') },
                        { value: 'topRight' as const, label: tr('Справа сверху') },
                      ]}
                    />
                  </Field>
                  {cutout.shape === 'circle' ? (
                    <Field label="Ø" hint="мм">
                      <NumberInput
                        value={cutout.diameter} min={5} max={2000}
                        onChange={(diameter) => setCutouts(
                          panel.id,
                          panelCutouts.map((c, k) => (k === i ? { ...c, diameter } : c)),
                          `d:${cutout.id}`,
                        )}
                      />
                    </Field>
                  ) : (
                    <>
                      <Field label={tr('Ширина')} hint="мм">
                        <NumberInput
                          value={cutout.width} min={5} max={4000}
                          onChange={(width) => setCutouts(
                            panel.id,
                            panelCutouts.map((c, k) => (k === i ? { ...c, width } : c)),
                            `w:${cutout.id}`,
                          )}
                        />
                      </Field>
                      <Field label={tr('Высота')} hint="мм">
                        <NumberInput
                          value={cutout.height} min={5} max={4000}
                          onChange={(height) => setCutouts(
                            panel.id,
                            panelCutouts.map((c, k) => (k === i ? { ...c, height } : c)),
                            `h:${cutout.id}`,
                          )}
                        />
                      </Field>
                    </>
                  )}
                </div>
              </div>
            ))}

            {/* Текстура мен бұрыштар — сол детальдің қасиеті, сондықтан
                оймамен бір жерде тұр. */}
            <div className="grid grid-cols-2 gap-2 border-t border-neutral-200 pt-2 dark:border-neutral-800">
              <Field label={tr('Текстура')} hint={tr('раскрой учитывает')}>
                <Select
                  value={cabinet?.panelGrain?.[panel.id] ?? (panel.grainAlongLength ? 'length' : 'width')}
                  onChange={(direction) => boardNode
                    ? editBoard(boardNode.id, { grainAlongLength: direction === 'length' })
                    : edit(`grain:${panel.id}`, { panelGrain: { ...cabinet?.panelGrain, [panel.id]: direction } })}
                  options={[
                    { value: 'length' as const, label: tr('Вдоль длины') },
                    { value: 'width' as const, label: tr('Поперёк длины') },
                  ]}
                />
              </Field>
            </div>

            {/* Бұрыштар — ӘРҚАЙСЫСЫ бөлек. Столешницада көбіне тек алдыңғы екеуі
                дөңгелектеледі, ал төртеуін бірге қою оны бермейді. Реті —
                сызбадағыдай: жоғарғы қатар үстінде. */}
            <div className="border-t border-neutral-200 pt-2 dark:border-neutral-800">
              <div className="mb-1 text-xs text-neutral-500">{tr('Скругление углов, R мм')}</div>
              <div className="grid grid-cols-2 gap-2">
                {([
                  ['topLeft', 'Верхний левый'],
                  ['topRight', 'Верхний правый'],
                  ['bottomLeft', 'Нижний левый'],
                  ['bottomRight', 'Нижний правый'],
                ] as const).map(([corner, label]) => (
                  <Field key={corner} label={tr(label)}>
                    <NumberInput
                      value={panel.corners?.[corner] ?? 0}
                      min={0}
                      max={Math.floor(Math.min(panel.finishedLength, panel.finishedWidth) / 2)}
                      onChange={(r) => {
                        const current = (boardNode ? boardNode.board.corners : cabinet?.panelCorners?.[panel.id])
                          ?? { bottomLeft: 0, bottomRight: 0, topRight: 0, topLeft: 0 }
                        if (boardNode) editBoard(boardNode.id, { corners: { ...current, [corner]: r } })
                        else edit(`corners:${panel.id}:${corner}`, {
                          panelCorners: { ...cabinet?.panelCorners, [panel.id]: { ...current, [corner]: r } },
                        })
                      }}
                    />
                  </Field>
                ))}
              </div>
            </div>

            {/* Ескертулер — ҚАТЕ емес: цех әдейі солай жасауы мүмкін. */}
            {warnings.length > 0 ? (
              <ul className="space-y-0.5 rounded-md border border-amber-300 bg-amber-50 p-1.5 text-[10px] text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
                {warnings.map((w) => <li key={w.cutoutId + w.message}>{w.message}</li>)}
              </ul>
            ) : null}
          </div>

          <div className="space-y-1 border-t border-neutral-200 pt-2 dark:border-neutral-800">
            {[...new Set(panel.drilling.map((d) => d.purpose))].map((purpose) => (
              <div key={purpose} className="flex items-center gap-1.5 text-[10px] text-neutral-500">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: PURPOSE_COLOR[purpose] }}
                />
                {PURPOSE_NAME[purpose]}
              </div>
            ))}
          </div>
        </aside>

        <div className="space-y-1">
          <svg
            viewBox={`0 0 ${viewW} ${viewH}`}
            width="100%"
            style={{ maxWidth: VIEW_PX, height: viewH * scale }}
            className="rounded border border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-950"
            onClick={onClick}
            onMouseMove={(e) => setCursor(toMm(e))}
            onMouseLeave={() => setCursor(null)}
            role="img"
            aria-label={tr('Развёртка детали')}
          >
            {/* Детальдің өзі мен төрт торцы: жайма. y төмен қарай өсетіндіктен,
                бүкіл сурет бір рет аударылады. */}
            <g transform={`translate(${pad + t}, ${pad + t + W}) scale(1, -1)`}>
              <rect x={0} y={-t} width={L} height={t} fill="#e2e8f0" stroke="#94a3b8" strokeWidth={1} />
              <rect x={0} y={W} width={L} height={t} fill="#e2e8f0" stroke="#94a3b8" strokeWidth={1} />
              <rect x={-t} y={0} width={t} height={W} fill="#e2e8f0" stroke="#94a3b8" strokeWidth={1} />
              <rect x={L} y={0} width={t} height={W} fill="#e2e8f0" stroke="#94a3b8" strokeWidth={1} />
              <rect x={0} y={0} width={L} height={W} fill="#f8fafc" stroke="#334155" strokeWidth={2} />

              {/* Оймалар — тесіктерден БҰРЫН салынады: тесік олардың үстінде
                  көрінуі керек. */}
              {panelCutouts.map((cutout) => {
                const b = cutoutBounds(cutout, panel.cutLength, panel.cutWidth)
                return cutout.shape === 'circle' ? (
                  <circle
                    key={cutout.id}
                    cx={b.x + b.width / 2} cy={b.y + b.height / 2} r={cutout.diameter / 2}
                    fill="#f8fafc" stroke="#7c3aed" strokeWidth={3} strokeDasharray="10 6"
                  />
                ) : (
                  <rect
                    key={cutout.id}
                    x={b.x} y={b.y} width={b.width} height={b.height}
                    fill="#f8fafc" stroke="#7c3aed" strokeWidth={3} strokeDasharray="10 6"
                  />
                )
              })}

              {drills.map(({ drill, key, manual }) => {
                const at = place(drill, L, W)
                const r = Math.max(drill.diameter / 2, Math.min(L, W) * 0.006)
                const color = PURPOSE_COLOR[drill.purpose]
                const isSelected = key === selected
                return (
                  <g key={key} onClick={(e) => { e.stopPropagation(); setSelected(key) }} style={{ cursor: 'pointer' }}>
                    <circle
                      cx={at.x} cy={at.y} r={r}
                      fill={drill.face === 'outer' ? 'none' : color}
                      fillOpacity={drill.face === 'outer' ? 0 : 0.85}
                      stroke={color}
                      strokeWidth={Math.max(1, r * 0.35)}
                    />
                    {manual ? (
                      <circle cx={at.x} cy={at.y} r={r * 2.1} fill="none" stroke={color} strokeWidth={1} strokeDasharray="4 3" />
                    ) : null}
                    {isSelected ? (
                      <circle cx={at.x} cy={at.y} r={r * 3} fill="none" stroke="#111827" strokeWidth={1.5} />
                    ) : null}
                  </g>
                )
              })}
            </g>

            {/* Қырлардың аттары — жайманы оқу үшін. */}
            <text x={pad + t + L / 2} y={viewH - pad / 2} textAnchor="middle" fontSize={Math.max(10, viewW * 0.015)} fill="#64748b">L1</text>
            <text x={pad + t + L / 2} y={pad / 2 + 4} textAnchor="middle" fontSize={Math.max(10, viewW * 0.015)} fill="#64748b">L2</text>
            <text x={pad / 2} y={pad + t + W / 2} textAnchor="middle" fontSize={Math.max(10, viewW * 0.015)} fill="#64748b">W1</text>
            <text x={viewW - pad / 2} y={pad + t + W / 2} textAnchor="middle" fontSize={Math.max(10, viewW * 0.015)} fill="#64748b">W2</text>
          </svg>

          <div className="flex flex-wrap items-center gap-3 text-[11px] text-neutral-500">
            <span>
              {panel.label} · {tr('рез')} {panel.cutLength} × {panel.cutWidth} · {material.thickness} {tr('мм')}
            </span>
            <span className="tabular-nums">
              {cursor ? `${Math.round(cursor.x)} × ${Math.round(cursor.y)} ${tr('мм')}` : '—'}
            </span>
            <span>
              {tr('отверстий')}: <b className="tabular-nums">{drills.length}</b>
              {filter !== 'all' ? ` ${tr('из')} ${panel.drilling.length}` : ''}
            </span>
          </div>
        </div>
      </div>
    </Shell>
  )
}

function SelectedInfo({ panel, keyOf }: { panel: Panel; keyOf: string }) {
  const drill = panel.drilling.find((d) => drillKey(d) === keyOf)
  if (!drill) return null
  return (
    <div className="rounded-md border border-neutral-200 px-2 py-1.5 text-[11px] dark:border-neutral-700">
      <div className="font-medium">{PURPOSE_NAME[drill.purpose]}</div>
      <div className="text-neutral-500 tabular-nums">
        Ø{drill.diameter} × {drill.depth} · {drill.face} · {drill.x} × {drill.y} {tr('мм')}
      </div>
    </div>
  )
}

function Shell({ children, onClose, zIndex }: { children: React.ReactNode; onClose: () => void; zIndex: number }) {
  const dialogRef = useRef<HTMLDivElement>(null)
  useEffect(() => { dialogRef.current?.focus() }, [])
  return (
    <div
      className="fixed inset-0 flex items-start justify-center overflow-auto bg-black/40 p-4"
      style={{ zIndex }}
      onClick={onClose}
    >
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={tr('Присадка')}
        className={cn(
          'w-full max-w-5xl rounded-xl border border-neutral-200 bg-white p-4',
          'dark:border-neutral-700 dark:bg-neutral-900',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
