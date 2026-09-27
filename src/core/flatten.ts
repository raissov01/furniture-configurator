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
import { validateJointDrill } from './autoJoint'
import { generateHardware } from './hardware'
import { ORIGIN_POSE, composePose } from './tree'
import type { GroupNode, Pose, SolidSpec, BoardNode, SceneNode } from './tree'
import type { Catalog, Panel, SettingsOverride, ConstructionSettings, EdgeBand } from './types'
import type { HardwarePlacement } from './hardware'
import { mergeSettings } from './constants'
import { calculateCutDimensions } from './edges'
import { ConfigValidationError } from './errors'
import { rotationFor } from './geometry'
import { derivePolygonContour } from './polygon'
import { isNodeHiddenByLayer } from './layers'
import type { Layer } from './layers'
import type { AutoJointRecord } from './autoJointRebuild'
import { rebuildAutoJoints } from './autoJointRebuild'

export type FlatNode = {
  nodeId: string
  name: string
  /** Түйіннің ЛОКАЛ кеңістігінде */
  panels: Panel[]
  hardware: HardwarePlacement[]
  pose: Pose
  /** Осы түйіннің панельдері есептелген нақты өндірістік баптау. */
  settings?: ConstructionSettings | undefined
}

export type PlacedSolid = {
  nodeId: string
  name: string
  spec: SolidSpec
  pose: Pose
}

export type FlatScene = { nodes: FlatNode[]; solids: PlacedSolid[] }

/**
 * Еркін тақта → деталь.
 *
 * Орны {0,0,0}: түйіннің ЛОКАЛ басы тақтаның өз басы. Әлемдегі орны
 * `FlatNode.pose`-та.
 */
function boardPanel(
  node: BoardNode,
  catalog: Catalog,
  bands: Map<string, EdgeBand>,
  settings: ConstructionSettings,
): Panel {
  const spec = node.board
  if (spec.veneerGroup !== undefined && (!spec.veneerGroup.trim() || spec.veneerGroup.trim() !== spec.veneerGroup)) {
    throw new ConfigValidationError(`board[${node.id}].veneerGroup`,
      'шпон тобы бос емес, шеттерінде бос орынсыз болуы керек', 'бос емес топ атауы')
  }
  const material = catalog.materials.find((m) => m.id === spec.materialId)
  if (!material) {
    throw new ConfigValidationError(
      `board[${node.id}].materialId`,
      `материал табылмады: "${spec.materialId}"`,
    )
  }
  for (const [edge, band] of Object.entries(spec.edges)) {
    if (band && !bands.has(band.bandId)) {
      throw new ConfigValidationError(
        `board[${node.id}].edges.${edge}.bandId`,
        `кромка табылмады: "${band.bandId}"`,
        [...bands.keys()].join(' | '),
      )
    }
  }
  if (spec.contour && Object.values(spec.edges).some(Boolean)) {
    throw new ConfigValidationError(`board[${node.id}].edges`,
      'контур кесінділерінің кромкасы contour.bands ішінде беріледі', 'төрт жиек те бос')
  }
  if (spec.contour && (spec.corners || (spec.cutouts?.length ?? 0) > 0)) {
    throw new ConfigValidationError(`board[${node.id}].contour`,
      'контурмен бірге corners/cutouts операциясы қолдау таппайды', 'тек контур')
  }
  const contour = spec.contour
    ? derivePolygonContour(spec.contour, spec.length, spec.width, bands,
      settings.minBandSubtract, `board[${node.id}].contour`)
    : undefined
  const { cutLength, cutWidth } = contour ?? calculateCutDimensions(
    spec.length, spec.width, spec.edges, bands, settings,
  )
  for (const [field, value] of Object.entries({ cutLength, cutWidth })) {
    if (!Number.isInteger(value) || value <= 0) {
      throw new ConfigValidationError(
        `board[${node.id}].${field}`, `кромка шегерілгеннен кейінгі өлшем: ${value}`,
        'бүтін мм > 0',
      )
    }
  }
  const panel: Panel = {
    id: node.id,
    role: spec.role,
    label: node.name,
    materialId: material.id,
    finishedLength: spec.length,
    finishedWidth: spec.width,
    cutLength,
    cutWidth,
    edges: spec.edges,
    ...(contour ? { contour: { points: contour.points, bands: contour.bands,
      cutPoints: contour.cutPoints } } : {}),
    grainAlongLength: spec.grainAlongLength,
    ...(spec.veneerGroup ? { veneerGroup: spec.veneerGroup } : {}),
    qty: 1,
    position: { x: 0, y: 0, z: 0 },
    rotation: rotationFor(spec.orientation),
    orientation: spec.orientation,
    note: '',
    drilling: spec.drilling ?? [],
    cutouts: spec.cutouts ?? [],
    grooves: [],
    milling: spec.milling ?? [],
    ...(spec.corners ? { corners: spec.corners } : {}),
  }
  panel.drilling.forEach((hole, index) => validateJointDrill(panel, hole, material.thickness,
    `board[${node.id}].drilling.${index}`))
  return panel
}

