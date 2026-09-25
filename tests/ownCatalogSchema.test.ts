/**
 * Өз каталогының тексерісі мен жаюы — шағын қолдан жасалған кіріспен
 * (нақты зерттеу дерегіне тәуелсіз). Нақты дерек `ownCatalogData.test.ts`-те.
 */
import { describe, expect, it } from 'vitest'
import {
  buildOwnCatalog, buildOwnCatalogBundle, linkReferencePrices, parseResearchFile,
  validateOwnCatalogInput,
} from '../src/core/data/catalog/index'
import type {
  DecorRecord, EdgeRecord, OwnCatalogInput, ResearchFile, SupplierPriceRow,
} from '../src/core/data/catalog/index'

const SRC = {
  id: 'test-src', manufacturer: 'Egger', url: 'https://example.com/decors', what: 'декорлар',
  termsUrl: null, termsNote: 'тест', reuse: 'facts-ok' as const, dateSeen: '2026-09-25',
}

const decor = (over: Partial<DecorRecord> = {}): DecorRecord => ({
  manufacturer: 'Egger', kind: 'ldsp', decorCode: 'H1145', structureCode: 'ST10', productLine: null,
  name: 'Дуб Бардолино натуральный', collection: 'Test', thicknessesMm: [16, 18],
  sheetSizesMm: [[2800, 2070]], sizeBasis: 'per-decor', sizeSourceUrl: 'https://example.com/h1145',
  grain: 'wood', grainBasis: 'өндіруші санаты', sourceId: 'test-src',
  sourceUrl: 'https://example.com/h1145', dateSeen: '2026-09-25', ...over,
})

const edge = (over: Partial<EdgeRecord> = {}): EdgeRecord => ({
  manufacturer: 'Egger', code: 'H1145', name: 'Дуб Бардолино', material: 'abs',
  thicknessesMm: [0.4, 0.8, 2], widthsMm: [19, 22, 54],
  matches: [{ manufacturer: 'Egger', decorCode: 'H1145', structureCode: null }],
  sourceId: 'test-src', sourceUrl: 'https://example.com/edge', dateSeen: '2026-09-25', ...over,
})

const input = (over: Partial<OwnCatalogInput> = {}): OwnCatalogInput => ({
  sources: [SRC], decors: [decor()], edges: [edge()], ...over,
})

describe('validateOwnCatalogInput — қате өріс атымен', () => {
  it('жарамды кіріс — қатесіз', () => {
    expect(validateOwnCatalogInput(input())).toEqual([])
  })

  it('бос декор коды — decors[i].decorCode', () => {
    const issues = validateOwnCatalogInput(input({ decors: [decor(), decor({ decorCode: ' ', structureCode: null })] }))
    expect(issues.map((i) => i.path)).toContain('decors[1].decorCode')
  })

  it('бөлшек не аралықтан тыс қалыңдық — thicknessesMm[j], рұқсат аралығымен', () => {
    const issues = validateOwnCatalogInput(input({ decors: [decor({ thicknessesMm: [16.5, 180] })] }))
    expect(issues.map((i) => i.path)).toEqual(['decors[0].thicknessesMm[0]', 'decors[0].thicknessesMm[1]'])
    expect(issues[0]?.message).toContain('3–40')
  })

  it('бір декордағы қалыңдық қайталанса — қайталанған элементті көрсетеді', () => {
    const issues = validateOwnCatalogInput(input({ decors: [decor({ thicknessesMm: [16, 16, 18] })] }))
    expect(issues.map((i) => i.path)).toContain('decors[0].thicknessesMm[1]')
  })

  it('product line регистрі ғана өзгеше болса — бір декор деп санайды', () => {
    const issues = validateOwnCatalogInput(input({
      decors: [decor({ productLine: 'P2' }), decor({ productLine: 'p2' })],
    }))
    expect(issues.map((i) => i.path)).toContain('decors[1].decorCode')
  })

  it('парақ өлшемі бүтін әрі 1000–5700 мм', () => {
    const issues = validateOwnCatalogInput(input({ decors: [decor({ sheetSizesMm: [[2800, 999], [2800.5, 2070]] })] }))
    expect(issues.map((i) => i.path)).toEqual(['decors[0].sheetSizesMm[0][1]', 'decors[0].sheetSizesMm[1][0]'])
  })

  it('қайталанған декор (бос орын/регистр ескерілмейді)', () => {
    const issues = validateOwnCatalogInput(input({ decors: [decor(), decor({ decorCode: 'h 1145', structureCode: 'st10' })] }))
    expect(issues.map((i) => i.path)).toEqual(['decors[1].decorCode'])
  })

  it('кромка сәйкестігі жоқ декорға сілтесе — edges[i].matches[j]', () => {
    const issues = validateOwnCatalogInput(input({
      edges: [edge({ matches: [{ manufacturer: 'Egger', decorCode: 'H9999', structureCode: null }] })],
    }))
    expect(issues.map((i) => i.path)).toEqual(['edges[0].matches[0]'])
  })

  it('белгісіз дереккөз мен URL-сіз жазба', () => {
    const issues = validateOwnCatalogInput(input({ decors: [decor({ sourceId: 'nope', sourceUrl: 'example' })] }))
    expect(issues.map((i) => i.path).sort()).toEqual(['decors[0].sourceId', 'decors[0].sourceUrl'])
  })
})

