/**
 * «Найти» (`src/core/searchPanels.ts`). Екі гоча ерекше тексерілуі керек:
 *   №1 — JS-тегі `\b`/`\w` кириллицаны сөз таңбасы деп санамайды;
 *   №2 — латын/кириллица гомоглифі («Kамень» латын K-мен).
 */
import { describe, expect, it } from 'vitest'
import { searchProjectPanels } from '../src/core/index'
import type { Material, Panel } from '../src/core/index'

function makePanel(overrides: Partial<Panel>): Panel {
  return {
    id: 'p1',
    role: 'shelf',
    label: 'Полка',
    materialId: 'm1',
    finishedLength: 600,
    finishedWidth: 300,
    cutLength: 598,
    cutWidth: 298,
    edges: { L1: null, L2: null, W1: null, W2: null },
    grainAlongLength: false,
    qty: 1,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    orientation: { length: 'x', width: 'z', thickness: 'y' },
    note: '',
    drilling: [],
    cutouts: [],
    grooves: [],
    milling: [],
    ...overrides,
  }
}

const material: Material = {
  id: 'm1',
  name: 'ЛДСП Kамень серый', // ⚠ 09-20 табылған нақты гоча: латын K
  thickness: 16,
  sheetWidth: 2800,
  sheetHeight: 2070,
  hasGrain: false,
  pricePerSheet: 0,
  trimEdge: 10,
}

describe('гоча №1 — кириллицада сөз шекарасы емес, қарапайым ішкі жол іздеу', () => {
  const items = [{ cabinetId: 'c1', panels: [makePanel({ label: 'Боковина левая' })] }]

  it('«боков» — «Боковина»-ны табады (сөз ортасынан)', () => {
    const hits = searchProjectPanels(items, [material], 'боков')
    expect(hits).toHaveLength(1)
  })

  it('регистрге тәуелсіз', () => {
    const hits = searchProjectPanels(items, [material], 'БОКОВИНА')
    expect(hits).toHaveLength(1)
  })

  it('өлшем бойынша табады', () => {
    const hits = searchProjectPanels(items, [material], '600')
    expect(hits).toHaveLength(1)
  })

  it('рөлі бойынша табады (label сөзбе-сөз сәйкес келмесе де)', () => {
    const items2 = [{ cabinetId: 'c1', panels: [makePanel({ label: 'Царга', role: 'shelf' })] }]
    const hits = searchProjectPanels(items2, [material], 'полка')
    expect(hits).toHaveLength(1)
  })
})

describe('гоча №2 — латын/кириллица гомоглифі («Kамень»)', () => {
  const items = [{ cabinetId: 'c1', panels: [makePanel({ materialId: 'm1' })] }]

  it('кириллицамен «камень» деп жазса да табылады (материалда латын K)', () => {
    const hits = searchProjectPanels(items, [material], 'камень')
    expect(hits).toHaveLength(1)
  })

  it('дәл сол латын K-мен жазса да табылады', () => {
    const hits = searchProjectPanels(items, [material], 'Kамень')
    expect(hits).toHaveLength(1)
  })

  it('көрсетілетін атау (material.name) ӨЗГЕРМЕЙДІ — тек салыстыру норманады', () => {
    expect(material.name).toBe('ЛДСП Kамень серый') // латын K сол күйінде қалады
  })
})

describe('бос сұрау', () => {
  it('бос жолда нәтиже жоқ', () => {
    const items = [{ cabinetId: 'c1', panels: [makePanel({})] }]
    expect(searchProjectPanels(items, [material], '')).toHaveLength(0)
    expect(searchProjectPanels(items, [material], '   ')).toHaveLength(0)
  })
})
