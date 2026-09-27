import { describe, expect, it } from 'vitest'
import { derivePolygonContour, validatePolygonContour } from '../src/core/polygon'
import { IDENTITY_TRANSFORM } from '../src/core/tree'
import { flattenTree } from '../src/core/flatten'
import { SEED_CATALOG } from '../src/core/seed'
import { edgeMetresByBand, panelAreaSquareMetres } from '../src/core/pricing'
import { priceProject } from '../src/core/pricing'
import { nestPanels } from '../src/core/nesting'
import { panelToDxf } from '../src/core/export/dxf'
import { formatCutList } from '../src/core/cutList'
import { defaultShopProfile } from '../src/core/shop'
import { parseProjectV4 } from '../src/core/projectV4'
import { referenceProject } from './fixtures'
import { isDrillWithinMaterial } from '../src/core/drillEdits'
import { validateJointDrill } from '../src/core/autoJoint'
import type { BoardNode, GroupNode } from '../src/core/tree'

const none = { L1: null, L2: null, W1: null, W2: null }
const band = { bandId: 'pvc2-h1145' }
const rectangle = {
  points: [{ x: 0, y: 0 }, { x: 600, y: 0 }, { x: 600, y: 400 }, { x: 0, y: 400 }],
  bands: [null, band, null, band],
}

function board(contour = rectangle): BoardNode {
  return {
    kind: 'board', id: 'polygon-1', name: 'Қиғаш тақта', transform: IDENTITY_TRANSFORM,
    board: { materialId: SEED_CATALOG.materials[0]!.id, length: 600, width: 400,
      role: 'custom', grainAlongLength: true,
      orientation: { length: 'x', width: 'y', thickness: 'z' },
      edges: none, contour },
  }
}

function panel(contour = rectangle) {
  const root: GroupNode = { kind: 'group', id: 'root', name: 'root',
    transform: IDENTITY_TRANSFORM, children: [board(contour)] }
  return flattenTree(root, SEED_CATALOG).nodes[0]!.panels[0]!
}