describe('buildOwnCatalog — Material/EdgeBand-қа жаю', () => {
  it('әр қалыңдық × формат — бөлек материал, пішіні жобаның Material-ы', () => {
    const b = buildOwnCatalog(input())
    expect(b.materials.map((m) => m.id)).toEqual([
      'own-ldsp-egger-h1145-st10-16-2800x2070',
      'own-ldsp-egger-h1145-st10-18-2800x2070',
    ])
    const m = b.materials[0]
    expect(m).toMatchObject({ thickness: 16, sheetWidth: 2800, sheetHeight: 2070, hasGrain: true, pricePerSheet: 0, trimEdge: 10 })
    expect(b.materialMeta[m?.id ?? '']?.decorCode).toBe('H1145')
  })

  it('кромка тек 0.4/1/2 мм және ені 19–43 мм жайылады (0.8 мен 54 — жоқ)', () => {
    const b = buildOwnCatalog(input())
    expect(b.edgeBands.map((e) => e.id)).toEqual([
      'own-edge-egger-h1145-abs-04x19', 'own-edge-egger-h1145-abs-04x22',
      'own-edge-egger-h1145-abs-2x19', 'own-edge-egger-h1145-abs-2x22',
    ])
  })

  it('үнсіз кромка: ені ≥ қалыңдық + 3 мм (16 → 19, 18 → 22), 2 мм алдыңғы, 0.4 мм екінші', () => {
    const b = buildOwnCatalog(input())
    expect(b.materials[0]?.defaultEdging).toEqual({
      visibleFront: 'own-edge-egger-h1145-abs-2x19', visibleSecondary: 'own-edge-egger-h1145-abs-04x19', hidden: null,
    })
    expect(b.materials[1]?.defaultEdging?.visibleFront).toBe('own-edge-egger-h1145-abs-2x22')
  })

  it('біртүсті декор бұрылады, белгісіз текстура — бұрылмайды (қауіпсіз жағы)', () => {
    const b = buildOwnCatalog(input({
      decors: [decor({ decorCode: 'U104', structureCode: 'ST9', grain: 'none' }), decor({ decorCode: 'F100', grain: 'unknown' })],
      edges: [],
    }))
    expect(b.materials.map((m) => m.hasGrain)).toEqual([false, false, true, true])
  })

  it('каталогқа тек CATALOG_THICKNESSES_MM жайылады, жарияланғанның бәрі мета-да', () => {
    const b = buildOwnCatalog(input({ decors: [decor({ thicknessesMm: [8, 16, 38] })], edges: [] }))
    expect(b.materials.map((m) => m.thickness)).toEqual([16])
    expect(b.materialMeta[b.materials[0]?.id ?? '']?.publishedThicknessesMm).toEqual([8, 16, 38])
  })

  it('бір декордың екі өнім желісі — екі бөлек материал, желісіз қайталау — қате', () => {
    const two = buildOwnCatalog(input({ decors: [decor(), decor({ productLine: 'MR' })], edges: [] }))
    expect(two.materials.map((m) => m.id)).toContain('own-ldsp-egger-h1145-st10-mr-16-2800x2070')
    expect(validateOwnCatalogInput(input({ decors: [decor({ productLine: 'MR' }), decor({ productLine: 'MR' })] }))
      .map((i) => i.path)).toEqual(['decors[1].decorCode'])
  })

  it('2 мм кромкасы жоқ декорға үнсіз жиынтық берілмейді (фасад жиегі үнсіз ашық қалмасын)', () => {
    const b = buildOwnCatalog(input({ edges: [edge({ thicknessesMm: [0.4] })] }))
    expect(b.materials[0]?.defaultEdging).toBeUndefined()
  })

  it('жарамсыз кіріс — лақтырады, хабарламада өріс аталады', () => {
    expect(() => buildOwnCatalog(input({ decors: [decor({ thicknessesMm: [0] })] })))
      .toThrow(/decors\[0\]\.thicknessesMm\[0\]/)
  })
})

