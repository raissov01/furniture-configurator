'use client'

import { useEffect, useState } from 'react'
import { t as tr } from '@/lib/i18n'
import { useConfigurator } from '@/store/configurator'
import { assertTreeNodeEditable } from '@/src/core/treeEditing'
import { ConfigValidationError } from '@/src/core/errors'
import { Button, Field, NumberInput } from '@/components/ui'
import type { AnnotationNode } from '@/src/core/tree'

export function AnnotationProperties({ node }: { node: AnnotationNode }) {
  const root = useConfigurator((state) => state.root)
  const layers = useConfigurator((state) => state.layers)
  const edit = useConfigurator((state) => state.editAnnotation)
  const remove = useConfigurator((state) => state.removeAnnotation)
  const translate = useConfigurator((state) => state.translateNodes)
  const [draft, setDraft] = useState(node.annotation.text)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { setDraft(node.annotation.text); setError(null) }, [node.id, node.annotation.text])
  let editable = true
  try { assertTreeNodeEditable(root, node.id, layers) }
  catch (cause) { if (!(cause instanceof ConfigValidationError)) throw cause; editable = false }
  const saveText = () => {
    try { edit(node.id, { text: draft }); setError(null) }
    catch (cause) { setError(cause instanceof Error ? cause.message : tr('Не удалось сохранить текст')) }
  }
  const move = (axis: 'x' | 'y' | 'z', value: number) => {
    translate([{ id: node.id, delta: {
      x: axis === 'x' ? value - node.transform.pos.x : 0,
      y: axis === 'y' ? value - node.transform.pos.y : 0,
      z: axis === 'z' ? value - node.transform.pos.z : 0,
    } }])
  }
  return <fieldset disabled={!editable} className="space-y-3" data-testid="annotation-properties">
    <Field label={tr('Текст записи')}>
      <textarea value={draft} maxLength={500} onChange={(event) => setDraft(event.target.value)}
        className="min-h-20 w-full rounded border border-neutral-300 bg-white p-2 text-sm dark:border-neutral-700 dark:bg-neutral-900" />
    </Field>
    <Button onClick={saveText} disabled={!draft.trim()}>{tr('Применить')}</Button>
    <Field label={tr('Размер текста, мм')}>
      <NumberInput value={node.annotation.fontSize} min={1} max={1000} step={10}
        onChange={(fontSize) => edit(node.id, { fontSize })} />
    </Field>
    <Field label={tr('Цвет текста')}>
      <input type="color" value={node.annotation.color} onChange={(event) => edit(node.id, { color: event.target.value })} />
    </Field>
    <div className="grid grid-cols-3 gap-2">
      {(['x', 'y', 'z'] as const).map((axis) => <Field key={axis} label={`${axis.toUpperCase()}, мм`}>
        <NumberInput value={node.transform.pos[axis]} min={-20000} max={20000} step={10}
          onChange={(value) => move(axis, value)} />
      </Field>)}
    </div>
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    <Button onClick={() => remove(node.id)}>{tr('Удалить текст')}</Button>
  </fieldset>
}
