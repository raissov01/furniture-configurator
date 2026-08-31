/**
 * Наполнение: механизмдер мен техниканың ұясы.
 *
 * Екі басты талап:
 *   1. ТЕХНИКА СМЕТАҒА ТҮСПЕЙДІ. Оны клиент өзі алады; ойдан жазылған баға
 *      клиентке кеткен КП-ға түсер еді (§6, CLAUDE.md §10).
 *   2. Ұяның биіктігі СОЗЫЛМАЙДЫ. Духовканың орны шкафтың қалған бос орнын
 *      жеп қойса, техника сыймай қалады да, оны тек цехта байқайды.
 */
import { describe, expect, it } from 'vitest'
import {
  APPLIANCES,
  FILLINGS,
  catalogOf,
  defaultShopProfile,
  findAppliance,
  findFilling,
  findTemplate,
  generateCabinet,
  generateHardware,
  layoutBands,
  nestPanels,
  priceProject,
  templateToCabinet,
} from '../src/core/index'
import type { CabinetConfig, SectionContent, ShopProfile } from '../src/core/index'

const shop = defaultShopProfile()
const catalog = catalogOf(shop)
const base = templateToCabinet(findTemplate('wardrobe-penal-600')!, catalog)

/** Бір секцияның толтырылымын ауыстыру. */
function withContents(contents: SectionContent[], patch: Partial<CabinetConfig> = {}): CabinetConfig {
  return {
    ...base,
    ...patch,
    sections: [{ ...base.sections[0]!, contents }],
  }
}

const priced: ShopProfile = {
  ...shop,
  hardware: shop.hardware.map((h) => ({ ...h, pricePerUnit: 100000 })),
  materials: shop.materials.map((m) => ({ ...m, pricePerSheet: 2850000 })),
  edgeBands: shop.edgeBands.map((b) => ({ ...b, pricePerMeter: 9000 })),
}

// ── Каталог ──────────────────────────────────────────────────────────────────

describe('каталог', () => {
  it('әр механизмнің сметада өз позициясы бар', () => {
    const ids = new Set(shop.hardware.map((h) => h.id))
    for (const f of FILLINGS) expect(ids.has(f.hardwareId), f.name).toBe(true)
  })

  it('ТЕХНИКА сметалық каталогта ЖОҚ', () => {
    // Болса, цех оған баға қоюға мәжбүр болар еді — ал ол оны сатпайды.
    const ids = new Set(shop.hardware.map((h) => h.id))
    for (const a of APPLIANCES) expect(ids.has(`appliance-${a.id}`), a.name).toBe(false)
  })

  it('әрқайсысының ең кіші ені мен әдепкі биіктігі мағыналы', () => {
    for (const f of FILLINGS) {
      expect(f.minWidth, f.name).toBeGreaterThan(0)
      expect(f.defaultHeight, f.name).toBeGreaterThan(0)
    }
    for (const a of APPLIANCES) {
      expect(a.minWidth, a.name).toBeGreaterThan(0)
      expect(a.defaultNicheHeight, a.name).toBeGreaterThan(0)
    }
  })
})

// ── Жолақтың биіктігі ────────────────────────────────────────────────────────

describe('ұяның биіктігі', () => {
  it('техниканың жолағы СОЗЫЛМАЙДЫ — өз биіктігінде қалады', () => {
    const bands = layoutBands(
      [{ kind: 'appliance', appliance: 'oven' }, { kind: 'shelves', count: 2, shelfKind: 'adjustable' }],
      2000, 16, 0,
    )
    expect(bands[0]!.height).toBe(findAppliance('oven').defaultNicheHeight)
    // Қалған бос орынның бәрі сөрелерге кетеді.
    expect(bands[1]!.height).toBeGreaterThan(bands[0]!.height)
  })

  it('нақты биіктік әдепкіні басып озады', () => {
    const bands = layoutBands(
      [{ kind: 'appliance', appliance: 'oven', height: 450 }, { kind: 'empty' }],
      2000, 16, 0,
    )
    expect(bands[0]!.height).toBe(450)
  })

  it('механизм де өз биіктігінде тұрады', () => {
    const bands = layoutBands(
      [{ kind: 'filling', filling: 'trousers' }, { kind: 'empty' }],
      2000, 16, 0,
    )
    expect(bands[0]!.height).toBe(findFilling('trousers').defaultHeight)
  })

  it('шкаф ұяға жетпесе — ҚАТЕ, үнсіз қысылмайды', () => {
    expect(() =>
      layoutBands([{ kind: 'appliance', appliance: 'fridge' }], 800, 16, 0),
    ).toThrow()
  })
})

// ── Ені бойынша тексеру ──────────────────────────────────────────────────────

