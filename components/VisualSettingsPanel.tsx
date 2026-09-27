'use client'

import { useEffect, useId, useState } from 'react'
import { t as tr } from '@/lib/i18n'
import { useConfigurator } from '@/store/configurator'
import type { MaterialPbr, SceneLight, Vec3 } from '@/src/core/index'
import { parseNormalUrl, parseVisualNumber } from '@/lib/visualSettingsInput'

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

function OptionalNumber({ label, value, setValue, max, error }: {
  label: string; value: string; setValue: (value: string) => void; max: number; error?: string | undefined
}) {
  const errorId = useId()
  return <label className="text-xs">{label}
    <input className={`${inputStyle} mt-1`} type="number" min={0} max={max} step={0.05}
      value={value} onChange={(event) => setValue(event.target.value)} aria-invalid={!!error}
      aria-describedby={error ? errorId : undefined}
      placeholder={tr('По умолчанию')} />
    {error && <span id={errorId} className="block text-red-600">{error}</span>}
  </label>
}

export function MaterialAppearanceEditor() {
  const normalUrlErrorId = useId()
  const normalXErrorId = useId()
  const normalYErrorId = useId()
  const materials = useConfigurator((state) => state.catalog.materials)
  const setMaterialPbr = useConfigurator((state) => state.setMaterialPbr)
  const [materialId, setMaterialId] = useState(materials[0]?.id ?? '')
  const material = materials.find((entry) => entry.id === materialId)
  const [draft, setDraft] = useState<PbrDraft>(() => draftFromPbr(material?.pbr))
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof PbrDraft, string>>>({})
  const [message, setMessage] = useState<string | null>(null)
  useEffect(() => { setDraft(draftFromPbr(material?.pbr)) }, [materialId, material?.pbr])
  const field = (key: keyof PbrDraft, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }))
    setFieldErrors((current) => ({ ...current, [key]: undefined }))
    setMessage(null)
  }
  const save = () => {
    if (!material) return
    setMessage(null)
    const errors: Partial<Record<keyof PbrDraft, string>> = {}
    const optional = (key: keyof PbrDraft, label: string, max: number) => {
      const parsed = parseVisualNumber(draft[key], label, 0, max, false, true)
      if (parsed.error) errors[key] = parsed.error
      return parsed.value === null ? undefined : parsed.value
    }
    const roughness = optional('roughness', tr('Шероховатость'), 1)
    const metalness = optional('metalness', tr('Металличность'), 1)
    const reflection = optional('reflection', tr('Отражение'), 2)
    const opacity = optional('opacity', tr('Прозрачность'), 1)
    const normalStrength = draft.normalUrl.trim()
      ? optional('normalStrength', tr('Сила рельефа'), 2) : undefined
    let normal: MaterialPbr['normal']
    if (draft.normalUrl.trim()) {
      const url = parseNormalUrl(draft.normalUrl)
      const x = parseVisualNumber(draft.normalX, tr('Размер карты X, мм'), 1, 100000, true)
      const y = parseVisualNumber(draft.normalY, tr('Размер карты Y, мм'), 1, 100000, true)
      if (url.error) errors.normalUrl = url.error
      if (x.error) errors.normalX = x.error
      if (y.error) errors.normalY = y.error
      if (url.value && x.value !== null && y.value !== null) {
        normal = { url: url.value, sizeMm: { x: x.value!, y: y.value! }, strength: normalStrength ?? 1 }
      }
    }
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) { setError(null); return }
    try {
      const pbr: MaterialPbr = {
        roughness, metalness, reflection, opacity, normal,
      }
      setMaterialPbr(material.id, Object.values(pbr).every((value) => value === undefined) ? undefined : pbr)
      setError(null); setMessage(tr('Вид материала сохранён'))
    } catch { setError(tr('Не удалось сохранить вид материала')) }
  }
  return <div className="space-y-3 text-neutral-900 dark:text-neutral-100">
    <p className="text-xs text-neutral-500">{tr('PBR меняет только вид, без изменения раскроя и цены.')}</p>
    <select className={inputStyle} aria-label={tr('Материал для PBR')} value={materialId}
      onChange={(event) => { setMaterialId(event.target.value); setError(null); setMessage(null); setFieldErrors({}) }}>
      {materials.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
    </select>
    <div className="grid grid-cols-2 gap-2">
      <OptionalNumber label={tr('Шероховатость')} value={draft.roughness} setValue={(value) => field('roughness', value)} max={1} error={fieldErrors.roughness} />
      <OptionalNumber label={tr('Металличность')} value={draft.metalness} setValue={(value) => field('metalness', value)} max={1} error={fieldErrors.metalness} />
      <OptionalNumber label={tr('Отражение')} value={draft.reflection} setValue={(value) => field('reflection', value)} max={2} error={fieldErrors.reflection} />
      <OptionalNumber label={tr('Прозрачность')} value={draft.opacity} setValue={(value) => field('opacity', value)} max={1} error={fieldErrors.opacity} />
    </div>
    <label className="block text-xs">{tr('Карта нормалей (URL)')}
      <input className={`${inputStyle} mt-1`} type="url" value={draft.normalUrl} aria-invalid={!!fieldErrors.normalUrl}
        aria-describedby={fieldErrors.normalUrl ? normalUrlErrorId : undefined}
        onChange={(event) => field('normalUrl', event.target.value)} placeholder="https://…" />
      {fieldErrors.normalUrl && <span id={normalUrlErrorId} className="block text-red-600">{fieldErrors.normalUrl}</span>}
    </label>
    {draft.normalUrl.trim() && <div className="grid grid-cols-3 gap-2">
      <label className="text-xs">{tr('Размер карты X, мм')} ({tr('Обязательно')})
        <input className={`${inputStyle} mt-1`} type="number" min={1} step={1} required value={draft.normalX}
          aria-invalid={!!fieldErrors.normalX} aria-describedby={fieldErrors.normalX ? normalXErrorId : undefined}
          onChange={(event) => field('normalX', event.target.value)} />
        {fieldErrors.normalX && <span id={normalXErrorId} className="block text-red-600">{fieldErrors.normalX}</span>}</label>
      <label className="text-xs">{tr('Размер карты Y, мм')} ({tr('Обязательно')})
        <input className={`${inputStyle} mt-1`} type="number" min={1} step={1} required value={draft.normalY}
          aria-invalid={!!fieldErrors.normalY} aria-describedby={fieldErrors.normalY ? normalYErrorId : undefined}
          onChange={(event) => field('normalY', event.target.value)} />
        {fieldErrors.normalY && <span id={normalYErrorId} className="block text-red-600">{fieldErrors.normalY}</span>}</label>
      <OptionalNumber label={tr('Сила рельефа')} value={draft.normalStrength}
        setValue={(value) => field('normalStrength', value)} max={2} error={fieldErrors.normalStrength} />
    </div>}
    <button type="button" className={buttonStyle} onClick={save}>{tr('Сохранить вид материала')}</button>
    {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    {message && <p role="status" className="text-xs text-neutral-500">{message}</p>}
  </div>
}

function NumberField({ label, value, onChange, min, max, step = 1, integer = false }: {
  label: string; value: number; onChange: (value: number) => void; min: number; max: number; step?: number; integer?: boolean
}) {
  const errorId = useId()
  const [draft, setDraft] = useState(String(value))
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { setDraft(String(value)); setError(null) }, [value])
  return <label className="text-xs">{label}
    <input className={`${inputStyle} mt-1`} type="text" inputMode="decimal" value={draft} aria-invalid={!!error}
      aria-describedby={error ? errorId : undefined}
      onChange={(event) => {
        const raw = event.target.value
        setDraft(raw)
        const parsed = parseVisualNumber(raw, label, min, max, integer)
        setError(parsed.error)
        if (parsed.value !== null && parsed.value !== undefined) onChange(parsed.value)
      }} />
    {error && <span id={errorId} className="block text-red-600">{error}</span>}
  </label>
}

