'use client'

import { useEffect, useState } from 'react'
import { t as tr } from '@/lib/i18n'
import { useConfigurator } from '@/store/configurator'
import type { MaterialPbr, SceneLight, Vec3 } from '@/src/core/index'

const inputStyle = 'w-full border border-neutral-300 bg-white px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-950'
const buttonStyle = 'border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700'

type PbrDraft = { roughness: string; metalness: string; reflection: string; opacity: string;
  normalUrl: string; normalX: string; normalY: string; normalStrength: string }

function draftFromPbr(pbr?: MaterialPbr): PbrDraft {
  const show = (value?: number) => value === undefined ? '' : String(value)
  return { roughness: show(pbr?.roughness), metalness: show(pbr?.metalness),
    reflection: show(pbr?.reflection), opacity: show(pbr?.opacity),
    normalUrl: pbr?.normal?.url ?? '', normalX: show(pbr?.normal?.sizeMm.x),
    normalY: show(pbr?.normal?.sizeMm.y), normalStrength: show(pbr?.normal?.strength) }
}

function OptionalNumber({ label, value, setValue, max }: {
  label: string; value: string; setValue: (value: string) => void; max: number
}) {
  return <label className="text-xs">{label}
    <input className={`${inputStyle} mt-1`} type="number" min={0} max={max} step={0.05}
      value={value} onChange={(event) => setValue(event.target.value)} placeholder={tr('По умолчанию')} />
  </label>
}

