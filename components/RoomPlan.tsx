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
import {
  WALL_LABELS,
  canMirror,
  placementCorners,
  roomWalls,
  validatePlacements,
  wallById,
} from '@/src/core/index'
import type { CabinetConfig, Placement, Room, WallId } from '@/src/core/index'
import { activeCabinet, useConfigurator } from '@/store/configurator'
import { Button, Field, NumberInput, SectionTitle } from '@/components/ui'
import { cn } from '@/lib/cn'

/** Жоспардың ең үлкен қабырғасы экранда осынша пиксель болады. */
const PLAN_PX = 420
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
  const room = useConfigurator((s) => s.room)
  const cabinets = useConfigurator((s) => s.cabinets)
  const placements = useConfigurator((s) => s.placements)
  const activeId = useConfigurator((s) => s.activeId)
  const selectedWall = useConfigurator((s) => s.selectedWall)
  const active = useConfigurator(activeCabinet)

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
  const issueFor = (id: string) => issues.filter((i) => i.cabinetId === id)

  const activePlacement: Placement =
    entries.find((e) => e.cabinet.id === activeId)?.placement ??
    { cabinetId: activeId, wall: 'south', offset: 0 }

  if (!open) return null

  const scale = PLAN_PX / Math.max(room.width, room.depth)

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/40 p-4 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-4xl rounded-xl border border-neutral-200 bg-white p-4 shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-sm font-semibold">{tr('Комната')}</h2>
          <span className="text-[11px] text-neutral-400">
            выберите стену, поставьте на неё корпус
          </span>
          <div className="ml-auto">
            <Button onClick={() => setOpen(false)}>{tr('Закрыть')}</Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[auto_minmax(0,1fr)]">
          <PlanSvg
            room={room}
            scale={scale}
            entries={entries}
            activeId={activeId}
            selectedWall={selectedWall}
            onWall={setSelectedWall}
            onCabinet={setActive}
            onMove={(id, offset) => movePlacement(id, { offset })}
          />

          <div className="space-y-3">
            <SectionTitle>{tr('Размеры комнаты, мм')}</SectionTitle>
            <div className="grid grid-cols-3 gap-2">
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
            </div>

            <SectionTitle>{tr('Стена')}</SectionTitle>
            <div className="flex flex-wrap gap-1">
              {roomWalls(room).map((w) => (
                <Button key={w.id} active={selectedWall === w.id} onClick={() => setSelectedWall(w.id)}>
                  {w.label} · {w.length}
                </Button>
              ))}
            </div>

            <SectionTitle>{tr('Текущий корпус')}</SectionTitle>
            <div className="grid grid-cols-2 gap-2">
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
            </div>

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
                        disabled={!canMirror(cabinet).ok}
                        onClick={() => mirrorCabinet(cabinet.id)}
                      >
                        ⇄
                      </Button>
                      <Button onClick={() => removeCabinet(cabinet.id)} disabled={cabinets.length <= 1}>✕</Button>
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

function PlanSvg({
  room, scale, entries, activeId, selectedWall, onWall, onCabinet, onMove,
}: {
  room: Room
  scale: number
  entries: { cabinet: CabinetConfig; placement: Placement }[]
  activeId: string
  selectedWall: WallId
  onWall: (w: WallId) => void
  onCabinet: (id: string) => void
  onMove: (id: string, offset: number) => void
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
  const drag = useRef<{ id: string; wall: WallId; startX: number; startY: number; startOffset: number } | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  useEffect(() => {
    if (!dragging) return
    const move = (e: PointerEvent) => {
      const d = drag.current
      if (!d) return
      const wall = walls.find((w) => w.id === d.wall)
      if (!wall) return
      const dxMm = (e.clientX - d.startX) / scale
      const dzMm = (e.clientY - d.startY) / scale
      const along = dxMm * wall.direction.x + dzMm * wall.direction.z
      const cab = entries.find((en) => en.cabinet.id === d.id)?.cabinet
      const max = Math.max(0, wall.length - (cab?.width ?? 0))
      onMove(d.id, Math.round(Math.min(max, Math.max(0, d.startOffset + along))))
    }
    const up = () => { drag.current = null; setDragging(null) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
  }, [dragging, walls, scale, entries, onMove])

  return (
    <svg
      viewBox={`${-pad} ${-pad} ${room.width + pad * 2} ${room.depth + pad * 2}`}
      width={(room.width + pad * 2) * scale}
      height={(room.depth + pad * 2) * scale}
      className="shrink-0 rounded-lg bg-neutral-50 dark:bg-neutral-950"
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
    </svg>
  )
}
