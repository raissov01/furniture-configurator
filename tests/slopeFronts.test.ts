/**
 * ҚИҒАШ ТӨБЕДЕГІ фасад пен ящик.
 *
 * Мансардалық қиғашта корпустың АЛДЫҢҒЫ жиегі мен арт жиегі әртүрлі
 * биіктікте. Фасад корпустың алдында тұрады, демек оның биіктігі АЛДЫҢҒЫ
 * жиектен алынуы керек.
 *
 * ⚠ Бұрын мұнда `H` тұрған: 2000 мм корпустың алды 1200 мм болса, фасад
 * 800 мм-ге АУАДА қалып қоятын — 3D-де де, раскройда да. Цех оны кесіп
 * алғаннан кейін ғана байқайтын.
 */
import { describe, expect, it } from 'vitest'
import { generateCabinet } from '../src/core/index'
import type { CabinetConfig, Panel } from '../src/core/index'
import { CARCASS_THICKNESS as T, catalog, withCabinet } from './fixtures'

const cabinet = (extra: Partial<CabinetConfig> = {}): CabinetConfig => withCabinet({
  height: 2000, width: 600, depth: 450,
  sections: [{
    id: 's1', widthMode: 'flex', contents: [],
    fronts: { count: 2, mount: 'overlay' },
  }],
  ...extra,
})

const fronts = (config: CabinetConfig) => generateCabinet(config, catalog)
  .filter((p: Panel) => p.role === 'front')

describe('алға қарай төмендейтін төбе', () => {
  const sloped = cabinet({ slope: { towards: 'front', lowHeight: 1200 } })

  it('фасад АЛДЫҢҒЫ жиектің биіктігінде', () => {
    const height = fronts(sloped)[0]!.finishedLength
    // 1200-ден биік болмауы керек: одан жоғары корпус ЖОҚ.
    expect(height).toBeLessThanOrEqual(1200)
    // Әрі саңылаудан басқа бәрін алады.
    expect(height).toBeGreaterThan(1200 - 20)
  })

  it('қиғашсыз корпуста ӨЗГЕРМЕЙДІ', () => {
    expect(fronts(cabinet())[0]!.finishedLength).toBeGreaterThan(1900)
  })

  it('фасад корпустан ЖОҒАРЫ шықпайды', () => {
    for (const front of fronts(sloped)) {
      expect(front.position.y + front.finishedLength).toBeLessThanOrEqual(1200 + 0.001)
    }
  })
})

describe('артқа қарай төмендейтін төбе', () => {
  it('алды БИІК — фасад толық биіктікте қалады', () => {
    const back = cabinet({ slope: { towards: 'back', lowHeight: 1200 } })
    expect(fronts(back)[0]!.finishedLength).toBe(fronts(cabinet())[0]!.finishedLength)
  })
})

describe('вкладной фасад', () => {
  it('қиғашта да крышканың астына кіреді', () => {
    const inset = cabinet({
      slope: { towards: 'front', lowHeight: 1200 },
      sections: [{
        id: 's1', widthMode: 'flex', contents: [],
        fronts: { count: 1, mount: 'inset' },
      }],
    })
    const front = fronts(inset)[0]!
    // Дноның үстінен басталады (үстіне саңылау қосылады).
    expect(front.position.y).toBeGreaterThanOrEqual(T)
    expect(front.position.y + front.finishedLength).toBeLessThanOrEqual(1200 - T + 0.001)
  })
})

describe('ящик қиғаш төбеде', () => {
  it('ящиктің фасады да корпустан шықпайды', () => {
    const drawers = cabinet({
      slope: { towards: 'front', lowHeight: 1200 },
      sections: [{
        id: 's1', widthMode: 'flex',
        contents: [{ kind: 'drawers', count: 3 }],
        fronts: null,
      }],
    })
    for (const front of fronts(drawers)) {
      expect(front.position.y + front.finishedLength).toBeLessThanOrEqual(2000)
    }
  })
})
