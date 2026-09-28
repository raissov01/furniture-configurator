'use client'

/**
 * Бөлме жоспары (C фаза): жоғарыдан қараған көрініс. Қабырғаны таңдайсың,
 * шкафты сол қабырға бойымен жылжытасың, жаңасын қосасың.
 *
 * Мұнда координата ЕСЕПТЕЛМЕЙДІ — орын да, төртбұрыш та ядродан келеді
 * (`placementCorners`), сондықтан жоспар мен 3D ешқашан алшақтамайды.
 */

import { t as tr } from '@/lib/i18n'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useModalLayer } from '@/lib/useModalLayer'
import {
  DEFAULT_WALL_COLOR,
  FLOOR_KINDS,
  WALL_COLORS,
  WALL_LABELS,
  canMirror,
  placementCorners,
  roomWalls,
  validatePlacements,
  validateOpenings,
  wallById,
  visibleAnnotations,
} from '@/src/core/index'
import type { CabinetConfig, Placement, Room, RoomFinish, RoomOpening, WallId } from '@/src/core/index'
import { useConfigurator } from '@/store/configurator'
import { wallAttachedPlacements } from '@/store/treeAdapters'
import { assertTreeNodeEditable } from '@/src/core/treeEditing'
import { ConfigValidationError } from '@/src/core/errors'
import { Button, Field, NumberInput, SectionTitle, Select } from '@/components/ui'
import { cn } from '@/lib/cn'
import { isCeilingIssue } from '@/lib/roomElevationUi'
import { planDragOffset } from '@/lib/roomPlanDrag'
import { nextOpening, updateOpening } from '@/lib/roomOpeningsUi'

/** Қабырға сызығының қалыңдығы, мм (шартты — тек көрініс үшін). */
const WALL_MM = 60

/** Айна неге сөндірулі — батырманың `title`-інде тұрады. */
function mirrorReason(cabinet: CabinetConfig): string {
  const check = canMirror(cabinet)
  return check.ok ? '' : check.reason
}