describe('зерттеу файлы → каталог', () => {
  const research = (over: Partial<ResearchFile> = {}): ResearchFile => ({
    sources: [SRC], skipped: [], notes: '',
    materials: [{
      manufacturer: 'Egger', kind: 'ldsp', decorCode: 'H1145', structureCode: 'ST10', productLine: null, name: 'Дуб',
      collection: null, thicknessesMm: [16], sheetSizesMm: [[2800, 2070]], sizeBasis: 'per-decor',
      sizeSourceUrl: 'https://example.com/h1145', grain: 'wood', grainBasis: 'x',
      sourceUrl: 'https://example.com/decors/h1145', dateSeen: '2026-09-25',
    }, {
      manufacturer: 'Egger', kind: 'ldsp', decorCode: 'U999', structureCode: null, productLine: null, name: 'Өлшемсіз',
      collection: null, thicknessesMm: [], sheetSizesMm: [], sizeBasis: 'unknown', sizeSourceUrl: null,
      grain: 'none', grainBasis: 'x', sourceUrl: 'https://example.com/decors/u999', dateSeen: '2026-09-25',
    }],
    edges: [{
      manufacturer: 'Rehau', code: '1234', name: 'Дуб', material: 'pvc', thicknessesMm: [2], widthsMm: [22],
      matches: [
        { manufacturer: 'Egger', decorCode: 'H1145', structureCode: null },
        { manufacturer: 'Egger', decorCode: 'H0000', structureCode: null },
      ],
      sourceUrl: 'https://example.com/decors/edge', dateSeen: '2026-09-25',
    }],
    ...over,
  })

  it('өлшемсіз декор мен шешілмеген сәйкестік — қате емес, есепке жазылған олқылық', () => {
    const b = buildOwnCatalogBundle([research()], [])
    expect(b.materials).toHaveLength(1)
    expect(b.report.decorsWithoutSizes).toBe(1)
    expect(b.report.unresolvedEdgeMatches).toBe(1)
    expect(b.report.decorsByManufacturer.Egger).toEqual({ found: 2, included: 1 })
    expect(b.edgeMeta['own-edge-rehau-1234-pvc-2x22']?.decorKeys).toEqual(['egger|H1145|ST10'])
  })

  it('тыйым салынған дереккөздің жазбасы каталогқа кірмейді', () => {
    const b = buildOwnCatalogBundle([research({ sources: [{ ...SRC, reuse: 'forbidden' }] })], [])
    expect(b.materials).toHaveLength(0)
    expect(b.report.forbiddenRecords).toBeGreaterThan(0)
    expect(b.sources).toHaveLength(0)
  })

  it('parseResearchFile қате өрістің жолын атайды', () => {
    const bad = { ...research(), materials: [{ ...research().materials[0], thicknessesMm: ['16'] }] }
    expect(() => parseResearchFile(bad, 'x.json')).toThrow(/x\.json: materials\.0\.thicknessesMm\.0/)
  })
})