export function flattenTree(
  root: GroupNode,
  catalog: Catalog,
  settings?: SettingsOverride,
  /**
   * Жобаның қабаттары (`layers.ts`). ЕРІКТІ: берілмесе, тек `node.hidden`
   * қаралады — ескі шақырулар (тесттер, `flattenEquivalence.test.ts`)
   * өзгеріссіз жұмыс істейді.
   */
  layers?: Layer[],
  autoJoints?: readonly AutoJointRecord[],
): FlatScene {
  const nodes: FlatNode[] = []
  const solids: PlacedSolid[] = []
  const bands = new Map(catalog.edgeBands.map((b) => [b.id, b]))
  const merged = mergeSettings(settings)

  const step = (node: SceneNode, parent: Pose): void => {
    // Көрінбейтін деталь деталировкаға да, сметаға да түспеуі керек:
    // әйтпесе клиент көрмеген нәрсеге ақша төлейді. Топ жасырылса —
    // балалары да жасырын, сондықтан рекурсия осы жерде тоқтайды.
    //
    // ⚠ Қабаттың жасырылуы (`layers.ts`) ЖАҢА МЕХАНИЗМ ЕМЕС — дәл осы
    // `hidden` жолымен өтеді, тек шарт кеңейді: түйіннің өз `hidden`
    // белгісі НЕМЕСЕ оның қабаты жасырын болса, рекурсия осында тоқтайды.
    if (node.hidden === true) return
    // Түбір — жоба контейнері, қабатқа жатпайды: әйтпесе «Әдепкі қабатты»
    // жасыру басқа қабаттардың түйіндерін де жасырып жібереді.
    if (layers !== undefined && node !== root && isNodeHiddenByLayer(node, layers)) return
    const pose = composePose(parent, node.transform)
    switch (node.kind) {
      case 'group':
        // Топ — контейнер. Өзі ештеңе шығармайды, балалары шығарады.
        for (const child of node.children) step(child, pose)
        return
      case 'cabinet':
        nodes.push({
          nodeId: node.id,
          name: node.name,
          panels: generateCabinet(node.config, catalog, settings),
          hardware: generateHardware(node.config, catalog, settings),
          pose,
          settings: mergeSettings(settings, node.config.settings),
        })
        return
      case 'board':
        nodes.push({
          nodeId: node.id,
          name: node.name,
          panels: [boardPanel(node, catalog, bands, merged)],
          hardware: [],
          pose,
          settings: merged,
        })
        return
      case 'solid':
        solids.push({ nodeId: node.id, name: node.name, spec: node.solid, pose })
        return
      case 'annotation':
        // Тек көрініс: өндірістік FlatNode/Panel/Hardware қатарына кірмейді.
        return
    }
  }
  step(root, ORIGIN_POSE)

  for (const joint of autoJoints ? rebuildAutoJoints(root, autoJoints, catalog, settings, layers) : []) {
    if (joint.status !== 'valid') continue
    for (const result of joint.drilling) {
      const node = nodes.find((item) => item.nodeId === result.boardId)
      const panel = node?.panels[0]
      if (!panel || !node || node.panels.length !== 1) continue
      // BoardSpec.drilling — тек қол тесіктері. Авто тесіктер осы көрініске ғана қосылады.
      panel.drilling = [...panel.drilling, ...result.drilling.map((hole) => ({ ...hole }))]
    }
  }

  return { nodes, solids }
}

/** Өндірістік тізбекке берілетін жалпы тізім (орын маңызды емес). */
export function scenePanels(scene: FlatScene): Panel[] {
  return scene.nodes.flatMap((n) => n.panels)
}
