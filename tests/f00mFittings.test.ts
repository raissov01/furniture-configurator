import { describe, expect, it } from 'vitest'
import { mergeSettings } from '../src/core/constants'
import { generateCabinet } from '../src/core/generateCabinet'
import { catalog, oneSection, referenceWardrobe, withCabinet } from './fixtures'
import { fittingShape, fittingsForPanel, rodBracketCentres } from '../lib/fittingGeometry'

const bands = new Map(catalog.edgeBands.map((band) => [band.id, band]))

describe('рентген фурнитурасының 3D дерегі', () => {
  it('конфирматтың өзегін панель көлемімен шектейді', () => {
    const panels = generateCabinet(referenceWardrobe, catalog)
    const items = panels.flatMap((panel) => {
      const thickness = catalog.materials.find((m) => m.id === panel.materialId)!.thickness
      return fittingsForPanel(panel, thickness, bands, mergeSettings(), panels)
        .filter((item) => item.purpose === 'confirmat').map((item) => ({ panel, thickness, item }))
    })
    expect(items.length).toBeGreaterThan(0)
    for (const { panel, thickness, item } of items) {
      const size = { x: panel.finishedLength, y: panel.finishedWidth, z: thickness }
      for (const axis of ['x', 'y', 'z'] as const) {
        const end = item.point[axis] - item.normal[axis] * item.embeddedLength
        expect(end).toBeGreaterThanOrEqual(0)
        expect(end).toBeLessThanOrEqual(size[axis])
      }
    }
  })

  it('петля чашкасы, иіні және планкасы тесіктің Ø мен тереңдігін қолданады', () => {
    const part = generateCabinet(referenceWardrobe, catalog).find((panel) =>
      panel.drilling.some((hole) => hole.purpose === 'hinge' && hole.diameter >= 30))!
    const thickness = catalog.materials.find((m) => m.id === part.materialId)!.thickness
    const hinge = fittingsForPanel(part, thickness, bands, mergeSettings())
      .find((item) => item.purpose === 'hinge' && item.diameter >= 30)!
    const shape = fittingShape(hinge)
    expect(shape.head[0]).toBe(hinge.diameter)
    expect(shape.shaft[1]).toBe(hinge.embeddedLength)
    expect(shape.arm).not.toBeNull()
    expect(shape.plate).not.toBeNull()
  })

  it('бағыттағыш ұзындығы жәшік тереңдігі мен жүйенің шегерімінен шығады', () => {
    for (const drawerSystem of [undefined, 'tandem'] as const) {
      const parts = generateCabinet(withCabinet({ drawerSystem,
        sections: oneSection({ contents: [{ kind: 'drawers', count: 1 }] }),
      }), catalog)
      const side = parts.find((part) => part.drilling.some((hole) => hole.purpose === 'runner'))!
      const drawerSide = parts.find((part) => part.role === 'drawerSide')!
      const thickness = catalog.materials.find((m) => m.id === side.materialId)!.thickness
      const rails = fittingsForPanel(side, thickness, bands, mergeSettings(), parts)
        .filter((item) => item.rail)
      expect(rails).toHaveLength(1)
      expect(rails[0]!.rail!.length).toBe(drawerSide.finishedWidth + (drawerSystem ? 10 : 0))
    }
  })

  it('штанга ұстағыштары ядро көрсеткен екі ұшта', () => {
    expect(rodBracketCentres({ x: 300, y: 500, z: 200 }, 560)).toEqual([
      { x: 20, y: 500, z: 200 }, { x: 580, y: 500, z: 200 },
    ])
  })
})
