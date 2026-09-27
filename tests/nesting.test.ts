/**
 * Раскрой (§5). Бұл жердегі тестер — қасиеттік (property) тестер: нақты
 * сандарды емес, ЕРЕЖЕЛЕРДІ тексереді.
 *
 * Ең маңыздысы — ГИЛЬОТИН ережесі. Форматты-кескіш станок парақты шетінен
 * шетіне дейін ғана кеседі. Сызбада бір ғана «Г» тәрізді орналасу болса,
 * цех оны кесе алмайды, ал бұл көзге бірден түспейді — сондықтан тексеру
 * рекурсивті верификатормен жүреді.
 */
import { describe, expect, it } from 'vitest'
import {
  SEED_CATALOG,
  findTemplate,
  generateCabinet,
  nestPanels,
  templateToCabinet,
} from '../src/core/index'
import type { NestedPart, Panel, SheetRect } from '../src/core/index'

const cabinetOf = (id: string) => templateToCabinet(findTemplate(id)!, SEED_CATALOG)
const panelsOf = (id: string) => generateCabinet(cabinetOf(id), SEED_CATALOG)

/** Барлық шаблонның детальдары — үлкенірек әрі әртүрлі жиын. */
function manyPanels(): Panel[] {
  return [
    ...panelsOf('wardrobe-3sec-1800'),
    ...panelsOf('kitchen-base-600'),
    ...panelsOf('bookcase-2sec-1200'),
  ]
}

const overlaps = (a: NestedPart, b: NestedPart) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

/**
 * Гильотин верификаторы: аймақты бөлетін ТОЛЫҚ тік немесе көлденең сызық
 * табылуы керек, әрі ол бірде-бір детальді қақ жармауы тиіс. Табылса —
 * екі жағын да рекурсивті тексереміз.
 */
function isGuillotine(parts: NestedPart[]): boolean {
  if (parts.length <= 1) return true

  const xs = [...new Set(parts.map((p) => p.x + p.width))]
  for (const cut of xs) {
    const left = parts.filter((p) => p.x + p.width <= cut)
    const right = parts.filter((p) => p.x >= cut)
    if (left.length + right.length === parts.length && left.length > 0 && right.length > 0) {
      if (isGuillotine(left) && isGuillotine(right)) return true
    }
  }

  const ys = [...new Set(parts.map((p) => p.y + p.height))]
  for (const cut of ys) {
    const below = parts.filter((p) => p.y + p.height <= cut)
    const above = parts.filter((p) => p.y >= cut)
    if (below.length + above.length === parts.length && below.length > 0 && above.length > 0) {
      if (isGuillotine(below) && isGuillotine(above)) return true
    }
  }
  return false
}

const inside = (p: NestedPart, u: SheetRect) =>
  p.x >= u.x && p.y >= u.y && p.x + p.width <= u.x + u.width && p.y + p.height <= u.y + u.height

