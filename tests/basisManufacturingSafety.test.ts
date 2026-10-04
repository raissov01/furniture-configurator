import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { importBasisB3d, type BasisImportResult } from '../src/core/import/basisB3d'
import { readBasisContainer, child, childrenOf, num, type BzNode } from '../src/core/import/basisBz'
import { writeBasisContainer } from './fixtures/basisContainerWriter'
import { SceneNodeSchema, parseProjectV4 } from '../src/core/projectV4'
import { flattenTree } from '../src/core/flatten'
import { walkTree, type BoardNode } from '../src/core/tree'
import { SEED_CATALOG } from '../src/core/seed'
import { cutListToCsv, drillingToCsv, cutListToXlsx, panelToDxf, cncFiles, cncIndexCsv,
  basisPartsCsv, basisPartsXlsx, basisDrillingCsv, basisScriptData, partLabels, assemblyDrawingPdf } from '../src/core/export'
import { nestPanels } from '../src/core/nesting'
import { runShopExport } from '../lib/shopExport'
import { referenceProject } from './fixtures'

const source = () => readFileSync(new URL('./fixtures/basis/shn720x550x600-sp8-2d-mojka.b3d', import.meta.url))
function boards(result: BasisImportResult): BoardNode[] {
  const list: BoardNode[] = []
  walkTree(result.root, node => { if (node.kind === 'board') list.push(node) })
  return list
}
function catalogOf(result: BasisImportResult) {
  return {
    materials: result.materials.map(m => ({ ...SEED_CATALOG.materials[0]!, id: m.id, name: m.name, thickness: m.thickness })),
    edgeBands: result.bands.map(b => ({ id: b.id, name: b.name, thickness: b.thickness ?? 0.4, pricePerMeter: 0 })),
  }
}

