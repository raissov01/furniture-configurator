import { describe, expect, it } from 'vitest'
import { mergeSettings } from '../src/core/constants'
import { generateCabinet } from '../src/core/generateCabinet'
import { catalog, oneSection, referenceWardrobe, withCabinet } from './fixtures'
import { fittingsForPanel, fittingShape } from '../lib/fittingGeometry'
import { xrayViewState } from '../lib/xrayView'
import { useConfigurator } from '../store/configurator'
import { HOTKEYS } from '../lib/hotkeys'
import { classicMenus } from '../lib/classicMenu'
import { readFileSync } from 'node:fs'
import { markerGroups, drillLegend } from '../lib/drillLegend'
import { drillToLocalMarker } from '../lib/drillGeometry'
import { rodBracketCentres } from '../lib/fittingGeometry'

const bands = new Map(catalog.edgeBands.map((band) => [band.id, band]))

describe('рентген көрінісі', () => {
  it('бір ауыстырғыш үш қабатты бірге қосады және бұрынғы көріністі қайтарады', () => {
    const initial = { viewMode: 'wire' as const, showDrilling: false, showFittings: false }
    expect(xrayViewState(initial, true)).toEqual({ viewMode: 'ghost', showDrilling: true, showFittings: true })
    expect(xrayViewState(initial, false)).toEqual(initial)
  })

  it('store ауыстырғышы, Вид пәрмені, toolbar мен перне бір режимге апарады', () => {
    const initial = useConfigurator.getState().xray
    useConfigurator.getState().setXray(true)
    expect(useConfigurator.getState().xray).toBe(true)
    useConfigurator.getState().setXray(initial)
    expect(HOTKEYS.some((key) => key.action.kind === 'xray')).toBe(true)
    const source = readFileSync(new URL('../components/Workspace.tsx', import.meta.url), 'utf8')
    expect(source).toContain("case 'xray'")
    expect(source).toContain("id: 'xray'")
    const view = classicMenus({
      canUndo: false, canRedo: false, activeEditable: false, editableBoard: false,
      canRemoveCabinet: false, canExport: false, canExportPdf: false, productionError: false,
      cameraPreset: 'front', viewMode: 'solid', showFronts: true, projection: 'perspective',
      showDimensions: false, showDrilling: false, showFittings: false, xray: true,
      silhouetteOn: false, open: false, assembly: false, theme: 'system', quality: 'high',
      lang: 'ru', price: null, cloud: false,
    }).find((menu) => menu.id === 'view')!
    expect(view.items.some((item) => item.kind === 'item' && item.id === 'view.xray' && item.active)).toBe(true)
  })

  it('конфирматтың көрінетін өзегі панельдің қарсы бетінен шықпайды', () => {
    const panels = generateCabinet(referenceWardrobe, catalog)
    const items = panels.flatMap((panel) => {
      const thickness = catalog.materials.find((m) => m.id === panel.materialId)!.thickness
      return fittingsForPanel(panel, thickness, bands, mergeSettings(), panels)
        .filter((item) => item.purpose === 'confirmat')
        .map((item) => ({ panel, thickness, item }))
    })
    expect(items.length).toBeGreaterThan(0)
    for (const { panel, thickness, item } of items) {
      const size = { x: panel.finishedLength, y: panel.finishedWidth, z: thickness }
      for (const axis of ['x', 'y', 'z'] as const) {
        const farEnd = item.point[axis] - item.normal[axis] * item.embeddedLength
        expect(farEnd).toBeGreaterThanOrEqual(0)
        expect(farEnd).toBeLessThanOrEqual(size[axis])
      }
    }
  })

  it('тесіктерді мақсаты бойынша инстанстарға жинайды, экспорт саны жоғалмайды', () => {
    const panels = generateCabinet(referenceWardrobe, catalog)
    const visual = panels.flatMap((panel) => panel.drilling.map((drill) => ({
      point: { x: drill.x, y: drill.y, z: 0 },
      direction: { x: 0, y: 0, z: 1 },
      diameter: drill.diameter, depth: drill.depth, purpose: drill.purpose,
    })))
    const groups = markerGroups(visual)
    expect(groups.reduce((count, group) => count + group.markers.length, 0)).toBe(
      panels.reduce((count, panel) => count + panel.drilling.length, 0),
    )
    expect(new Set(groups.map((group) => group.purpose)).size).toBe(groups.length)
    expect(drillLegend.find((entry) => entry.purpose === 'confirmat')?.color).toBeTruthy()
  })

  it('штанганың екі ұстағышын ядро берген ұзындық пен орыннан есептейді', () => {
    expect(rodBracketCentres({ x: 300, y: 500, z: 200 }, 560)).toEqual([
      { x: 20, y: 500, z: 200 }, { x: 580, y: 500, z: 200 },
    ])
  })

  it('петля чашкасы, иіні және планкасы Drill өлшемінен тарайды', () => {
    const part = generateCabinet(referenceWardrobe, catalog).find((panel) =>
      panel.drilling.some((hole) => hole.purpose === 'hinge' && hole.diameter >= 30))!
    const thickness = catalog.materials.find((m) => m.id === part.materialId)!.thickness
    const hinge = fittingsForPanel(part, thickness, bands, mergeSettings()).find((item) => item.purpose === 'hinge' && item.diameter >= 30)!
    const shape = fittingShape(hinge)
    expect(shape.head[0]).toBe(hinge.diameter)
    expect(shape.shaft[1]).toBe(hinge.embeddedLength)
    expect(shape.arm).not.toBeNull()
    expect(shape.plate).not.toBeNull()
  })

  it('бағыттағыш рельсінің ұзындығын жәшіктің бүйір бөлшегінен алады', () => {
    const parts = generateCabinet(withCabinet({
      sections: oneSection({ contents: [{ kind: 'drawers', count: 1 }] }),
    }), catalog)
    const side = parts.find((part) => part.drilling.some((hole) => hole.purpose === 'runner'))!
    const drawerSide = parts.find((part) => part.role === 'drawerSide')!
    const thickness = catalog.materials.find((m) => m.id === side.materialId)!.thickness
    const rails = fittingsForPanel(side, thickness, bands, mergeSettings(), parts)
      .filter((item) => item.purpose === 'runner' && item.rail)
    expect(rails).toHaveLength(1)
    expect(rails[0]!.rail!.length).toBe(drawerSide.finishedWidth)
    expect(rails[0]!.rail!.center.y).toBe(drawerSide.position.z - side.position.z + drawerSide.finishedWidth / 2)
  })

  it('Tandem рельсінің номинал ұзындығын ядроның boxDepthSub дерегімен қалпына келтіреді', () => {
    const parts = generateCabinet(withCabinet({ drawerSystem: 'tandem',
      sections: oneSection({ contents: [{ kind: 'drawers', count: 1 }] }),
    }), catalog)
    const side = parts.find((part) => part.drilling.some((hole) => hole.purpose === 'runner'))!
    const drawerSide = parts.find((part) => part.role === 'drawerSide')!
    const thickness = catalog.materials.find((m) => m.id === side.materialId)!.thickness
    const rail = fittingsForPanel(side, thickness, bands, mergeSettings(), parts)
      .find((item) => item.rail)?.rail
    expect(rail?.system).toBe('tandem')
    expect(rail?.length).toBe(drawerSide.finishedWidth + 10)
  })

  it('экспорттағы әр Drill 3D-де сол панельдің бетіне түседі', () => {
    const parts = generateCabinet(referenceWardrobe, catalog)
    let count = 0
    for (const part of parts) {
      const thickness = catalog.materials.find((m) => m.id === part.materialId)!.thickness
      for (const drill of part.drilling) {
        const marker = drillToLocalMarker(part, drill, thickness, bands, mergeSettings())
        const limits = { x: part.finishedLength, y: part.finishedWidth, z: thickness }
        const surface = (['x', 'y', 'z'] as const).some((axis) =>
          marker.direction[axis] !== 0 && (marker.point[axis] === 0 || marker.point[axis] === limits[axis]))
        expect(surface).toBe(true)
        count += 1
      }
    }
    expect(count).toBe(parts.reduce((sum, part) => sum + part.drilling.length, 0))
  })
})
