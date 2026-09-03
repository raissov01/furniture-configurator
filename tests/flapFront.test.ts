/**
 * КӨТЕРІЛЕТІН (подъёмный) фасад.
 *
 * Бұл — «жасалмаған» деп тұрған соңғы фасад түрі еді. Оны бұғаттап тұрған
 * нәрсе — ПРИСАДКА: механизмнің түрі моделіне қарай мүлде әртүрлі
 * (Aventos HK бір чашкамен, HF екеуімен, арқандысы басқаша).
 *
 * Шешімі: детальді де, сметаны да, 3D-ні де беру, ал присадканы ҚОЙМАУ да,
 * оның себебін детальдің ескертпесінде АЙТУ. Цех көтергішті бәрібір
 * өндірушінің қағаз шаблонымен бұрғылайды.
 */
import { describe, expect, it } from 'vitest'
import {
  catalogOf, defaultShopProfile, findTemplate, generateCabinet, generateHardware,
  nestPanels, priceProject, templateToCabinet,
} from '../src/core/index'
import type { CabinetConfig, FrontOpening, Panel } from '../src/core/index'
import { catalog, withCabinet } from './fixtures'

const shop = defaultShopProfile()

const cabinet = (opening: FrontOpening, count = 1): CabinetConfig => withCabinet({
  height: 700, width: 800, depth: 350,
  sections: [{
    id: 's1', widthMode: 'flex', contents: [],
    fronts: { count, mount: 'overlay', opening },
  }],
})

const fronts = (opening: FrontOpening, count = 1) =>
  generateCabinet(cabinet(opening, count), catalog).filter((p: Panel) => p.role === 'front')

describe('деталь', () => {
  it('фасадтың ӨЛШЕМІ ілмеліден өзгермейді', () => {
    const flap = fronts('up')[0]!
    const door = fronts('left')[0]!
    expect([flap.finishedLength, flap.finishedWidth])
      .toEqual([door.finishedLength, door.finishedWidth])
  })

  it('ескертпеде себебі ЖАЗЫЛАДЫ', () => {
    expect(fronts('up')[0]!.note).toContain('шаблону')
  })
})

describe('присадка', () => {
  it('ілгектің ЧАШКАСЫ бұрғыланбайды', () => {
    expect(fronts('up')[0]!.drilling.filter((d) => d.purpose === 'hinge')).toHaveLength(0)
    expect(fronts('left')[0]!.drilling.filter((d) => d.purpose === 'hinge').length)
      .toBeGreaterThan(0)
  })

  it('БҮЙІРГЕ де ілгектің планкасы қойылмайды', () => {
    const panels = generateCabinet(cabinet('up'), catalog)
    const side = panels.find((p: Panel) => p.role === 'side')!
    expect(side.drilling.filter((d) => d.purpose === 'hinge')).toHaveLength(0)
  })

  it('ТҰТҚА бәрібір бұрғыланады — ол механизмге тәуелсіз', () => {
    // Тұтқалар ЦЕХТЫҢ профилінде тұрады, сондықтан каталог содан құралады.
    const full = catalogOf(shop)
    const base = templateToCabinet(findTemplate('wardrobe-penal-600')!, full)
    const config = {
      ...base,
      sections: [{
        id: 's1', widthMode: 'flex' as const, contents: [],
        fronts: {
          count: 1, mount: 'overlay' as const, opening: 'up' as const,
          handle: {
            handleId: 'handle-bar', boreSpacing: 128,
            position: 'top' as const, edgeOffset: 40, endOffset: 50,
          },
        },
      }],
    }
    const front = generateCabinet(config, full).find((p: Panel) => p.role === 'front')!
    expect(front.opening).toEqual({ kind: 'flap' })
    expect(front.drilling.filter((d) => d.purpose === 'handle').length).toBeGreaterThan(0)
  })
})

describe('3D', () => {
  it('фасад ЖОҒАРЫ ашылады', () => {
    expect(fronts('up')[0]!.opening).toEqual({ kind: 'flap' })
  })

  it('ілмелі фасад бұрынғыдай жанынан ашылады', () => {
    expect(fronts('left')[0]!.opening).toEqual({ kind: 'door', side: 'left' })
  })
})

describe('смета', () => {
  it('көтергіш механизм ФАСАДТЫҢ санымен түседі', () => {
    const config = cabinet('up')
    const panels = generateCabinet(config, catalog)
    const price = priceProject(
      panels, nestPanels(panels, catalog), shop,
      generateHardware(config, catalog), [config.width],
    )
    expect(price.hardware.find((l) => l.id === 'lift-flap')?.qty).toBe(1)
  })

  it('ілмелі фасадта көтергіш ЖОҚ', () => {
    const config = cabinet('left')
    const panels = generateCabinet(config, catalog)
    const price = priceProject(
      panels, nestPanels(panels, catalog), shop,
      generateHardware(config, catalog), [config.width],
    )
    expect(price.hardware.some((l) => l.id === 'lift-flap')).toBe(false)
  })

  it('артикул цехтың прайсында бар', () => {
    expect(shop.hardware.some((h) => h.id === 'lift-flap')).toBe(true)
  })
})

describe('шектеу', () => {
  it('ұяда ЕКЕУІ болмайды — иінтіректер соғылады', () => {
    expect(() => fronts('up', 2)).toThrow(/подъёмный/)
  })
})
