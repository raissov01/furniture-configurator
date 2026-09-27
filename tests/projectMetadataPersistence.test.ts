/** Реквизит пен жеңілдік өзгерген сәтте жоба файлға автоматты жазылуы керек. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseProjectV4 } from '../src/core/index'
import { useConfigurator } from '../store/configurator'

const PROJECT_KEY = 'furniture-configurator:project'
const initial = useConfigurator.getState()
const lineKey = `materials:${initial.cabinets[0]!.carcassMaterialId}`

function storage(): Map<string, string> {
  const values = new Map<string, string>()
  vi.stubGlobal('window', {
    localStorage: {
      setItem: (key: string, value: string) => values.set(key, value),
      getItem: (key: string) => values.get(key) ?? null,
    },
  })
  return values
}

afterEach(() => {
  useConfigurator.setState({
    room: initial.room, root: initial.root, layers: initial.layers,
    projectSettings: initial.projectSettings, projectMaterials: initial.projectMaterials,
    projectEdgeBands: initial.projectEdgeBands, catalog: initial.catalog,
    cabinets: initial.cabinets, placements: initial.placements,
    activeId: initial.activeId, projectInfo: {}, priceOverrides: {},
    firstRun: initial.firstRun,
  })
  vi.unstubAllGlobals()
})

describe('жоба реквизиті мен жеңілдігінің автосақталуы', () => {
  it('орнатусыз және пропорционал баға базасын файлға сақтайды', () => {
    const values = storage()
    const scaling = { baseAreaMm2: 123456, materialIds: [initial.cabinets[0]!.carcassMaterialId] }
    useConfigurator.getState().editPriceOverrides({ salePrice: 500_000, withoutInstallation: true, salePriceScaling: scaling })
    expect(parseProjectV4(JSON.parse(values.get(PROJECT_KEY)!)).priceOverrides).toEqual({
      salePrice: 500_000, withoutInstallation: true, salePriceScaling: scaling,
    })
  })

  it('бес реквизитті edit жасаған сәтте localStorage-ке сақтайды; геометрия өзгермейді', () => {
    const values = storage()
    const root = useConfigurator.getState().root
    const cabinets = useConfigurator.getState().cabinets
    const info = {
      orderNo: 'ЗАКАЗ-42', date: '2026-09-24', client: 'Айгүл',
      designer: 'Бекназар', note: 'Мәреге жеткізу',
    }
    useConfigurator.getState().editProjectInfo(info)
    const saved = parseProjectV4(JSON.parse(values.get(PROJECT_KEY)!))
    expect(saved.info).toEqual(info)
    expect(saved.root).toEqual(root)
    expect(saved.root.children[0]).toMatchObject({ kind: 'cabinet', config: cabinets[0] })
    expect(useConfigurator.getState().cabinets).toBe(cabinets)
  })

  it('жолдық және жалпы жеңілдікті бірден сақтап, hydrateProject арқылы қайтарады', () => {
    const values = storage()
    const discounts = {
      coefficient: 1.4, salePrice: 500_000,
      lineDiscounts: { [lineKey]: { kind: 'amount' as const, value: 125 } },
      overallDiscount: { kind: 'percent' as const, value: 10 },
    }
    useConfigurator.getState().editPriceOverrides(discounts)
    expect(parseProjectV4(JSON.parse(values.get(PROJECT_KEY)!)).priceOverrides).toEqual(discounts)

    useConfigurator.setState({ projectInfo: {}, priceOverrides: {} })
    useConfigurator.getState().hydrateProject()
    expect(useConfigurator.getState().priceOverrides).toEqual(discounts)
  })

  it('метадерек пен екі жеңілдік reload-тен кейін бірге қалады, тазалау бос кілт қалдырмайды', () => {
    const values = storage()
    const info = { orderNo: '42', date: '2026-09-24', client: 'Айгүл', designer: 'Бекназар', note: 'Ескертпе' }
    useConfigurator.getState().editProjectInfo(info)
    useConfigurator.getState().editPriceOverrides({
      salePrice: 500_000,
      lineDiscounts: { [lineKey]: { kind: 'percent', value: 5 } },
      overallDiscount: { kind: 'amount', value: 2500 },
    })
    useConfigurator.setState({ projectInfo: {}, priceOverrides: {} })
    useConfigurator.getState().hydrateProject()
    expect(useConfigurator.getState().projectInfo).toEqual(info)
    expect(useConfigurator.getState().priceOverrides.overallDiscount).toEqual({ kind: 'amount', value: 2500 })
    expect(useConfigurator.getState().priceOverrides.lineDiscounts?.[lineKey]).toEqual({ kind: 'percent', value: 5 })

    useConfigurator.getState().editPriceOverrides({ salePrice: undefined, lineDiscounts: {}, overallDiscount: undefined })
    expect(parseProjectV4(JSON.parse(values.get(PROJECT_KEY)!)).priceOverrides).toBeUndefined()
    useConfigurator.getState().editProjectInfo({ orderNo: '', date: '', client: '', designer: '', note: '' })
    expect(parseProjectV4(JSON.parse(values.get(PROJECT_KEY)!)).info).toBeUndefined()
  })
})
