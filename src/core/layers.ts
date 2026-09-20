/**
 * ҚАБАТТАР (слои) — PRO100 паритеті, `docs/pro100/parity.md` §2.1
 * («Қабат (слои) басқару, қосу/өшіру/атын өзгерту/түс», `TLAYERSFORM`,
 * бұрын ❌ болатын), `docs/pro100/ui-design.md` §2 («Слои» панелі.
 *
 * Таза TypeScript, React/three.js/Next.js импорты ЖОҚ (CLAUDE.md §3).
 *
 * Қабат — түйіннің ҚАСИЕТІ (`SceneNode.layerId`, `tree.ts`), ал қабаттардың
 * ӨЗІ (аты/көрінуі/құлпы/түсі) жоба деңгейінде сақталады
 * (`schema.ts` → `ProjectFileWithLayersSchema`, `layers-report.md`-де
 * негіздеме). Бұл файл — таза функциялар: жасау/өшіру/атын өзгерту,
 * көрінуін/құлпын шешу, `flattenTree`-мен бірге істейтін hidden-байланыс
 * және құлыпты тексеретін мутация күзеті.
 */
import { ConfigValidationError } from './errors'
import { findNode } from './tree'
import type { GroupNode, SceneNode, Transform } from './tree'

export type Layer = {
  id: string
  name: string
  /** Көз белгісі. `false` болса — 3D-де де, есепте де көрінбейді (`flattenTree`). */
  visible: boolean
  /** Құлып белгісі. `true` болса — қабаттағы түйінді жылжытуға/өзгертуге болмайды. */
  locked: boolean
  /** UI-дегі түс белгісі, hex («Слои» панеліндегі түс бағанасы). */
  color: string
}

/**
 * Әрқашан бар, өшірілмейтін қабат. Жаңа жобаның бірінші қабаты осы, әрі
 * жоқ/өшірілген қабатқа сілтеген түйін де осыған түседі (§ силент catch
 * жоқ — `resolveLayer` төменде `console.warn` жазады).
 */
export const DEFAULT_LAYER_ID = 'default'

export function createDefaultLayer(): Layer {
  return { id: DEFAULT_LAYER_ID, name: 'Әдепкі қабат', visible: true, locked: false, color: '#9a9a9a' }
}

/** Тізімде әдепкі қабат әрқашан болуын қамтамасыз етеді (жаңа/ескі жоба). */
export function ensureDefaultLayer(layers: Layer[]): Layer[] {
  if (layers.some((l) => l.id === DEFAULT_LAYER_ID)) return layers
  return [createDefaultLayer(), ...layers]
}

/**
 * Жаңа қабат қосады. `id` шақырушыдан келеді (басқа `tree.ts`/`layers.ts`
 * функциялары сияқты — таза функция кездейсоқ id ойлап таппайды, UI өз
 * генераторын қолданады).
 */
export function createLayer(layers: Layer[], id: string, name: string): Layer[] {
  if (layers.some((l) => l.id === id)) {
    throw new ConfigValidationError('layer.id', `қабат id қайталанды: "${id}"`, 'бірегей id')
  }
  return [...layers, { id, name, visible: true, locked: false, color: '#4a90d9' }]
}

export function renameLayer(layers: Layer[], id: string, name: string): Layer[] {
  return layers.map((l) => (l.id === id ? { ...l, name } : l))
}

export function setLayerVisible(layers: Layer[], id: string, visible: boolean): Layer[] {
  return layers.map((l) => (l.id === id ? { ...l, visible } : l))
}

export function setLayerLocked(layers: Layer[], id: string, locked: boolean): Layer[] {
  return layers.map((l) => (l.id === id ? { ...l, locked } : l))
}

export function setLayerColor(layers: Layer[], id: string, color: string): Layer[] {
  return layers.map((l) => (l.id === id ? { ...l, color } : l))
}

/**
 * Ағаштың ӘРБІР түйініне `fn`-ды қолданып, жаңа ағаш қайтарады (иммутабельді).
 * `updateNodeTransform`, `setNodeLayer`, `reassignLayer` осыны ортақ
 * пайдаланады — рекурсия бір жерде жазылады.
 */
function mapTree(root: GroupNode, fn: (node: SceneNode) => SceneNode): GroupNode {
  const step = (node: SceneNode): SceneNode => {
    const next = fn(node)
    if (next.kind === 'group') {
      return { ...next, children: next.children.map(step) }
    }
    return next
  }
  return step(root) as GroupNode
}

