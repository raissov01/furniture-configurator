/**
 * Қиғаш (мансарда) корпус.
 *
 * Мұндағы басты келісім: панельдің ӨЛШЕМІ — ЗАГОТОВКАНЫҢ габариті. Станок
 * алдымен тікбұрышты кеседі, содан кейін қиғашты кеседі, ал гильотиндік
 * раскрой трапецияны кесе алмайды. Сондықтан раскрой да габаритпен жүреді —
 * бұл әдейі, әрі цехтың нақты жұмыс тәртібі.
 */
import { describe, expect, it } from 'vitest'
import {
  SEED_CATALOG,
  findTemplate,
  formatCutList,
  generateCabinet,
  nestPanels,
  panelToDxf,
  templateToCabinet,
} from '../src/core/index'
import type { CabinetConfig, Panel } from '../src/core/index'

const catalog = SEED_CATALOG
const base = templateToCabinet(findTemplate('wardrobe-penal-600')!, catalog)

const sloped = (patch: Partial<CabinetConfig> = {}): CabinetConfig => ({
  ...base,
  height: 2400, width: 1200, depth: 600,
  slope: { towards: 'back', lowHeight: 1400 },
  ...patch,
})

describe('қиғаш корпус', () => {
  const panels = generateCabinet(sloped(), catalog)
  const sides = panels.filter((p: Panel) => p.role === 'side')

  it('бүйірлер трапеция болады: екі жиегінің биіктігі әртүрлі', () => {
    expect(sides).toHaveLength(2)
    for (const side of sides) {
      expect(side.bevel).toBeDefined()
      expect(side.bevel!.lengthAtStart).toBeGreaterThan(side.bevel!.lengthAtEnd)
    }
  })

  it('өлшемі — ЗАГОТОВКАНЫҢ габариті, яғни биік жағы', () => {
    for (const side of sides) {
      expect(side.finishedLength).toBe(2400)
      expect(side.bevel!.lengthAtStart).toBeLessThanOrEqual(side.finishedLength)
      expect(side.bevel!.lengthAtEnd).toBeLessThanOrEqual(side.finishedLength)
    }
  })

  it('деталировкада қиғаш ЖАЗЫЛАДЫ — цех оны білуі керек', () => {
    const rows = formatCutList(panels, catalog)
    const side = rows.find((r) => r.name === 'Боковина')!
    expect(side.note).toMatch(/Скос \d+ → \d+/)
  })

  it('крышка көлбеу: ені — гипотенуза, тереңдіктен ҰЗЫН', () => {
    const top = panels.find((p: Panel) => p.role === 'top')!
    expect(top.finishedWidth).toBeGreaterThan(sloped().depth - 100)
    expect(top.note).toMatch(/Наклонная, \d+°/)
  })

  it('қиғашсыз корпуста ештеңе өзгермейді', () => {
    const flat = generateCabinet(base, catalog)
    expect(flat.every((p: Panel) => p.bevel === undefined)).toBe(true)
    // Жатық панельдің әдепкі бұрылысы — 90°; көлбеу сол мәннен АУЫТҚИДЫ.
    const flatTop = flat.find((p: Panel) => p.role === 'top')!
    const slopedTop = panels.find((p: Panel) => p.role === 'top')!
    expect(slopedTop.rotation.x).not.toBe(flatTop.rotation.x)
  })

  it('аласа жағы биік жағынан кіші болуы керек', () => {
    expect(() => generateCabinet(sloped({ slope: { towards: 'back', lowHeight: 2400 } }), catalog))
      .toThrow(/slope.lowHeight/)
    expect(() => generateCabinet(sloped({ slope: { towards: 'back', lowHeight: 10 } }), catalog))
      .toThrow(/slope.lowHeight/)
  })

  it('қиғаш тек sidesOverlay құрастыруымен', () => {
    expect(() => generateCabinet(sloped({ construction: 'topBottomOverlay' }), catalog))
      .toThrow(/sidesOverlay/)
  })

  it('алдыға қарай да қиғайта алады', () => {
    const forward = generateCabinet(sloped({ slope: { towards: 'front', lowHeight: 1400 } }), catalog)
    const side = forward.find((p: Panel) => p.role === 'side')!
    expect(side.bevel!.lengthAtStart).toBeLessThan(side.bevel!.lengthAtEnd)
  })
})