export function MaterialAppearanceEditor() {
  const materials = useConfigurator((state) => state.catalog.materials)
  const setMaterialPbr = useConfigurator((state) => state.setMaterialPbr)
  const [materialId, setMaterialId] = useState(materials[0]?.id ?? '')
  const material = materials.find((entry) => entry.id === materialId)
  const [draft, setDraft] = useState<PbrDraft>(() => draftFromPbr(material?.pbr))
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  useEffect(() => { setDraft(draftFromPbr(material?.pbr)) }, [materialId, material?.pbr])
  const field = (key: keyof PbrDraft, value: string) => setDraft((current) => ({ ...current, [key]: value }))
  const save = () => {
    if (!material) return
    try {
      const optional = (value: string) => value.trim() ? Number(value) : undefined
      const pbr: MaterialPbr = {
        roughness: optional(draft.roughness), metalness: optional(draft.metalness),
        reflection: optional(draft.reflection), opacity: optional(draft.opacity),
        normal: draft.normalUrl.trim() ? {
          url: draft.normalUrl.trim(),
          sizeMm: { x: Number(draft.normalX), y: Number(draft.normalY) },
          strength: Number(draft.normalStrength || '1'),
        } : undefined,
      }
      setMaterialPbr(material.id, Object.values(pbr).every((value) => value === undefined) ? undefined : pbr)
      setError(null); setMessage(tr('Вид материала сохранён'))
    } catch (cause) { setError(cause instanceof Error ? cause.message : tr('Не удалось сохранить вид материала')) }
  }
  return <div className="space-y-3 text-neutral-900 dark:text-neutral-100">
    <p className="text-xs text-neutral-500">{tr('PBR меняет только вид, без изменения раскроя и цены.')}</p>
    <select className={inputStyle} aria-label={tr('Материал для PBR')} value={materialId}
      onChange={(event) => { setMaterialId(event.target.value); setError(null); setMessage(null) }}>
      {materials.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
    </select>
    <div className="grid grid-cols-2 gap-2">
      <OptionalNumber label={tr('Шероховатость')} value={draft.roughness} setValue={(value) => field('roughness', value)} max={1} />
      <OptionalNumber label={tr('Металличность')} value={draft.metalness} setValue={(value) => field('metalness', value)} max={1} />
      <OptionalNumber label={tr('Отражение')} value={draft.reflection} setValue={(value) => field('reflection', value)} max={2} />
      <OptionalNumber label={tr('Прозрачность')} value={draft.opacity} setValue={(value) => field('opacity', value)} max={1} />
    </div>
    <label className="block text-xs">{tr('Карта нормалей (URL)')}
      <input className={`${inputStyle} mt-1`} type="url" value={draft.normalUrl}
        onChange={(event) => field('normalUrl', event.target.value)} placeholder="https://…" />
    </label>
    {draft.normalUrl.trim() && <div className="grid grid-cols-3 gap-2">
      <label className="text-xs">{tr('Размер карты X, мм')} ({tr('Обязательно')})
        <input className={`${inputStyle} mt-1`} type="number" min={1} step={1} required value={draft.normalX}
          onChange={(event) => field('normalX', event.target.value)} /></label>
      <label className="text-xs">{tr('Размер карты Y, мм')} ({tr('Обязательно')})
        <input className={`${inputStyle} mt-1`} type="number" min={1} step={1} required value={draft.normalY}
          onChange={(event) => field('normalY', event.target.value)} /></label>
      <OptionalNumber label={tr('Сила рельефа')} value={draft.normalStrength}
        setValue={(value) => field('normalStrength', value)} max={2} />
    </div>}
    <button type="button" className={buttonStyle} onClick={save}>{tr('Сохранить вид материала')}</button>
    {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    {message && <p role="status" className="text-xs text-neutral-500">{message}</p>}
  </div>
}

function NumberField({ label, value, onChange, step = 1 }: {
  label: string; value: number; onChange: (value: number) => void; step?: number
}) {
  return <label className="text-xs">{label}
    <input className={`${inputStyle} mt-1`} type="number" step={step} value={value}
      onChange={(event) => {
        const number = Number(event.target.value)
        if (Number.isFinite(number)) onChange(number)
      }} />
  </label>
}

export function ProjectLightsEditor() {
  const lights = useConfigurator((state) => state.lights)
  const room = useConfigurator((state) => state.room)
  const setProjectLights = useConfigurator((state) => state.setProjectLights)
  const [error, setError] = useState<string | null>(null)
  const apply = (next: SceneLight[]) => {
    try { setProjectLights(next); setError(null) }
    catch (cause) { setError(cause instanceof Error ? cause.message : tr('Не удалось изменить свет')) }
  }
  const update = (changed: SceneLight) => apply(lights.map((light) => light.id === changed.id ? changed : light))
  const add = (kind: SceneLight['kind']) => {
    const id = `light-${crypto.randomUUID()}`
    const position: Vec3 = { x: Math.round(room.width / 2), y: Math.round(room.height * 0.8),
      z: Math.round(room.depth / 2) }
    const target: Vec3 = { x: Math.round(room.width / 2), y: Math.round(room.height / 2),
      z: Math.round(room.depth / 2) }
    const light: SceneLight = kind === 'point'
      ? { kind, id, color: '#fff1dc', intensity: 8, position }
      : kind === 'spot'
        ? { kind, id, color: '#ffffff', intensity: 5, position, target, angleDegrees: 35 }
        : { kind, id, color: '#ffe5bd', intensity: 1.5, azimuthDegrees: 45, elevationDegrees: 55 }
    apply([...lights, light])
  }
  const vectorFields = (label: string, value: Vec3, change: (value: Vec3) => void) =>
    <div className="grid grid-cols-3 gap-2">
      {(['x', 'y', 'z'] as const).map((axis) => <NumberField key={axis}
        label={`${label} ${axis.toUpperCase()}, мм`} value={value[axis]}
        onChange={(number) => change({ ...value, [axis]: number })} />)}
    </div>
  return <div className="space-y-3 text-neutral-900 dark:text-neutral-100">
    <div className="flex flex-wrap gap-1">
      {(['point', 'spot', 'sun'] as const).map((kind) => <button type="button" key={kind}
        className={buttonStyle} onClick={() => add(kind)}>{tr('Добавить')} {tr(kind === 'point' ? 'Точечный' : kind === 'spot' ? 'Прожектор' : 'Солнце')}</button>)}
    </div>
    {lights.map((light) => <section key={light.id} className="space-y-2 border border-neutral-300 p-2 dark:border-neutral-700">
      <div className="flex items-center justify-between text-xs">
        <strong>{tr(light.kind === 'point' ? 'Точечный' : light.kind === 'spot' ? 'Прожектор' : 'Солнце')}</strong>
        <button type="button" className={buttonStyle} onClick={() => apply(lights.filter((entry) => entry.id !== light.id))}>{tr('Удалить')}</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs">{tr('Цвет')}
          <input className={`${inputStyle} mt-1 h-8`} type="color" value={light.color}
            onChange={(event) => update({ ...light, color: event.target.value })} /></label>
        <NumberField label={tr('Интенсивность')} value={light.intensity} step={0.1}
          onChange={(value) => update({ ...light, intensity: value })} />
      </div>
      {light.kind !== 'sun' && vectorFields(tr('Позиция'), light.position,
        (position) => update({ ...light, position }))}
      {light.kind === 'spot' && <>
        {vectorFields(tr('Цель'), light.target, (target) => update({ ...light, target }))}
        <NumberField label={tr('Угол, °')} value={light.angleDegrees} onChange={(angleDegrees) => update({ ...light, angleDegrees })} />
      </>}
      {light.kind === 'sun' && <div className="grid grid-cols-2 gap-2">
        <NumberField label={tr('Азимут, °')} value={light.azimuthDegrees}
          onChange={(azimuthDegrees) => update({ ...light, azimuthDegrees })} />
        <NumberField label={tr('Высота солнца, °')} value={light.elevationDegrees}
          onChange={(elevationDegrees) => update({ ...light, elevationDegrees })} />
      </div>}
    </section>)}
    {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
  </div>
}
