/**
 * Аяқтар (опоры).
 *
 * Аяқтың басты қаупі — ОРНЫНЫҢ ЕКІ ЖЕРДЕ бөлек есептелуі: біреуі 3D-де,
 * екіншісі присадкада. Олар бір-бірінен жылжып кетсе, клиент 3D-де көрген
 * аяқтың бұрандасы басқа жерге бұрғыланады, ал бұл тек цехта байқалады.
 * Сондықтан мұнда ең маңызды тест — екеуінің БІР көзден шығуы.
 */
import { describe, expect, it } from 'vitest'
import {
  LEG_SPECS, defaultShopProfile, generateCabinet, generateHardware, legCentres,
  legPairsFor, nestPanels, priceProject,
} from '../src/core/index'
import type { CabinetConfig, LegType, Panel } from '../src/core/index'
import { catalog, withCabinet } from './fixtures'

const shop = defaultShopProfile()

const base = (legType?: LegType): CabinetConfig => withCabinet({
  height: 720, width: 800, depth: 500,
  sections: [{ id: 's1', widthMode: 'flex', contents: [], fronts: null }],
  base: { kind: 'legs', height: 100, ...(legType ? { legType } : {}) },
})

describe('аяқтардың орны', () => {
  it('әр 600 мм-ге бір жұп, кемінде екі жұп', () => {
    expect(legPairsFor(400)).toBe(2)
    expect(legPairsFor(600)).toBe(2)
    expect(legPairsFor(1200)).toBe(2)
    expect(legPairsFor(1201)).toBe(3)
  })

  it('3D-дегі аяқ пен присадка БІР нүктеде', () => {
    const config = base()
    const panels = generateCabinet(config, catalog)
    const bottom = panels.find((p: Panel) => p.role === 'bottom')!
    const legs = generateHardware(config, catalog).filter((h) => h.kind === 'leg')

    for (const leg of legs) {
      // Аяқтың айналасындағы төрт бұранда: дноның координатасына аударылған.
      const cx = leg.position.x - bottom.position.x
      const cy = leg.position.z - bottom.position.z
      // Бұранда аяқтың ортасынан 65/2 мм-де; кромканың шегерімі бірнеше
      // миллиметр қосады, сондықтан төзім сәл кеңірек.
      const around = bottom.drilling.filter((d) =>
        d.purpose === 'leg' && Math.abs(d.x - cx) <= 36 && Math.abs(d.y - cy) <= 36)
      expect(around, `${leg.position.x}×${leg.position.z}`).toHaveLength(4)
    }
  })

  it('ВКЛАДНОЙ дно да дұрыс: саңылау қалыңдыққа жылжымайды', () => {
    const inset = { ...base(), mounts: { bottom: 'inset' as const } }
    const overlay = { ...base(), mounts: { bottom: 'overlay' as const } }
    const legX = (c: CabinetConfig) => generateHardware(c, catalog)
      .filter((h) => h.kind === 'leg').map((h) => h.position.x)
    // Аяқ корпустың СЫРТҚЫ жиегінен саналады — дноның бекітілуіне тәуелсіз.
    expect(legX(inset)).toEqual(legX(overlay))

    const holeX = (c: CabinetConfig) => {
      const panels = generateCabinet(c, catalog)
      const bottom = panels.find((p: Panel) => p.role === 'bottom')!
      return bottom.drilling.filter((d) => d.purpose === 'leg')
        .map((d) => d.x + bottom.position.x).sort((a, b) => a - b)
    }
    expect(holeX(inset)).toEqual(holeX(overlay))
  })

  it('аяқ корпустың ІШІНДЕ тұрады, жиектен шықпайды', () => {
    for (const centre of legCentres(800, 500, 2)) {
      expect(centre.x).toBeGreaterThan(0)
      expect(centre.x).toBeLessThan(800)
      expect(centre.z).toBeGreaterThan(0)
      expect(centre.z).toBeLessThan(500)
    }
  })

  it('тым тар корпуста аяқ ҚОЙЫЛМАЙДЫ — ойдан шығарылған орын берілмейді', () => {
    expect(legCentres(120, 500, 2)).toEqual([])
    expect(legCentres(800, 150, 2)).toEqual([])
  })
})

describe('аяқтың түрі', () => {
  it('әр түр — сметада БӨЛЕК артикул', () => {
    const ids = new Set(Object.values(LEG_SPECS).map((s) => s.hardwareId))
    expect(ids.size).toBe(Object.keys(LEG_SPECS).length)
    // Ескі жоба өзгермеуі керек: цилиндр — бұрынғы артикул.
    expect(LEG_SPECS.cylinder.hardwareId).toBe('leg-100')
  })

  it('әрқайсысы цехтың прайсында бар — «баға жоқ» деп қалмайды', () => {
    for (const spec of Object.values(LEG_SPECS)) {
      expect(shop.hardware.some((h) => h.id === spec.hardwareId), spec.hardwareId).toBe(true)
    }
  })

  it('таңдалған түр сметаға сол атымен түседі', () => {
    const config = base('cone')
    const panels = generateCabinet(config, catalog)
    const price = priceProject(
      panels, nestPanels(panels, catalog), shop,
      generateHardware(config, catalog), [config.width],
    )
    expect(price.hardware.some((l) => l.id === 'leg-cone')).toBe(true)
    expect(price.hardware.some((l) => l.id === 'leg-100')).toBe(false)
  })

  it('әдепкі — цилиндр', () => {
    const legs = generateHardware(base(), catalog).filter((h) => h.kind === 'leg')
    expect(legs[0]!.legType).toBe('cylinder')
    expect(legs[0]!.hardwareId).toBe('leg-100')
  })

  it('3D үшін габариті беріледі', () => {
    const legs = generateHardware(base('square'), catalog).filter((h) => h.kind === 'leg')
    expect(legs[0]!.size).toEqual({ x: 50, y: 100, z: 50 })
  })
})