export function RoomPlan() {
  const open = useConfigurator((s) => s.roomOpen)
  const setOpen = useConfigurator((s) => s.setRoomOpen)
  const { zIndex, isTop } = useModalLayer(open, 'room', () => setOpen(false))


  const room = useConfigurator((s) => s.room)
  const cabinets = useConfigurator((s) => s.cabinets)
  const root = useConfigurator((s) => s.root)
  const layers = useConfigurator((s) => s.layers)
  const annotations = useMemo(() => visibleAnnotations(root, layers), [root, layers])
  const placements = useConfigurator((s) => s.placements)
  const activeId = useConfigurator((s) => s.activeId)
  const selectedWall = useConfigurator((s) => s.selectedWall)
  const active = cabinets.find((cabinet) => cabinet.id === activeId)
  const editableIds = useMemo(() => new Set(cabinets.flatMap((cabinet) => {
    try {
      assertTreeNodeEditable(root, cabinet.id, layers)
      return [cabinet.id]
    } catch (error) {
      if (!(error instanceof ConfigValidationError)) throw error
      return []
    }
  })), [root, layers, cabinets])
  // Қабырға бойымен тек қабырғаға дәл тірелген шкаф жылжиды: еркін шкафтың
  // placement-і жуықтау, оны өзгерту шкафты қабырғаға секіртеді.
  const movableIds = useMemo(() => new Set(wallAttachedPlacements(root, room)
    .map((placement) => placement.cabinetId).filter((id) => editableIds.has(id))), [root, room, editableIds])

  const editRoom = useConfigurator((s) => s.editRoom)
  const setSelectedWall = useConfigurator((s) => s.setSelectedWall)
  const setActive = useConfigurator((s) => s.setActive)
  const addCabinet = useConfigurator((s) => s.addCabinet)
  const removeCabinet = useConfigurator((s) => s.removeCabinet)
  const duplicateCabinet = useConfigurator((s) => s.duplicateCabinet)
  const mirrorCabinet = useConfigurator((s) => s.mirrorCabinet)
  const movePlacement = useConfigurator((s) => s.movePlacement)

  const entries = useMemo(
    () =>
      cabinets.map((c) => ({
        cabinet: c,
        placement: placements.find((p) => p.cabinetId === c.id) ?? {
          cabinetId: c.id, wall: 'south' as WallId, offset: 0,
        },
      })),
    [cabinets, placements],
  )

  const issues = useMemo(() => validatePlacements(room, entries), [room, entries])
  const openingIssues = useMemo(() => validateOpenings(room), [room])
  const issueFor = (id: string) => issues.filter((i) => i.cabinetId === id)
  const dialogRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialogRef.current?.focus()
    return () => { trigger?.focus() }
  }, [open, setOpen])

  const activePlacement: Placement =
    entries.find((e) => e.cabinet.id === activeId)?.placement ??
    { cabinetId: activeId, wall: 'south', offset: 0 }

  if (!open) return null

  return (
    <div
      style={{ zIndex }}
      className="fixed inset-0 flex items-start justify-center overflow-auto bg-black/40 p-2 sm:p-4"
      onClick={() => { if (isTop) setOpen(false) }}


    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="room-plan-title"
        tabIndex={-1}
        className="min-w-0 max-h-[calc(100dvh-1rem)] w-full max-w-4xl overflow-y-auto rounded-xl border border-neutral-200 bg-white p-3 outline-none sm:max-h-[calc(100dvh-2rem)] dark:border-neutral-700 dark:bg-neutral-900 sm:p-4"


        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 id="room-plan-title" className="text-sm font-semibold">{tr('Комната')}</h2>
          <span className="hidden text-[11px] text-neutral-400 sm:inline">
            выберите стену, поставьте на неё корпус
          </span>
          <div className="ml-auto">
            <Button onClick={() => setOpen(false)}>{tr('Закрыть')}</Button>
          </div>
        </div>

        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          <PlanSvg
            room={room}
            entries={entries}
            activeId={activeId}
            selectedWall={selectedWall}
            onWall={setSelectedWall}
            onCabinet={setActive}
            onMove={(id, offset) => { if (movableIds.has(id)) movePlacement(id, { offset }) }}
            annotations={annotations}
          />

          <div className="min-w-0 space-y-3">
            <SectionTitle>{tr('Размеры комнаты, мм')}</SectionTitle>
            <fieldset className="grid grid-cols-1 gap-2 min-[460px]:grid-cols-3">
              <Field label={tr('Ширина')}>
                <NumberInput value={room.width} min={500} max={20000} step={50}
                  onChange={(width) => editRoom({ width })} />
              </Field>
              <Field label={tr('Глубина')}>
                <NumberInput value={room.depth} min={500} max={20000} step={50}
                  onChange={(depth) => editRoom({ depth })} />
              </Field>
              <Field label={tr('Высота')}>
                <NumberInput value={room.height} min={2000} max={4000} step={50}
                  onChange={(height) => editRoom({ height })} />
              </Field>
            </fieldset>

            <SectionTitle>{tr('Отделка')}</SectionTitle>
            <fieldset>
              <FinishEditor room={room} onChange={(finish) => editRoom({ finish })} />
            </fieldset>

            <SectionTitle>{tr('Проёмы')}</SectionTitle>
            <OpeningEditor room={room} issues={openingIssues} onChange={(openings) => editRoom({ openings })} />

            <SectionTitle>{tr('Стена')}</SectionTitle>
            <div className="flex flex-wrap gap-1">
              {roomWalls(room).map((w) => (
                <Button key={w.id} active={selectedWall === w.id} onClick={() => setSelectedWall(w.id)}>
                  {w.label} · {w.length}
                </Button>
              ))}
            </div>

            {active ? <><SectionTitle>{tr('Текущий корпус')}</SectionTitle>
            <fieldset disabled={!movableIds.has(active.id)} className="grid grid-cols-2 gap-2">
              <Field label={tr('Стена')}>
                <select
                  className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                  value={activePlacement.wall}
                  onChange={(e) => movePlacement(activeId, { wall: e.target.value as WallId })}
                >
                  {roomWalls(room).map((w) => (
                    <option key={w.id} value={w.id}>{w.label}</option>
                  ))}
                </select>
              </Field>
              <Field
                label={tr('Смещение')}
                hint={`0..${Math.max(0, wallById(room, activePlacement.wall).length - active.width)}`}
              >
                <NumberInput
                  value={activePlacement.offset}
                  min={0}
                  step={10}
                  onChange={(offset) => movePlacement(activeId, { offset })}
                />
              </Field>
              {/* Ілмелі модуль: ас үйдің үстіңгі қатары, ванна шкафы, ілмелі
                  тумба. Корпустың есебі бұдан өзгермейді — тек орны. */}
              <Field label={tr('От пола')} hint="мм">
                <NumberInput
                  value={activePlacement.elevation ?? 0}
                  min={0}
                  max={4000}
                  step={10}
                  invalid={isCeilingIssue(issues, active.id)}
                  onChange={(elevation) => movePlacement(activeId, { elevation })}
                />
              </Field>
              {/* Бұрыштық ас үйдің 45°-тық модулі, қиғаш қабырғаға тірелген
                  шкаф. Корпустың есебі бұдан да өзгермейді. */}
              <Field label={tr('Поворот')} hint="°">
                <NumberInput
                  value={activePlacement.rotate ?? 0}
                  min={-180}
                  max={180}
                  step={5}
                  onChange={(rotate) => movePlacement(activeId, { rotate })}
                />
              </Field>
            </fieldset></> : null}

            <div className="flex items-center justify-between">
              <SectionTitle>{tr('Корпуса')} ({cabinets.length})</SectionTitle>
              <Button onClick={addCabinet}>{tr('+ корпус')}</Button>
            </div>
            <ul className="space-y-1">
              {entries.map(({ cabinet, placement }) => {
                const bad = issueFor(cabinet.id)
                return (
                  <li key={cabinet.id}>
                    <div
                      className={cn(
                        'flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs',
                        cabinet.id === activeId
                          ? 'border-neutral-900 dark:border-neutral-100'
                          : 'border-neutral-200 dark:border-neutral-700',
                        bad.length > 0 && 'border-red-400 dark:border-red-500',
                      )}
                    >
                      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setActive(cabinet.id)}>
                        <span className="font-medium">{cabinet.name}</span>
                        <span className="ml-2 tabular-nums text-neutral-500">
                          {WALL_LABELS[placement.wall]} · {placement.offset} мм · {cabinet.width} (W)
                        </span>
                      </button>
                      <Button
                        title={tr('Копия корпуса')}
                        disabled={!editableIds.has(cabinet.id)}
                        onClick={() => duplicateCabinet(cabinet.id)}
                      >
                        ⧉
                      </Button>
                      {/*
                        Айна: бұрыштық корпуста СӨНДІРУЛІ — себебі
                        `canMirror`-да жазылған, ал title соны айтады.
                      */}
                      <Button
                        title={canMirror(cabinet).ok ? tr('Зеркальный корпус') : mirrorReason(cabinet)}
                        disabled={!canMirror(cabinet).ok || !editableIds.has(cabinet.id)}
                        onClick={() => mirrorCabinet(cabinet.id)}
                      >
                        ⇄
                      </Button>
                      <Button onClick={() => removeCabinet(cabinet.id)} disabled={cabinets.length <= 1 || !editableIds.has(cabinet.id)}>✕</Button>
                    </div>
                    {bad.map((i, k) => (
                      <p key={k} className="mt-0.5 pl-2 text-[11px] text-red-600 dark:text-red-400">{i.message}</p>
                    ))}
                  </li>
                )
              })}
            </ul>
          </div>
        </div>

        <p className="mt-3 text-[11px] text-neutral-400">
          {tr('Перетащите корпус на плане, чтобы подвинуть вдоль стены. Кружок — точка отсчёта. Редактор и экспорт — по выбранному корпусу.')}
        </p>
      </div>
    </div>
  )
}

