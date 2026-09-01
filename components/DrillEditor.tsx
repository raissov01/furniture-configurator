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
 * қайта есептеледі (§7). Түзету `cabinet.drillEdits` ішінде, панель id-і
 * бойынша жатады да, генерацияның соңында үстіне жабылады. Сондықтан
 * қолмен қойылған тесік 3D-де де, DXF-те де, сметада да бірдей көрінеді.
 */

import { t as tr } from '@/lib/i18n'
import { useEffect, useMemo, useState } from 'react'
import { Button, Field, Select } from '@/components/ui'
import { cn } from '@/lib/cn'
import {
  DRILL_PRESETS,
  addDrill,
  drillEditCounts,
  drillKey,
  drillFromPreset,
  findDrillPreset,
  isManualDrill,
  removeDrill,
  resetPanelDrills,
  snapToPitch,
} from '@/src/core/index'
import type { Catalog, Drill, DrillEdits, Panel } from '@/src/core/index'
import { activeCabinet, useConfigurator } from '@/store/configurator'

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
}

const PURPOSE_NAME: Record<Drill['purpose'], string> = {
  confirmat: 'Конфирмат',
  dowel: 'Шкант',
  minifix: 'Минификс',
  shelfPin: 'Полкодержатель',
  hinge: 'Петля',
  runner: 'Направляющая',
  handle: 'Ручка',
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

export function DrillEditor({ panels, catalog }: { panels: Panel[]; catalog: Catalog }) {
  const open = useConfigurator((s) => s.drillOpen)
  const setOpen = useConfigurator((s) => s.setDrillOpen)
  const cabinet = useConfigurator(activeCabinet)
  const edit = useConfigurator((s) => s.edit)

  const [panelId, setPanelId] = useState<string | null>(null)
  const [presetId, setPresetId] = useState(DRILL_PRESETS[0]!.id)
  const [filter, setFilter] = useState<Filter>('all')
  const [side, setSide] = useState<'inner' | 'outer'>('inner')
  const [snap, setSnap] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null)

  const edits: DrillEdits = cabinet.drillEdits ?? {}
  const panel = panels.find((p) => p.id === panelId) ?? panels[0]
  const preset = findDrillPreset(presetId)!

  const setEdits = (next: DrillEdits, key: string) => edit(`drill:${key}`, { drillEdits: next })

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
      if (!open) return
      if (e.key === 'Escape') setOpen(false)
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected !== null && panel) {
        const found = panel.drilling.find((d) => drillKey(d) === selected)
        if (!found) return
        e.preventDefault()
        setEdits(
          removeDrill(edits, panel.id, found, { manual: isManualDrill(found, edits[panel.id]) }),
          `remove:${selected}`,
        )
        setSelected(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!open) return null
  if (!panel || !material) {
    return (
      <Shell onClose={() => setOpen(false)}>
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
    // Пресет пен бет сәйкес келмесе, ҮНСІЗ басқа тесік қоймаймыз.
    if (onEdge !== (preset.where === 'edge')) return

    // Торцта тесік ӘРҚАШАН қалыңдықтың ортасында: станок басқаша бұрғыламайды.
    const x = snap && !onEdge ? snapToPitch(spot.x) : spot.x
    const y = onEdge ? t / 2 : snap ? snapToPitch(spot.y) : spot.y
    const drill = drillFromPreset(preset, spot.face, x, y, t)
    setEdits(addDrill(edits, panel.id, drill), `add:${drillKey(drill)}`)
    setSelected(drillKey(drill))
  }

  return (
    <Shell onClose={() => setOpen(false)}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="mr-1 text-sm font-semibold">{tr('Присадка вручную')}</h2>
        <span className="text-[11px] text-neutral-500">
          {tr('добавлено')}: <b className="tabular-nums">{counts.added}</b> · {tr('удалено')}:{' '}
          <b className="tabular-nums">{counts.removed}</b>
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Button
            disabled={!panelEdit}
            title={tr('Вернуть автоматическую присадку этой детали')}
            onClick={() => {
              setEdits(resetPanelDrills(edits, panel.id), `reset:${panel.id}`)
              setSelected(null)
            }}
          >
            {tr('Вернуть авто')}
          </Button>
          <Button onClick={() => setOpen(false)}>{tr('Закрыть')}</Button>
        </div>
      </div>

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
              onChange={setPresetId}
              options={DRILL_PRESETS.map((p) => ({ value: p.id, label: p.name }))}
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

function Shell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={cn(
          'w-full max-w-5xl rounded-xl border border-neutral-200 bg-white p-4 shadow-xl',
          'dark:border-neutral-700 dark:bg-neutral-900',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
