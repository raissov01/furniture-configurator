/**
 * Направляющаның ЖҮЙЕСІ.
 *
 * Бұрын ящиктің өлшемі мен тесіктері ЕКІ БӨЛЕК жерден келетін: саңылау
 * цехтың профилінен (роликтінің 13 мм-і), ал тесіктер Blum Tandem-нің
 * схемасынан. Бір қорапта екі түрлі фурнитураның өлшемі тұрғаны — сол
 * фурнитура сатып алынғанда ғана байқалатын қате.
 *
 * Ең маңыздысы: жүйе таңдалғанда қораптың тереңдігі НОМИНАЛДЫ ұзындыққа
 * түседі. Направляющая 50 мм қадаммен ғана сатылады, ал қорап оған дәл тең
 * болуы керек — qdesign бұны істемейді, ол тереңдікті «қалай шықса, солай»
 * қалдырады.
 */
import { describe, expect, it } from 'vitest'
import {
  DRAWER_SYSTEMS, defaultShopProfile, findDrawerSystem, generateCabinet,
  generateHardware, nestPanels, nominalRunnerLength, priceProject,
} from '../src/core/index'
import type { CabinetConfig, DrawerSystemId, Panel } from '../src/core/index'
import { catalog, withCabinet } from './fixtures'

const shop = defaultShopProfile()

const cabinet = (drawerSystem?: DrawerSystemId): CabinetConfig => withCabinet({
  height: 850, width: 800, depth: 500,
  sections: [{
    id: 's1', widthMode: 'flex', contents: [{ kind: 'drawers', count: 3 }], fronts: null,
  }],
  ...(drawerSystem ? { drawerSystem } : {}),
})

const gen = (id?: DrawerSystemId) => generateCabinet(cabinet(id), catalog)
const boxSide = (panels: Panel[]) => panels.find((p) => p.role === 'drawerSide')!
const runnerDrills = (panels: Panel[]) => panels
  .filter((p) => p.role === 'side').flatMap((p) => p.drilling)
  .filter((d) => d.purpose === 'runner')

describe('жүйе таңдалмаса — ЕСКІ мінез сақталады', () => {
  it('өлшем цехтың профилінен алынады', () => {
    // Бұл тест ЕСКІ жобаны күзетеді: сақталған жоба басқа деталь бермеуі керек.
    const side = boxSide(gen())
    expect(side.finishedWidth).toBe(gen().find((p) => p.role === 'drawerSide')!.finishedWidth)
    expect(runnerDrills(gen()).length).toBeGreaterThan(0)
  })
})

describe('таңдалған жүйе бәрін өзі шешеді', () => {
  it('әр жүйенің саңылауы әртүрлі → қораптың ені де әртүрлі', () => {
    /*
     * ⚠ ӨЛШЕНГЕН МӘН (qdesign, 2026-09-04): ТАНДЕМ қораптың АСТЫНДА
     * жатады, сондықтан қорап саңылауды толық дерлік алады (әр жақтан
     * 5 мм), ал роликті ЖАНЫНАН орын талап етеді (12.5). Демек тандемнің
     * қорабы КЕҢІРЕК — керісінше емес.
     */
    const width = (panels: Panel[]) => panels.find((p) => p.role === 'drawerBack')!.finishedWidth
    expect(width(gen('tandem'))).toBeGreaterThan(width(gen('roller')))
    expect(boxSide(gen('roller')).finishedWidth).toBeGreaterThan(0)
    expect(boxSide(gen('tandem')).finishedWidth).toBeGreaterThan(0)
  })

  it('қораптың тереңдігі НОМИНАЛДЫ ұзындықтан шығады', () => {
    for (const id of ['roller', 'ball', 'tandem'] as const) {
      const system = DRAWER_SYSTEMS[id]
      const depth = boxSide(gen(id)).finishedWidth
      // Тандемде қорап направляющадан 10 мм қысқа (өлшенді), қалғанында тең.
      expect(system.nominalLengths, id).toContain(depth + system.boxDepthSub)
    }
  })

  it('тесіктің схемасы да сол жүйенікі', () => {
    const tandem = runnerDrills(gen('tandem'))
    const roller = runnerDrills(gen('roller'))
    // Tandem — пилот Ø3 × 3, роликті — Ø5 × 12.
    expect(new Set(tandem.map((d) => d.diameter))).toEqual(new Set([3]))
    expect(new Set(roller.map((d) => d.diameter))).toEqual(new Set([5]))
    // Ящикке шаққанда: tandem-де 4 нүкте, роликтіде 1.
    expect(tandem.length).toBeGreaterThan(roller.length)
  })

  it('смета ДӘЛ сол направляющаны жазады', () => {
    const line = (id: DrawerSystemId) => {
      const config = cabinet(id)
      const panels = generateCabinet(config, catalog)
      const price = priceProject(
        panels, nestPanels(panels, catalog), shop,
        generateHardware(config, catalog), [config.width],
      )
      return price.hardware.find((l) => l.id === DRAWER_SYSTEMS[id].hardwareId)
    }
    for (const id of ['roller', 'ball', 'tandem'] as const) {
      // Үш ящик = үш жұп.
      expect(line(id)?.qty, id).toBe(3)
    }
  })

  it('әр артикул цехтың прайсында бар', () => {
    for (const system of Object.values(DRAWER_SYSTEMS)) {
      expect(shop.hardware.some((h) => h.id === system.hardwareId), system.id).toBe(true)
    }
  })
})

describe('номиналды ұзындық', () => {
  it('сыятын ЕҢ ҰЗЫНЫ таңдалады', () => {
    const roller = DRAWER_SYSTEMS.roller
    expect(nominalRunnerLength(roller, 460)).toBe(450)
    expect(nominalRunnerLength(roller, 450)).toBe(450)
    expect(nominalRunnerLength(roller, 449)).toBe(400)
  })

  it('ең қысқасы да сыймаса — null, ойдан ұзындық шығарылмайды', () => {
    expect(nominalRunnerLength(DRAWER_SYSTEMS.roller, 200)).toBeNull()
  })

  it('тайыз корпуста түсінікті ҚАТЕ', () => {
    // 250 мм-лік корпуста ең қысқа роликті направляющая (250 мм) да сыймайды.
    const shallow = { ...cabinet('roller'), depth: 250 }
    expect(() => generateCabinet(shallow, catalog)).toThrow(/направляющая/)
  })
})

describe('металл жәшік жүйелері', () => {
  it('әзірге АЙҚЫН қате береді — үнсіз қате өлшем бермейді', () => {
    for (const id of ['tandembox', 'legrabox', 'merivobox']) {
      expect(() => findDrawerSystem(id), id).toThrow(/металл жәшік/)
    }
  })

  it('белгісіз атау да қате', () => {
    expect(() => findDrawerSystem('нет такого')).toThrow()
  })
})
