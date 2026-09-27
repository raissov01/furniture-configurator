'use client'

import { useEffect, useState } from 'react'
import { t as tr } from '@/lib/i18n'
import { useConfigurator } from '@/store/configurator'
import type { MaterialPbr, SceneLight, Vec3 } from '@/src/core/index'
import { parsePbrDraft, visualNumber } from '@/lib/f28VisualUi'
import type { PbrDraft, PbrErrors } from '@/lib/f28VisualUi'

const inputStyle = 'w-full border border-neutral-300 bg-white px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-950'
const buttonStyle = 'border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700'

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
  return <label className="text-xs">{label}
    <input className={`${inputStyle} mt-1`} type="number" min={0} max={max} step={0.05}
      aria-invalid={Boolean(error) || undefined} value={value} onChange={(event) => setValue(event.target.value)} placeholder={tr('По умолчанию')} />
    {error && <span role="alert" className="block text-red-600">{label}: {tr('допустимо')} {error.split(': ').at(-1)}</span>}
  </label>
}

export function MaterialAppearanceEditor() {
  const materials = useConfigurator((state) => state.catalog.materials)
  const setMaterialPbr = useConfigurator((state) => state.setMaterialPbr)
  const [materialId, setMaterialId] = useState(materials[0]?.id ?? '')
  const material = materials.find((entry) => entry.id === materialId)
  const [draft, setDraft] = useState<PbrDraft>(() => draftFromPbr(material?.pbr))
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<PbrErrors>({})
  const [message, setMessage] = useState<string | null>(null)
  useEffect(() => { setDraft(draftFromPbr(material?.pbr)) }, [materialId, material?.pbr])
  const field = (key: keyof PbrDraft, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }))
    setFieldErrors((current) => ({ ...current, [key]: undefined }))
    setMessage(null)
  }
  const save = () => {
    setMessage(null)
    setError(null)
    if (!material) return
    const result = parsePbrDraft(draft)
    setFieldErrors(result.errors)
    if (Object.keys(result.errors).length) return
    try {
      setMaterialPbr(material.id, result.pbr)
      setMessage(tr('Вид материала сохранён'))
    } catch {
      setError(tr('Не удалось сохранить вид материала'))
    }
  }
  return <div className="space-y-3 text-neutral-900 dark:text-neutral-100">
    <p className="text-xs text-neutral-500">{tr('PBR меняет только вид, без изменения раскроя и цены.')}</p>
    <select className={inputStyle} aria-label={tr('Материал для PBR')} value={materialId}
      onChange={(event) => { setMaterialId(event.target.value); setError(null); setFieldErrors({}); setMessage(null) }}>
      {materials.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
    </select>
    <div className="grid grid-cols-2 gap-2">
      <OptionalNumber label={tr('Шероховатость')} value={draft.roughness} setValue={(value) => field('roughness', value)} max={1} error={fieldErrors.roughness} />
      <OptionalNumber label={tr('Металличность')} value={draft.metalness} setValue={(value) => field('metalness', value)} max={1} error={fieldErrors.metalness} />
      <OptionalNumber label={tr('Отражение')} value={draft.reflection} setValue={(value) => field('reflection', value)} max={2} error={fieldErrors.reflection} />
      <OptionalNumber label={tr('Прозрачность')} value={draft.opacity} setValue={(value) => field('opacity', value)} max={1} error={fieldErrors.opacity} />
    </div>
    <label className="block text-xs">{tr('Карта нормалей (URL)')}
      <input className={`${inputStyle} mt-1`} type="url" value={draft.normalUrl}
        aria-invalid={Boolean(fieldErrors.normalUrl) || undefined}
        onChange={(event) => field('normalUrl', event.target.value)} placeholder="https://…" />
      {fieldErrors.normalUrl && <span role="alert" className="block text-red-600">{tr('Карта нормалей (URL)')}: http(s) URL</span>}
    </label>
    {draft.normalUrl.trim() && <div className="grid grid-cols-3 gap-2">
      <label className="text-xs">{tr('Размер карты X, мм')} ({tr('Обязательно')})
        <input className={`${inputStyle} mt-1`} type="number" min={1} step={1} required aria-invalid={Boolean(fieldErrors.normalX) || undefined} value={draft.normalX}
          onChange={(event) => field('normalX', event.target.value)} />
        {fieldErrors.normalX && <span role="alert" className="block text-red-600">{tr('Размер карты X, мм')}: &gt; 0 мм, {tr('Введите целое число, мм')}</span>}</label>
      <label className="text-xs">{tr('Размер карты Y, мм')} ({tr('Обязательно')})
        <input className={`${inputStyle} mt-1`} type="number" min={1} step={1} required aria-invalid={Boolean(fieldErrors.normalY) || undefined} value={draft.normalY}
          onChange={(event) => field('normalY', event.target.value)} />
        {fieldErrors.normalY && <span role="alert" className="block text-red-600">{tr('Размер карты Y, мм')}: &gt; 0 мм, {tr('Введите целое число, мм')}</span>}</label>
      <OptionalNumber label={tr('Сила рельефа')} value={draft.normalStrength}
        setValue={(value) => field('normalStrength', value)} max={2} error={fieldErrors.normalStrength} />
    </div>}
    <button type="button" className={buttonStyle} onClick={save}>{tr('Сохранить вид материала')}</button>
    {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    {message && <p role="status" className="text-xs text-neutral-500">{message}</p>}
  </div>
}

function NumberField({ label, value, onChange, step = 1, min = -Number.MAX_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER }: {
  label: string; value: number; onChange: (value: number) => void; step?: number; min?: number; max?: number
}) {
  const [draft, setDraft] = useState(String(value))
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { setDraft(String(value)); setError(null) }, [value])
  return <label className="text-xs">{label}
    <input className={`${inputStyle} mt-1 ${error ? 'border-red-500' : ''}`} type="text" inputMode="decimal"
      aria-invalid={Boolean(error) || undefined} value={draft}
      onChange={(event) => {
        const raw = event.target.value
        setDraft(raw)
        const result = visualNumber(raw, label, min, max, true, step >= 1)
        setError(result.error ?? null)
        if (result.value !== undefined) onChange(result.value)
      }} />
    {error && <span role="alert" className="block text-red-600">{label}: {tr('допустимо')} {min}..{max}{step >= 1 ? ` ${tr('Введите целое число, мм')}` : ''}</span>}
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
        <NumberField label={tr('Интенсивность')} value={light.intensity} step={0.1} min={0} max={100}
          onChange={(value) => update({ ...light, intensity: value })} />
      </div>
      {light.kind !== 'sun' && vectorFields(tr('Позиция'), light.position,
        (position) => update({ ...light, position }))}
      {light.kind === 'spot' && <>
        {vectorFields(tr('Цель'), light.target, (target) => update({ ...light, target }))}
        <NumberField label={tr('Угол, °')} value={light.angleDegrees} min={1} max={89} onChange={(angleDegrees) => update({ ...light, angleDegrees })} />
      </>}
      {light.kind === 'sun' && <div className="grid grid-cols-2 gap-2">
        <NumberField label={tr('Азимут, °')} value={light.azimuthDegrees} min={-180} max={180}
          onChange={(azimuthDegrees) => update({ ...light, azimuthDegrees })} />
        <NumberField label={tr('Высота солнца, °')} value={light.elevationDegrees} min={-90} max={90}
          onChange={(elevationDegrees) => update({ ...light, elevationDegrees })} />
      </div>}
    </section>)}
    {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
  </div>
}