describe('polygon panel manufacturing', () => {
  it(' rejects holes in the missing L corner and holes whose radius crosses the cut contour', () => {
    const l = panel({ points: [
      { x: 0, y: 0 }, { x: 600, y: 0 }, { x: 600, y: 160 },
      { x: 220, y: 160 }, { x: 220, y: 400 }, { x: 0, y: 400 },
    ], bands: [null, null, null, null, null, null] })
    expect(isDrillWithinMaterial(l, 'inner', 400, 300, 10)).toBe(false)
    expect(isDrillWithinMaterial(l, 'inner', 210, 200, 30)).toBe(false)
    expect(isDrillWithinMaterial(l, 'inner', 100, 100, 10)).toBe(true)
    expect(() => validateJointDrill(l, {
      face: 'inner', x: 400, y: 300, diameter: 10, depth: 8, purpose: 'shelfPin',
    }, 16, 'drilling[0]')).toThrow(/position/)
  })
  it('subtracts thick bands from the cut contour and blank, preserving integer mm', () => {
    const p = panel()
    expect([p.cutLength, p.cutWidth]).toEqual([596, 400])
    expect(p.contour?.cutPoints).toEqual([
      { x: 0, y: 0 }, { x: 596, y: 0 }, { x: 596, y: 400 }, { x: 0, y: 400 },
    ])
    expect(nestPanels([p], SEED_CATALOG).byMaterial[0]?.sheets[0]?.parts[0])
      .toMatchObject({ width: 596, height: 400 })
  })

  it('does not subtract 0.4 mm band and prices the actual diagonal length', () => {
    const contour = { points: [
      { x: 0, y: 0 }, { x: 600, y: 0 }, { x: 600, y: 200 }, { x: 0, y: 400 },
    ], bands: [null, null, { bandId: 'pvc04-h1145' }, null] }
    const p = panel(contour)
    expect([p.cutLength, p.cutWidth]).toEqual([600, 400])
    expect(edgeMetresByBand([p]).get('pvc04-h1145')).toBeCloseTo(Math.hypot(600, 200) / 1000, 8)
    expect(panelAreaSquareMetres([p])).toBe(0.18)
    const dxf = panelToDxf(p)
    expect(dxf).toContain('LWPOLYLINE')
    expect(dxf).toContain('10\n600.0\n20\n200.0')
  })

  it('rejects crossing, noninteger, duplicate and degenerate contours', () => {
    const crossing = { points: [
      { x: 0, y: 0 }, { x: 600, y: 400 }, { x: 600, y: 0 }, { x: 0, y: 400 },
    ], bands: [null, null, null, null] }
    expect(() => validatePolygonContour(crossing, 600, 400)).toThrow(/contour/)
    expect(() => validatePolygonContour({ ...rectangle,
      points: rectangle.points.map((p, i) => i === 1 ? { ...p, x: 600.5 } : p),
    }, 600, 400)).toThrow(/contour/)
    expect(() => validatePolygonContour({ points: [
      { x: 0, y: 0 }, { x: 600, y: 0 }, { x: 600, y: 0 }, { x: 0, y: 400 },
    ], bands: [null, null, null, null] }, 600, 400)).toThrow(/contour/)
  })

  it('offsets a diagonal 2 mm band inward and validates the result', () => {
    const contour = { points: [
      { x: 0, y: 0 }, { x: 600, y: 0 }, { x: 600, y: 200 }, { x: 0, y: 400 },
    ], bands: [null, null, band, null] }
    const result = derivePolygonContour(contour, 600, 400, new Map([[band.bandId, { thickness: 2 }]]), 1)
    expect(result.cutPoints.every((p) => Number.isInteger(p.x) && Number.isInteger(p.y))).toBe(true)
    expect(result.cutPoints[2]!.y).toBeLessThan(200)
    expect(result.cutLength).toBe(600)
  })

  it('includes polygon edge cost in the quote and keeps distinct contours on separate cut-list rows', () => {
    const contour = { points: [
      { x: 0, y: 0 }, { x: 600, y: 0 }, { x: 600, y: 200 }, { x: 0, y: 400 },
    ], bands: [null, null, band, null] }
    const p = panel(contour)
    const shop = defaultShopProfile()
    shop.edgeBands.find((item) => item.id === band.bandId)!.pricePerMeter = 1000
    const quote = priceProject([p], nestPanels([p], SEED_CATALOG), shop)
    // Қиғаш кесінді: hypot(600, 200) мм × 1000 тиын/м = 632 тиын.
    expect(quote.edges.find((line) => line.id === band.bandId)?.cost)
      .toBe(Math.round(Math.hypot(600, 200)))
    const rows = formatCutList([p, panel()], SEED_CATALOG)
    expect(rows).toHaveLength(2)
    expect(rows[0]?.note).toContain('кромка: 3=2.0 мм')
  })

  it('persists valid contours in v4 and rejects crossing contours at parse time', () => {
    const project = parseProjectV4(referenceProject)
    // This board is built with SEED_CATALOG, so persist that same library.
    project.materials = SEED_CATALOG.materials
    project.edgeBands = SEED_CATALOG.edgeBands
    project.root.children = [board()]
    const parsed = parseProjectV4(JSON.parse(JSON.stringify(project)))
    expect(parsed.root.children[0]).toEqual(board())
    const crossing = board({ points: [
      { x: 0, y: 0 }, { x: 600, y: 400 }, { x: 600, y: 0 }, { x: 0, y: 400 },
    ], bands: [null, null, null, null] })
    project.root.children = [crossing]
    expect(() => parseProjectV4(JSON.parse(JSON.stringify(project)))).toThrow(/contour/)
  })

  it('rejects a second corner or cutout operation that the polygon DXF cannot represent safely', () => {
    const b = board()
    b.board.corners = { bottomLeft: 5, bottomRight: 0, topRight: 0, topLeft: 0 }
    const root: GroupNode = { kind: 'group', id: 'root', name: 'root',
      transform: IDENTITY_TRANSFORM, children: [b] }
    expect(() => flattenTree(root, SEED_CATALOG)).toThrow(/contour/)
  })
})
