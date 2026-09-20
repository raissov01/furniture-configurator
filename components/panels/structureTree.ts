/**
 * «Структура проекта» докинг панелінің ТАЗА логикасы (CLAUDE.md §3 рухында:
 * React жоқ, есептеу React-тан бөлек).
 *
 * Ағаштың өзі 09-20 қосылған `src/core/tree.ts` + `treeFromProject` +
 * `flattenTree`-ден шығады — мұнда ЕШТЕҢЕ қайта есептелмейді, тек нәтиже
 * (`FlatScene`) экранға жолдар (`StructureRow[]`) болып тегістеледі.
 *
 * PRO100-дың идеясы (docs/pro100/ui-design.md §2): «Структура проекта» —
 * нағыз ағаш, топ → корпус → деталь. Бізде топ деңгейі — жоба (root), корпус
 * деңгейі — `CabinetNode`, деталь деңгейі — `flattenTree`-ден шыққан
 * `Panel[]`. `ModuleList`-тен айырмашылығы дәл осында: ол корпус деңгейінде
 * тоқтайды, бұл — детальге дейін түседі.
 */
// ⚠ ТІКЕЛЕЙ ЖОЛ, `@/`-АЛИАС ЕМЕС: бұл файлды `tests/`-тегі vitest те импорттайды,
// ал `vitest.config.ts`-те `@`-алиасы жоқ (тек Next.js өзі оны tsconfig-тен
// біледі). Форбидден файлды түзетпеу үшін (`vitest.config.ts` менде жоқ),
// осы төрт таза модуль тікелей салыстырмалы жолмен импорттайды.
import { flattenTree, projectPanelId, treeFromProject, ROLE_NAMES } from '../../src/core/index'
import type {
  CabinetConfig, Catalog, FlatScene, Placement, Room, SettingsOverride,
} from '../../src/core/index'

/** Жоба (cabinets+placements+room+catalog) → жайылған сахна (FlatScene). */
export function buildProjectScene(
  room: Room,
  cabinets: CabinetConfig[],
  placements: Placement[],
  catalog: Catalog,
  projectName: string,
  settings?: SettingsOverride,
): FlatScene {
  const root = treeFromProject({
    schemaVersion: 3,
    name: projectName,
    materials: catalog.materials,
    edgeBands: catalog.edgeBands,
    cabinets,
    room,
    placements,
  })
  return flattenTree(root, catalog, settings)
}

export type StructureRow =
  | {
      kind: 'cabinet'
      /** React `key` мен DOM хук үшін бірегей. */
      id: string
      cabinetId: string
      depth: 0
      label: string
      partCount: number
    }
  | {
      kind: 'part'
      id: string
      cabinetId: string
      depth: 1
      label: string
      roleLabel: string
      /** `store.selected`-ке жазылатын кілт — `projectPanelId`-мен БІРДЕЙ ереже
       * (3D-де басқанда, `Workspace.tsx`-тегі ақпарат жолағында қолданылатын
       * кілтпен сәйкес келуі үшін). */
      selectId: string
    }

/**
 * `FlatScene` → экрандағы жолдар. Тереңдігі тұрақты екі деңгей (корпус,
 * деталь), сондықтан рекурсия ЖОҚ — жоба 10+ модульді ұстаса да (гоча #3),
 * бұл жәй екі енгізілген цикл.
 */
export function flatSceneToRows(scene: FlatScene): StructureRow[] {
  const cabinetCount = scene.nodes.length
  const rows: StructureRow[] = []
  for (const node of scene.nodes) {
    rows.push({
      kind: 'cabinet',
      id: `cabinet:${node.nodeId}`,
      cabinetId: node.nodeId,
      depth: 0,
      label: node.name,
      partCount: node.panels.length,
    })
    for (const panel of node.panels) {
      rows.push({
        kind: 'part',
        id: `part:${node.nodeId}:${panel.id}`,
        cabinetId: node.nodeId,
        depth: 1,
        label: panel.label || ROLE_NAMES[panel.role],
        roleLabel: ROLE_NAMES[panel.role],
        selectId: projectPanelId(node.nodeId, panel.id, cabinetCount),
      })
    }
  }
  return rows
}