/** Қабырғаның түсі мен еден — тек 3D-дегі көрініс, есепке әсері жоқ. */
function FinishEditor({ room, onChange }: { room: Room; onChange: (finish: RoomFinish) => void }) {
  const finish = room.finish ?? {}
  const wallColor = finish.wallColor ?? DEFAULT_WALL_COLOR
  return (
    <div className="grid grid-cols-2 gap-2">
      <Field label={tr('Цвет стен')}>
        <div className="flex flex-wrap items-center gap-1 pt-1">
          {WALL_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              title={c}
              aria-label={c}
              onClick={() => onChange({ ...finish, wallColor: c })}
              className={cn(
                'h-6 w-6 rounded border',
                c === wallColor
                  ? 'border-neutral-900 ring-1 ring-neutral-900 dark:border-neutral-100 dark:ring-neutral-100'
                  : 'border-neutral-300 dark:border-neutral-600',
              )}
              style={{ backgroundColor: c }}
            />
          ))}
          <input
            type="color"
            value={wallColor}
            onChange={(e) => onChange({ ...finish, wallColor: e.target.value })}
            className="h-6 w-8 cursor-pointer rounded border border-neutral-300 bg-transparent p-0 dark:border-neutral-600"
            aria-label={tr('Свой цвет')}
          />
        </div>
      </Field>
      <Field label={tr('Пол')}>
        <Select
          value={finish.floor ?? 'oak'}
          onChange={(floor) => onChange({ ...finish, floor })}
          options={FLOOR_KINDS.map((f) => ({ value: f.value, label: tr(f.label) }))}
        />
      </Field>
    </div>
  )
}

