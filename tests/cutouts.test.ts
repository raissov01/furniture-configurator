/**
 * ОЙМА (вырез): раковина, розетка, құбыр.
 *
 * Ойма — параметрлі модельден шықпайтын, бірақ әр екінші тапсырыста
 * кездесетін нәрсе. Мұндағы басты ережелер:
 *   1. Ойма детальдің СЫРТҚЫ өлшемін өзгертпейді → раскрой оны көрмейді;
 *   2. Панельден шығып кетсе — ҚАТЕ, үнсіз қиылмайды;
 *   3. Координата таңдалған БҰРЫШТАН саналады (цех сызбаны солай оқиды).
 */
import { describe, expect, it } from 'vitest'
import {
  CUTOUT_PRESETS, SEED_CATALOG, cabinetToDxfFiles, cutoutBounds, cutoutCount,
  cutoutPerimeter, cutoutWarnings, findCutoutPreset, findTemplate, generateCabinet,
  mergeSettings, millingMetres, nestPanels, parseProject, templateToCabinet,
} from '../src/core/index'
import type { CabinetConfig, Cutout, Panel } from '../src/core/index'

const base = (): CabinetConfig => templateToCabinet(findTemplate('kitchen-base-600')!, SEED_CATALOG)

const socket = (over: Partial<Extract<Cutout, { shape: 'circle' }>> = {}): Cutout => ({
  id: 'c1', shape: 'circle', label: 'Розетка', corner: 'bottomLeft', x: 100, y: 100, diameter: 68,
  ...over,
})

const build = (cutouts: Cutout[], panelId = 'back'): Panel[] =>
  generateCabinet({ ...base(), panelCutouts: { [panelId]: cutouts } }, SEED_CATALOG)

const panelOf = (panels: Panel[], id: string) => panels.find((p) => p.id === id)!

describe('ойманың орны', () => {
  it('координата таңдалған БҰРЫШТАН саналады', () => {
    const length = 1000
    const width = 500
    const cut = { id: 'c', shape: 'rect', corner: 'bottomLeft', x: 100, y: 50, width: 200, height: 60 } as const
    expect(cutoutBounds(cut, length, width)).toEqual({ x: 100, y: 50, width: 200, height: 60 })

    // Оң жоғарғы бұрыштан — сол сан екінші жақтан саналады.
    expect(cutoutBounds({ ...cut, corner: 'topRight' }, length, width))
      .toEqual({ x: 700, y: 390, width: 200, height: 60 })
  })

  it('дөңгелекте координата ОРТАСЫНА беріледі', () => {
    const bounds = cutoutBounds(socket(), 1000, 500)
    expect(bounds).toEqual({ x: 66, y: 66, width: 68, height: 68 })
  })
})

describe('панельге жабылуы', () => {
  const panels = build([socket()])
  const back = panelOf(panels, 'back')

  it('панельде ойма пайда болады', () => {
    expect(back.cutouts).toHaveLength(1)
    expect(back.cutouts[0]).toMatchObject({ id: 'c1', shape: 'circle', diameter: 68 })
  })

  it('ойма ЕСКЕРТПЕГЕ жазылады — цех қағазда көреді', () => {
    expect(back.note).toContain('Розетка')
  })

  it('СЫРТҚЫ өлшем ӨЗГЕРМЕЙДІ', () => {
    const plain = panelOf(generateCabinet(base(), SEED_CATALOG), 'back')
    expect(back.finishedLength).toBe(plain.finishedLength)
    expect(back.cutLength).toBe(plain.cutLength)
  })

  it('раскрой оны КӨРМЕЙДІ — парақтан бәрібір тікбұрыш кесіледі', () => {
    const withCut = nestPanels(panels, SEED_CATALOG)
    const without = nestPanels(generateCabinet(base(), SEED_CATALOG), SEED_CATALOG)
    expect(withCut.sheetCount).toBe(without.sheetCount)
  })

  it('конфиг ӨЗГЕРМЕЙДІ: панельдегі ойма көшірме', () => {
    const list = [socket()]
    const made = build(list)
    panelOf(made, 'back').cutouts[0]!.x = 999
    expect(list[0]!.x).toBe(100)
  })

  it('ойма жоқ панельде тізім бос', () => {
    expect(panelOf(panels, 'side-left').cutouts).toEqual([])
  })
})

