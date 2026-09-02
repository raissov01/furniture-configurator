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
    expect(ids.size).toBe(4)
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
