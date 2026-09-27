'use client'

import { useEffect, useState } from 'react'
import { t as tr } from '@/lib/i18n'
import { Field, NumberInput } from '@/components/ui'
import type { SolidNode } from '@/src/core/tree'
import { useConfigurator } from '@/store/configurator'
import { ExactTransformFields } from '@/components/ExactTransformFields'

/** Decorative solids have scene properties only; they do not produce cut panels. */
export function SolidProperties({ node }: { node: SolidNode }) {
  const [name, setName] = useState(node.name)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => setName(node.name), [node.id, node.name])
  const renameNode = useConfigurator((state) => state.renameNode)
  const editSolid = useConfigurator((state) => state.editSolid)
  const run = (edit: () => void) => {
    try { edit(); setError(null) }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
  }
  return <section data-testid="solid-properties" className="space-y-3 text-xs">
    {error && <p role="alert" className="border border-red-500 p-2 text-red-700">{error}</p>}
    <Field label={tr('Название')}><input data-properties-name value={name}
      className="w-full border border-neutral-300 bg-white px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
      onChange={(event) => setName(event.target.value)} onBlur={() => {
        if (name !== node.name) run(() => renameNode(node.id, name))
      }} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }} /></Field>
    <div className="grid grid-cols-3 gap-2" data-testid="solid-dimensions">
      {([['y', 'H'], ['x', 'W'], ['z', 'D']] as const).map(([axis, label]) =>
        <Field key={axis} label={`${label}, мм`}><NumberInput value={node.solid.size[axis]} min={1}
          onChange={(value) => run(() => editSolid(node.id, { size: { ...node.solid.size, [axis]: value } }))} /></Field>)}
    </div>
    <div data-testid="solid-position"><ExactTransformFields nodeId={node.id} transform={node.transform} disabled={Boolean(node.locked)} /></div>
    <Field label={tr('Цвет')}><input type="color" aria-label={tr('Цвет')}
      className="h-8 w-full border border-neutral-300 bg-white p-0.5 dark:border-neutral-700 dark:bg-neutral-900"
      value={/^#[0-9a-fA-F]{6}$/.test(node.solid.color ?? '') ? node.solid.color : '#a3a3a3'}
      onChange={(event) => run(() => editSolid(node.id, { color: event.target.value }))} /></Field>
    <p className="text-neutral-500">{tr('Декоративный блок не входит в деталировку.')}</p>
  </section>
}
