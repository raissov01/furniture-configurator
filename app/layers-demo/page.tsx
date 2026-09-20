'use client'

/**
 * ⚠ ӨЗ ДЕМО БЕТІМ. «Слои» панелін (`components/panels/LayersPanel.tsx`)
 * докинг жүйесінде (`components/dock/`) көрсетеді.
 *
 * Store-ты (`store/configurator.ts`) ЕШБІР жерде қолданбайды: ол әлі
 * `cabinets` + `placements` пішінімен жұмыс істейді, ал қабаттар
 * `src/core/tree.ts`-тегі түйіндер ағашының қасиеті (бұл екеуі әлі
 * жалғанбаған — `treeFromProject.ts`-тегі ескертуді қара). Сондықтан бұл
 * бет ӨЗ жергілікті ағашын (`GroupNode`) және өз қабат тізімін ұстайды,
 * бәрі `src/core/layers.ts`-тегі таза функциялармен өзгереді. Негізгі
 * экранға интеграция — тарихтары ағаш пен store қосылғанда, бөлек тапсырма.
 *
 * Не көрсетеді: үш демо түйін (Корпус, Фасад — көрінеді; Техника —
 * жасырылған қабатта). Қабатты жасыру/құлыптау → «Есептеу» батырмасы
 * `flattenTree()`-ді шақырып, нәтижесін көрсетеді (жасырылған түйін
 * шығыста жоқ болуы керек — солай екенін көзбен тексеруге болады).
 */
import * as React from 'react'
import { DockHost } from '@/components/dock/DockHost'
import type { DockPanelSpec } from '@/components/dock/DockHost'
import { LayersPanel } from '@/components/panels/LayersPanel'
import type { LayersPanelNode } from '@/components/panels/LayersPanel'
import { Button } from '@/components/ui'
import {
  ConfigValidationError,
  DEFAULT_LAYER_ID,
  SEED_CATALOG,
  createDefaultLayer,
  createLayer,
  deleteLayer,
  flattenTree,
  renameLayer,
  setLayerColor,
  setLayerLocked,
  setLayerVisible,
  setNodeLayer,
} from '@/src/core/index'
import type { GroupNode, Layer, SceneNode } from '@/src/core/index'

const INITIAL_LAYER_ID = 'demo-tech'

function initialTree(): GroupNode {
  const solid = (id: string, name: string, layerId?: string): SceneNode => ({
    kind: 'solid',
    id,
    name,
    transform: { pos: { x: 0, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0 } },
    solid: { size: { x: 600, y: 2000, z: 450 } },
    ...(layerId ? { layerId } : {}),
  })
  return {
    kind: 'group',
    id: 'root',
    name: 'Демо жоба',
    transform: { pos: { x: 0, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0 } },
    children: [
      solid('corpus', 'Корпус'),
      solid('facade', 'Фасад'),
      solid('appliance', 'Техника (духовка)', INITIAL_LAYER_ID),
    ],
  }
}

function initialLayers(): Layer[] {
  return [
    createDefaultLayer(),
    { id: INITIAL_LAYER_ID, name: 'Техника', visible: true, locked: false, color: '#d97706' },
  ]
}

function LayersDemoContent() {
  const [tree, setTree] = React.useState<GroupNode>(initialTree)
  const [layers, setLayers] = React.useState<Layer[]>(initialLayers)
  const [error, setError] = React.useState<string | null>(null)
  const [report, setReport] = React.useState<string | null>(null)

  const nodes: LayersPanelNode[] = tree.children.map((n) => ({ id: n.id, name: n.name, layerId: n.layerId }))

  const guard = (fn: () => void) => {
    try {
      fn()
      setError(null)
    } catch (e) {
      setError(e instanceof ConfigValidationError ? e.message : String(e))
    }
  }

  const runFlatten = () => {
    const scene = flattenTree(tree, SEED_CATALOG, undefined, layers)
    const visibleIds = scene.solids.map((s) => s.nodeId)
    setReport(`Көрінетін түйіндер: ${visibleIds.join(', ') || '(жоқ)'}`)
  }

  return (
    <div className="flex h-full flex-col gap-2 p-3 text-neutral-300">
      <LayersPanel
        layers={layers}
        nodes={nodes}
        onCreateLayer={(name) => guard(() => setLayers((prev) => createLayer(prev, `l-${Date.now()}`, name)))}
        onRenameLayer={(id, name) => setLayers((prev) => renameLayer(prev, id, name))}
        onSetVisible={(id, visible) => setLayers((prev) => setLayerVisible(prev, id, visible))}
        onSetLocked={(id, locked) => setLayers((prev) => setLayerLocked(prev, id, locked))}
        onSetColor={(id, color) => setLayers((prev) => setLayerColor(prev, id, color))}
        onDeleteLayer={(id) => guard(() => {
          const result = deleteLayer(tree, layers, id)
          setTree(result.root)
          setLayers(result.layers)
        })}
        onAssignNode={(nodeId, layerId) => guard(() => setTree((prev) => setNodeLayer(prev, nodeId, layerId, layers)))}
      />
      <div className="flex items-center gap-2 border-t border-neutral-800 pt-2">
        <Button onClick={runFlatten}>Есептеу (flattenTree)</Button>
      </div>
      {error ? <p className="text-[11px] text-red-500">{error}</p> : null}
      {report ? <p className="text-[11px] text-neutral-400">{report}</p> : null}
      <p className="text-[10px] text-neutral-600">
        Әдепкі қабат id: {DEFAULT_LAYER_ID}. «Техника» қабатын жасырсаң —
        «Есептеу» түймесі оны тізімнен алып тастайды.
      </p>
    </div>
  )
}

const PANELS: DockPanelSpec[] = [
  { id: 'layers', title: 'Слои', content: <LayersDemoContent /> },
]

// ⚠ `metadata` экспорты ЖОҚ: бұл файл `'use client'` (LayersDemoContent
// хуктерді қолданады), ал Next.js метадеректі тек СЕРВЕР компонентінен
// экспорттауға рұқсат етеді.
export default function LayersDemoPage() {
  return (
    <div className="h-dvh w-dvw bg-neutral-950">
      <DockHost panels={PANELS}>
        <div className="flex h-full items-center justify-center px-4 text-center text-[11px] uppercase tracking-wider text-neutral-700">
          Scene — бұл бетте жоқ. Демо ағаш үш түйіннен тұрады: Корпус, Фасад,
          Техника (соңғысы «Техника» қабатында).
        </div>
      </DockHost>
    </div>
  )
}
