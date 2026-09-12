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
  DEFAULT_WALL_COLOR,
  FLOOR_KINDS,
  WALL_COLORS,
  WALL_LABELS,
  canMirror,
  placementCorners,
  roomWalls,
  validateOpenings,
  validatePlacements,
  wallById,
} from '@/src/core/index'
import type { CabinetConfig, Placement, Room, RoomFinish, RoomOpening, WallId } from '@/src/core/index'
import { activeCabinet, useConfigurator } from '@/store/configurator'
import { Button, Field, NumberInput, SectionTitle, Select } from '@/components/ui'
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

            <SectionTitle>{tr('Окна и двери')}</SectionTitle>
            <OpeningsEditor room={room} selectedWall={selectedWall} onChange={(openings) => editRoom({ openings })} />

            <SectionTitle>{tr('Отделка')}</SectionTitle>
            <FinishEditor room={room} onChange={(finish) => editRoom({ finish })} />

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

/**
 * Терезе мен есік. Жаңасы ТАҢДАЛҒАН қабырғаның ортасына қойылады; өлшемдері —
 * ең жиі кездесетіні (есік 800 × 2050, терезе 1200 × 1400, табалдырығы 850).
 * Қате болса (қабырғадан шықты, төбеден биік) — сол ойықтың астында жазылады.
 */
function OpeningsEditor({ room, selectedWall, onChange }: {
  room: Room
  selectedWall: WallId
  onChange: (openings: RoomOpening[]) => void
}) {
  const list = room.openings ?? []
  const issues = validateOpenings(room)
  const select = 'rounded-md border border-neutral-300 bg-white px-1.5 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-900'

  const add = (kind: RoomOpening['kind']) => {
    const wall = wallById(room, selectedWall)
    const width = kind === 'door' ? 800 : 1200
    onChange([...list, {
      id: `${kind}-${Date.now().toString(36)}`,
      kind,
      wall: selectedWall,
      offset: Math.max(0, Math.round((wall.length - width) / 2)),
      width,
      height: kind === 'door' ? 2050 : 1400,
      elevation: kind === 'door' ? 0 : 850,
    }])
  }
  const patch = (id: string, p: Partial<RoomOpening>) => onChange(list.map((o) => (o.id === id ? { ...o, ...p } : o)))

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1">
        <Button onClick={() => add('window')}>{tr('+ окно')}</Button>
        <Button onClick={() => add('door')}>{tr('+ дверь')}</Button>
        <span className="text-[11px] text-neutral-400">{tr('на выбранную стену')}</span>
      </div>
      {list.map((o) => (
        <div key={o.id} className="rounded-md border border-neutral-200 p-2 dark:border-neutral-700">
          <div className="mb-1.5 flex items-center gap-2 text-xs">
            <span className="font-medium">{o.kind === 'door' ? tr('Дверь') : tr('Окно')}</span>
            <select
              className={select}
              value={o.wall}
              onChange={(e) => patch(o.id, { wall: e.target.value as WallId })}
            >
              {roomWalls(room).map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}
            </select>
            <div className="ml-auto">
              <Button onClick={() => onChange(list.filter((x) => x.id !== o.id))}>✕</Button>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <Field label={tr('Смещение')}>
              <NumberInput value={o.offset} min={0} step={10} onChange={(offset) => patch(o.id, { offset })} />
            </Field>
            <Field label={tr('Ширина')}>
              <NumberInput value={o.width} min={300} max={6000} step={10} onChange={(width) => patch(o.id, { width })} />
            </Field>
            <Field label={tr('Высота')}>
              <NumberInput value={o.height} min={300} max={room.height} step={10} onChange={(height) => patch(o.id, { height })} />
            </Field>
            <Field label={tr('От пола')}>
              <NumberInput value={o.elevation} min={0} max={room.height} step={10} onChange={(elevation) => patch(o.id, { elevation })} />
            </Field>
          </div>
          {issues.filter((i) => i.openingId === o.id).map((i, k) => (
            <p key={k} className="mt-1 text-[11px] text-red-600 dark:text-red-400">{i.message}</p>
          ))}
        </div>
      ))}
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

      {/*
        Терезе мен есік қабырғаның жолағында. Есіктің ашылу ДОҒАСЫ бөлменің
        ішіне қарай: шкафты оның жолына қоюға болмайтыны бірден көрінеді.
      */}
      {(room.openings ?? []).map((o) => {
        const w = walls.find((x) => x.id === o.wall)
        if (!w) return null
        const at = (t: number, out: number) => ({
          x: w.origin.x + w.direction.x * t - w.inward.x * out,
          z: w.origin.z + w.direction.z * t - w.inward.z * out,
        })
        const a = at(o.offset, 0)
        const b = at(o.offset + o.width, 0)
        const band = [a, b, at(o.offset + o.width, WALL_MM), at(o.offset, WALL_MM)]
          .map((p) => `${p.x},${p.z}`).join(' ')
        if (o.kind === 'window') {
          return (
            <polygon key={o.id} points={band} fill="#bfdbfe" stroke="#1d4ed8" strokeWidth={8} pointerEvents="none" />
          )
        }
        // Жарма ілгектің (a) айналасында бөлменің ішіне ашылады.
        const open = { x: a.x + w.inward.x * o.width, z: a.z + w.inward.z * o.width }
        const u = { x: b.x - a.x, z: b.z - a.z }
        const v = { x: open.x - a.x, z: open.z - a.z }
        const sweep = u.x * v.z - u.z * v.x > 0 ? 1 : 0
        return (
          <g key={o.id} pointerEvents="none">
            <polygon points={band} fill="#ffffff" stroke="#64748b" strokeWidth={6} />
            <line x1={a.x} y1={a.z} x2={open.x} y2={open.z} stroke="#64748b" strokeWidth={10} />
            <path
              d={`M ${b.x} ${b.z} A ${o.width} ${o.width} 0 0 ${sweep} ${open.x} ${open.z}`}
              fill="none" stroke="#94a3b8" strokeWidth={6} strokeDasharray="30 20"
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
