import { describe, expect, it } from 'vitest'
import { generateCabinet } from '../src/core/generateCabinet'
import { mergeSettings } from '../src/core/constants'
import { catalog, oneSection, referenceWardrobe, withCabinet } from './fixtures'
import { fittingsForPanel } from '../lib/fittingGeometry'
import { boxFitting, fittingRenderParts } from '../lib/fittingRenderGeometry'

const bands = new Map(catalog.edgeBands.map((band) => [band.id, band]))

describe('F00o рельс геометриясы', () => {
  it('бағыттағышты панельдің box осіне көшіреді және ядро ұзындығынан асырмайды', () => {
    const panels = generateCabinet(withCabinet({
      sections: oneSection({ contents: [{ kind: 'drawers', count: 3 }] }),
    }), catalog)
    const side = panels.find((part) => part.drilling.some((hole) => hole.purpose === 'runner'))!
    const thickness = catalog.materials.find((material) => material.id === side.materialId)!.thickness
    const rail = fittingsForPanel(side, thickness, bands, mergeSettings(), panels).find((item) => item.rail)!
    const placed = boxFitting(rail, side, thickness)
    expect(placed.rail?.center.y).toBe(rail.rail!.center.x - side.finishedLength / 2)
    expect(placed.rail?.center.z).toBe(rail.rail!.center.y - side.finishedWidth / 2)
    const parts = fittingRenderParts(placed)
    const runner = parts.find((part) => part.kind === 'rail')!
    expect(runner.size.z).toBe(rail.rail!.length)
    expect(runner.size.y).toBeLessThanOrEqual(rail.diameter + rail.rail!.sideClearance)
    expect(runner.size.y).toBeLessThan(100)
  })

  it('әр фурнитура өз панелінің габаритіне жақын қалады', () => {
    for (const cabinet of [referenceWardrobe, withCabinet({
      sections: oneSection({ contents: [{ kind: 'drawers', count: 3 }] }),
    })]) {
      const panels = generateCabinet(cabinet, catalog)
      for (const panel of panels) {
        const thickness = catalog.materials.find((material) => material.id === panel.materialId)!.thickness
        const extents = { x: 0, y: 0, z: 0 }
        extents[panel.orientation.length] = panel.finishedLength
        extents[panel.orientation.width] = panel.finishedWidth
        extents[panel.orientation.thickness] = thickness
        for (const fitting of fittingsForPanel(panel, thickness, bands, mergeSettings(), panels)) {
          const placed = boxFitting(fitting, panel, thickness)
          for (const part of fittingRenderParts(placed)) {
            for (const axis of ['x', 'y', 'z'] as const) {
              expect(part.center[axis] - part.size[axis] / 2).toBeGreaterThanOrEqual(-extents[axis] / 2 - 40)
              expect(part.center[axis] + part.size[axis] / 2).toBeLessThanOrEqual(extents[axis] / 2 + 40)
            }
          }
        }
      }
    }
  })

})