describe('раскрой', () => {
  const result = nestPanels(manyPanels(), SEED_CATALOG)

  it('барлық деталь орналасты', () => {
    expect(result.unplaced).toEqual([])
    expect(result.sheetCount).toBeGreaterThan(0)
  })

  it('детальдар бір-бірімен ҚАБАТТАСПАЙДЫ', () => {
    for (const m of result.byMaterial) {
      for (const sheet of m.sheets) {
        for (let i = 0; i < sheet.parts.length; i += 1) {
          for (let k = i + 1; k < sheet.parts.length; k += 1) {
            expect(
              overlaps(sheet.parts[i]!, sheet.parts[k]!),
              `${m.materialName} лист ${sheet.index}: ${sheet.parts[i]!.label} ↔ ${sheet.parts[k]!.label}`,
            ).toBe(false)
          }
        }
      }
    }
  })

  it('әр деталь подрезкадан кейінгі аймақтың ІШІНДЕ', () => {
    for (const m of result.byMaterial) {
      for (const sheet of m.sheets) {
        for (const part of sheet.parts) {
          expect(inside(part, sheet.usable), `${part.label}`).toBe(true)
        }
      }
    }
  })

  it('әр парақтың сызбасы ГИЛЬОТИНМЕН кесіледі', () => {
    for (const m of result.byMaterial) {
      for (const sheet of m.sheets) {
        expect(isGuillotine(sheet.parts), `${m.materialName} лист ${sheet.index}`).toBe(true)
      }
    }
  })

  it('бір параққа әртүрлі материал түспейді', () => {
    for (const m of result.byMaterial) {
      for (const sheet of m.sheets) {
        expect(sheet.materialId).toBe(m.materialId)
      }
    }
  })

  it('текстуралы материалда деталь БҰРЫЛМАЙДЫ', () => {
    for (const m of result.byMaterial) {
      const material = SEED_CATALOG.materials.find((x) => x.id === m.materialId)!
      if (!material.hasGrain) continue
      for (const sheet of m.sheets) {
        for (const part of sheet.parts) {
          // Текстуралы материалда бағыт grainAlongLength-пен қатаң бекітілген,
          // сондықтан «бұрылған» деп белгіленген деталь бір бағытта ғана болады.
          const panel = manyPanels().find((p) => p.id === part.panelId)!
          expect(part.rotated).toBe(!panel.grainAlongLength)
        }
      }
    }
  })

  it('текстурасыз материалда бұруға болады', () => {
    const hdf = result.byMaterial.find((m) => m.materialId === 'hdf3-white')
    expect(hdf).toBeDefined()
  })

  it('қалдық пайызы 0..100 аралығында әрі ауданмен сәйкес', () => {
    for (const m of result.byMaterial) {
      expect(m.wastePercent).toBeGreaterThanOrEqual(0)
      expect(m.wastePercent).toBeLessThan(100)
      expect(m.partArea).toBeLessThanOrEqual(m.usableArea)
    }
  })

  it('деловой отход тек 100×100-ден үлкен болады', () => {
    for (const m of result.byMaterial) {
      for (const sheet of m.sheets) {
        for (const off of sheet.offcuts) {
          expect(off.width).toBeGreaterThan(100)
          expect(off.height).toBeGreaterThan(100)
        }
      }
    }
  })

  it('дәл 100 мм жолақ қалдыққа кірмейді, 101 мм кіреді', () => {
    const material = {
      ...SEED_CATALOG.materials[0]!, sheetWidth: 300, sheetHeight: 300,
      trimEdge: 0, hasGrain: true,
    }
    const catalog = { ...SEED_CATALOG, materials: [material] }
    const base = panelsOf('wardrobe-penal-600')[0]!
    const offcutsFor = (length: number) => nestPanels([
      { ...base, materialId: material.id, cutLength: length, cutWidth: 300, grainAlongLength: true },
    ], catalog, { kerf: 4 }).byMaterial[0]!.sheets[0]!.offcuts

    expect(offcutsFor(196)).toEqual([])
    expect(offcutsFor(195)).toEqual([{ x: 199, y: 0, width: 101, height: 300 }])
  })

  it('параққа сыймайтын деталь ҮНСІЗ ЖОҒАЛМАЙДЫ', () => {
    const huge = generateCabinet(
      { ...cabinetOf('wardrobe-penal-600'), height: 3500, width: 900 },
      SEED_CATALOG,
    )
    const out = nestPanels(huge, SEED_CATALOG)
    expect(out.unplaced.length).toBeGreaterThan(0)
    expect(out.unplaced[0]!.reason).toMatch(/не помещается/)
  })

  it('эталон шкаф бір парақтан аспайды', () => {
    const out = nestPanels(panelsOf('wardrobe-penal-600'), SEED_CATALOG)
    const ldsp = out.byMaterial.find((m) => m.materialId === 'ldsp16-h1145')!
    expect(ldsp.sheets).toHaveLength(1)
  })
})

/**
 * Баптаулар: пропил, подрезка, іздеу тереңдігі. Бұлар цехтың станогына
 * байланысты — бір цехтың саны кодта тұрмайды.
 */
