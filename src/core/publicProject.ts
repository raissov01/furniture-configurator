import type { ProjectFile } from './types'
import type { ProjectFileV4 } from './projectV4'
import { discountAmount, priceProject } from './pricing'
import { flattenTree } from './flatten'
import { findNode } from './tree'
import type { GroupNode, SceneNode } from './tree'
import { specialPartRows } from './specialParts'
import { mergeProjectPanels } from './generateCabinet'
import { nestPanels } from './nesting'
import { nestingOptionsOf } from './shop'
import { ConfigValidationError } from './errors'
import type { ShopProfile } from './shop'

type SavedProject = ProjectFile | ProjectFileV4

function stripSpecialPrices(root: GroupNode): GroupNode {
  const strip = (node: SceneNode): SceneNode => {
    if (node.kind === 'group') return { ...node, children: node.children.map(strip) }
    if (node.kind === 'solid' && node.solid.fabrication) return { ...node,
      solid: { ...node.solid, fabrication: { ...node.solid.fabrication, unitPrice: 0 } } }
    return node
  }
  return { ...root, children: root.children.map(strip) }
}

/** A shop-floor copy keeps geometry but carries no commercial inputs. */
export function toProductionProject<T extends SavedProject>(project: T): T {
  return {
    ...project,
    materials: project.materials.map(({ slab, ...material }) => ({
      ...material,
      pricePerSheet: 0,
      ...(slab ? { slab: { stockLengths: slab.stockLengths, pricePerMeter: 0 } } : {}),
    })),
    edgeBands: project.edgeBands.map((band) => ({ ...band, pricePerMeter: 0 })),
    ...('root' in project ? { root: stripSpecialPrices(project.root) } : {}),
    priceOverrides: undefined,
  } as T
}

/** Shareable copy: the manually agreed sale price is the sole price retained. */
export function toPublicProject<T extends SavedProject>(project: T, finalTotal?: number): T {
  const production = toProductionProject(project)
  const overrides = project.priceOverrides
  // Жолдық жеңілдікті бағалар өшірілгеннен кейін қайта есептеу мүмкін емес.
  // Дәл соңғы сома белгілі болмаса клиентке бастапқы бағаны көрсетпейміз.
  const hasLineDiscounts = Object.keys(overrides?.lineDiscounts ?? {}).length > 0
  const salePrice = overrides?.salePrice
  if (finalTotal !== undefined && (!Number.isSafeInteger(finalTotal) || finalTotal < 0)) {
    throw new ConfigValidationError('priceOverrides.salePrice', 'жарамсыз қорытынды баға', '≥ 0, бүтін тиын')
  }
  const finalPrice = finalTotal ?? (salePrice === undefined || hasLineDiscounts ? undefined
    : salePrice - (overrides?.overallDiscount
      ? discountAmount(overrides.overallDiscount, salePrice, 'priceOverrides.overallDiscount') : 0))
  return {
    ...production,
    materials: production.materials.map(({ slab: _slab, ...material }) => material),
    info: undefined,
    priceOverrides: finalPrice === undefined ? undefined : { salePrice: finalPrice },
  } as T
}

/** Келісімге арналған ашық көшірме: КП қолданатын сол панельдер мен профильден нақты соманы алады. */
export function toPricedPublicProject(project: ProjectFileV4, shop: ShopProfile): ProjectFileV4 {
  const materialPrices = new Map(shop.materials.map((material) => [material.id, material.pricePerSheet]))
  const bandPrices = new Map(shop.edgeBands.map((band) => [band.id, band.pricePerMeter]))
  const catalog = {
    materials: project.materials.map((material) => ({ ...material,
      pricePerSheet: materialPrices.get(material.id) ?? 0 })),
    edgeBands: project.edgeBands.map((band) => ({ ...band,
      pricePerMeter: bandPrices.get(band.id) ?? 0 })),
    hingeSystems: shop.hingeSystems,
    handles: shop.handles,
  }
  const scene = flattenTree(project.root, catalog, project.settings ?? shop.settings,
    project.layers, project.autoJoints)
  const panels = mergeProjectPanels(scene.nodes.map((node) => ({ cabinetId: node.nodeId, panels: node.panels })))
  const hardware = scene.nodes.flatMap((node) => node.hardware)
  const moduleWidths = scene.nodes.flatMap((node) => {
    const source = findNode(project.root, node.nodeId)
    return source?.kind === 'cabinet' ? [source.config.width] : []
  })
  const nesting = nestPanels(panels, catalog, nestingOptionsOf(shop))
  const specialParts = specialPartRows(scene.solids.flatMap((solid) => solid.spec.fabrication
    ? [{ nodeId: solid.nodeId, name: solid.name, spec: solid.spec.fabrication }] : []),
    new Map(catalog.materials.map((material) => [material.id, material])))
  const price = priceProject(panels, nesting, shop, hardware, moduleWidths, project.priceOverrides, specialParts)
  if (price.missingPrices.length > 0) {
    throw new ConfigValidationError('priceOverrides.salePrice',
      `баға жетіспейді: ${price.missingPrices.join(', ')}`, 'барлық позиция бағасы толтырылсын')
  }
  return toPublicProject(project, price.total)
}
