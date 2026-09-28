import { describe, expect, it } from 'vitest'
import { generateCabinet } from '../src/core/generateCabinet'
import { mergeSettings } from '../src/core/constants'
import { SEED_CATALOG, findSet, findTemplate, setToProject, templateToCabinet } from '../src/core/index'
import { drillingToCsv } from '../src/core/export/csv'
import { markerGroups } from '../lib/drillLegend'
import { drillToLocalMarker } from '../lib/drillGeometry'
import { markerAppearance } from '../lib/drillMarkerAppearance'

describe('F00o тесік белгілері', () => {
  it('тесік маркері ұсақ Ø5 үшін де көрінеді, рентгенде depthTest өшірулі', () => {
    expect(markerAppearance(5, true, false)).toEqual({ radius: 5, depthTest: false, opacity: 1 })
    expect(markerAppearance(5, false, false).depthTest).toBe(true)
  })

  it('үш эталонда 3D маркерлерінің саны присадка CSV жолдарымен бірдей', () => {
    const drawer = templateToCabinet(findTemplate('kitchen-base-drawers-600')!, SEED_CATALOG)
    const wardrobe = templateToCabinet(findTemplate('wardrobe-penal-600')!, SEED_CATALOG)
    const kitchen = setToProject(findSet('kitchen-run-3m')!, SEED_CATALOG).cabinets
    for (const cabinets of [[drawer], [wardrobe], kitchen]) {
      const panels = cabinets.flatMap((cabinet) => generateCabinet(cabinet, SEED_CATALOG))
      const markers = panels.flatMap((panel) => {
        const thickness = SEED_CATALOG.materials.find((material) => material.id === panel.materialId)!.thickness
        const edgeBands = new Map(SEED_CATALOG.edgeBands.map((band) => [band.id, band]))
        return panel.drilling.map((drill) => ({ ...drillToLocalMarker(panel, drill, thickness, edgeBands, mergeSettings()),
          purpose: drill.purpose }))
      })
      const shown = markerGroups(markers).reduce((sum, group) => sum + group.markers.length, 0)
      expect(shown).toBe(drillingToCsv(panels).trimEnd().split('\n').length - 1)
      expect(shown).toBeGreaterThan(0)
    }
  })
})
