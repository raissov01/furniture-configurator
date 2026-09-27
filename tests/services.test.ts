/**
 * Цехтың қызметтері, коэффициент және монтаж.
 *
 * ЕҢ БАСТЫ ТАЛАП — КЕСТЕ ҚОСЫЛУЫ КЕРЕК. Цех сметаны қолмен тексереді: егер
 * материал бойынша жіктеме мен жалпы жолдар 1–2 ₸-ге айырмашылық берсе,
 * құжатқа сенім кетеді. Сондықтан дөңгелектеу БІР ЖЕРДЕ — материал×баған
 * ұяшығында — жүреді, ал қалғанының бәрі сол ұяшықтардың қосындысы.
 */
import { describe, expect, it } from 'vitest'
import {
  SERVICE_IDS,
  catalogOf,
  defaultCutting,
  defaultShopProfile,
  findTemplate,
  generateCabinet,
  generateHardware,
  nestPanels,
  nestingOptionsOf,
  parseShopProfile,
  priceProject,
  templateToCabinet,
} from '../src/core/index'
import type { ServiceBasis, ShopProfile } from '../src/core/index'

const base = defaultShopProfile()
const catalog = catalogOf(base)
const cabinet = templateToCabinet(findTemplate('wardrobe-penal-600')!, catalog)
const panels = generateCabinet(cabinet, catalog)
const hardware = generateHardware(cabinet, catalog)
const nesting = nestPanels(panels, catalog)

/** Бағасы толтырылған цех. Барлық сан ТИЫНМЕН. */
function shopWith(patch: Partial<ShopProfile> = {}): ShopProfile {
  return {
    ...base,
    name: 'Цех «Алаш»',
    materials: base.materials.map((m) => ({ ...m, pricePerSheet: 2850000 })),
    edgeBands: base.edgeBands.map((b) => ({ ...b, pricePerMeter: 9000 })),
    hardware: base.hardware.map((h) => ({ ...h, pricePerUnit: 6000 })),
    services: {
      cutting: { basis: 'sheet', rate: 200000 },
      drilling: { basis: 'hole', rate: 3000 },
      edging: { basis: 'edgeMetre', rate: 5000 },
      packing: { basis: 'sheet', rate: 200000 },
      assembly: { basis: 'squareMetre', rate: 150000 },
    },
    ...patch,
  }
}

const price = (patch: Partial<ShopProfile> = {}, widths: number[] = []) =>
  priceProject(panels, nesting, shopWith(patch), hardware, widths)

// ── Кестенің қосылуы ─────────────────────────────────────────────────────────

describe('жіктеме мен жолдар ДӘЛ қосылады', () => {
  const p = price()

  it('материал жолдары материал бойынша жіктемемен сәйкес', () => {
    const fromRows = p.byMaterial.reduce((s, r) => s + r.materialCost, 0)
    const fromLines = p.materials.reduce((s, l) => s + l.cost, 0)
    expect(fromLines).toBe(fromRows)
  })

  it('кромка жолдары да сәйкес', () => {
    const fromRows = p.byMaterial.reduce((s, r) => s + r.edgeCost, 0)
    const fromLines = p.edges.reduce((s, l) => s + l.cost, 0)
    expect(fromLines).toBe(fromRows)
  })

  it('әр қызметтің жолы материал бойынша ұяшықтардың қосындысы', () => {
    for (const sid of SERVICE_IDS) {
      const line = p.services.find((l) => l.id === `service-${sid}`)
      if (!line) continue
      const cells = p.byMaterial.reduce((s, r) => s + r.services[sid], 0)
      expect(line.cost, sid).toBe(cells)
    }
  })

  it('жолдың өз сомасы да ұяшықтарынан жиналады', () => {
    for (const r of p.byMaterial) {
      const parts = r.materialCost + r.edgeCost
        + SERVICE_IDS.reduce((s, sid) => s + r.services[sid], 0)
      expect(parts, r.materialName).toBe(r.total)
    }
  })

  it('барлық сома БҮТІН ТЕҢГЕ', () => {
    const all = [...p.materials, ...p.edges, ...p.hardware, ...p.services]
    for (const l of all) expect(l.cost % 100, l.name).toBe(0)
    for (const r of p.byMaterial) expect(r.total % 100, r.materialName).toBe(0)
    expect(p.markup % 100).toBe(0)
    expect(p.total % 100).toBe(0)
  })
})

