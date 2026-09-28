'use client'

import { useEffect, useState } from 'react'
import { t as tr } from '@/lib/i18n'
import { Field, NumberInput } from '@/components/ui'
import { MoneyInput } from './MoneyInput'
import { LATHE_PROFILES, bentDevelopment } from '@/src/core/specialParts'
import type { FabricationSpec } from '@/src/core/specialParts'
import type { SolidNode } from '@/src/core/tree'
import { useConfigurator } from '@/store/configurator'

const inputClass = 'w-full border border-neutral-300 bg-white px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900'

export function SpecialPartProperties({ node, onError }: { node: SolidNode; onError: (message: string | null) => void }) {
  const spec = node.solid.fabrication
  const shop = useConfigurator((state) => state.shop)
  const editSolid = useConfigurator((state) => state.editSolid)
  const [profileDraft, setProfileDraft] = useState('')
  useEffect(() => {
    setProfileDraft(spec?.kind === 'lathe' ? spec.profile.map((point) => `${point.radius}:${point.y}`).join('\n') : '')
  }, [node.id, spec])
  if (!spec) return null
  const edit = (next: FabricationSpec) => {
    try { editSolid(node.id, { fabrication: next }); onError(null) }
    catch (cause) { onError(cause instanceof Error ? cause.message : String(cause)) }
  }
  const material = shop.materials.find((item) => item.id === spec.materialId)
  const common = <>
    <Field label={tr('Материал')}><select className={inputClass} value={spec.materialId}
      onChange={(event) => edit({ ...spec, materialId: event.target.value })}>
      {shop.materials.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select></Field>
    <div className="grid grid-cols-2 gap-2">
      <Field label={tr('Количество')}><NumberInput min={1} value={spec.quantity}
        onChange={(quantity) => edit({ ...spec, quantity })} /></Field>
      <Field label={tr('Цена за штуку, ₸')}><MoneyInput value={spec.unitPrice}
        label={tr('Цена за штуку, ₸')} onChange={(unitPrice) => edit({ ...spec, unitPrice })} /></Field>
    </div>
  </>
  if (spec.kind === 'lathe') return <div data-testid="lathe-properties" className="space-y-2">
    {common}
    <Field label={tr('Готовый профиль')}><select className={inputClass} value={LATHE_PROFILES.find((item) =>
      JSON.stringify(item.profile) === JSON.stringify(spec.profile))?.id ?? ''}
      onChange={(event) => {
        const preset = LATHE_PROFILES.find((item) => item.id === event.target.value)
        if (preset) edit({ ...spec, profile: structuredClone(preset.profile) })
      }}>
      <option value="">{tr('Свой профиль')}</option>
      {LATHE_PROFILES.map((item) => <option key={item.id} value={item.id}>{tr(item.name)}</option>)}
    </select></Field>
    <Field label={tr('Профиль: радиус:высота, мм')}><textarea className={`${inputClass} h-28 font-mono`}
      value={profileDraft} onChange={(event) => setProfileDraft(event.target.value)}
      onBlur={() => {
        const lines = profileDraft.trim().split(/\r?\n/)
        const parsed = lines.map((line) => line.trim().match(/^(\d+):(\d+)$/))
        if (parsed.some((match) => !match)) { onError(tr('Формат точки: радиус:высота, мм')); return }
        edit({ ...spec, profile: parsed.map((match) => ({ radius: Number(match![1]), y: Number(match![2]) })) })
      }} /></Field>
    <p className="text-neutral-500">{tr('Токарный профиль не входит в раскрой и присадку.')}</p>
  </div>
  const min = material?.minBendRadiusMm
  let developed: number | null = null
  let developmentError: string | null = null
  try { developed = bentDevelopment(spec, min).developedLength }
  catch (cause) { developmentError = cause instanceof Error ? cause.message : String(cause) }
  return <div data-testid="bent-properties" className="space-y-2">
    {common}
    <div className="grid grid-cols-2 gap-2">
      <Field label={tr('Хорда, мм')}><NumberInput min={1} value={spec.chord}
        onChange={(chord) => edit({ ...spec, chord })} /></Field>
      <Field label={tr('Высота, мм')}><NumberInput min={1} value={spec.height}
        onChange={(height) => edit({ ...spec, height })} /></Field>
      <Field label={tr('Толщина, мм')}><NumberInput min={1} value={spec.thickness}
        onChange={(thickness) => edit({ ...spec, thickness })} /></Field>
      <Field label={tr('Радиус или угол')}><select className={inputClass}
        value={spec.radius !== undefined ? 'radius' : 'angle'}
        onChange={(event) => edit(event.target.value === 'radius'
          ? { ...spec, radius: Math.max(1, Math.round(spec.chord)), angleDegrees: undefined }
          : { ...spec, radius: undefined, angleDegrees: 60 })}>
        <option value="radius">{tr('Радиус')}</option><option value="angle">{tr('Угол')}</option>
      </select></Field>
      {spec.radius !== undefined
        ? <Field label={tr('Радиус, мм')}><NumberInput min={1} value={spec.radius}
          onChange={(radius) => edit({ ...spec, radius })} /></Field>
        : <Field label={tr('Угол, °')}><NumberInput min={1} max={180} value={spec.angleDegrees ?? 60}
          onChange={(angleDegrees) => edit({ ...spec, angleDegrees })} /></Field>}
      <Field label={tr('Опорная поверхность')}><select className={inputClass} value={spec.referenceFace}
        onChange={(event) => edit({ ...spec, referenceFace: event.target.value as 'inner' | 'outer' })}>
        <option value="inner">{tr('Внутренняя')}</option><option value="outer">{tr('Наружная')}</option>
      </select></Field>
    </div>
    <p className="text-neutral-500">{tr('Мин. радиус цеха')}: {min ?? tr('не задан')} мм · {tr('Развёртка')}: {developed ?? '—'} мм</p>
    {developmentError && <p role="alert" className="text-red-700">{developmentError}</p>}
    <p className="text-neutral-500">{tr('Отдельная операция гибки; не входит в гильотинный раскрой.')}</p>
  </div>
}