/**
 * Ағаштағы әр `fromLayerId` түйінін `toLayerId`-ге ауыстырады. Түйіннің
 * басқа ешбір өрісі өзгермейді — тек `layerId`.
 */
function reassignLayer(root: GroupNode, fromLayerId: string, toLayerId: string): GroupNode {
  return mapTree(root, (node) => (node.layerId === fromLayerId ? { ...node, layerId: toLayerId } : node))
}

/**
 * Қабатты жояды. Ондағы түйіндер ЖОҒАЛМАЙДЫ — ӘДЕПКІ қабатқа ауысады
 * (талап: «қабат өшірілгенде ондағы түйіндер жоғалмайды»).
 */
export function deleteLayer(
  root: GroupNode,
  layers: Layer[],
  id: string,
): { root: GroupNode; layers: Layer[] } {
  if (id === DEFAULT_LAYER_ID) {
    throw new ConfigValidationError(
      'layer.id', 'әдепкі қабатты өшіруге болмайды', `id !== "${DEFAULT_LAYER_ID}"`,
    )
  }
  return {
    root: reassignLayer(root, id, DEFAULT_LAYER_ID),
    layers: layers.filter((l) => l.id !== id),
  }
}

/**
 * Түйіннің қабатын табады. Жоқ/өшірілген қабатқа сілтесе — ҚҰЛАМАЙДЫ,
 * ӘДЕПКІ қабатқа түседі әрі `console.warn` жазады (no silent catch,
 * CLAUDE.md §10).
 */
export function resolveLayer(layerId: string | undefined, layers: Layer[]): Layer {
  const effective = ensureDefaultLayer(layers)
  const fallback = effective.find((l) => l.id === DEFAULT_LAYER_ID) ?? createDefaultLayer()
  if (layerId === undefined) return fallback
  const found = effective.find((l) => l.id === layerId)
  if (found) return found
  console.warn(`[layers] жоқ қабатқа сілтеме: "${layerId}" — түйін әдепкі қабатқа түсті`)
  return fallback
}

/** `flattenTree`-дегі `hidden` жолымен бірге қолданылады: қабат жасырын ба. */
export function isNodeHiddenByLayer(node: { layerId?: string | undefined }, layers: Layer[]): boolean {
  return resolveLayer(node.layerId, layers).visible === false
}

/**
 * Түйінді өзгертуге/жылжытуға бола ма — тексереді. Болмаса
 * `ConfigValidationError` лақтырады, өріс атымен (§10: «құлыпталған
 * қабаттағы түйінді таңдауға/жылжытуға болмайды»).
 */
export function assertNodeEditable(node: SceneNode, layers: Layer[]): void {
  if (node.locked === true) {
    throw new ConfigValidationError('node.locked', `түйін құлыпталған: "${node.name}"`, 'locked = false')
  }
  const layer = resolveLayer(node.layerId, layers)
  if (layer.locked) {
    throw new ConfigValidationError(
      'node.layerId',
      `қабат құлыпталған: "${layer.name}" (${layer.id})`,
      'layer.locked = false',
    )
  }
}

/**
 * Түйіннің transform-ын (жылжыту/бұрылыс) ауыстырады, алдымен құлыпты
 * тексеріп барып. Табылмаса не құлыпты болса — өзгертпей
 * `ConfigValidationError` лақтырады.
 */
export function updateNodeTransform(
  root: GroupNode,
  nodeId: string,
  transform: Transform,
  layers: Layer[],
): GroupNode {
  const node = findNode(root, nodeId)
  if (!node) {
    throw new ConfigValidationError('nodeId', `түйін табылмады: "${nodeId}"`, 'ағаштағы бар id')
  }
  assertNodeEditable(node, layers)
  return mapTree(root, (n) => (n.id === nodeId ? { ...n, transform } : n))
}

/**
 * Түйінді басқа қабатқа тағайындайды («түйінді қабатқа тағайындау», §2.1).
 * Ағымдағы қабат құлыпты болса — ConfigValidationError (жаңа қабатқа
 * жылжыту да мутация, `assertNodeEditable`-мен бірдей ережемен қорғалады).
 */
export function setNodeLayer(
  root: GroupNode,
  nodeId: string,
  layerId: string,
  layers: Layer[],
): GroupNode {
  const node = findNode(root, nodeId)
  if (!node) {
    throw new ConfigValidationError('nodeId', `түйін табылмады: "${nodeId}"`, 'ағаштағы бар id')
  }
  assertNodeEditable(node, layers)
  return mapTree(root, (n) => (n.id === nodeId ? { ...n, layerId } : n))
}