// ── Қызметтің өлшем бірлігі ──────────────────────────────────────────────────

describe('қызмет неге қарап саналады', () => {
  const only = (basis: ServiceBasis, rate: number) =>
    price({
      services: {
        cutting: { basis, rate },
        drilling: { basis: 'hole', rate: 0 },
        edging: { basis: 'edgeMetre', rate: 0 },
        packing: { basis: 'sheet', rate: 0 },
        assembly: { basis: 'squareMetre', rate: 0 },
      },
    })

  it('парақпен: саны раскройдағы парақ саны', () => {
    const p = only('sheet', 100000)
    const line = p.services.find((l) => l.id === 'service-cutting')!
    const sheets = p.byMaterial.reduce((s, r) => s + r.sheets, 0)
    expect(line.qty).toBe(sheets)
    expect(line.unit).toBe('лист')
  })

  it('тесікпен: саны присадканың тесіктері', () => {
    const p = only('hole', 1000)
    const line = p.services.find((l) => l.id === 'service-cutting')!
    const holes = p.byMaterial.reduce((s, r) => s + r.holes, 0)
    expect(line.qty).toBe(holes)
    expect(line.unit).toBe('отв')
  })

  it('детальмен: саны панель саны', () => {
    const p = only('panel', 1000)
    const line = p.services.find((l) => l.id === 'service-cutting')!
    expect(line.qty).toBe(panels.length)
  })

  it('өлшем бірлігі ауысса сома да ауысады', () => {
    const bySheet = only('sheet', 100000).servicesTotal
    const byPanel = only('panel', 100000).servicesTotal
    expect(bySheet).not.toBe(byPanel)
  })

  it('мөлшерлемесі 0 қызмет жолда КӨРІНБЕЙДІ', () => {
    const p = only('sheet', 0)
    expect(p.services).toHaveLength(0)
    expect(p.servicesTotal).toBe(0)
  })

  it('толтырылмаған қызмет «бағасы жоқ» ескертуін ТУДЫРМАЙДЫ', () => {
    // Цех бір қызметті мүлде көрсетпеуі мүмкін — бұл қате емес.
    const p = only('sheet', 0)
    for (const m of p.missingPrices) expect(m).not.toMatch(/Распил|Упаковка|Сборка/)
  })
})

// ── Коэффициент пен монтаж ───────────────────────────────────────────────────

describe('коэффициент', () => {
  it('коэффициент 1 болса ештеңе қоспайды', () => {
    const p = price({ coefficient: 1 })
    expect(p.coefficientAmount).toBe(0)
    expect(p.subtotal).toBe(p.goods + p.servicesTotal)
  })

  it('коэффициент ТЕК шығынға тиеді, монтажға тимейді', () => {
    const widths = [600, 900]
    const plain = price({ coefficient: 1, installation: { ratePerMetreWidth: 1000000 } }, widths)
    const raised = price({ coefficient: 1.5, installation: { ratePerMetreWidth: 1000000 } }, widths)

    // Монтаж екеуінде де БІРДЕЙ.
    expect(raised.installation.cost).toBe(plain.installation.cost)
    // Айырма тек шығынның жартысы.
    const base = plain.goods + plain.servicesTotal
    expect(raised.coefficientAmount).toBe(Math.round((base * 0.5) / 100) * 100)
  })

  it('жарамсыз коэффициент 1-ге теңеледі', () => {
    expect(price({ coefficient: 0 }).coefficient).toBe(1)
  })
})

describe('монтаж', () => {
  it('корпустардың ЕНІ бойынша саналады', () => {
    const p = price({ installation: { ratePerMetreWidth: 1000000 } }, [600, 900, 1500])
    expect(p.installation.metres).toBe(3)
    expect(p.installation.cost).toBe(3 * 1000000)
  })

  it('ені берілмесе монтаж ЖОҚ', () => {
    const p = price({ installation: { ratePerMetreWidth: 1000000 } }, [])
    expect(p.installation.cost).toBe(0)
  })

  it('мөлшерлеме 0 болса монтаж ЖОҚ', () => {
    const p = price({ installation: { ratePerMetreWidth: 0 } }, [600, 900])
    expect(p.installation.cost).toBe(0)
  })
})