describe('B3D manufacturing fidelity', () => {
  it('preserves 2.8 mm diameter and 11.5 mm depth through import, schema and flattening', () => {
    const { header, document } = readBasisContainer(source())
    let changed = 0
    for (const entry of childrenOf(child(document, 'FurnList'))) {
      for (const hole of childrenOf(child(entry, 'Holes'), 'Hole')) {
        const radius = child(hole, 'Radius'), depth = child(hole, 'Depth')
        if (radius?.type === 'float' && radius.value === 2.5) { radius.value = 1.4; changed++ }
        if (depth?.type === 'float' && depth.value === 34) depth.value = 11.5
      }
    }
    expect(changed).toBeGreaterThan(0)
    const result = importBasisB3d(writeBasisContainer(header, document))
    const drills = boards(result).flatMap(b => b.board.drilling ?? [])
    expect(drills).toContainEqual(expect.objectContaining({ diameter: 2.8, depth: 11.5 }))
    expect(result.warnings.some(w => w.code === 'hole-rounded')).toBe(false)
    const root = SceneNodeSchema.parse(JSON.parse(JSON.stringify(result.root)))
    expect(root.kind).toBe('group')
    if (root.kind !== 'group') throw new Error('Expected group')
    expect(flattenTree(root, catalogOf(result)).nodes.flatMap(n => n.panels).flatMap(p => p.drilling))
      .toContainEqual(expect.objectContaining({ diameter: 2.8, depth: 11.5 }))
  })

  it('persists the missing-groove manufacturing block across save/reopen while retaining preview panels', async () => {
    const result = importBasisB3d(source()), catalog = catalogOf(result)
    const project = parseProjectV4({ ...parseProjectV4(referenceProject), ...catalog, root: result.root })
    const reopened = parseProjectV4(JSON.parse(JSON.stringify(project)))
    const scene = flattenTree(reopened.root, catalog), panels = scene.nodes.flatMap(n => n.panels)
    expect(panels).toHaveLength(10)
    // Every part of this partial imported model stays blocked, including copies/selections.
    for (const panel of panels) expect(panel.manufacturingBlockReason).toMatch(/groove-unsupported/)
    const operations = [
      () => cutListToCsv(panels, catalog), () => drillingToCsv(panels),
      () => cutListToXlsx(panels, catalog, 'Imported'), () => panelToDxf(panels[0]!),
      () => cncFiles(panels, catalog, { projectName: 'Imported' }), () => cncIndexCsv(panels, catalog, { projectName: 'Imported' }),
      () => basisPartsCsv(panels, catalog, { projectName: 'Imported' }), () => basisPartsXlsx(panels, catalog, { projectName: 'Imported' }),
      () => basisDrillingCsv(panels, { projectName: 'Imported' }), () => basisScriptData(scene, catalog, {}),
      () => nestPanels(panels, catalog), () => partLabels(panels, catalog),
    ]
    for (const operation of operations) expect(operation).toThrow(/groove-unsupported/)
    await expect(assemblyDrawingPdf({ panels, catalog, cabinet: referenceProject.cabinets[0]!,
      projectName: 'Imported', fonts: { regular: new Uint8Array(), bold: new Uint8Array() } })).rejects.toThrow(/groove-unsupported/)
    for (const format of ['csv', 'xlsx', 'dxf', 'pdf'] as const) {
      const save = vi.fn()
      await expect(runShopExport(format, { panels, catalog }, save)).rejects.toThrow(/groove-unsupported/)
      expect(save).not.toHaveBeenCalled()
    }
  })

  function replaceSideContour(contour: Uint8Array): BasisImportResult {
    const parsed = readBasisContainer(readFileSync(new URL('./fixtures/basis/shv1080x320x20-bok-fasad-pr.b3d', import.meta.url)))
    const replace = (node: BzNode): void => {
      if (node.type !== 'object') return
      if (num(node, 'Type') === 4002) {
        const target = child(node, 'Contour'), bands = child(node, 'Butts')
        if (target?.type !== 'blob' || bands?.type !== 'object') throw new Error('Invalid fixture')
        target.value = contour
        bands.children = []
      }
      node.children.forEach(replace)
    }
    replace(parsed.document)
    return importBasisB3d(writeBasisContainer(parsed.header, parsed.document))
  }

  it('blocks manufacturing when a source circle has been approximated by straight segments', () => {
    const circle = Buffer.alloc(29)
    circle.writeUInt32LE(1, 0); circle.writeUInt8(0x11, 4)
    for (const offset of [5, 13, 21]) circle.writeDoubleLE(1000, offset)
    const result = replaceSideContour(circle)
    expect(boards(result)[0]!.board.contour!.points).toHaveLength(36)
    expect(result.warnings.some(w => w.code === 'contour-approximated')).toBe(true)
    const panel = flattenTree(result.root, catalogOf(result)).nodes[0]!.panels[0]!
    expect(() => panelToDxf(panel)).toThrow(/contour-approximated/)
  })

  it('preserves a four-point trapezoid rather than replacing it with its rectangle bounds', () => {
    const points = [[0, 0], [2000, 0], [1600, 1000], [400, 1000]] as const
    const contour = Buffer.alloc(4 + 33 * points.length)
    contour.writeUInt32LE(points.length, 0)
    points.forEach((point, index) => {
      const start = 4 + 33 * index, next = points[(index + 1) % points.length]!
      contour.writeUInt8(0x10, start)
      ;[...point, ...next].forEach((value, offset) => contour.writeDoubleLE(value, start + 1 + offset * 8))
    })
    const result = replaceSideContour(contour)
    expect(boards(result)[0]!.board.contour?.points).toHaveLength(4)
    expect(result.warnings).toEqual([])
    const panel = flattenTree(result.root, catalogOf(result)).nodes[0]!.panels[0]!
    expect(panel.contour?.points).toHaveLength(4)
    expect(() => panelToDxf(panel)).not.toThrow()
  })

  it('blocks when imported hole positions must be rounded to the integer offset contract', () => {
    const parsed = readBasisContainer(source())
    const clearCuts = (node: BzNode): void => {
      if (node.type !== 'object') return
      if (node.key === 'Cuts') node.children = []
      node.children.forEach(clearCuts)
    }
    clearCuts(parsed.document)
    let changed = 0
    for (const entry of childrenOf(child(parsed.document, 'FurnList'))) {
      for (const hole of childrenOf(child(entry, 'Holes'), 'Hole')) {
        for (const axis of ['X', 'Y', 'Z']) {
          const point = child(hole, axis)
          if (point?.type === 'float' && Math.abs(num(hole, `Dir${axis}`)) < 0.01) {
            point.value += 0.4; changed++; break
          }
        }
      }
    }
    expect(changed).toBeGreaterThan(0)
    const result = importBasisB3d(writeBasisContainer(parsed.header, parsed.document))
    expect(result.warnings.some(w => w.code === 'groove-unsupported')).toBe(false)
    expect(result.warnings.some(w => w.code === 'hole-position-rounded')).toBe(true)
    const panels = flattenTree(result.root, catalogOf(result)).nodes.flatMap(node => node.panels)
    expect(() => drillingToCsv(panels)).toThrow(/hole-position-rounded/)
  })

  it('allows supported lossless imports to keep working', () => {
    const result = importBasisB3d(readFileSync(new URL('./fixtures/basis/shv1080x320x20-bok-fasad-pr.b3d', import.meta.url)))
    const catalog = catalogOf(result), panels = flattenTree(result.root, catalog).nodes.flatMap(n => n.panels)
    expect(result.warnings).toEqual([])
    expect(cutListToCsv(panels, catalog)).toContain('1080')
    expect(nestPanels(panels, catalog).unplaced).toEqual([])
  })
})