export function ProjectLightsEditor() {
  const lights = useConfigurator((state) => state.lights)
  const room = useConfigurator((state) => state.room)
  const setProjectLights = useConfigurator((state) => state.setProjectLights)
  const [error, setError] = useState<string | null>(null)
  const apply = (next: SceneLight[]) => {
    try { setProjectLights(next); setError(null) }
    catch { setError(tr('Не удалось изменить свет')) }
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
        label={`${label} ${axis.toUpperCase()}, мм`} value={value[axis]} min={-100000} max={100000} integer
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
        <NumberField label={tr('Интенсивность')} value={light.intensity} min={0} max={100} step={0.1}
          onChange={(value) => update({ ...light, intensity: value })} />
      </div>
      {light.kind !== 'sun' && vectorFields(tr('Позиция'), light.position,
        (position) => update({ ...light, position }))}
      {light.kind === 'spot' && <>
        {vectorFields(tr('Цель'), light.target, (target) => update({ ...light, target }))}
        <NumberField label={tr('Угол, °')} value={light.angleDegrees} min={1} max={89} integer onChange={(angleDegrees) => update({ ...light, angleDegrees })} />
      </>}
      {light.kind === 'sun' && <div className="grid grid-cols-2 gap-2">
        <NumberField label={tr('Азимут, °')} value={light.azimuthDegrees} min={-180} max={180} integer
          onChange={(azimuthDegrees) => update({ ...light, azimuthDegrees })} />
        <NumberField label={tr('Высота солнца, °')} value={light.elevationDegrees} min={-90} max={90} integer
          onChange={(elevationDegrees) => update({ ...light, elevationDegrees })} />
      </div>}
    </section>)}
    {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
  </div>
}
