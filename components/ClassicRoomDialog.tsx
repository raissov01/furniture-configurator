'use client'

/**
 * PRO100 «Свойства помещения»: «Размеры» (Длина / Ширина / Высота) және
 * «Пол» (еден, қабырға түсі). OK / Отмена / Применить. Толық жоспар
 * (қабырғалар, проёмдар) бұрынғы «Стены и комната» терезесінде қалады.
 */

import { useState } from 'react'
import { t as tr } from '@/lib/i18n'
import { FLOOR_KINDS, WALL_COLORS, DEFAULT_WALL_COLOR } from '@/src/core/index'
import type { FloorKind, Room, RoomFinish } from '@/src/core/index'
import { ROOM_DIMENSIONS, roomDimensionIssue } from '@/lib/roomDimensions'
import { useConfigurator } from '@/store/configurator'
import { useClassicView } from '@/store/classicView'
import { ClassicTabs, ClassicWindow } from '@/components/ClassicWindow'

type Draft = { width: string; depth: string; height: string; floor: FloorKind | ''; wallColor: string }

const fromRoom = (room: Room): Draft => ({
  width: String(room.width), depth: String(room.depth), height: String(room.height),
  floor: room.finish?.floor ?? '', wallColor: room.finish?.wallColor ?? '',
})

/** Өріс мәтінін бүтін мм-ге айналдыру; бүтін емес болса — NaN (қате көрсетіледі). */
export function roomDraftPatch(draft: Draft): { patch: Partial<Room>; error: string | null } {
  const dims = { width: draft.width, depth: draft.depth, height: draft.height }
  const patch: Partial<Room> = {}
  for (const [key, raw] of Object.entries(dims) as [keyof typeof dims, string][]) {
    const value = /^\d+$/.test(raw.trim()) ? Number(raw) : NaN
    patch[key] = value
  }
  const issue = roomDimensionIssue(patch)
  if (issue) return { patch, error: `${issue.field}: ${issue.allowed}` }
  const finish: RoomFinish | undefined = draft.floor || draft.wallColor
    ? { ...(draft.floor ? { floor: draft.floor } : {}), ...(draft.wallColor ? { wallColor: draft.wallColor } : {}) }
    : undefined
  return { patch: { ...patch, finish }, error: null }
}

export function ClassicRoomDialog() {
  const open = useClassicView((s) => s.roomDialogOpen)
  return open ? <RoomDialogBody /> : null
}

function RoomDialogBody() {
  const room = useConfigurator((s) => s.room)
  const editRoom = useConfigurator((s) => s.editRoom)
  const setRoomOpen = useConfigurator((s) => s.setRoomOpen)
  const close = useClassicView((s) => s.setRoomDialogOpen)
  const [tab, setTab] = useState<'size' | 'floor'>('size')
  const [draft, setDraft] = useState<Draft>(() => fromRoom(room))
  const [error, setError] = useState<string | null>(null)
  const dirty = JSON.stringify(draft) !== JSON.stringify(fromRoom(room))
  const apply = (): boolean => {
    const { patch, error: issue } = roomDraftPatch(draft)
    if (issue) { setError(issue); return false }
    try { editRoom(patch); setError(null); return true }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); return false }
  }
  const field = (key: 'width' | 'depth' | 'height', label: string) => {
    const bounds = ROOM_DIMENSIONS[key]
    return <label className="p100-form-row" key={key}>
      <span>{label}</span>
      <input type="number" inputMode="numeric" min={bounds.min} max={bounds.max} step={10} value={draft[key]}
        data-testid={`room-${key}`} aria-invalid={Boolean(error?.startsWith(`room.${key}`))}
        onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))} />
    </label>
  }
  return <ClassicWindow id="classic-room" title={tr('Свойства помещения')} testId="classic-room-dialog" width={420}
    onClose={() => close(false)} onOk={() => { if (apply()) close(false) }}
    actions={[
      { label: tr('OK'), primary: true, testId: 'room-ok', onClick: () => { if (apply()) close(false) } },
      { label: tr('Отмена'), testId: 'room-cancel', onClick: () => close(false) },
      { label: tr('Применить'), testId: 'room-apply', disabled: !dirty, onClick: () => { apply() } },
    ]}>
    <ClassicTabs label={tr('Свойства помещения')} value={tab} onChange={setTab}
      tabs={[{ value: 'size', label: tr('Размеры') }, { value: 'floor', label: tr('Пол') }]} />
    <div className="p100-tab-page">
      {tab === 'size' ? <div className="p100-form-grid">
        {field('width', tr('Длина'))}
        {field('depth', tr('Ширина'))}
        {field('height', tr('Высота'))}
      </div> : <div className="p100-form-grid">
        <label className="p100-form-row"><span>{tr('Пол')}</span>
          <select value={draft.floor} data-testid="room-floor"
            onChange={(event) => setDraft((current) => ({ ...current, floor: event.target.value as FloorKind | '' }))}>
            <option value="">{tr('Без материала (сетка)')}</option>
            {FLOOR_KINDS.map((kind) => <option key={kind.value} value={kind.value}>{tr(kind.label)}</option>)}
          </select>
        </label>
        <div className="p100-form-row"><span>{tr('Цвет стен')}</span>
          <div className="p100-swatch-row">
            {WALL_COLORS.map((color) => <button key={color} type="button" className="p100-swatch" title={color} aria-label={color}
              aria-pressed={(draft.wallColor || DEFAULT_WALL_COLOR) === color && Boolean(draft.wallColor)}
              style={{ background: color }} onClick={() => setDraft((current) => ({ ...current, wallColor: color }))} />)}
          </div>
        </div>
        <p className="p100-hint">{tr('Пол и стены с материалом показываются реалистично; без материала — сеткой, как в PRO100.')}</p>
      </div>}
      <button type="button" className="p100-window-button p100-inline-button" onClick={() => { close(false); setRoomOpen(true) }}>
        {tr('Стены и проёмы…')}
      </button>
      {error ? <p role="alert" className="p100-dialog-error p100-dialog-invalid">{error}</p> : null}
    </div>
  </ClassicWindow>
}