describe('қиғаш деталь: экспорт пен раскрой', () => {
  const panels = generateCabinet(sloped(), catalog)

  it('DXF контуры — ТРАПЕЦИЯ, тікбұрыш емес', () => {
    const side = panels.find((p: Panel) => p.role === 'side')!
    const dxf = panelToDxf(side)
    const outline = dxf.split('LWPOLYLINE')[1]!
    // Контурдың алғашқы төрт нүктесі. (TEXT нысанында да 10 коды бар,
    // сондықтан бәрін алуға болмайды.)
    const xs = [...outline.matchAll(/\n10\n([\d.]+)/g)].slice(0, 4).map((m) => Number(m[1]))
    expect(xs).toHaveLength(4)
    expect(new Set(xs).size).toBeGreaterThan(2)
  })

  it('тікбұрышты детальдің контуры бұрынғыдай тікбұрыш', () => {
    const shelf = panels.find((p: Panel) => p.role === 'shelf')!
    const dxf = panelToDxf(shelf)
    const outline = dxf.split('LWPOLYLINE')[1]!
    const xs = [...outline.matchAll(/\n10\n([\d.]+)/g)].slice(0, 4).map((m) => Number(m[1]))
    expect(new Set(xs).size).toBe(2)
  })

  it('раскрой ЗАГОТОВКА бойынша жүреді — гильотин трапецияны кеспейді', () => {
    const nesting = nestPanels(panels, catalog)
    expect(nesting.unplaced).toEqual([])
    const parts = nesting.byMaterial.flatMap((m) => m.sheets.flatMap((s) => s.parts))
    const side = panels.find((p: Panel) => p.role === 'side')!
    const placed = parts.find((p) => p.panelId === side.id)!
    expect(Math.max(placed.width, placed.height)).toBe(Math.max(side.cutLength, side.cutWidth))
  })
})

describe('қиғаштың астындағы сөрелер', () => {
  const panels = generateCabinet(sloped({ sections: [{
    id: 's1', widthMode: 'flex',
    contents: [{ kind: 'shelves', count: 3, shelfKind: 'adjustable' }],
    fronts: null,
  }] }), catalog)

  it('жоғарғы сөре ҚЫСҚАРАДЫ — арт жиегі көлбеу төбеге тіреледі', () => {
    const shelves = panels
      .filter((p: Panel) => p.role === 'shelf')
      .sort((a, b) => a.position.y - b.position.y)
    const depths = shelves.map((s) => s.finishedWidth)
    // Жоғарыға қарай тереңдік кемиді (кем дегенде біреуі қысқарған).
    expect(Math.min(...depths)).toBeLessThan(Math.max(...depths))
    expect(depths[depths.length - 1]).toBeLessThan(depths[0]!)
  })

  it('қысқарған сөре деталировкада БЕЛГІЛЕНЕДІ', () => {
    const rows = formatCutList(panels, catalog)
    expect(rows.some((r) => r.note.includes('Укорочена под скос'))).toBe(true)
  })

  it('әр сөре көлбеу төбенің АСТЫНДА қалады', () => {
    const cabinet = sloped()
    const high = cabinet.height
    const low = cabinet.slope!.lowHeight
    for (const shelf of panels.filter((p: Panel) => p.role === 'shelf')) {
      const backEdge = shelf.position.z + shelf.finishedWidth
      // Осы тереңдіктегі төбенің биіктігі сөренің үстінен жоғары болуы керек.
      const roof = high - ((high - low) * backEdge) / cabinet.depth
      expect(roof, `сөре ${shelf.id}: y=${shelf.position.y}, арт жиегі z=${backEdge}`)
        .toBeGreaterThanOrEqual(shelf.position.y)
    }
  })

  it('сөре мүлде сыймаса — түсінікті қате', () => {
    expect(() =>
      generateCabinet(sloped({
        slope: { towards: 'back', lowHeight: 400 },
        sections: [{
          id: 's1', widthMode: 'flex',
          contents: [{ kind: 'shelves', count: 8, shelfKind: 'adjustable' }],
          fronts: null,
        }],
      }), catalog),
    ).toThrow(/скос/)
  })
})
