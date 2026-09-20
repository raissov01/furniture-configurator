/**
 * АҒАШТЫҢ ЖАЙЫЛУЫ: SceneNode ағашы → панельдер мен позалар.
 *
 * Таза TypeScript (CLAUDE.md §3).
 *
 * ⚠ НЕГЕ ӘЛЕМ КООРДИНАТЫ ЕМЕС. `Panel.rotation` — `Orientation`-нан шыққан
 * Euler (ORIENT_FACING → 180, 0, −90). Оған түйіннің Y-бұрылысын қосу үшін
 * матрица керек, ал онсыз да қажеті жоқ: өндірістік тізбек (cutList,
 * pricing, nesting, dxf, cnc, labels) панельдің әлемдегі орнын ЕШҚАШАН
 * оқымайды. Орын тек 3D-ге керек, ал 3D бұрыннан позамен жұмыс істейді
 * (`placementPose` → `SceneItem.pose`).
 */
import { generateCabinet } from './generateCabinet'
import { generateHardware } from './hardware'
import { walkTree } from './tree'
import type { GroupNode, Pose, SolidSpec } from './tree'
import type { Catalog, Panel, SettingsOverride } from './types'
import type { HardwarePlacement } from './hardware'

export type FlatNode = {
  nodeId: string
  name: string
  /** Түйіннің ЛОКАЛ кеңістігінде */
  panels: Panel[]
  hardware: HardwarePlacement[]
  pose: Pose
}

export type PlacedSolid = {
  nodeId: string
  name: string
  spec: SolidSpec
  pose: Pose
}

export type FlatScene = { nodes: FlatNode[]; solids: PlacedSolid[] }

export function flattenTree(
  root: GroupNode,
  catalog: Catalog,
  settings?: SettingsOverride,
): FlatScene {
  const nodes: FlatNode[] = []
  const solids: PlacedSolid[] = []

  walkTree(root, (node, pose) => {
    switch (node.kind) {
      case 'group':
        // Топ — контейнер. Өзі ештеңе шығармайды, балалары шығарады.
        return
      case 'cabinet':
        nodes.push({
          nodeId: node.id,
          name: node.name,
          panels: generateCabinet(node.config, catalog, settings),
          hardware: generateHardware(node.config, catalog, settings),
          pose,
        })
        return
      case 'board':
        // Task 3-те толады.
        return
      case 'solid':
        solids.push({ nodeId: node.id, name: node.name, spec: node.solid, pose })
        return
    }
  })

  return { nodes, solids }
}

/** Өндірістік тізбекке берілетін жалпы тізім (орын маңызды емес). */
export function scenePanels(scene: FlatScene): Panel[] {
  return scene.nodes.flatMap((n) => n.panels)
}
