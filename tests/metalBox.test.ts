/**
 * МЕТАЛЛ ЖӘШІК: LEGRABOX / TANDEMBOX / MERIVOBOX.
 *
 * Мұнда қорап ЛДСП-дан ЖИНАЛМАЙДЫ: бүйірі де, направляющасы да дайын
 * жиынтықта келеді, ал парақтан тек ТҮБІ мен АРТ ҚАБЫРҒАСЫ кесіледі.
 *
 * ⚠ САНДАРДЫҢ ДЕРЕККӨЗІ. Шегерімдер qdesign-нің раскройынан өлшенді
 * (2026-09-04, ішкі ені 868, номиналды ұзындығы 450). Төмендегі тестте сол
 * ӨЛШЕНГЕН мәндер тұр: егер біреу шегерімді өзгертсе, тест дәл сол өлшеммен
 * салыстырып, айырманы көрсетеді.
 */
import { describe, expect, it } from 'vitest'
import {
  METAL_BOX_SYSTEMS, defaultShopProfile, findMetalBoxSystem, generateCabinet,
  generateHardware, isMetalBoxSystem, metalBoxParts, nestPanels, priceProject,
  cabinetToDxfFiles, panelToDxf,
} from '../src/core/index'
import type { CabinetConfig, MetalBoxSystemId, Panel } from '../src/core/index'
import { catalog, withCabinet } from './fixtures'

const shop = defaultShopProfile()

/** qdesign өлшегендегідей корпус: ішкі ені 868, ящикке 450 мм қалады. */
const cabinet = (drawerSystem: MetalBoxSystemId, extra: Partial<CabinetConfig> = {}): CabinetConfig =>
  withCabinet({
    height: 900, width: 900, depth: 550,
    sections: [{
      id: 's1', widthMode: 'flex',
      contents: [{ kind: 'drawers', count: 2 }],
      fronts: null,
    }],
    drawerSystem,
    ...extra,
  })

const gen = (id: MetalBoxSystemId, extra = {}) => generateCabinet(cabinet(id, extra), catalog)
const role = (panels: Panel[], r: string) => panels.filter((p) => p.role === r)

describe('Blum каталогының номинал ұзындықтары және METABOX M', () => {
  it('M профильдерінде 250 жоқ, 270 пен 600 бар; TANDEMBOX 576-да 650 бар', () => {
    for (const id of ['merivobox', 'tandembox'] as const) {
      expect(METAL_BOX_SYSTEMS[id].nominalLengths).not.toContain(250)
      expect(METAL_BOX_SYSTEMS[id].nominalLengths).toContain(270)
      expect(METAL_BOX_SYSTEMS[id].nominalLengths).toContain(600)
    }
    expect(METAL_BOX_SYSTEMS.tandembox.nominalLengths).toContain(650)
  })

  it('METABOX M түбі LW−31 × NL−2, арты LW−31 × 71', () => {
    const box = METAL_BOX_SYSTEMS.metabox
    expect(box.nominalLengths).toEqual([270, 350, 400, 450, 500, 550])
    expect(metalBoxParts(box, 868, 450)).toEqual({
      bottom: { width: 837, depth: 448 }, back: { width: 837, height: 71 },
    })
    expect(box.source).toContain('Blum')
    expect(box.mountingGrid).toEqual({ firstFromFront: 37, pitch: 32 })
  })
})

describe('парақтан не кесіледі', () => {
  const panels = gen('legrabox')

  it('ағаш қораптың БҮЙІРІ де, алдыңғы қабырғасы да ЖОҚ', () => {
    expect(role(panels, 'drawerSide')).toHaveLength(0)
    expect(panels.filter((p) => p.id.endsWith('-wall-front'))).toHaveLength(0)
  })

  it('тек түбі мен арт қабырғасы', () => {
    expect(role(panels, 'drawerBottom')).toHaveLength(2)
    expect(role(panels, 'drawerBack')).toHaveLength(2)
    expect(role(panels, 'front')).toHaveLength(2)
  })

  it('детальде ҚАЙ жүйе екені жазылады — цех жиынтықты содан таниды', () => {
    expect(role(panels, 'drawerBottom')[0]!.note).toContain('LEGRABOX')
  })

  it('направляющаға присадка ЖОҚ: жиынтық өз шаблонымен бекітіледі', () => {
    const runner = panels.flatMap((p) => p.drilling).filter((d) => d.purpose === 'runner')
    expect(runner).toHaveLength(0)
  })
})