describe('қорытындының реті', () => {
  it('шығын × коэффициент + монтаж + үстеме', () => {
    const p = price(
      { coefficient: 1.2, markupPercent: 10, installation: { ratePerMetreWidth: 500000 } },
      [600],
    )
    const base = p.goods + p.servicesTotal
    expect(p.subtotal).toBe(base + p.coefficientAmount + p.installation.cost)
    expect(p.markup).toBe(Math.round((p.subtotal * 10) / 100 / 100) * 100)
    expect(p.total).toBe(p.subtotal + p.markup)
  })

  it('goods = материал + кромка + фурнитура', () => {
    const p = price()
    const sum = [...p.materials, ...p.edges, ...p.hardware].reduce((s, l) => s + l.cost, 0)
    expect(p.goods).toBe(sum)
  })
})

// ── Ескі профильден көшу ─────────────────────────────────────────────────────

describe('3-нұсқадан көшу', () => {
  it('ескі жұмыс ақысы қызметтерге сол мағынасымен көшеді', () => {
    const old = {
      ...base,
      schemaVersion: 3,
      labour: { perSquareMetre: 150000, perHole: 3000, perEdgeMetre: 5000 },
    }
    delete (old as Record<string, unknown>)['services']
    delete (old as Record<string, unknown>)['installation']
    delete (old as Record<string, unknown>)['coefficient']

    const migrated = parseShopProfile(old)
    expect(migrated.schemaVersion).toBe(10)
    // Аудан → распил, тесік → присадка, метр → кромка.
    expect(migrated.services.cutting).toEqual({ basis: 'squareMetre', rate: 150000 })
    expect(migrated.services.drilling).toEqual({ basis: 'hole', rate: 3000 })
    expect(migrated.services.edging).toEqual({ basis: 'edgeMetre', rate: 5000 })
    // Жаңалары бос күйінде келеді.
    expect(migrated.services.packing.rate).toBe(0)
    expect(migrated.coefficient).toBe(1)
    expect(migrated.installation.ratePerMetreWidth).toBe(0)
  })
})

/**
 * Раскрой баптаулары. Ең маңыздысы — ЕСКІ профиль жаңа нұсқада БАСҚАША
 * кесілмеуі: v5-тің әдепкі сандары v4-тің мінезімен дәл сол.
 */
describe('4-нұсқадан көшу — раскрой баптаулары', () => {
  it('ескі профильге әдепкі баптаулар қосылады, қалғаны тимейді', () => {
    // Бір бағасы бар цех: мүлде бос цех нарық бағасымен толар еді (marketPrices.test.ts).
    const priced = { ...base, installation: { ratePerMetreWidth: 500_000 } }
    const old = { ...priced, schemaVersion: 4 }
    delete (old as Record<string, unknown>)['cutting']

    const migrated = parseShopProfile(old)
    expect(migrated.schemaVersion).toBe(10)
    expect(migrated.cutting).toEqual({ kerf: 4, trimEdge: null, optimization: 'standard' })
    expect(migrated.services).toEqual(base.services)
    expect(migrated.materials).toEqual(base.materials)
  })

  it('баптаулар раскройға сол күйінде беріледі', () => {
    const shop = {
      ...defaultShopProfile(),
      cutting: { kerf: 3, trimEdge: 15, optimization: 'deep' as const },
    }
    expect(nestingOptionsOf(shop)).toEqual({ kerf: 3, trimEdge: 15, optimization: 'deep' })
  })

  it('подрезка null болса, МАТЕРИАЛДАҒЫ саны қалады', () => {
    const shop = { ...defaultShopProfile(), cutting: defaultCutting() }
    expect(nestingOptionsOf(shop)).toEqual({ kerf: 4, optimization: 'standard' })
  })
})
