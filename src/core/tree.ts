/**
 * ТҮЙІНДЕР АҒАШЫ — еркін редактордың өзегі (spec 2026-09-20).
 *
 * Таза TypeScript: React, three.js, Next.js импорты ЖОҚ (CLAUDE.md §3).
 *
 * Ағаштың мәні — PRO100-дағы «элементтің ішіне элемент салу»: топты
 * жылжытқанда балалары бірге жылжуы керек. Сондықтан әр түйіннің
 * `transform`-ы АТА-ТҮЙІНГЕ қатысты, ал әлемдегі орны аралау кезінде
 * жиналады.
 */
import { ConfigValidationError } from './errors'
import type {
  CabinetConfig, Drill, Orientation,
  PanelCorners, PanelEdges, PanelRole, Vec3,
} from './types'
import type { Cutout } from './cutouts'
import type { MillingPath } from './milling'

/** Ата-түйінге ҚАТЫСТЫ орны. Орын — бүтін мм (§0.2), бұрыш — градус. */
export type Transform = { pos: Vec3; rot: Vec3 }

export const IDENTITY_TRANSFORM: Transform = {
  pos: { x: 0, y: 0, z: 0 },
  rot: { x: 0, y: 0, z: 0 },
}

/**
 * ӘЛЕМДЕГІ орны. `placementPose` қайтаратын пішінмен әдейі БІРДЕЙ: 3D сахна
 * бұрыннан осымен жұмыс істейді, екінші келісім ойлап табудың қажеті жоқ.
 */
export type Pose = { position: Vec3; rotationY: number }

export const ORIGIN_POSE: Pose = { position: { x: 0, y: 0, z: 0 }, rotationY: 0 }

type NodeBase = {
  id: string
  name: string
  transform: Transform
  /** Көрінбейтін түйін деталировкаға да, сметаға да ТҮСПЕЙДІ */
  hidden?: boolean | undefined
  locked?: boolean | undefined
  /**
   * Қабат (слои, PRO100 паритеті `docs/pro100/parity.md` §2.1
   * `TLAYERSFORM`). Қабаттың өзі (аты/көрінуі/құлпы/түсі) осында ЖОҚ —
   * ол жоба деңгейінде сақталады (`src/core/layers.ts` `Layer`,
   * `src/core/schema.ts` `ProjectFileWithLayersSchema`). Мұнда тек СІЛТЕМЕ:
   * түйін қай қабатқа тиесілі. Жоқ болса — әдепкі қабат
   * (`src/core/layers.ts` `DEFAULT_LAYER_ID`).
   */
  layerId?: string | undefined
}

export type GroupNode = NodeBase & { kind: 'group'; children: SceneNode[] }
export type CabinetNode = NodeBase & { kind: 'cabinet'; config: CabinetConfig }
export type BoardNode = NodeBase & { kind: 'board'; board: BoardSpec }
export type SolidNode = NodeBase & { kind: 'solid'; solid: SolidSpec }

export type SceneNode = GroupNode | CabinetNode | BoardNode | SolidNode

/**
 * ЕРКІН ТАҚТА = бір деталь.
 *
 * `cutLength`/`cutWidth` әдейі ЖОҚ: рез өлшемі кромкадан есептеледі
 * (CLAUDE.md §4.3). Оны қолмен енгізуге рұқсат етсек, екі ақиқат көзі пайда
 * болады да, цехқа қате сан кетеді.
 */
export type BoardSpec = {
  materialId: string
  /** ГОТОВЫЙ ұзындығы, мм */
  length: number
  /** ГОТОВЫЙ ені, мм */
  width: number
  orientation: Orientation
  edges: PanelEdges
  grainAlongLength: boolean
  /** Бір шпон өрнегіне жататын детальдардың ортақ идентификаторы. */
  veneerGroup?: string | undefined
  role: PanelRole
  drilling?: Drill[] | undefined
  cutouts?: Cutout[] | undefined
  corners?: PanelCorners | undefined
  milling?: MillingPath[] | undefined
}

/** Өндіріске КЕТПЕЙТІН қорап: техника, тас, декор. */
export type SolidSpec = {
  size: Vec3
  color?: string | undefined
  textureId?: string | undefined
}

/**
 * 90°-қа еселі бұрышта cos/sin ДӘЛ ±1 не 0 болуы керек.
 * `Math.cos(Math.PI)` −0.9999999999999999 береді де, 450 мм-лік шкаф
 * 450.0000000000001 болып шығады (room.ts-тегі сол ескерту).
 */
function snapTrig(n: number): number {
  if (Math.abs(n) < 1e-9) return 0
  if (Math.abs(n - 1) < 1e-9) return 1
  if (Math.abs(n + 1) < 1e-9) return -1
  return n
}

/**
 * Ата позасына бала трансформасын қосу.
 *
 * Бұрылыс бағыты `room.ts`-тегі `placementCorners`-пен бірдей:
 *   world.x = pos.x + lx·cos + lz·sin
 *   world.z = pos.z − lx·sin + lz·cos
 *
 * ⚠ 1-фазада тек Y осі. Жиһазда қажеті де сол: шкаф қабырғаға бұрылады,
 * шалқайып тұрмайды. X/Z бойынша бұрылыс Euler құрамасын талап етеді —
 * ол кейінгі фазада, `SolidNode`-қа қисық декор керек болғанда.
 */
export function composePose(parent: Pose, child: Transform): Pose {
  if (child.rot.x !== 0 || child.rot.z !== 0) {
    throw new ConfigValidationError(
      'transform.rot',
      'бұл фазада тек Y осі бойынша бұрылысқа қолдау бар',
      'rot.x = 0 және rot.z = 0',
    )
  }
  const a = (parent.rotationY * Math.PI) / 180
  const cos = snapTrig(Math.cos(a))
  const sin = snapTrig(Math.sin(a))
  return {
    position: {
      x: parent.position.x + child.pos.x * cos + child.pos.z * sin,
      y: parent.position.y + child.pos.y,
      z: parent.position.z - child.pos.x * sin + child.pos.z * cos,
    },
    rotationY: parent.rotationY + child.rot.y,
  }
}

/**
 * Ағашты тереңдігінен аралау. Әр түйінге ӘЛЕМДЕГІ позасы беріледі.
 * Түбірдің өзі де кіреді — оның да трансформасы болуы мүмкін.
 */
export function walkTree(
  root: GroupNode,
  visit: (node: SceneNode, pose: Pose) => void,
): void {
  const step = (node: SceneNode, parent: Pose): void => {
    const pose = composePose(parent, node.transform)
    visit(node, pose)
    if (node.kind === 'group') {
      for (const child of node.children) step(child, pose)
    }
  }
  step(root, ORIGIN_POSE)
}

export function findNode(root: GroupNode, id: string): SceneNode | undefined {
  let found: SceneNode | undefined
  walkTree(root, (node) => {
    if (found === undefined && node.id === id) found = node
  })
  return found
}
