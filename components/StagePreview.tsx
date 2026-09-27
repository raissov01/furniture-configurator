'use client'

import { useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { buildStagePreview } from '@/lib/stageBuilder'
import type { StageDraft } from '@/lib/stageBuilder'
import { formatTenge, panelExtents, placementPose } from '@/src/core/index'
import { t as tr } from '@/lib/i18n'
import { useConfigurator } from '@/store/configurator'

/** Жұмыс жобасын ауыстырмайтын, бірақ дәл сол Panel[] мен сметаны оқитын көрініс. */
export function StagePreview({ draft }: { draft: StageDraft }) {
  const catalog = useConfigurator((s) => s.catalog)
  const shop = useConfigurator((s) => s.shop)
  const settings = useConfigurator((s) => s.projectSettings ?? s.shop.settings)
  const preview = useMemo(() => {
    try {
      return { value: buildStagePreview(draft, catalog, shop, settings), error: null }
    } catch (cause) {
      return { value: null, error: cause instanceof Error ? cause.message : String(cause) }
    }
  }, [draft, catalog, shop, settings])

  if (!preview.value) return <div role="alert" className="rounded border border-red-300 p-2 text-xs text-red-700">{tr('Предпросмотр')}: {preview.error}</div>
  const { result, groups, price, issues, panels } = preview.value
  const material = new Map(catalog.materials.map((entry) => [entry.id, entry]))
  const cameraDistance = Math.max(result.room.width, result.room.depth) / 1000
  const focus: [number, number, number] = [result.room.width / 2000, 0.9, result.room.depth / 2000]
  return <section aria-label={tr('Предпросмотр')} className="min-w-0 rounded border border-neutral-300 bg-neutral-50 p-2 dark:border-neutral-600 dark:bg-neutral-800">
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
      <strong>{tr('Предпросмотр')}</strong>
      <span>{result.cabinets.length} {tr('модулей')} · {panels.length} {tr('деталей')}</span>
    </div>
    <div data-testid="stage-preview-3d" className="h-44 overflow-hidden rounded border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900 sm:h-56">
      <Canvas camera={{ position: [focus[0] + cameraDistance * 0.55, 2.5, focus[2] - cameraDistance * 0.75], fov: 42 }} dpr={[1, 1.5]}>
        <ambientLight intensity={1.4} />
        <directionalLight position={[2, 5, 4]} intensity={1.6} />
        <group scale={0.001}>
          {groups.map(({ cabinetId, panels: cabinetPanels }) => {
            const cabinet = result.cabinets.find((item) => item.id === cabinetId)!
            const placement = result.placements.find((item) => item.cabinetId === cabinetId)!
            const pose = placementPose(result.room, cabinet, placement)
            return <group key={cabinetId} position={[pose.position.x, pose.position.y, pose.position.z]} rotation={[0, pose.rotationY * Math.PI / 180, 0]}>
              {cabinetPanels.map((panel) => {
                const thick = material.get(panel.materialId)?.thickness ?? 16
                const size = panelExtents(panel, thick)
                return <mesh key={panel.id} position={[panel.position.x + size.x / 2, panel.position.y + size.y / 2, panel.position.z + size.z / 2]}>
                  <boxGeometry args={[size.x, size.y, size.z]} />
                  <meshStandardMaterial color={material.get(panel.materialId)?.decor?.color ?? '#b7b5ae'} roughness={0.85} />
                </mesh>
              })}
            </group>
          })}
        </group>
        <OrbitControls target={focus} enablePan={false} minDistance={1.2} maxDistance={cameraDistance * 3} />
      </Canvas>
    </div>
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
      <span data-testid="stage-preview-price">{tr('Предварительная цена')}: <strong>{formatTenge(price.total)}</strong></span>
      {price.missingPrices.length > 0 ? <span role="alert" className="text-amber-800 dark:text-amber-300">{tr('Есть позиции без цены')}: {price.missingPrices.length}</span> : null}
    </div>
    {issues.map((issue) => <p role="alert" key={`${issue.cabinetId}-${issue.field}`} className="mt-1 text-xs text-red-700">{issue.cabinetId}: {issue.message}</p>)}
  </section>
}