describe('секцияның ені', () => {
  it('тар секцияға пантограф СЫЙМАЙДЫ — қате шығады', () => {
    const cabinet = withContents([{ kind: 'filling', filling: 'pantograph' }], { width: 400 })
    expect(() => generateHardware(cabinet, catalog)).toThrow(/Пантограф/)
  })

  it('тар ұяға духовка СЫЙМАЙДЫ', () => {
    const cabinet = withContents([{ kind: 'appliance', appliance: 'oven' }], { width: 400, height: 1200 })
    expect(() => generateHardware(cabinet, catalog)).toThrow(/Духовка/)
  })

  it('жеткілікті кең секцияда мәселе жоқ', () => {
    const cabinet = withContents([{ kind: 'filling', filling: 'trousers' }], { width: 600 })
    expect(() => generateHardware(cabinet, catalog)).not.toThrow()
  })
})

// ── Панельмен байланысы ──────────────────────────────────────────────────────

describe('панельдер', () => {
  it('механизм де, техника да ӨЗІНЕН панель шығармайды', () => {
    const empty = generateCabinet(withContents([{ kind: 'empty' }]), catalog)
    const filled = generateCabinet(
      withContents([{ kind: 'appliance', appliance: 'oven' }, { kind: 'filling', filling: 'trousers' }]),
      catalog,
    )
    // Артық орын АЙҚЫН бос жолақ болып қосылады → 3 жолақ, 2 бөлгіш сөре.
    // Механизмнің де, техниканың да ӨЗ панелі жоқ: бүкіл айырма — сол сөрелер.
    expect(filled.filter((p) => p.role === 'shelf')).toHaveLength(2)
    expect(filled.length).toBe(empty.length + 2)
  })

  it('артық орын бос жолақ болып қосылады, қате шықпайды', () => {
    // Духовка 595 мм, брючница 180 мм — 2000 мм шкафта әлі көп орын бар.
    const bands = layoutBands(
      [{ kind: 'appliance', appliance: 'oven' }, { kind: 'filling', filling: 'trousers' }],
      1952, 16, 0,
    )
    expect(bands).toHaveLength(3)
    expect(bands[2]!.content.kind).toBe('empty')
    // Ұяның биіктігі СОЛ КҮЙІ қалады.
    expect(bands[0]!.height).toBe(findAppliance('oven').defaultNicheHeight)
  })

  it('пайдаланушы биіктікті ӨЗІ жазса, ереже тимейді — сан қосылмаса қате', () => {
    expect(() =>
      layoutBands([{ kind: 'shelves', count: 1, shelfKind: 'adjustable', height: 300 }], 1952, 16, 0),
    ).toThrow()
  })

  it('орналасуы жолақтың ішінде қалады', () => {
    const cabinet = withContents([
      { kind: 'appliance', appliance: 'oven' },
      { kind: 'shelves', count: 2, shelfKind: 'adjustable' },
    ], { width: 600 })
    const [oven] = generateHardware(cabinet, catalog).filter((h) => h.kind === 'appliance')
    expect(oven).toBeDefined()
    expect(oven!.size).toBeDefined()
    expect(oven!.size!.y).toBe(findAppliance('oven').defaultNicheHeight)
    // Ұяның ортасы шкафтың ішінде.
    expect(oven!.position.y).toBeGreaterThan(0)
    expect(oven!.position.y).toBeLessThan(cabinet.height)
  })
})

// ── Сметамен байланысы ───────────────────────────────────────────────────────

describe('смета', () => {
  const cabinet = withContents([
    { kind: 'appliance', appliance: 'oven' },
    { kind: 'filling', filling: 'trousers' },
  ], { width: 600 })
  const panels = generateCabinet(cabinet, catalog)
  const hardware = generateHardware(cabinet, catalog)
  const quote = priceProject(panels, nestPanels(panels, catalog), priced, hardware)

  it('механизм сметада ДАНАМЕН тұр', () => {
    const line = quote.hardware.find((l) => l.id === findFilling('trousers').hardwareId)
    expect(line).toBeDefined()
    expect(line!.qty).toBe(1)
    expect(line!.unit).toBe('шт')
  })

  it('техника сметада МҮЛДЕ ЖОҚ', () => {
    expect(quote.hardware.find((l) => l.id.startsWith('appliance-'))).toBeUndefined()
    expect(quote.hardware.some((l) => /духовк/i.test(l.name))).toBe(false)
  })

  it('техника «бағасы жоқ» деген ескертуді де тудырмайды', () => {
    // Әйтпесе цех сатпайтын нәрсеге баға қоюға мәжбүр болар еді.
    for (const m of quote.missingPrices ?? []) expect(m).not.toMatch(/духовк|холодильник/i)
  })

  it('техника 3D-де бар, бірақ priced: false', () => {
    const oven = hardware.find((h) => h.kind === 'appliance')!
    expect(oven.priced).toBe(false)
    const trousers = hardware.find((h) => h.kind === 'filling')!
    expect(trousers.priced).toBe(true)
  })
})
