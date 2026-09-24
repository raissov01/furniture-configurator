/**
 * v3 файл → loadProject → exportProject (v4) → JSON → loadProject → exportProject:
 * бөлме (терезе/әрлеу), қабаттар, реквизит, баға түзетулері, баптаулар,
 * шкаф конфигтері мен орны ешқайсысы үнсіз түспеуі керек.
 * Мутациямен тексерілді: exportProject-тен `layers`-ты, loadProject-тен
 * `room`-ды алып тастаса, бұл тест құлайды (бұрынғы тесттер құламайтын).
 */
import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, SEED_CATALOG, SEED_SETS, parseProjectV4, setToProject } from '../src/core/index'
import { useConfigurator } from '../store/configurator'

const baseline = useConfigurator.getState()
afterEach(() => {
  useConfigurator.setState({
    root: baseline.root, layers: baseline.layers, room: baseline.room,
    projectSettings: baseline.projectSettings, projectMaterials: baseline.projectMaterials,
    projectEdgeBands: baseline.projectEdgeBands, catalog: baseline.catalog,
    cabinets: baseline.cabinets, placements: baseline.placements,
    activeId: baseline.activeId, past: [], future: [], projectLoadError: null,
    projectInfo: {}, priceOverrides: {},
  })
})

const { cabinets, placements } = setToProject(SEED_SETS[0]!, SEED_CATALOG)
const legacy = {
  schemaVersion: 3, name: 'Клиент жобасы', materials: SEED_CATALOG.materials, edgeBands: SEED_CATALOG.edgeBands,
  room: { width: 4200, depth: 3100, height: 2750,
    openings: [{ id: 'w1', kind: 'window', wall: 'north', offset: 400, width: 900, height: 1300, elevation: 850 }],
    finish: { wallColor: '#aabbcc', floor: 'tile' } },
  cabinets: [...cabinets, { ...cabinets[0]!, id: 'spare', name: 'Қойма' }],
  placements: placements.map((p, i) => (i === 0 ? { ...p, elevation: 300, rotate: 15 } : p)),
  settings: { ...DEFAULT_SETTINGS, frontGap: 3 },
  info: { orderNo: 'A-17', date: '2026-09-01', client: 'Айгүл', designer: 'Бек', note: 'ескерту' },
  priceOverrides: { coefficient: 1.4, salePrice: 5_000_000,
    lineDiscounts: { 'materials:x': { kind: 'percent', value: 5 } }, overallDiscount: { kind: 'amount', value: 10_000 } },
  layers: [
    { id: 'main', name: 'Негізгі', visible: true, locked: false, color: '#ffffff' },
    { id: 'draft', name: 'Жоба', visible: false, locked: true, color: '#123456' },
  ],
}

describe('v3 → v4 → v4 толық round-trip', () => {
  it('сақтап қайта ашқанда жобаның бірде-бір өрісі жоғалмайды', () => {
    const s = () => useConfigurator.getState()
    s().loadProject(legacy)
    const first = JSON.parse(JSON.stringify(s().exportProject()))
    s().loadProject(first)
    const second = JSON.parse(JSON.stringify(s().exportProject()))
    expect(second).toEqual(first)

    const migrated = parseProjectV4(legacy)
    expect(first.room).toEqual(legacy.room)
    expect(first.layers).toEqual(legacy.layers)
    expect(first.info).toEqual(legacy.info)
    expect(first.priceOverrides).toEqual(legacy.priceOverrides)
    expect(first.settings).toMatchObject({ frontGap: 3 })
    expect(first.root).toEqual(JSON.parse(JSON.stringify(migrated.root)))
    expect(first.root.children.map((n: { id: string }) => n.id)).toEqual(legacy.cabinets.map((c) => c.id))
  })
})