function OpeningEditor({ room, issues, onChange }: {
  room: Room
  issues: ReturnType<typeof validateOpenings>
  onChange: (openings: RoomOpening[]) => void
}) {
  const openings = room.openings ?? []
  const patch = (id: string, change: Partial<RoomOpening>) => onChange(updateOpening(openings, id, change))
  return (
    <div className="space-y-2">
      {openings.map((opening) => {
        const wallLength = wallById(room, opening.wall).length
        const bad = issues.filter((issue) => issue.openingId === opening.id)
        return (
          <div key={opening.id} className={cn('min-w-0 rounded-md border border-neutral-200 p-2 dark:border-neutral-700', bad.length > 0 && 'border-red-500 dark:border-red-500')}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <strong className="text-xs">{tr(opening.kind === 'window' ? 'Окно' : 'Дверь')}</strong>
              <Button onClick={() => onChange(openings.filter((item) => item.id !== opening.id))}>{tr('Удалить')}</Button>
            </div>
            <div className="grid min-w-0 grid-cols-1 gap-2 min-[460px]:grid-cols-2">
              <Field label={tr('Стена')}>
                <Select value={opening.wall} onChange={(wall) => patch(opening.id, { wall })}
                  options={roomWalls(room).map((wall) => ({ value: wall.id, label: tr(wall.label) }))} />
              </Field>
              <Field label={tr('Положение проёма')} hint={`0..${Math.max(0, wallLength - opening.width)} мм`}>
                <NumberInput value={opening.offset} min={0} max={Math.max(0, wallLength - opening.width)}
                  label={tr('Положение проёма')} onChange={(offset) => patch(opening.id, { offset })} />
              </Field>
              <Field label={tr('Ширина проёма')} hint={`1..${wallLength} мм`}>
                <NumberInput value={opening.width} min={1} max={wallLength}
                  onChange={(width) => patch(opening.id, { width })} />
              </Field>
              <Field label={tr('Высота проёма')} hint={`1..${room.height} мм`}>
                <NumberInput value={opening.height} min={1} max={room.height}
                  onChange={(height) => patch(opening.id, { height })} />
              </Field>
              <Field label={tr('От пола проёма')} hint={`0..${room.height} мм`}>
                <NumberInput value={opening.elevation} min={0} max={room.height}
                  onChange={(elevation) => patch(opening.id, { elevation })} />
              </Field>
            </div>
            {bad.map((issue, index) => <p role="alert" key={index} className="mt-1 text-[11px] text-red-700 dark:text-red-400">{issue.message}</p>)}
          </div>
        )
      })}
      <div className="flex flex-wrap gap-2">
        <Button disabled={openings.length >= 20} onClick={() => onChange([...openings, nextOpening(room, openings, 'window')])}>{tr('+ окно')}</Button>
        <Button disabled={openings.length >= 20} onClick={() => onChange([...openings, nextOpening(room, openings, 'door')])}>{tr('+ дверь')}</Button>
      </div>
    </div>
  )
}

