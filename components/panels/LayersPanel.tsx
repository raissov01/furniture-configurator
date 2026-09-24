'use client'

/**
 * «Слои» — PRO100 паритеті (`docs/pro100/parity.md` §2.1 `TLAYERSFORM`,
 * бұрын ❌ болатын). Цехтағы пайдасы: клиентке көрсеткенде техниканы
 * жасырасың, монтажда тек корпусты көресің (тапсырма мәтіні).
 *
 * Логиканың бәрі `src/core/layers.ts`-те (таза функциялар) — бұл файл тек
 * көрсетеді әрі шақырады (CLAUDE.md §3). Қабатты жасау/өшіру/атын
 * өзгерту/көрінуін-құлпын ауыстыру барлығы КОЛБЭКпен сыртқа шығады: хост
 * (докинг жүйесі не Configurator.tsx) өз ағашы мен қабат тізімін қалай
 * сақтайтынын өзі шешеді, бұл панель ешбір стор-ды білмейді.
 *
 * Дизайн: градиент/blur/эмоджи ЖОҚ — тұтас түс + 1px жиек (CLAUDE.md §10).
 */
import * as React from 'react'
import { cn } from '@/lib/cn'
import { t as tr } from '@/lib/i18n'
import { Button, Field, Toggle } from '@/components/ui'
import { DEFAULT_LAYER_ID } from '@/src/core/layers'
import type { Layer } from '@/src/core/layers'

/** Панельге көрсетуге керек аз ғана өріс — толық SceneNode бермейміз. */
export type LayersPanelNode = {
  id: string
  name: string
  layerId?: string | undefined
}

/** A layer rename is one committed edit/undo step, not one edit per keystroke. */
function LayerNameInput({ layer, onRename }: { layer: Layer; onRename: (id: string, name: string) => void }) {
  const [draft, setDraft] = React.useState(layer.name)
  const cancel = React.useRef(false)
  React.useEffect(() => setDraft(layer.name), [layer.name])
  return <input
    aria-label={tr('Название слоя')}
    className="min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900 outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-300"
    value={draft}
    onChange={(event) => setDraft(event.target.value)}
    onBlur={(event) => {
      if (cancel.current) { cancel.current = false; return }
      const name = event.target.value.trim()
      if (!name) { setDraft(layer.name); return }
      if (name !== layer.name) onRename(layer.id, name)
      // The store supplies the committed name on rerender; a rejected edit
      // must not leave a local draft masquerading as saved data.
      setDraft(layer.name)
    }}
    onKeyDown={(event) => {
      if (event.key === 'Enter') event.currentTarget.blur()
      if (event.key === 'Escape') { cancel.current = true; setDraft(layer.name); event.currentTarget.blur() }
    }}
  />
}

export function LayersPanel({
  layers,
  nodes = [],
  onCreateLayer,
  onRenameLayer,
  onSetVisible,
  onSetLocked,
  onSetColor,
  onDeleteLayer,
  onAssignNode,
}: {
  layers: Layer[]
  /** Ағаштағы түйіндер — қайсысы қай қабатта екенін көрсету/ауыстыру үшін. ЕРІКТІ. */
  nodes?: LayersPanelNode[]
  onCreateLayer: (name: string) => void
  onRenameLayer: (id: string, name: string) => void
  onSetVisible: (id: string, visible: boolean) => void
  onSetLocked: (id: string, locked: boolean) => void
  onSetColor: (id: string, color: string) => void
  onDeleteLayer: (id: string) => void
  onAssignNode?: (nodeId: string, layerId: string) => void
}) {
  const [newName, setNewName] = React.useState('')

  const nodesByLayer = React.useMemo(() => {
    const map = new Map<string, LayersPanelNode[]>()
    for (const node of nodes) {
      const key = node.layerId ?? DEFAULT_LAYER_ID
      const list = map.get(key) ?? []
      list.push(node)
      map.set(key, list)
    }
    return map
  }, [nodes])

  const submitNewLayer = () => {
    const name = newName.trim()
    if (!name) return
    onCreateLayer(name)
    setNewName('')
  }

  return (
    <div className="flex h-full flex-col gap-3 text-xs">
      <div className="flex items-end gap-2">
        <Field label={tr('Жаңа қабат')}>
          <input
            className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900 outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-300"
            value={newName}
            placeholder={tr('Мыс.: Техника')}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submitNewLayer() }}
          />
        </Field>
        <Button onClick={submitNewLayer} disabled={!newName.trim()}>{tr('Қосу')}</Button>
      </div>

      <ul className="flex flex-col gap-1.5" data-testid="layers-list">
        {layers.map((layer) => {
          const nodeCount = nodesByLayer.get(layer.id)?.length ?? 0
          const isDefault = layer.id === DEFAULT_LAYER_ID
          return (
            <li
              key={layer.id}
              className="flex flex-col gap-1.5 border border-neutral-300 p-2 dark:border-neutral-700"
            >
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label={tr('Қабат түсі')}
                  className="h-6 w-6 shrink-0 cursor-pointer border border-neutral-300 bg-transparent p-0 dark:border-neutral-700"
                  value={layer.color}
                  onChange={(e) => onSetColor(layer.id, e.target.value)}
                />
                <LayerNameInput layer={layer} onRename={onRenameLayer} />
                <span className="shrink-0 text-[10px] tabular-nums text-neutral-400">
                  {nodeCount}
                </span>
                <Button
                  size="sm"
                  disabled={isDefault}
                  title={isDefault ? tr('Әдепкі қабатты өшіруге болмайды') : tr('Қабатты өшіру')}
                  onClick={() => onDeleteLayer(layer.id)}
                >
                  {tr('Өшіру')}
                </Button>
              </div>
              <div className="flex items-center gap-4">
                <Toggle
                  checked={layer.visible}
                  onChange={(v) => onSetVisible(layer.id, v)}
                  label={tr('Көрінеді')}
                />
                <Toggle
                  checked={layer.locked}
                  onChange={(v) => onSetLocked(layer.id, v)}
                  label={tr('Құлыпты')}
                />
              </div>
            </li>
          )
        })}
      </ul>

      {nodes.length > 0 && onAssignNode ? (
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
            {tr('Түйіндер')}
          </span>
          <ul className="flex flex-col gap-1">
            {nodes.map((node) => (
              <li key={node.id} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-neutral-700 dark:text-neutral-300">
                  {node.name}
                </span>
                <select
                  className={cn(
                    'rounded-md border border-neutral-300 bg-white px-1.5 py-1 text-[11px] text-neutral-900',
                    'outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-300',
                  )}
                  value={node.layerId ?? DEFAULT_LAYER_ID}
                  onChange={(e) => onAssignNode(node.id, e.target.value)}
                >
                  {layers.map((layer) => (
                    <option key={layer.id} value={layer.id}>{layer.name}</option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
