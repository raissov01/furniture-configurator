/**
 * Базис-Мебельщик импортының тесттері (docs/basis/import.md).
 *
 * Мұнда ТЕК осы тапсырманың өз өзгерісі тексеріледі: `src/core/data/`-тегі
 * жаңа файлдар. Басқа агенттердің файлдарына (drilling/edges/dxf/types)
 * тәуелді емес — олардың жарты күйі бұл тестті құлатпауы керек.
 */
import { describe, expect, it } from 'vitest'
import {
  BASIS_CATALOG, BASIS_EDGE_BANDS, BASIS_MATERIALS, BASIS_PRICE_META,
  defaultShopProfile, generateCabinet, nestPanels, priceProject,
} from '../src/core/index'
import type { CabinetConfig } from '../src/core/index'

const NO_EDGE = { visibleFront: null, visibleSecondary: null, hidden: null }

describe('Базис импорты — Material/EdgeBand пішіні', () => {
  it('материалдар бос емес', () => {
    expect(BASIS_MATERIALS.length).toBeGreaterThan(1000)
    expect(BASIS_EDGE_BANDS.length).toBeGreaterThan(500)
  })

  it('id бәрі бірегей (материал + кромка бірге)', () => {
    const ids = [...BASIS_MATERIALS, ...BASIS_EDGE_BANDS].map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('қалыңдық пен парақ өлшемі оң', () => {
    for (const m of BASIS_MATERIALS) {
      expect(m.thickness, m.id).toBeGreaterThan(0)
      expect(m.sheetWidth, m.id).toBeGreaterThan(0)
      expect(m.sheetHeight, m.id).toBeGreaterThan(0)
    }
    for (const b of BASIS_EDGE_BANDS) {
      expect(b.thickness, b.id).toBeGreaterThan(0)
    }
  })

  it('тек ЛДСП (16/18мм) және ХДФ (3/4мм) импортталды', () => {
    const thicknesses = new Set(BASIS_MATERIALS.map((m) => m.thickness))
    expect([...thicknesses].sort((a, b) => a - b)).toEqual([3, 4, 16, 18])
  })

  it('кромка қалыңдығы 0.4/1/2 мм (жобаның конвенциясы)', () => {
    const thicknesses = new Set(BASIS_EDGE_BANDS.map((b) => b.thickness))
    expect([...thicknesses].sort((a, b) => a - b)).toEqual([0.4, 1, 2])
  })

  it('баға шешімі: барлығы 0, тек Egger 2800×2070-де ҚР анықтамалық бағасы бар', () => {
    const priced = BASIS_MATERIALS.filter((m) => m.pricePerSheet > 0)
    expect(priced.length).toBeGreaterThan(0)
    for (const m of priced) {
      expect(m.sheetWidth).toBe(2800)
      expect(m.sheetHeight).toBe(2070)
      expect(BASIS_PRICE_META[m.id]?.priceSource).toBe('kz-quoted-generic')
    }
    // Кромкада бекітілген ҚР бағасы жоқ — бәрі белгісіз.
    expect(BASIS_EDGE_BANDS.every((b) => b.pricePerMeter === 0)).toBe(true)
    // Бағасы 0 материалдардың priceSource — 'unknown'.
    const unpriced = BASIS_MATERIALS.filter((m) => m.pricePerSheet === 0)
    expect(unpriced.length).toBeGreaterThan(0)
    for (const m of unpriced) {
      expect(BASIS_PRICE_META[m.id]?.priceSource).toBe('unknown')
    }
  })

  it('hasGrain: ағаш декорлар да, біртүсті декорлар да бар (тек true не тек false емес)', () => {
    const grain = new Set(BASIS_MATERIALS.map((m) => m.hasGrain))
    expect(grain.has(true)).toBe(true)
    expect(grain.has(false)).toBe(true)
  })

  it('парақ өлшемі кемінде 1500 мм (1000×1000 fallback ақауы жоқ)', () => {
    // Нарықтағы ең кіші ЛДСП парағы 2440×1220-дан басталады,
    // ХДФ 2800×2070. 1000×1000 ондай емес — fallback ершігі.
    // Материалдағы толлыдың бір өлшемі ≥1500 болуы керек.
    for (const m of BASIS_MATERIALS) {
      const minDim = Math.min(m.sheetWidth, m.sheetHeight)
      expect(minDim, `${m.name} өлшемі ${m.sheetWidth}×${m.sheetHeight}`).toBeGreaterThanOrEqual(1500)
    }
  })
})

describe('Базис каталогымен generateCabinet', () => {
  it('кемінде бір нақты шкаф жиналады', () => {
    const ldsp16 = BASIS_MATERIALS.find((m) => m.thickness === 16)
    const hdf3 = BASIS_MATERIALS.find((m) => m.thickness === 3)
    if (!ldsp16 || !hdf3) throw new Error('фикстура үшін ЛДСП16/ХДФ3 табылмады')

    const config: CabinetConfig = {
      id: 'basis-test',
      name: 'Базис тест шкафы',
      construction: 'sidesOverlay',
      height: 2000,
      width: 600,
      depth: 450,
      carcassMaterialId: ldsp16.id,
      frontMaterialId: ldsp16.id,
      backMaterialId: hdf3.id,
      back: { mode: 'overlay' },
      sections: [
        {
          id: 's1',
          widthMode: 'flex',
          contents: [{ kind: 'shelves', count: 4, shelfKind: 'adjustable' }],
          fronts: { count: 2, mount: 'overlay' },
        },
      ],
      edging: NO_EDGE,
    }

    const panels = generateCabinet(config, BASIS_CATALOG)
    expect(panels.length).toBeGreaterThan(0)
    // Барлық панельдің материал id-і каталогта бар.
    const materialIds = new Set(BASIS_MATERIALS.map((m) => m.id))
    for (const p of panels) {
      expect(materialIds.has(p.materialId), p.role).toBe(true)
    }
  })
})

describe('Баға 0 болғанда pricing.ts құламайды', () => {
  it('priceProject missingPrices тізіміне жазады, лақтырмайды', () => {
    const ldsp16 = BASIS_MATERIALS.find((m) => m.thickness === 16 && m.pricePerSheet === 0)
    const hdf3 = BASIS_MATERIALS.find((m) => m.thickness === 3)
    if (!ldsp16 || !hdf3) throw new Error('фикстура үшін материал табылмады')

    const config: CabinetConfig = {
      id: 'basis-price-test',
      name: 'Баға тест',
      construction: 'sidesOverlay',
      height: 2000,
      width: 600,
      depth: 450,
      carcassMaterialId: ldsp16.id,
      frontMaterialId: ldsp16.id,
      backMaterialId: hdf3.id,
      back: { mode: 'overlay' },
      sections: [
        {
          id: 's1',
          widthMode: 'flex',
          contents: [],
          fronts: { count: 1, mount: 'overlay' },
        },
      ],
      edging: NO_EDGE,
    }
    const panels = generateCabinet(config, BASIS_CATALOG)
    const nesting = nestPanels(panels, BASIS_CATALOG)

    // Толық цех профилі (фурнитура/қызмет баптаулары) `defaultShopProfile()`-ден,
    // тек материал/кромка каталогы — Базис импорты (бағасы 0 тексеру үшін).
    const shop = { ...defaultShopProfile(), materials: BASIS_MATERIALS, edgeBands: BASIS_EDGE_BANDS }

    expect(() => priceProject(panels, nesting, shop)).not.toThrow()
    const result = priceProject(panels, nesting, shop)
    expect(result.missingPrices.length).toBeGreaterThan(0)
    expect(result.missingPrices.some((s) => s.includes(ldsp16.name))).toBe(true)
  })
})