/**
 * Аяқтың ТАБАНЫ (основание) — qdesign-нің «Модуль аяқтары» терезесінен
 * алынған екінші жартысы: онда тұғыр мен табан БӨЛЕК таңдалады. Табан —
 * дноға бұранда тесіктерін беретін бөлік, сондықтан ол «көрініс» емес.
 */
describe('табаны (основание)', () => {
  const holes = (config: CabinetConfig) => generateCabinet(config, catalog)
    .find((p: Panel) => p.role === 'bottom')!.drilling.filter((d) => d.purpose === 'leg')

  it('әдепкіде дөңгелек табан — тесіктер бар', () => {
    expect(holes(base()).length).toBeGreaterThan(0)
  })

  it('ТАБАНСЫЗ аяққа тесік бұрғыланбайды', () => {
    const config = { ...base(), base: { kind: 'legs' as const, height: 100, legPlate: 'none' as const } }
    expect(holes(config)).toHaveLength(0)
    // Бірақ ҮНСІЗ емес: цех неге тесік жоқ екенін детальдің ескертпесінен оқиды.
    const bottom = generateCabinet(config, catalog).find((p: Panel) => p.role === 'bottom')!
    expect(bottom.note).toContain('без основания')
  })

  it('тесіктер арасы БАПТАЛАДЫ', () => {
    const config = {
      ...base(),
      base: { kind: 'legs' as const, height: 100, legHoleSpacing: 100 },
    }
    const xs = [...new Set(holes(config).map((d) => d.x))].sort((a, b) => a - b)
    const wide = xs[1]! - xs[0]!
    const narrow = (() => {
      const dxs = [...new Set(holes(base()).map((d) => d.x))].sort((a, b) => a - b)
      return dxs[1]! - dxs[0]!
    })()
    expect(wide).toBeGreaterThan(narrow)
    expect(wide).toBe(100)
    expect(narrow).toBe(65)
  })

  it('қадам аяқтардың САНЫН өзгертеді', () => {
    const legs = (step?: number) => generateHardware(
      { ...base(), base: { kind: 'legs', height: 100, ...(step ? { legStep: step } : {}) } },
      catalog,
    ).filter((h) => h.kind === 'leg').length
    // 800 мм корпус: 600 қадаммен 2 жұп, 400 қадаммен 2 жұп, 300-де 3 жұп.
    expect(legs()).toBe(4)
    expect(legs(300)).toBe(6)
  })

  it('табанның өлшемі 3D-ге беріледі', () => {
    const round = generateHardware(base(), catalog).find((h) => h.kind === 'leg')!
    expect(round.legPlate).toBe('round')
    expect(round.plateSize).toBe(108)

    const square = generateHardware(
      { ...base(), base: { kind: 'legs', height: 100, legPlate: 'square' } }, catalog,
    ).find((h) => h.kind === 'leg')!
    expect(square.plateSize).toBe(81)
  })
})

describe('qdesign-нің CNC экспортымен салыстыру (2026-09-02)', () => {
  /**
   * Олардың «Модуль 1» экспортында аяқтың бұрандалары дноның бетінде:
   *   x = 55.5 / 120.5 / 364.5 / 429.5   (шаршы 65, орталары 88 және 397)
   *   y = 71.5 / 136.5 / 165.5 / 230.5   (шаршы 65, орталары 104 және 198)
   * Бізде координаталар бүтінге дөңгеленеді, сондықтан ±1 мм-мен салыстырылады.
   */
  it('бір аяққа ТӨРТ бұранда, шаршысы 65 мм', () => {
    const panels = generateCabinet(base(), catalog)
    const bottom = panels.find((p: Panel) => p.role === 'bottom')!
    const legHoles = bottom.drilling.filter((d) => d.purpose === 'leg')
    expect(legHoles.length % 4).toBe(0)
    expect(new Set(legHoles.map((d) => d.diameter))).toEqual(new Set([3]))
    expect(new Set(legHoles.map((d) => d.depth))).toEqual(new Set([3]))

    const xs = [...new Set(legHoles.map((d) => d.x))].sort((a, b) => a - b)
    expect(xs[1]! - xs[0]!).toBe(65)
  })

  it('шеткі аяқтың ортасы бүйір жиектен 88 мм', () => {
    const panels = generateCabinet(base(), catalog)
    const bottom = panels.find((p: Panel) => p.role === 'bottom')!
    const xs = [...new Set(bottom.drilling.filter((d) => d.purpose === 'leg').map((d) => d.x))]
      .sort((a, b) => a - b)
    const centre = (xs[0]! + xs[1]!) / 2 + bottom.position.x
    expect(Math.abs(centre - 88)).toBeLessThanOrEqual(1)
  })
})