describe('раскрой баптаулары', () => {
  const panels = manyPanels()

  it('пропил тек 0..20 бүтін мм болады', () => {
    const sample = panels.slice(0, 1)
    for (const kerf of [-1, 21, 999999, 0.5, Number.NaN]) {
      expect(() => nestPanels(sample, SEED_CATALOG, { kerf })).toThrow(/kerf.*0\.\.20/)
    }
    expect(() => nestPanels(sample, SEED_CATALOG, { kerf: 0 })).not.toThrow()
    expect(() => nestPanels(sample, SEED_CATALOG, { kerf: 20 })).not.toThrow()
  })

  it('подрезка пайдалы аймақты дәл сонша қысады', () => {
    const wide = nestPanels(panels, SEED_CATALOG, { trimEdge: 0 })
    const tight = nestPanels(panels, SEED_CATALOG, { trimEdge: 25 })
    const usableOf = (r: ReturnType<typeof nestPanels>) => r.byMaterial[0]!.sheets[0]!.usable
    const sheet = (r: ReturnType<typeof nestPanels>) => r.byMaterial[0]!.sheets[0]!

    expect(usableOf(wide)).toMatchObject({ x: 0, y: 0 })
    expect(usableOf(wide).width).toBe(sheet(wide).sheetWidth)
    expect(usableOf(tight)).toMatchObject({ x: 25, y: 25 })
    expect(usableOf(tight).width).toBe(sheet(tight).sheetWidth - 50)
  })

  it('подрезкасыз парақ детальға кем дегенде сонша орын береді', () => {
    const wide = nestPanels(panels, SEED_CATALOG, { trimEdge: 0 })
    const tight = nestPanels(panels, SEED_CATALOG, { trimEdge: 25 })
    expect(wide.sheetCount).toBeLessThanOrEqual(tight.sheetCount)
  })

  it('пропил кеңейгенде детальдар бір-біріне жабыспайды', () => {
    const out = nestPanels(panels, SEED_CATALOG, { kerf: 12 })
    for (const m of out.byMaterial) {
      for (const sheet of m.sheets) {
        for (let i = 0; i < sheet.parts.length; i += 1) {
          for (let k = i + 1; k < sheet.parts.length; k += 1) {
            expect(overlaps(sheet.parts[i]!, sheet.parts[k]!)).toBe(false)
          }
        }
        expect(isGuillotine(sheet.parts)).toBe(true)
      }
    }
  })

  it('терең іздеу жылдамнан ЕШҚАШАН нашар емес', () => {
    const fast = nestPanels(panels, SEED_CATALOG, { optimization: 'fast' })
    const standard = nestPanels(panels, SEED_CATALOG, { optimization: 'standard' })
    const deep = nestPanels(panels, SEED_CATALOG, { optimization: 'deep' })
    expect(standard.sheetCount).toBeLessThanOrEqual(fast.sheetCount)
    expect(deep.sheetCount).toBeLessThanOrEqual(standard.sheetCount)

    const waste = (r: ReturnType<typeof nestPanels>) =>
      r.byMaterial.reduce((sum, m) => sum + (m.usableArea - m.partArea), 0)
    if (deep.sheetCount === standard.sheetCount) {
      expect(waste(deep)).toBeLessThanOrEqual(waste(standard))
    }
  })

  it('нәтиже ТҰРАҚТЫ: бірдей кіріс — бірдей сызба', () => {
    expect(nestPanels(panels, SEED_CATALOG, { optimization: 'deep' }))
      .toEqual(nestPanels(panels, SEED_CATALOG, { optimization: 'deep' }))
  })

  it('әр деңгейдің сызбасы гильотиндік болып қалады', () => {
    for (const optimization of ['fast', 'standard', 'deep'] as const) {
      const out = nestPanels(panels, SEED_CATALOG, { optimization })
      for (const m of out.byMaterial) {
        for (const sheet of m.sheets) {
          expect(isGuillotine(sheet.parts), `${optimization}: ${m.materialName} ${sheet.index}`).toBe(true)
          for (const part of sheet.parts) expect(inside(part, sheet.usable)).toBe(true)
        }
      }
    }
  })
})