describe('анықтамалық баға байланысы', () => {
  const row = (over: Partial<SupplierPriceRow> = {}): SupplierPriceRow => ({
    supplier: 'PROFI KZ', city: 'Астана', url: 'https://example.kz/p', date_seen: '2026-09-24',
    brand: 'Egger', decor_code: 'H1145 ST10', name: 'ЛДСП', thickness_mm: 16, sheet_size_mm: '2800×2070',
    unit: 'sheet', price_kzt: 29620, vat_included: 'unknown', note: '', category: 'ldsp', price_type: 'exact', ...over,
  })

  it('бренд + декор + құрылым + қалыңдық + формат дәл сәйкес — тиынмен байланады', () => {
    const b = buildOwnCatalog(input())
    const prices = linkReferencePrices([row()], b.materials, b.materialMeta, b.edgeBands, b.edgeMeta)
    expect(prices).toHaveLength(1)
    expect(prices[0]).toMatchObject({
      targetKind: 'material', targetId: 'own-ldsp-egger-h1145-st10-16-2800x2070', priceTiyn: 2_962_000, dateSeen: '2026-09-24',
    })
  })

  it('қалыңдық, формат, бренд не код сәйкес келмесе, баға жоқ болса — байланбайды', () => {
    const b = buildOwnCatalog(input())
    const rows = [
      row({ thickness_mm: 22 }), row({ sheet_size_mm: '2750×1830' }), row({ brand: null }),
      row({ decor_code: 'H1145 ST9' }), row({ price_kzt: null, price_type: 'on_request' }),
    ]
    expect(linkReferencePrices(rows, b.materials, b.materialMeta, b.edgeBands, b.edgeMeta)).toEqual([])
  })

  it('құрылымы null декор: жеткізуші кодындағы құрылым жұрнағы («U 9118 TS») сәйкес, басқа код — жоқ', () => {
    const b = buildOwnCatalog(input({
      decors: [decor({ manufacturer: 'Увадрев', decorCode: 'U9118', structureCode: null, sheetSizesMm: [[2750, 1830]] })],
      edges: [],
    }))
    const r = (decor_code: string) => row({ brand: 'Увадрев', decor_code, sheet_size_mm: '2750×1830', price_kzt: 17500 })
    const prices = linkReferencePrices([r('U 9118 TS'), r('U 91181'), r('U 9118 ABCD')], b.materials, b.materialMeta, b.edgeBands, b.edgeMeta)
    expect(prices.map((p) => p.supplierDecorCode)).toEqual(['U 9118 TS'])
  })

  it('плита түрі сәйкес болуы керек, екі желі болса — стандарт желі (Egger P2), ылғалға төзімді жол — стандартқа жалғанбайды', () => {
    const b = buildOwnCatalog(input({
      decors: [decor({ productLine: 'P2' }), decor({ productLine: 'MR' }), decor({ kind: 'mdf', productLine: null })],
      edges: [],
    }))
    const link = (rs: SupplierPriceRow[]) =>
      linkReferencePrices(rs, b.materials, b.materialMeta, b.edgeBands, b.edgeMeta).map((p) => p.targetId)
    expect(link([row()])).toEqual(['own-ldsp-egger-h1145-st10-p2-16-2800x2070'])
    expect(link([row({ category: 'mdf' })])).toEqual(['own-mdf-egger-h1145-st10-16-2800x2070'])
    expect(link([row({ name: 'ЛДСП влагостойкая' })])).toEqual([])
    expect(link([row({ category: 'worktop' })])).toEqual([])
  })

  it('кромка: код + қалыңдық + ен (атаудағы «22/2»)', () => {
    const b = buildOwnCatalog(input())
    const prices = linkReferencePrices(
      [row({ unit: 'lm', category: 'edge_band', decor_code: 'H1145', thickness_mm: 2, name: 'ABS 22/2', sheet_size_mm: null, price_kzt: 150 })],
      b.materials, b.materialMeta, b.edgeBands, b.edgeMeta,
    )
    expect(prices.map((p) => [p.targetId, p.priceTiyn])).toEqual([['own-edge-egger-h1145-abs-2x22', 15_000]])
  })
})
