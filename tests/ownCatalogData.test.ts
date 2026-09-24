/**
 * Өз каталогымыздың НАҚТЫ дерегі (docs/catalog/sources.md): генератор жазған
 * `generated/*.json` жарамды, толық әрі кірістегі зерттеу файлдарымен сәйкес.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  OWN_CATALOG, OWN_CATALOG_INPUT, OWN_CATALOG_SOURCES, OWN_REFERENCE_PRICES, BASIS_CATALOG, SEED_CATALOG,
  decorKey, generateCabinet, normalizeResearch, ownCatalogBuild, parseResearchFile, validateOwnCatalogInput,
} from '../src/core/index'
import type { CabinetConfig } from '../src/core/index'

const {
  materials: OWN_MATERIALS, edgeBands: OWN_EDGE_BANDS, materialMeta: OWN_MATERIAL_META, edgeMeta: OWN_EDGE_META,
} = ownCatalogBuild()

const DIR = new URL('../src/core/data/catalog/', import.meta.url)

describe('өз каталогы — пішін мен тұтастық', () => {
  it('генератор жазған кіріс тексерістен қатесіз өтеді', () => {
    expect(validateOwnCatalogInput(OWN_CATALOG_INPUT)).toEqual([])
  })

  it('OWN_CATALOG — жалқау, бірақ ownCatalogBuild()-пен бір массив', () => {
    expect(OWN_CATALOG.materials).toBe(OWN_MATERIALS)
    expect(OWN_CATALOG.edgeBands).toBe(OWN_EDGE_BANDS)
  })

  it('generated/catalog.json кірістегі зерттеу файлдарынан қайта құрастырылғанмен бірдей (генератор жүргізілген)', () => {
    const dir = new URL('input/research/', DIR)
    const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort()
      .map((f) => parseResearchFile(JSON.parse(readFileSync(new URL(f, dir), 'utf8')), f))
    expect(normalizeResearch(files).input).toEqual(OWN_CATALOG_INPUT)
  })

  it('id бірегей: материал + кромка бірге, әрі Базис пен seed каталогымен қиылыспайды', () => {
    const ids = [...OWN_MATERIALS, ...OWN_EDGE_BANDS].map((x) => x.id)
    expect(new Set(ids).size).toBe(ids.length)
    const others = new Set([...BASIS_CATALOG.materials, ...BASIS_CATALOG.edgeBands, ...SEED_CATALOG.materials, ...SEED_CATALOG.edgeBands].map((x) => x.id))
    expect(ids.filter((id) => others.has(id))).toEqual([])
  })

  it('әр материалда декор коды, дереккөз URL мен күні бар; өлшемдер бүтін', () => {
    for (const m of OWN_MATERIALS) {
      const meta = OWN_MATERIAL_META[m.id]
      expect(meta?.decorCode.trim(), m.id).toBeTruthy()
      expect(meta?.sourceUrl, m.id).toMatch(/^https?:\/\//)
      expect(meta?.dateSeen, m.id).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      for (const v of [m.thickness, m.sheetWidth, m.sheetHeight]) expect(Number.isInteger(v), m.id).toBe(true)
      expect(m.pricePerSheet).toBe(0)
    }
  })

  it('кромка қалыңдығы тек 0.4/1/2 мм', () => {
    expect([...new Set(OWN_EDGE_BANDS.map((b) => b.thickness))].sort()).toEqual([0.4, 1, 2])
  })

  it('кромканың әр декор сілтемесі каталогтағы материалға шешіледі', () => {
    const keys = new Set(Object.values(OWN_MATERIAL_META).map((m) => decorKey(m.manufacturer, m.decorCode, m.structureCode)))
    let links = 0
    for (const [id, meta] of Object.entries(OWN_EDGE_META)) {
      for (const k of meta.decorKeys) {
        expect(keys.has(k), `${id} → ${k}`).toBe(true)
        links++
      }
    }
    expect(links).toBeGreaterThan(1000)
  })

  it('үнсіз кромка жиынтығы бар кромкаға сілтейді, әрі ені плитадан кем емес', () => {
    const bands = new Map(OWN_EDGE_BANDS.map((b) => [b.id, b]))
    const withEdging = OWN_MATERIALS.filter((m) => m.defaultEdging)
    expect(withEdging.length).toBeGreaterThan(500)
    for (const m of withEdging) {
      for (const id of [m.defaultEdging?.visibleFront, m.defaultEdging?.visibleSecondary]) {
        if (id === null || id === undefined) continue
        expect(bands.has(id), `${m.id} → ${id}`).toBe(true)
        expect(OWN_EDGE_META[id]?.widthMm ?? 0, `${m.id} → ${id}`).toBeGreaterThanOrEqual(m.thickness + 3)
      }
    }
  })

  it('дереккөздің бәрі «facts-ok» не «unclear»; тыйым салынғандар тек skipped-те', () => {
    expect(OWN_CATALOG_SOURCES.sources.every((s) => s.reuse === 'facts-ok' || s.reuse === 'unclear')).toBe(true)
    const skipped = OWN_CATALOG_SOURCES.skipped.map((s) => s.manufacturer).join(' ')
    expect(skipped).toMatch(/Kronospan/)
    expect(skipped).toMatch(/Kastamonu/)
    const used = new Set(OWN_CATALOG_INPUT.decors.map((d) => d.manufacturer))
    expect(used.has('Kronospan')).toBe(false)
    expect(used.has('Kastamonu')).toBe(false)
  })
})

describe('өз каталогы — белгілі декорлар өндіруші бойынша', () => {
  const has = (manufacturer: string, decorCode: string, structureCode: string | null, thickness: number) =>
    OWN_MATERIALS.some((m) => {
      const x = OWN_MATERIAL_META[m.id]
      return x?.manufacturer === manufacturer && x.decorCode === decorCode &&
        (structureCode === null || x.structureCode === structureCode) && m.thickness === thickness
    })

  it.each([
    ['Egger', 'H1145', 'ST10', 16],
    ['Egger', 'W980', 'ST7', 18],
    ['Egger', 'U104', 'ST9', 16],
    ['Lamarty', 'Малави', null, 16],
    ['Увадрев', 'U9118', null, 16],
    ['Ultradecor', '4298', 'SU', 16],
    ['SWISS KRONO', 'D3102', null, 18],
  ] as const)('%s %s %s — %i мм', (man, code, struct, t) => {
    expect(has(man, code, struct, t)).toBe(true)
  })

  it('ХДФ (арт қабырға) мен МДФ фасад қалыңдықтары бар', () => {
    const t = (kind: string) => new Set(OWN_MATERIALS.filter((m) => OWN_MATERIAL_META[m.id]?.kind === kind).map((m) => m.thickness))
    expect([...t('hdf')]).toContain(3)
    for (const x of [16, 18, 19, 22]) expect([...t('mdf')]).toContain(x)
  })

  it('Egger H1145 ST10 16 мм — Egger-дің өз 2 мм кромкасы алдыңғы жиекке', () => {
    const m = OWN_MATERIALS.find((x) => x.id === 'own-ldsp-egger-h1145-st10-p2-16-2800x2070')
    const front = m?.defaultEdging?.visibleFront ?? ''
    expect(OWN_EDGE_META[front]).toMatchObject({ manufacturer: 'Egger', code: 'H1145 ST10' })
  })
})

describe('өз каталогы — анықтамалық баға', () => {
  it('әр баға бар материалға/кромкаға сілтейді, бүтін тиын, дереккөзі мен күні бар', () => {
    const ids = new Set([...OWN_MATERIALS, ...OWN_EDGE_BANDS].map((x) => x.id))
    expect(OWN_REFERENCE_PRICES.length).toBeGreaterThanOrEqual(10)
    for (const p of OWN_REFERENCE_PRICES) {
      expect(ids.has(p.targetId), p.targetId).toBe(true)
      expect(Number.isInteger(p.priceTiyn) && p.priceTiyn > 0).toBe(true)
      expect(p.url).toMatch(/^https?:\/\//)
      expect(p.dateSeen).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it('PROFI KZ Egger F685 ST10 16 мм = 29 620 ₸ → стандарт P2 парағына 2 962 000 тиын', () => {
    const p = OWN_REFERENCE_PRICES.find((x) => x.targetId === 'own-ldsp-egger-f685-st10-p2-16-2800x2070')
    expect(p).toMatchObject({ supplier: 'PROFI KZ', priceTiyn: 2_962_000, unit: 'sheet' })
  })

  it('баға материалдың өзіне жазылмайды', () => {
    expect(OWN_MATERIALS.every((m) => m.pricePerSheet === 0)).toBe(true)
    expect(OWN_EDGE_BANDS.every((b) => b.pricePerMeter === 0)).toBe(true)
  })
})

describe('өз каталогы — генерацияда қолдану', () => {
  it('Egger ЛДСП 16 + ХДФ 3 мм + декордың өз кромкасымен шкаф жиналады', () => {
    const body = OWN_MATERIALS.find((m) => m.id === 'own-ldsp-egger-h1145-st10-p2-16-2800x2070')
    const back = OWN_MATERIALS.find((m) => OWN_MATERIAL_META[m.id]?.kind === 'hdf' && m.thickness === 3)
    if (!body?.defaultEdging || !back) throw new Error('фикстура үшін ЛДСП16 (кромкасымен) / ХДФ3 табылмады')
    const config: CabinetConfig = {
      id: 'own-test', name: 'Өз каталогы тест шкафы', construction: 'sidesOverlay',
      height: 2000, width: 600, depth: 450,
      carcassMaterialId: body.id, frontMaterialId: body.id, backMaterialId: back.id,
      back: { mode: 'overlay' },
      sections: [{
        id: 's1', widthMode: 'flex',
        contents: [{ kind: 'shelves', count: 4, shelfKind: 'adjustable' }],
        fronts: { count: 2, mount: 'overlay' },
      }],
      edging: body.defaultEdging,
    }
    const panels = generateCabinet(config, OWN_CATALOG)
    expect(panels.length).toBeGreaterThan(5)
    const materials = new Set(OWN_CATALOG.materials.map((m) => m.id))
    const bands = new Set(OWN_CATALOG.edgeBands.map((b) => b.id))
    let banded = 0
    for (const p of panels) {
      expect(materials.has(p.materialId), p.role).toBe(true)
      for (const e of Object.values(p.edges)) {
        if (e === null) continue
        expect(bands.has(e.bandId), e.bandId).toBe(true)
        banded++
      }
    }
    expect(banded).toBeGreaterThan(0)
  })
})
