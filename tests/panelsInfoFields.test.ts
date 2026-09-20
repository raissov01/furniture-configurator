/**
 * ИНФОРМАЦИЯ докинг панелінің таза логикасы
 * (`components/panels/infoFields.ts`).
 *
 * ⚠ CLAUDE.md §4.3 — бұл файл дайын/рез өлшемін араластырмайды тексереді
 * жоқ (ол Panel-дың өз өрісі), бірақ кромка/присадка бөлінуінің дәл екенін
 * тексереді.
 */
import { describe, expect, it } from 'vitest'
import type { Drill, EdgeSpec, Material } from '../src/core/index'
import {
  DRILL_PURPOSE_LABEL, edgeSummary, groupDrillingByPurpose, materialName,
} from '../components/panels/infoFields'
import type { EdgeFieldName } from '../components/panels/infoFields'

const drill = (purpose: Drill['purpose']): Drill => ({
  face: 'inner', x: 10, y: 10, diameter: 5, depth: 8, purpose,
})

describe('groupDrillingByPurpose', () => {
  it('бос тізім — бос топ', () => {
    expect(groupDrillingByPurpose([])).toEqual([])
  })

  it('мақсаты бойынша санайды, көбіне бірінші', () => {
    const groups = groupDrillingByPurpose([
      drill('shelfPin'), drill('shelfPin'), drill('shelfPin'),
      drill('confirmat'), drill('confirmat'),
      drill('hinge'),
    ])
    expect(groups[0]).toEqual({ purpose: 'shelfPin', label: DRILL_PURPOSE_LABEL.shelfPin, count: 3 })
    expect(groups[1]).toEqual({ purpose: 'confirmat', label: DRILL_PURPOSE_LABEL.confirmat, count: 2 })
    expect(groups[2]).toEqual({ purpose: 'hinge', label: DRILL_PURPOSE_LABEL.hinge, count: 1 })
    expect(groups.reduce((n, g) => n + g.count, 0)).toBe(6)
  })
})

describe('edgeSummary', () => {
  const bandById = new Map([
    ['pvc2', { name: 'ПВХ 2 мм', thickness: 2 }],
    ['pvc04', { name: 'ПВХ 0.4 мм', thickness: 0.4 }],
  ])

  it('төрт жиек әрқашан L1/L2/W1/W2 ретімен қайтады', () => {
    const edges: Record<EdgeFieldName, EdgeSpec> = {
      L1: { bandId: 'pvc2' }, L2: null, W1: { bandId: 'pvc04' }, W2: null,
    }
    const rows = edgeSummary(edges, bandById)
    expect(rows.map((r) => r.edge)).toEqual(['L1', 'L2', 'W1', 'W2'])
    expect(rows[0]).toEqual({ edge: 'L1', bandName: 'ПВХ 2 мм', thickness: 2 })
    expect(rows[1]).toEqual({ edge: 'L2', bandName: null, thickness: null })
  })

  it('каталогта жоқ bandId — шикі id көрінеді, құламайды', () => {
    const edges: Record<EdgeFieldName, EdgeSpec> = {
      L1: { bandId: 'unknown-band' }, L2: null, W1: null, W2: null,
    }
    const rows = edgeSummary(edges, bandById)
    expect(rows[0]).toEqual({ edge: 'L1', bandName: 'unknown-band', thickness: null })
  })
})

describe('materialName', () => {
  const materials: Material[] = [
    { id: 'm1', name: 'ЛДСП Дуб Бардолино', thickness: 16, sheetWidth: 2800, sheetHeight: 2070, hasGrain: false, pricePerSheet: 0, trimEdge: 10 },
  ]

  it('табылса — аты', () => {
    expect(materialName('m1', materials)).toBe('ЛДСП Дуб Бардолино')
  })

  it('табылмаса — шикі id, құламайды', () => {
    expect(materialName('does-not-exist', materials)).toBe('does-not-exist')
  })
})
