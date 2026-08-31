/**
 * Бұрыштық (переходной) корпус: тереңдігі солдан оңға өзгереді.
 *
 * Екі нәрсе тексерілуі керек, екеуін де көзбен байқау мүмкін емес:
 *   1. Жатық детальдар ТРАПЕЦИЯ болып шығады, ал заготовкасы тікбұрыш
 *      күйінде қалады — цех оны солай кеседі.
 *   2. Әлі ЖАСАЛМАҒАН нәрселер (фасад, ящик, перегородка, арт қабырға)
 *      ҮНСІЗ ҚАБЫЛДАНБАЙДЫ. Жартылай дұрыс присадканы цехтан басқа ешкім
 *      байқамайды, сондықтан «болмайды» деп айқын айтылады.
 */
import { describe, expect, it } from 'vitest'
import {
  catalogOf,
  defaultShopProfile,
  findTemplate,
  formatCutList,
  generateCabinet,
  isWidthBevel,
  nestPanels,
  templateToCabinet,
} from '../src/core/index'
import type { CabinetConfig, Panel } from '../src/core/index'

const shop = defaultShopProfile()
const catalog = catalogOf(shop)
const template = templateToCabinet(findTemplate('wardrobe-penal-600')!, catalog)

/** Ашық переходной модуль: фасадсыз, артсыз, бір секция. */
const corner = (depthAtRight: number, patch: Partial<CabinetConfig> = {}): CabinetConfig => ({
  ...template,
  depth: 600,
  back: { mode: 'none' },
  corner: { depthAtRight },
  sections: [{
    ...template.sections[0]!,
    fronts: null,
    contents: [{ kind: 'shelves', count: 3, shelfKind: 'adjustable' }],
  }],
  ...patch,
})

const byId = (panels: Panel[], id: string) => panels.find((p) => p.id === id)!

const widthBevelOf = (p: Panel) => {
  const b = p.bevel
  expect(b, p.label).toBeDefined()
  if (!b || !isWidthBevel(b)) throw new Error(`${p.label}: қиғаш ЕН бойынша болуы керек`)
  return b
}

// ── Геометрия ────────────────────────────────────────────────────────────────

describe('корпустың пішіні', () => {
  const panels = generateCabinet(corner(350), catalog)

  it('оң бүйір ТАРЫРАҚ, сол бүйір бұрынғыдай', () => {
    const left = byId(panels, 'side-left')
    const right = byId(panels, 'side-right')
    expect(right.finishedWidth).toBeLessThan(left.finishedWidth)
    expect(left.finishedWidth).toBe(600)
    expect(right.finishedWidth).toBe(350)
  })

  it('оң бүйір ҚАБЫРҒАҒА тіреледі — артқа жылжыған', () => {
    // Арты бір деңгейде тұрмаса, шкаф қабырғадан қашық қалар еді.
    const left = byId(panels, 'side-left')
    const right = byId(panels, 'side-right')
    expect(left.position.z + left.finishedWidth).toBe(right.position.z + right.finishedWidth)
  })

  it('крышка мен дно — ТРАПЕЦИЯ, қиғашы ЕН бойынша', () => {
    for (const id of ['top', 'bottom']) {
      const b = widthBevelOf(byId(panels, id))
      expect(b.widthAtStart).toBe(600)
      expect(b.widthAtEnd).toBe(350)
      // Арты қабырғада — материал ен осінің СОҢЫНА тураланады.
      expect(b.alignWidth).toBe('end')
    }
  })

  it('сөрелер де трапеция', () => {
    const shelves = panels.filter((p) => p.role === 'shelf')
    expect(shelves.length).toBeGreaterThan(0)
    for (const sh of shelves) {
      const b = widthBevelOf(sh)
      expect(b.widthAtStart).toBeGreaterThan(b.widthAtEnd)
    }
  })

  it('ЗАГОТОВКА тікбұрыш күйінде қалады — цех соны кеседі', () => {
    // Трапецияның габариті = ең кең жері. Деталировкадағы сан осы.
    const top = byId(panels, 'top')
    expect(top.finishedWidth).toBe(600)
    expect(top.cutWidth).toBeLessThanOrEqual(top.finishedWidth)
  })

  it('бұрыштық емес корпуста қиғаш МҮЛДЕ ЖОҚ', () => {
    const plain = generateCabinet({ ...corner(350), corner: undefined }, catalog)
    expect(plain.every((p) => p.bevel === undefined)).toBe(true)
  })

  it('екі жақ тең болса қиғаш мәні де тең', () => {
    const equal = generateCabinet(corner(600), catalog)
    const b = widthBevelOf(byId(equal, 'top'))
    expect(b.widthAtStart).toBe(b.widthAtEnd)
  })
})

