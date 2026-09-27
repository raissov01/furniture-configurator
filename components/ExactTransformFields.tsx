'use client'

import { useEffect, useState } from 'react'
import { t as tr } from '@/lib/i18n'
import type { Transform } from '@/src/core/tree'
import { useConfigurator } from '@/store/configurator'

type Draft = { x: string; y: string; z: string; angle: string }
const fromTransform = (value: Transform): Draft => ({
  x: String(value.pos.x), y: String(value.pos.y), z: String(value.pos.z), angle: String(value.rot.y),
})

/** Барлық төрт өріс бір store мутациясымен қолданылады: бір undo қадамы. */
export function ExactTransformFields({ nodeId, transform, disabled = false }: {
  nodeId: string; transform: Transform; disabled?: boolean
}) {
  const setNodeTransform = useConfigurator((state) => state.setNodeTransform)
  const [draft, setDraft] = useState<Draft>(() => fromTransform(transform))
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { setDraft(fromTransform(transform)); setError(null) }, [transform])
  const apply = () => {
    const values = [draft.x, draft.y, draft.z].map((raw) => /^[-+]?\d+$/.test(raw.trim()) ? Number(raw) : NaN)
    const angle = /^[-+]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(draft.angle.trim()) ? Number(draft.angle) : NaN
    if (values.some((value) => !Number.isSafeInteger(value)) || !Number.isFinite(angle)) {
      setError(tr('X/Y/Z — целые миллиметры; поворот Y — число градусов.'))
      return
    }
    try {
      setNodeTransform(nodeId, { pos: { x: values[0]!, y: values[1]!, z: values[2]! },
        rot: { x: 0, y: angle, z: 0 } })
      setError(null)
    } catch (cause) { setError(cause instanceof Error ? cause.message : tr('Не удалось изменить положение')) }
  }
  return <fieldset disabled={disabled} data-testid="exact-transform" className="border border-neutral-300 p-2 dark:border-neutral-700">
    <legend className="px-1 text-xs">{tr('Положение и поворот')}</legend>
    <div className="grid grid-cols-4 gap-2">
      {([['x', 'X, мм'], ['y', 'Y, мм'], ['z', 'Z, мм'], ['angle', 'Y, °']] as const).map(([key, label]) =>
        <label key={key} className="text-xs">{label}<input type="text" inputMode="decimal" data-exact-mm
          className="mt-1 w-full border border-neutral-300 bg-white px-1 py-0.5 dark:border-neutral-700 dark:bg-neutral-900"
          value={draft[key]} onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))}
          onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); apply() } }} /></label>)}
    </div>
    <button type="button" className="mt-2 border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700"
      onClick={apply}>{tr('Применить положение')}</button>
    {error && <p role="alert" className="mt-1 text-xs text-red-700">{error}</p>}
  </fieldset>
}
