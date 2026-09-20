/**
 * v3 ЖОБА → ТҮЙІНДЕР АҒАШЫ.
 *
 * Таза TypeScript (CLAUDE.md §3).
 *
 * 1-фазада бұл функция `parseProject`-ке ЖАЛҒАНБАЙДЫ: қосымша әлі
 * `cabinets` + `placements` пішінімен жұмыс істейді. Ол 2-фазада, UI ағашқа
 * көшкенде, `schemaVersion` 4-ке көтерілгенде жалғанады. Қазір ол —
 * эквиваленттік тесттің кірісі.
 *
 * `placementPose` қабырға геометриясын бұрыннан біледі, сондықтан бұл жерде
 * қайта есептелмейді: екі жерде екі есеп болса, олар бір күні алшақтайды.
 */
import { placementPose } from './room'
import { IDENTITY_TRANSFORM } from './tree'
import type { CabinetNode, GroupNode } from './tree'
import type { ProjectFile } from './types'

export function treeFromProject(project: ProjectFile): GroupNode {
  const children: CabinetNode[] = []

  for (const cabinet of project.cabinets) {
    const placement = project.placements.find((p) => p.cabinetId === cabinet.id)
    // Орны жоқ шкаф сахнада да көрінбейді (`useSceneItems` сол ережемен
    // жүреді), сондықтан ағашқа да кірмейді.
    if (!placement) continue
    const pose = placementPose(project.room, cabinet, placement)
    children.push({
      kind: 'cabinet',
      id: cabinet.id,
      name: cabinet.name,
      transform: { pos: pose.position, rot: { x: 0, y: pose.rotationY, z: 0 } },
      config: cabinet,
    })
  }

  return {
    kind: 'group',
    id: 'root',
    name: project.name,
    transform: IDENTITY_TRANSFORM,
    children,
  }
}