describe('тексерулер', () => {
  it('дайын өлшемдегі ойма кромкадан кейінгі рез контурынан шықпауға тиіс', () => {
    const front = generateCabinet(base(), SEED_CATALOG).find((p) => p.role === 'front')!
    expect(front.finishedLength - front.cutLength).toBeGreaterThan(0)
    const cutout: Cutout = { id: 'edge', shape: 'rect', corner: 'bottomLeft',
      x: 0, y: 100, width: 20, height: 20 }
    expect(() => build([cutout], front.id)).toThrow(/panelCutouts.*рез/)
  })
  it('панельден шығып кетсе — ҚАТЕ', () => {
    expect(() => build([socket({ x: 5000 })])).toThrow(/вырез выходит за деталь/)
    expect(() => build([socket({ x: 10 })])).toThrow(/вырез выходит за деталь/)
  })

  it('бүтін емес сан мен теріс өлшем — ҚАТЕ', () => {
    expect(() => build([socket({ x: 10.5 })])).toThrow(/бүтін сан/)
    expect(() => build([{
      id: 'r', shape: 'rect', corner: 'bottomLeft', x: 100, y: 100, width: 0, height: 50,
    }])).toThrow()
  })

  it('радиус жарты өлшемнен аспайды', () => {
    expect(() => build([{
      id: 'r', shape: 'rect', corner: 'bottomLeft', x: 100, y: 100,
      width: 100, height: 60, radius: 40,
    }])).toThrow(/0\.\.30/)
  })

  it('бірдей id ҚАТЕ береді', () => {
    expect(() => build([socket(), socket({ x: 300 })])).toThrow(/id қайталанды/)
  })
})

describe('ескертулер (қате емес)', () => {
  it('жиекке жақын ойма ескертіледі', () => {
    const panels = build([socket({ x: 40, y: 40 })])
    const warnings = cutoutWarnings(panelOf(panels, 'back'))
    expect(warnings).toHaveLength(1)
    expect(warnings[0]!.message).toMatch(/до края/)
  })

  it('қабаттасқан оймалар ескертіледі', () => {
    const panels = build([
      socket({ id: 'a', x: 200, y: 200 }),
      socket({ id: 'b', x: 230, y: 200 }),
    ])
    const warnings = cutoutWarnings(panelOf(panels, 'back'))
    expect(warnings.some((w) => w.message.includes('пересекается'))).toBe(true)
  })

  it('дұрыс орналасқан ойма ескертусіз', () => {
    const panels = build([socket({ x: 200, y: 200 })])
    expect(cutoutWarnings(panelOf(panels, 'back'))).toEqual([])
  })
})

describe('фрезаның метражы (qdesign-де жоқ)', () => {
  it('дөңгелектің периметрі — πD', () => {
    expect(cutoutPerimeter(socket())).toBeCloseTo(Math.PI * 68, 6)
  })

  it('тіктөртбұрыштың периметрі, дөңгелектелген бұрышпен', () => {
    const sharp = cutoutPerimeter({ id: 'r', shape: 'rect', corner: 'bottomLeft', x: 0, y: 0, width: 200, height: 100 })
    expect(sharp).toBe(600)
    const rounded = cutoutPerimeter({ id: 'r', shape: 'rect', corner: 'bottomLeft', x: 0, y: 0, width: 200, height: 100, radius: 10 })
    // Бұрыштар қиылған: түзу қысқарады, орнына шеңбердің төрттен бірі.
    expect(rounded).toBeCloseTo(600 - 80 + 2 * Math.PI * 10, 6)
  })

  it('жоба бойынша метраж жиналады', () => {
    const panels = build([socket({ x: 200, y: 200 })])
    expect(millingMetres(panels)).toBeCloseTo((Math.PI * 68) / 1000, 6)
    expect(millingMetres(generateCabinet(base(), SEED_CATALOG))).toBe(0)
  })
})

describe('пресеттер', () => {
  it('розетка Ø68 — еуростандарт подрозетник', () => {
    expect(findCutoutPreset('socket')).toMatchObject({ shape: 'circle', diameter: 68 })
  })

  it('әр пресеттің өлшемі толық', () => {
    for (const preset of CUTOUT_PRESETS) {
      if (preset.shape === 'circle') expect(preset.diameter).toBeGreaterThan(0)
      else {
        expect(preset.width).toBeGreaterThan(0)
        expect(preset.height).toBeGreaterThan(0)
      }
    }
  })
})

describe('экспорт пен сақтау', () => {
  it('DXF-те ойма БӨЛЕК қабатта', () => {
    // §O6: ойманың рез координатасын дұрыс шығару үшін catalog/settings керек.
    const dxf = cabinetToDxfFiles(
      build([socket({ x: 200, y: 200 })]),
      { catalog: SEED_CATALOG, settings: mergeSettings() },
    ).get('back.dxf')!
    expect(dxf).toContain('CUTOUT')
  })

  it('жоба файлында сақталады әрі қайта оқылады', () => {
    const config = { ...base(), panelCutouts: { back: [socket()] } }
    const project = {
      schemaVersion: 3 as const,
      name: 'Кухня',
      materials: SEED_CATALOG.materials,
      edgeBands: SEED_CATALOG.edgeBands,
      cabinets: [config],
      room: { width: 3000, depth: 3000, height: 2700 },
      placements: [{ cabinetId: config.id, wall: 'north' as const, offset: 0 }],
    }
    const parsed = parseProject(JSON.parse(JSON.stringify(project)))
    expect(cutoutCount(parsed.cabinets[0]!.panelCutouts)).toBe(1)
  })
})