function PlanSvg({
  room, entries, activeId, selectedWall, onWall, onCabinet, onMove, annotations,
}: {
  room: Room
  entries: { cabinet: CabinetConfig; placement: Placement }[]
  activeId: string
  selectedWall: WallId
  onWall: (w: WallId) => void
  onCabinet: (id: string) => void
  onMove: (id: string, offset: number) => void
  annotations: ReturnType<typeof visibleAnnotations>
}) {
  const walls = roomWalls(room)
  const pad = WALL_MM * 2

  /*
   * СҮЙРЕП ЖЫЛЖЫТУ (шетелдік конфигуратордың ыңғайы). Корпусты басып
   * тартқанда ол ӨЗ ҚАБЫРҒАСЫ бойымен жылжиды: экран пикселін мм-ге
   * (÷scale) айналдырып, қабырға бағытына проекциялаймыз. Offset [0,
   * қабырға−ені] аралығында қыселінеді. Дәлдік керек болса — оң жақтағы сан
   * қалады.
   */
  const drag = useRef<{ id: string; wall: WallId; startX: number; startY: number; startOffset: number; pxPerMm: number } | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  useEffect(() => {
    if (!dragging) return
    const move = (e: PointerEvent) => {
      const d = drag.current
      if (!d) return
      const wall = walls.find((w) => w.id === d.wall)
      if (!wall) return
      const alongPx = (e.clientX - d.startX) * wall.direction.x + (e.clientY - d.startY) * wall.direction.z
      const cab = entries.find((en) => en.cabinet.id === d.id)?.cabinet
      const max = Math.max(0, wall.length - (cab?.width ?? 0))
      onMove(d.id, planDragOffset(d.startOffset, alongPx, d.pxPerMm, max))
    }
    const up = () => { drag.current = null; setDragging(null) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
  }, [dragging, walls, entries, onMove])

  return (
    <svg
      viewBox={`${-pad} ${-pad} ${room.width + pad * 2} ${room.depth + pad * 2}`}
      className="block h-auto w-full max-w-[420px] min-w-0 rounded-lg bg-neutral-50 dark:bg-neutral-950"
      style={{ aspectRatio: `${room.width + pad * 2} / ${room.depth + pad * 2}` }}
      role="img"
      aria-label={tr('План комнаты')}
    >
      <rect x={0} y={0} width={room.width} height={room.depth} fill="#ffffff" fillOpacity={0.04} stroke="#94a3b8" strokeWidth={8} />

      {walls.map((w) => {
        // Қабырғаны басу аймағы: жіңішке сызықты дәл басу қиын, сондықтан
        // тіктөртбұрыш етіп кеңейтеміз.
        const horizontal = w.id === 'north' || w.id === 'south'
        const x = horizontal ? 0 : w.id === 'west' ? -WALL_MM : room.width
        const y = horizontal ? (w.id === 'north' ? -WALL_MM : room.depth) : 0
        const width = horizontal ? room.width : WALL_MM
        const height = horizontal ? WALL_MM : room.depth
        const on = selectedWall === w.id
        return (
          <g key={w.id} onClick={() => onWall(w.id)} style={{ cursor: 'pointer' }}>
            <rect x={x} y={y} width={width} height={height} fill={on ? '#0f172a' : '#cbd5e1'} />
            {/* offset = 0 нүктесі */}
            <circle
              cx={w.origin.x + w.inward.x * WALL_MM * 0.5}
              cy={w.origin.z + w.inward.z * WALL_MM * 0.5}
              r={WALL_MM * 0.7}
              fill={on ? '#f59e0b' : '#94a3b8'}
            />
          </g>
        )
      })}

      {entries.map(({ cabinet, placement }) => {
        /*
         * ⚠ Тікбұрыш ЕМЕС, көпбұрыш. Бұрылған шкафтың осьтерге тураланған
         * АЖШ-сы шкафтың өзінен үлкен: оны тікбұрышпен салсақ, жоспарда ол
         * шын орнынан кеңірек көрініп, көршісіне тиіп тұрғандай болар еді.
         */
        const points = placementCorners(room, cabinet, placement)
          .map((p) => `${p.x},${p.z}`).join(' ')
        const on = cabinet.id === activeId
        return (
          <g
            key={cabinet.id}
            onClick={() => onCabinet(cabinet.id)}
            onPointerDown={(e) => {
              onCabinet(cabinet.id)
              drag.current = {
                id: cabinet.id, wall: placement.wall,
                startX: e.clientX, startY: e.clientY, startOffset: placement.offset,
                pxPerMm: (e.currentTarget.ownerSVGElement?.getBoundingClientRect().width ?? 1) / (room.width + pad * 2),
              }
              setDragging(cabinet.id)
            }}
            style={{ cursor: dragging === cabinet.id ? 'grabbing' : 'grab' }}
          >
            <polygon
              points={points}
              fill={on ? '#c9a227' : '#e3c76a'}
              stroke={on ? '#0f172a' : '#7c5f14'}
              strokeWidth={on ? 14 : 6}
            />
          </g>
        )
      })}
      {annotations.map((annotation) => (
        <text key={annotation.nodeId} data-testid="room-plan-annotation" x={annotation.pose.position.x} y={annotation.pose.position.z}
          fontSize={annotation.fontSize} fill={annotation.color} textAnchor="middle"
          transform={`rotate(${-annotation.pose.rotationY} ${annotation.pose.position.x} ${annotation.pose.position.z})`}
          onClick={() => onCabinet(annotation.nodeId)} style={{ cursor: 'pointer' }}>
          {annotation.text}
        </text>
      ))}
    </svg>
  )
}