describe('өлшемдер — qdesign-нен ӨЛШЕНГЕН', () => {
  /** Ішкі ен 868, номиналды ұзындық 450 — өлшеу дәл осындай болған. */
  const expected: Record<MetalBoxSystemId, { bottom: [number, number]; back: [number, number] }> = {
    legrabox: { bottom: [833, 440], back: [830, 63] },
    tandembox: { bottom: [793, 426], back: [781, 84] },
    merivobox: { bottom: [817, 424], back: [817, 83] },
    metabox: { bottom: [837, 448], back: [837, 71] },
  }

  for (const id of Object.keys(expected) as MetalBoxSystemId[]) {
    it(`${id}: түбі мен арты өлшенгендей`, () => {
      const parts = metalBoxParts(METAL_BOX_SYSTEMS[id], 868, 450)
      expect([parts.bottom.width, parts.bottom.depth]).toEqual(expected[id].bottom)
      expect([parts.back.width, parts.back.height]).toEqual(expected[id].back)
    })
  }

  it('ГЕНЕРАЦИЯ да сол ережемен есептейді', () => {
    const system = METAL_BOX_SYSTEMS.tandembox
    const bottom = role(gen('tandembox'), 'drawerBottom')[0]!
    // Ені ішкі еннен шығады: 868 − 75.
    expect(bottom.finishedLength).toBe(868 - system.bottomWidthSub)
    // Тереңдігі — НОМИНАЛДЫ ұзындықтан: корпустың тереңдігіне қарай таңдалады.
    expect(system.nominalLengths).toContain(bottom.finishedWidth + system.bottomDepthSub)
  })

  it('арт қабырғаның биіктігін ЦЕХ өз кестесінен қоя алады', () => {
    const back = role(gen('merivobox', { metalBoxBackHeight: 115 }), 'drawerBack')[0]!
    expect(back.finishedLength).toBe(115)
    // Ені өзгермейді — ол биіктік класына тәуелді емес.
    expect(back.finishedWidth).toBe(817)
  })

  it('түбі ұяның ОРТАСЫНДА тұрады', () => {
    const panels = gen('legrabox')
    const bottom = role(panels, 'drawerBottom')[0]!
    const left = bottom.position.x
    const right = 900 - (bottom.position.x + bottom.finishedLength)
    expect(Math.abs(left - right)).toBeLessThanOrEqual(1)
  })
})

describe('смета', () => {
  it('жиынтық ящиктің САНЫМЕН түседі', () => {
    const config = cabinet('legrabox')
    const panels = generateCabinet(config, catalog)
    const price = priceProject(
      panels, nestPanels(panels, catalog), shop,
      generateHardware(config, catalog), [config.width],
    )
    const line = price.hardware.find((l) => l.id === 'box-legrabox')
    expect(line?.qty).toBe(2)
  })

  it('әр жүйенің артикулы цехтың прайсында бар', () => {
    for (const system of Object.values(METAL_BOX_SYSTEMS)) {
      expect(shop.hardware.some((h) => h.id === system.hardwareId), system.id).toBe(true)
    }
  })
})

describe('шектер мен қателер', () => {
  it('арт қабырға өз қорабының биіктігінен аспайды', () => {
    const config = cabinet('tandembox', {
      height: 720,
      sections: [{ id: 's1', widthMode: 'flex', contents: [{ kind: 'drawers', count: 3 }], fronts: null }],
      metalBoxBackHeight: 300,
    })
    expect(() => generateCabinet(config, catalog)).toThrow(/metalBoxBackHeight.*рұқсат етілген/)
  })

  it('бекіту схемасы жоқ металл жүйеге өндірістік DXF берілмейді', () => {
    const panels = gen('tandembox')
    expect(() => cabinetToDxfFiles(panels)).toThrow(/бекіту координаталары жоқ/)
    expect(() => panelToDxf(role(panels, 'drawerBottom')[0]!)).toThrow(/бекіту координаталары жоқ/)
    expect(() => panelToDxf(panels.find((panel) => panel.id === 'side-left')!)).toThrow(/бекіту координаталары жоқ/)
  })

  it('тайыз корпуста түсінікті ҚАТЕ', () => {
    expect(() => gen('legrabox', { depth: 250 })).toThrow(/направляющая/)
  })

  it('металл жүйе ағаш жолмен ІЗДЕЛМЕЙДІ', () => {
    for (const id of Object.keys(METAL_BOX_SYSTEMS)) {
      expect(isMetalBoxSystem(id)).toBe(true)
    }
    expect(isMetalBoxSystem('tandem')).toBe(false)
    expect(() => findMetalBoxSystem('tandem')).toThrow()
  })

  it('әр жүйеде дереккөзі жазулы — цех санды тексере алады', () => {
    for (const system of Object.values(METAL_BOX_SYSTEMS)) {
      expect(system.source).toMatch(/qdesign|Blum/)
    }
  })
})
