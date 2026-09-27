'use client'

import { useEffect, useState } from 'react'
import { t as tr } from '@/lib/i18n'
import type { GroupNode } from '@/src/core/tree'
import { useConfigurator } from '@/store/configurator'
import { ExactTransformFields } from '@/components/ExactTransformFields'

export function GroupProperties({ node }: { node: GroupNode }) {
  const renameNode = useConfigurator((state) => state.renameNode)
  const [name, setName] = useState(node.name)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => setName(node.name), [node.id, node.name])
  return <section data-testid="group-properties" className="space-y-3 text-xs">
    <label className="block">{tr('Название')}<input data-properties-name value={name}
      className="mt-1 w-full border border-neutral-300 bg-white px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
      onChange={(event) => setName(event.target.value)} onBlur={() => {
        if (name === node.name) return
        try { renameNode(node.id, name); setError(null) }
        catch (cause) { setError(cause instanceof Error ? cause.message : tr('Не удалось изменить название')) }
      }} /></label>
    <ExactTransformFields nodeId={node.id} transform={node.transform} disabled={Boolean(node.locked)} />
    <p>{tr('Элементов в группе')}: {node.children.length}</p>
    {error && <p role="alert" className="text-red-700">{error}</p>}
  </section>
}