// ── Шектеулер ────────────────────────────────────────────────────────────────

describe('әлі жасалмағаны ҮНСІЗ өтпейді', () => {
  it('арт қабырға — қате', () => {
    expect(() => generateCabinet(corner(350, { back: { mode: 'overlay' } }), catalog))
      .toThrow(/арт қабырға/)
  })

  it('фасад — қате', () => {
    const cfg = corner(350)
    cfg.sections = [{ ...cfg.sections[0]!, fronts: { count: 2, mount: 'overlay' } }]
    expect(() => generateCabinet(cfg, catalog)).toThrow(/ілгек присадкасы/)
  })

  it('ящик — қате', () => {
    const cfg = corner(350)
    cfg.sections = [{ ...cfg.sections[0]!, contents: [{ kind: 'drawers', count: 2 }] }]
    expect(() => generateCabinet(cfg, catalog)).toThrow(/направляющая/)
  })

  it('перегородка — қате', () => {
    const cfg = corner(350)
    cfg.sections = [cfg.sections[0]!, { ...cfg.sections[0]!, id: 's2' }]
    expect(() => generateCabinet(cfg, catalog)).toThrow(/перегородка/)
  })

  it('оң тереңдік сол жақтан АСПАЙДЫ', () => {
    expect(() => generateCabinet(corner(900), catalog)).toThrow(/depthAtRight|аспауы/)
  })

  it('тым тайыз оң жақ — қате', () => {
    expect(() => generateCabinet(corner(30), catalog)).toThrow()
  })
})

// ── Жүйемен байланысы ────────────────────────────────────────────────────────

describe('жүйенің қалған бөлігі', () => {
  const panels = generateCabinet(corner(350), catalog)

  it('деталировкаға түседі', () => {
    const rows = formatCutList(panels, catalog)
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.some((r) => r.name === 'Крышка')).toBe(true)
  })

  it('раскройға сыяды — заготовка тікбұрыш болғандықтан', () => {
    const nesting = nestPanels(panels, catalog)
    expect(nesting.unplaced).toHaveLength(0)
  })

  it('id-лері бірегей', () => {
    const ids = panels.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

// ── Жол-жөнекей табылған қате ────────────────────────────────────────────────

describe('арт қабырғасыз корпус толық тереңдікте', () => {
  /**
   * Бұрыштық модульді жасау кезінде табылды: «Без стенки» режимінде де
   * `backThickness` шегеріліп тұрған. Арт қабырға болмаса, шегеретін ештеңе
   * жоқ — корпус сұралған тереңдікте болуы керек еді.
   */
  it('корпус детальдері сұралған тереңдікте', () => {
    const cfg: CabinetConfig = { ...template, depth: 600, back: { mode: 'none' } }
    const panels = generateCabinet(cfg, catalog)
    expect(byId(panels, 'side-left').finishedWidth).toBe(600)
    expect(byId(panels, 'top').finishedWidth).toBe(600)
  })

  it('арт қабырғасы БАР корпуста шегерім бұрынғыдай қалады', () => {
    const cfg: CabinetConfig = { ...template, depth: 600, back: { mode: 'overlay' } }
    const panels = generateCabinet(cfg, catalog)
    // 3 мм ХДФ артқа қағылады — корпус сонша тайыз.
    expect(byId(panels, 'side-left').finishedWidth).toBe(597)
  })
})
